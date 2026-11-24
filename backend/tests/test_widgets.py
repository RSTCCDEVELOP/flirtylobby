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
