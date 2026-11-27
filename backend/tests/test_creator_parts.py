# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The + of the chat of the creator: the customer adds components, system objects and widgets. They are kept in the brief, reach the designer and the plan, and are in the result."""
import pytest

from apps.core import componentpacks, sitecreator as sc


def _tags():
    return {c["easy2edit_tag"] for c in componentpacks.get(None)["components"]}


@pytest.mark.django_db
def test_chosen_components_are_kept_only_when_they_are_in_the_set():
    b = sc.clean_brief({"components": ["ui-pricing", "ui-does-not-exist", "ui-faq", "ui-pricing"]}, {})
    assert b["components"] == ["ui-pricing", "ui-faq"]  # an unknown tag and a double are dropped


@pytest.mark.django_db
def test_the_catalogue_lists_the_components_for_the_picker():
    comps = sc.catalog()["components"]
    assert comps and {"tag", "name", "category", "description"} <= set(comps[0])
    assert {c["tag"] for c in comps} <= _tags()


@pytest.mark.django_db
def test_the_designer_gets_the_chosen_parts_in_the_brief_and_in_the_chat():
    b = {"name": "X", "components": ["ui-pricing"]}
    assert "ui-pricing" in sc._brief_text(b) and "mandatory" in sc._brief_text(b)
    assert "ui-pricing" in sc.parts_text(b) and "do not ask about them" in sc.parts_text(b)
    assert sc.parts_text({}) == ""


def test_a_part_that_the_planner_left_out_is_added_before_the_closing_section():
    pages = [{"file": "index.html", "title": "x", "sections": [{"tag": "ui-hero-split", "id": "hero"}, {"tag": "ui-features", "id": "f"}, {"tag": "ui-cta", "id": "cta"}]}]
    sc._ensure_chosen(pages, {"components": ["ui-pricing", "ui-features"], "objects": ["widget-countdown"]}, {"ui-pricing", "ui-features", "ui-cta", "ui-hero-split"}, {"widget-countdown"})
    got = [(x.get("tag"), x.get("sysobject")) for x in pages[0]["sections"]]
    assert ("ui-pricing", "") in got and (None, "widget-countdown") in got  # added
    assert got.count(("ui-features", None)) == 1  # already planned: not twice
    assert got[-1] == ("ui-cta", None) and got[0][0] == "ui-hero-split"  # the opening first, the closing last


def test_parts_that_are_unknown_are_not_invented():
    pages = [{"file": "index.html", "title": "x", "sections": [{"tag": "ui-hero-split", "id": "hero"}]}]
    sc._ensure_chosen(pages, {"components": ["ui-nope"], "objects": ["media-nope"]}, {"ui-hero-split"}, set())
    assert len(pages[0]["sections"]) == 1


@pytest.mark.django_db
def test_adding_a_widget_to_an_existing_design_installs_it(django_user_model, monkeypatch):
    from apps.core.models import SiteDesignJob

    u = django_user_model.objects.create_user("pp", "pp@x.nl", "pw12345678!", is_staff=True)
    job = SiteDesignJob.objects.create(user=u, name="D", status="done", brief={"name": "D"}, files={"index.html": "<html></html>"})
    seen = []
    monkeypatch.setattr(sc, "_install_chosen_widgets", lambda b: seen.append(list(b.get("objects") or [])))
    slug = next(o["slug"] for o in sc.catalog()["objects"] if o["kind"] == "widget")
    sc.save(job, {"objects": [slug]})
    assert seen == [[slug]]
    fresh = SiteDesignJob.objects.create(user=u, name="E", status="draft", brief={"name": "E"})
    sc.save(fresh, {"objects": [slug]})
    assert seen == [[slug]]  # no design yet: installed when the design is made


@pytest.mark.django_db
def test_redesign_makes_a_new_design_from_the_current_data_and_keeps_the_old_one(django_user_model, monkeypatch):
    from apps.core.models import SiteDesignJob

    u = django_user_model.objects.create_user("rd", "rd@x.nl", "pw12345678!", is_staff=True)
    old = {"index.html": "<html>old</html>"}
    job = SiteDesignJob.objects.create(user=u, name="D", status="done", brief={"name": "D", "direction": "editorial", "improve_now": True, "focus": "x", "colors": {"primary": "#112233"}}, files=old, messages=[{"role": "user", "text": "hi"}])
    monkeypatch.setattr(sc.ai, "available", lambda *a, **k: True)
    spawned = []
    monkeypatch.setattr(sc, "_spawn", lambda fn, pk: spawned.append(pk))
    sc.generate(job, redo=True)
    job.refresh_from_db()
    assert spawned == [job.pk] and job.status == "running"
    assert job.files_prev == old  # the way back
    assert "direction" not in job.brief and "improve_now" not in job.brief and job.brief["colors"] == {"primary": "#112233"}  # a new direction, the data stay
    assert job.messages == [{"role": "user", "text": "hi"}]  # the conversation stays


@pytest.mark.django_db
def test_redesign_keeps_the_style_that_the_customer_chose_and_needs_a_design(django_user_model, monkeypatch):
    from apps.core.models import SiteDesignJob

    u = django_user_model.objects.create_user("rd2", "rd2@x.nl", "pw12345678!", is_staff=True)
    monkeypatch.setattr(sc.ai, "available", lambda *a, **k: True)
    monkeypatch.setattr(sc, "_spawn", lambda fn, pk: None)
    empty = SiteDesignJob.objects.create(user=u, name="E", status="draft", brief={"name": "E"})
    with pytest.raises(ValueError):
        sc.generate(empty, redo=True)  # nothing to make again
    job = SiteDesignJob.objects.create(user=u, name="F", status="done", brief={"name": "F", "hero_style": "editorial", "direction": "editorial"}, files={"index.html": "x"})
    sc.generate(job, redo=True)
    job.refresh_from_db()
    assert job.brief["direction"] == "editorial"  # the customer chose a style: it stays


def test_a_system_object_is_placed_once_and_a_page_gets_one_slider():
    pages = [{"file": "index.html", "title": "x", "sections": [
        {"tag": "ui-hero-split", "id": "hero"},
        {"tag": None, "sysobject": "media-demo-beeldcarrousel", "id": "a"},
        {"tag": None, "sysobject": "media-demo-diavoorstelling", "id": "b"},  # a second slider that nobody asked for
        {"tag": None, "sysobject": "media-demo-beeldcarrousel", "id": "c"},  # the same one twice
        {"layout": "band", "id": "band", "cells": [{"tag": None, "sysobject": "widget-clock"}, {"tag": None, "sysobject": "widget-clock"}]},
        {"tag": "ui-cta", "id": "cta"},
    ]}]
    sc._dedupe_objects(pages, {"objects": []})
    ids = [x["id"] for x in pages[0]["sections"]]
    assert ids == ["hero", "a", "band", "cta"]
    assert len(pages[0]["sections"][2]["cells"]) == 1


def test_a_page_gets_one_slider_even_when_the_customer_chose_two():
    pages = [{"file": "index.html", "title": "x", "sections": [{"tag": None, "sysobject": "media-a", "id": "a"}, {"tag": None, "sysobject": "media-b", "id": "b"}, {"tag": None, "sysobject": "widget-clock", "id": "c"}]}]
    sc._dedupe_objects(pages, {"objects": ["media-a", "media-b"]})
    assert [x["id"] for x in pages[0]["sections"]] == ["a", "c"]  # one slider, the widget stays


def test_a_design_that_exists_keeps_one_slider_per_page():
    sec = lambda body: f'<div class="container">{body}</div>'  # noqa: E731
    page = ("<html><body><header>h</header><main>"
            + sec('<div data-sysobject="media-demo-beeldcarrousel"></div>')
            + '<div data-easy2edit-tag="ui-features"><p>f</p></div>'
            + sec('<div data-sysobject="media-demo-diavoorstelling"></div>')
            + "</main><footer>f</footer></body></html>")
    out = sc._one_slider_per_page({"index.html": page, "style.css": "x"})
    assert out["index.html"].count("data-sysobject") == 1 and "media-demo-beeldcarrousel" in out["index.html"] and "ui-features" in out["index.html"]
    assert out["style.css"] == "x"


@pytest.mark.django_db
def test_only_free_plugins_can_be_chosen_and_a_plugin_that_is_off_is_installed_and_switched_on(monkeypatch):
    lib = [{"name": "gratis", "title": "Gratis", "description": "", "installed": False, "active": False, "price": 0.0, "free": True},
           {"name": "betaald", "title": "Betaald", "description": "", "installed": False, "active": False, "price": 9.0, "free": False}]
    monkeypatch.setattr(sc, "library_plugins", lambda: lib)
    b = sc.clean_brief({"plugins_use": ["gratis", "betaald", "onbekend", "gratis"]}, {})
    assert b["plugins_use"] == ["gratis"]  # a paid and an unknown plugin never get in

    from apps.plugins import installer
    from apps.plugins.models import Plugin

    done = {"installed": [], "on": []}

    def fake_install(name):
        Plugin.objects.create(name=name, title=name, enabled=False)
        done["installed"].append(name)
        return True

    monkeypatch.setattr(installer, "install_from_library", fake_install)
    import apps.plugins.switch as sw

    monkeypatch.setattr(sw, "set_enabled", lambda p, want, with_requires=False: done["on"].append((p.name, want)))
    assert sc._install_chosen_plugins({"plugins_use": ["gratis", "betaald"]}) == ["gratis"]
    assert done == {"installed": ["gratis"], "on": [("gratis", True)]}  # a paid plugin is never touched


@pytest.mark.django_db
def test_the_designer_hears_about_the_chosen_plugins():
    b = {"name": "X", "plugins_use": ["agenda"]}
    assert "agenda" in sc._brief_text(b) and "free" in sc._brief_text(b)
    assert "plugin agenda" in sc.parts_text(b)


@pytest.mark.django_db
def test_parts_can_be_taken_out_of_a_page_and_the_old_design_is_kept(django_user_model):
    from apps.core.models import SiteDesignJob

    u = django_user_model.objects.create_user("ds", "ds@x.nl", "pw12345678!", is_staff=True)
    page = ('<html><body><header>h</header><main>'
            '<div id="a"><p>één</p></div><div id="b"><p>twee</p></div><div id="c"><p>drie</p></div>'
            '</main><footer>f</footer></body></html>')
    job = SiteDesignJob.objects.create(user=u, name="D", status="done", brief={"name": "D"}, files={"index.html": page, "style.css": "x"})
    n = len(sc._main_parts(page)[1])
    assert n == 3
    job = sc.delete_sections(job, "index.html", [1])
    html = job.files["index.html"]
    assert "twee" not in html and "één" in html and "drie" in html and job.files["style.css"] == "x"
    assert job.files_prev["index.html"] == page  # the way back
    with pytest.raises(ValueError):
        sc.delete_sections(job, "index.html", [9])  # a part that does not exist
    with pytest.raises(ValueError):
        sc.delete_sections(job, "index.html", [0, 1])  # a page keeps at least one part
    with pytest.raises(ValueError):
        sc.delete_sections(job, "style.css", [0])  # not a page of parts
