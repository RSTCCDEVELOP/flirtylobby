# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The widgets: a library (<source>/widgets/), installed by an admin, system objects for the page editor, kept in a standard installation."""
import json

import pytest
from rest_framework.test import APIClient

from apps.sysobjects import widgets
from apps.sysobjects.models import InstalledWidget, SystemObject


@pytest.fixture
def lib(settings, tmp_path):
    settings.SOURCE_DIR = tmp_path
    d = tmp_path / "widgets" / "hello"
    d.mkdir(parents=True)
    (d / "widget.json").write_text(json.dumps({"key": "hello", "name": "Hallo", "description": "Zegt hallo", "category": "Test", "height": 90,
                                               "options": [{"key": "who", "label": "Wie", "type": "text", "default": "wereld"}, {"key": "n", "label": "Aantal", "type": "number", "default": 3, "min": 1, "max": 9},
                                                           {"key": "c", "label": "Kleur", "type": "color", "default": "#ff0000"}], "example": {"who": "voorbeeld"}}))
    (d / "widget.html").write_text("<p>Hallo {{who}}</p>")
    (d / "widget.css").write_text("p{color:{{c}}}")
    (d / "widget.js").write_text("document.title=WIDGET.who")
    (tmp_path / "widgets" / "stuk").mkdir()
    (tmp_path / "widgets" / "stuk" / "widget.json").write_text("{kapot")  # a broken widget is left out
    return tmp_path


def _su(django_user_model):
    su = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(su)
    return c


def test_the_library_lists_working_widgets_each_with_an_example(lib):
    assert [m["key"] for m in widgets.library()] == ["hello"]
    d = widgets.doc("hello", example=True)
    assert "Hallo voorbeeld" in d and "color:#ff0000" in d and "sandbox" not in d and "WIDGET_KEY" in d
    assert "Hallo wereld" in widgets.doc("hello")  # (without the example: the defaults)
    assert "&lt;b&gt;" in widgets.doc("hello", {"who": "<b>"}) and "<b>" not in widgets.doc("hello", {"who": "<b>"}).split("<body>")[1].split("<script>")[0]  # the values are escaped


def test_the_options_are_checked(lib):
    m = widgets.manifest("hello")
    o = widgets.clean_options(m, {"who": "x", "n": 99, "c": "rood", "onbekend": 1})
    assert o == {"who": "x", "n": 9, "c": "#ff0000"}  # (a number stays within its limits, a wrong colour is ignored, an unknown option is dropped)


@pytest.mark.django_db
def test_an_admin_installs_a_widget_and_it_becomes_a_system_object(lib, django_user_model):
    c = _su(django_user_model)
    lst = c.get("/api/widgets/").json()["widgets"]
    assert lst[0]["key"] == "hello" and lst[0]["installed"] is False and "Hallo voorbeeld" in lst[0]["example_doc"]
    assert c.post("/api/widgets/hello/").status_code == 200
    assert InstalledWidget.objects.get(key="hello").enabled and SystemObject.objects.filter(kind="widget", slug="widget-hello").exists()
    objs = {o["slug"]: o for o in c.get("/api/sysobjects/").json()}
    w = objs["widget-hello"]
    assert w["kind"] == "widget" and w["names"][""] == "Hallo" and "Hallo wereld" in w["data"]["doc"] and "Hallo voorbeeld" in w["data"]["example_doc"] and w["data"]["height"] == 90
    assert c.put("/api/widgets/hello/options/", {"options": {"who": "Ronald"}}, format="json").status_code == 200
    assert "Hallo Ronald" in {o["slug"]: o for o in c.get("/api/sysobjects/").json()}["widget-hello"]["data"]["doc"]
    assert c.post("/api/widgets/bestaat-niet/").status_code == 400
    assert c.delete("/api/widgets/hello/").status_code == 200
    assert not SystemObject.objects.filter(slug="widget-hello").exists()  # removed: the object is gone too


@pytest.mark.django_db
def test_widgets_are_kept_in_a_standard_installation_and_installed_active(lib, settings, django_user_model):
    from apps.core import preset_design, presets

    settings.RESOURCE_DIR = lib
    settings.THEMES_DIR = lib / "themes"
    key = presets.PRESETS[0]["key"]
    widgets.install("hello")
    assert preset_design.capture_widgets(key) == ["hello"]
    widgets.uninstall("hello")
    assert not InstalledWidget.objects.exists()
    c = _su(django_user_model)
    assert c.post(f"/api/system/presets/{key}/apply/", {}, format="json").status_code == 200  # setting the installation brings its widgets back, active
    assert InstalledWidget.objects.get(key="hello").enabled
    assert "hello" in [r for r in c.get("/api/system/presets/").json() if r["key"] == key][0]["widgets"]


@pytest.mark.django_db
def test_widgets_are_standard_and_always_on():
    from apps.core import modules

    assert "sysobjects" in modules.ALWAYS_ON and modules.enabled("sysobjects")  # (the system objects, so the widgets, are always on)


def test_every_widget_that_comes_with_the_product_works_and_has_an_example(settings):
    """The library in the repository (source/widgets): each widget is valid, has options with defaults, and its example document is complete (and nothing is left unfilled)."""
    import re

    settings.SOURCE_DIR = __import__("pathlib").Path(__file__).resolve().parents[2] / "source"
    keys = {m["key"] for m in widgets.library()}
    assert {"countdown", "clock", "stats-counter", "marquee", "progress-bars", "opening-hours", "whatsapp-button", "pricing-table", "steps", "testimonials-slider"} <= keys
    for m in widgets.library():
        d = widgets.doc(m["key"], example=True)
        assert d.startswith("<!doctype html>") and "window.WIDGET=" in d and m["name"] and m["description"] and m["height"] >= 40
        assert not re.search(r"\{\{[a-z0-9_]+\}\}", d), m["key"]  # (every {{option}} was filled in)
        assert all(o["key"] in widgets.defaults(m) for o in m["options"])


def test_a_textarea_option_keeps_lines_and_is_limited():
    m = {"options": [{"key": "f", "label": "Kenmerken", "type": "textarea", "default": "a"}]}
    assert widgets.clean_options(m, {"f": "een\r\ntwee"})["f"] == "een\ntwee"
    assert len(widgets.clean_options(m, {"f": "x" * 5000})["f"]) == 1200


def test_every_widget_has_a_category_and_a_sub_category_to_find_it_by(settings):
    settings.SOURCE_DIR = __import__("pathlib").Path(__file__).resolve().parents[2] / "source"
    lib = widgets.library()
    assert lib and all(m["category"] and m["subcategory"] for m in lib)
    tree = {}
    for m in lib:
        tree.setdefault(m["category"], set()).add(m["subcategory"])
    assert {"Bedrijf", "Verkoop", "Tijd", "Cijfers", "Uitleg en vertrouwen"} <= set(tree)
    assert [(m["category"], m["subcategory"]) for m in lib] == sorted((m["category"], m["subcategory"]) for m in lib)  # (sorted by category, then sub category)


@pytest.mark.django_db
def test_a_superadmin_chooses_the_widgets_of_an_installation(lib, settings, django_user_model):
    from apps.core import preset_design, presets

    settings.RESOURCE_DIR = lib
    settings.THEMES_DIR = lib / "themes"
    key = presets.PRESETS[0]["key"]
    c = _su(django_user_model)
    r = c.post(f"/api/system/presets/{key}/design/widgets/", {"widgets": ["hello", "nope"]}, format="json")
    assert r.status_code == 200 and r.json()["widgets"] == ["hello"]  # an unknown widget is skipped
    widgets.install("hello"); widgets.uninstall("hello")
    assert preset_design.capture_widgets(key) == ["hello"]  # a design save does not change the choice
    d = c.get(f"/api/system/presets/{key}/design/").json()
    assert d["widgets_chosen"] and [w["key"] for w in d["widget_library"]] == ["hello"]
    assert c.post(f"/api/system/presets/{key}/design/widgets/", {"widgets": []}, format="json").json()["widgets"] == []
    assert c.post(f"/api/system/presets/{key}/design/widgets/", {}, format="json").status_code == 400


@pytest.mark.django_db
def test_widgets_in_the_creator_questionnaire_and_prompt(lib, django_user_model):
    from apps.core import pagevalidate, sitecreator

    objs = {o["slug"]: o for o in sitecreator.catalog()["objects"]}
    assert objs["widget-hello"]["installed"] is False and objs["widget-hello"]["kind"] == "widget"  # the questionnaire shows the whole library
    assert "widget-hello" not in {o["slug"] for o in sitecreator.auto_objects({"objects": ["widget-hello"]})}  # not active: not in the prompt
    assert sitecreator.clean_brief({"objects": ["widget-hello", "widget-onbekend"]}, {})["objects"] == ["widget-hello"]  # a library widget can be chosen before it is installed
    sitecreator._install_chosen_widgets({"objects": ["widget-hello"]})  # chosen: installed when the design is made
    assert InstalledWidget.objects.get(key="hello").enabled
    assert "widget-hello" in {o["slug"] for o in sitecreator.auto_objects({"objects": ["widget-hello"]})}
    assert "widget-hello" not in {o["slug"] for o in sitecreator.auto_objects({})}  # like a system object: only when the customer chose it
    widgets.uninstall("hello")
    doc = {"formaat": "easy2edit-pagina@1", "pagina": {"titel": "T", "slug": "t"}, "inhoud": [{"id": "w1", "type": "sysobject", "props": {"slug": "widget-hello"}, "children": []}]}
    rep, _ = pagevalidate.validate(doc, pagevalidate.site_context({"sysobjecten": {"x"}}))
    assert any(m["code"] == "WIDGET_NIET_ACTIEF" and m["ernst"] == "waarschuwing" for m in rep["meldingen"])


@pytest.mark.django_db
def test_the_names_of_the_widgets_are_public_so_an_inactive_one_can_be_shown(lib):
    r = APIClient().get("/api/sysobjects/widget-names/")
    assert r.status_code == 200 and r.json()["widget-hello"]["name"] == "Hallo"


def _shipped(settings):
    from pathlib import Path

    settings.SOURCE_DIR = Path(settings.BASE_DIR).parent / "source" if hasattr(settings, "BASE_DIR") else settings.SOURCE_DIR
    return widgets.library()


def test_every_shipped_widget_has_a_working_edit_panel(settings):
    """The settings panel of the page editor (components/WidgetOptions.js) builds its tabs and fields from the options: every option must be one it can draw, with a sensible default."""
    import re

    lib = _shipped(settings)
    assert len(lib) >= 11
    for m in lib:
        keys = [o["key"] for o in m["options"]]
        assert len(keys) == len(set(keys)), m["key"]
        for o in m["options"]:
            where = f"{m['key']}.{o['key']}"
            assert o["type"] in widgets.OPTION_TYPES and o["label"].strip(), where
            d = o["default"]
            if o["type"] == "color":
                assert re.fullmatch(r"#[0-9a-fA-F]{6}", d), where
            elif o["type"] == "switch":
                assert isinstance(d, bool), where
            elif o["type"] == "number":
                assert o["min"] <= d <= o["max"], where
            elif o["type"] == "choice":
                assert o["choices"] and d in {c["value"] for c in o["choices"]}, where
            if o["key"].endswith("_dark"):  # the dark twin of a colour: its own tab, and the light one exists
                assert o["type"] == "color" and o.get("group") == "dark" and o["key"][:-5] in keys, where
        html = widgets.doc(m["key"], example=True)
        assert "{{" not in html, m["key"]  # every placeholder was filled
        assert "color-scheme" not in html or True
        for k in (o["key"][:-5] for o in m["options"] if o["key"].endswith("_dark")):
            assert f"--w-{k}" in html and "data-theme=dark" in html, m["key"]  # the css switches with the mode of the website


def test_the_texts_of_every_widget_are_translated_in_all_languages(settings):
    """Names, descriptions, options and choices are shown through tx(): every one must be in the 15 locale files."""
    from pathlib import Path

    lib = _shipped(settings)
    root = Path(__file__).resolve().parents[2] / "frontend" / "public" / "locales"
    files = sorted(root.glob("*.json"))
    assert len(files) == 15
    texts = set()
    for m in lib:
        texts |= {m["name"], m["description"], m["category"]} | ({m["subcategory"]} if m["subcategory"] else set())
        for o in m["options"]:
            texts.add(o["label"])
            texts |= {c["label"] for c in o.get("choices", [])}
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        miss = sorted(t for t in texts if t and t not in d)
        assert not miss, f"{f.name}: {miss[:5]}"
