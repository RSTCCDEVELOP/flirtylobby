# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The plugin Showcase: loaded from a temporary copy of its folder, then used through its routes (public and admin), its system objects and its demo content."""

import pytest

"""AI chat build: the website is designed in a conversation; photo slots with an iStock search address; the user puts downloaded photos in the slots."""
import json

import pytest
from django.contrib.auth import get_user_model

from apps.core import sitecreator
from apps.core.models import SiteDesignJob


@pytest.fixture
def job(db):
    u = get_user_model().objects.create(username="boss", email="b@example.com", is_staff=True, is_superuser=True)
    return SiteDesignJob.objects.create(user=u, name="Chat", status="draft", brief={"chat": True, "name": "Chat"})


def test_photo_slots_search_istock_and_fill(job):
    from apps.medialib.models import MediaItem

    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": '<img src="img/hair-salon-interior.jpg" alt="Modern hair salon interior with chairs"><img src="img/logo.svg" alt="x">', "style.css": ".h{background:url(img/team.png)}"})
    job.refresh_from_db()
    slots = sitecreator.photo_slots(job)
    by = {s["file"]: s for s in slots}
    assert set(by) == {"hair-salon-interior.jpg", "team.png"}  # svg is made by the AI itself: no slot
    assert by["hair-salon-interior.jpg"]["url"] == "https://www.istockphoto.com/photos/modern-hair-salon-interior-with-chairs"
    assert by["team.png"]["url"].endswith("/photos/team") and not by["team.png"]["done"]
    m = MediaItem.objects.create(name="download.jpg", key="x/download.jpg", kind="image") if True else None
    job = sitecreator.set_slot(job, "team.png", m.id)
    assert {s["file"]: s["done"] for s in sitecreator.photo_slots(job)}["team.png"] is True
    assert [p["file"] for p in job.brief["photos"]] == ["team.png"]
    with pytest.raises(ValueError):
        sitecreator.set_slot(job, "bestaat-niet.jpg", m.id)
    assert sitecreator.clear_slot(job, "team.png").brief["photos"] == []


@pytest.mark.django_db
def test_rules_have_the_istock_photo_rules_only_in_chat():
    assert "istockphoto.com" in sitecreator.rules({"chat": True})
    assert "istockphoto.com" not in sitecreator.rules({})


def test_chat_asks_first_then_designs(job, monkeypatch):
    answers = iter([
        json.dumps({"reply": "Wat bieden jullie aan?", "ready": False}),
        json.dumps({"reply": "Top, ik ontwerp het nu.", "ready": True, "brief": {"name": "Kapper Zon", "kind": "company", "lang": "Dutch", "pages": "Home, Contact", "style": "warm", "extra": "kapsalon in Zwolle"}}),
    ])
    monkeypatch.setattr(sitecreator.ai, "available", lambda: True)
    monkeypatch.setattr(sitecreator, "_ask", lambda *a, **k: next(answers))
    seen = {}

    def fake_generate(pk):
        seen["brief"] = SiteDesignJob.objects.get(pk=pk).brief
        SiteDesignJob.objects.filter(pk=pk).update(status="done", files={"index.html": "<html></html>"})

    monkeypatch.setattr(sitecreator, "_generate", fake_generate)
    monkeypatch.setattr(sitecreator.threading, "Thread", lambda target, args, daemon: type("T", (), {"start": lambda self: target(*args)})())
    sitecreator.chat(job, "Ik wil een website")
    job.refresh_from_db()
    assert job.status == "done" and [m["role"] for m in job.messages] == ["user", "ai"] and not job.files
    sitecreator.chat(job, "Een kapsalon in Zwolle")
    job.refresh_from_db()
    assert job.name == "Kapper Zon" and seen["brief"]["chat"] is True and seen["brief"]["pages"] == "Home, Contact" and "kapsalon" in seen["brief"]["extra"]
    assert job.messages[-1]["text"] == "Top, ik ontwerp het nu."
    with pytest.raises(ValueError):
        sitecreator.chat(job, "  ")


@pytest.mark.django_db
def test_istock_number_makes_a_download_link(django_user_model):
    u = django_user_model.objects.create_user("istock@example.com", "istock@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="draft", name="t", brief={"chat": True}, files={"index.html": '<img src="img/hero.jpg" alt="A hero">'})
    job = sitecreator.set_istock(job, "hero.jpg", "https://www.istockphoto.com/photo/x-gm1234567890-9876")  # (not found on iStock -> only the number is kept)
    slot = sitecreator.photo_slots(job)[0]
    assert slot["istock"] == "1234567890" and slot["download"].endswith("phrase=1234567890")
    job = sitecreator.set_istock(job, "hero.jpg", "")
    assert sitecreator.photo_slots(job)[0]["download"] == ""
    with pytest.raises(ValueError):
        sitecreator.set_istock(job, "hero.jpg", "abc")


@pytest.mark.django_db
def test_istock_search_gives_number_address_and_example_and_no_double_photos(django_user_model, monkeypatch):
    u = django_user_model.objects.create_user("istock2@example.com", "istock2@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="t", brief={"chat": True}, files={"index.html": '<img src="img/a.jpg" alt="A"><img src="img/b.jpg" alt="B">'})
    hits = [{"id": "111111", "url": "https://www.istockphoto.com/photo/x-gm111111-1", "preview": "https://media.istockphoto.com/id/111111/photo/x.jpg?s=612x612", "title": "X"},
            {"id": "222222", "url": "https://www.istockphoto.com/photo/y-gm222222-2", "preview": "", "title": "Y"}]
    monkeypatch.setattr(sitecreator, "search_istock", lambda q, skip=(), video=False: [h for h in hits if h["id"] not in skip])
    job = sitecreator.find_istock(job)
    by = {x["file"]: x for x in sitecreator.photo_slots(job)}
    assert job.found == 2 and by["a.jpg"]["istock"] == "111111" and by["b.jpg"]["istock"] == "222222"
    assert by["a.jpg"]["preview"].startswith("https://media.istockphoto.com/") and by["a.jpg"]["download"].startswith("https://www.istockphoto.com/photo/")
    assert sitecreator.photo_slots(sitecreator.hide_slot(job, "a.jpg"))[0]["file"] == "b.jpg"


def test_istock_search_reads_the_results_page(monkeypatch):
    html = '<a href="/photo/office-manager-smiling-gm1496098116-518871771"></a> https://media.istockphoto.com/id/1496098116/photo/office-manager.jpg?s=612x612\\u0026w=0\\u0026k=20\\u0026c=abc='
    monkeypatch.setattr(sitecreator, "_istock_get", lambda url: (url, html))
    r = sitecreator.search_istock("office manager")
    assert r[0]["id"] == "1496098116" and "&w=0" in r[0]["preview"] and r[0]["title"] == "Office manager smiling"


@pytest.mark.django_db
def test_use_preview_puts_the_istock_example_in_the_slot(django_user_model, monkeypatch, settings, tmp_path):
    import io
    import urllib.request

    from PIL import Image

    u = django_user_model.objects.create_user("istock3@example.com", "istock3@example.com", "x")
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "grey").save(buf, "JPEG")

    class R(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=0: R(buf.getvalue()))
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="t", brief={"chat": True, "istock": {"a.jpg": {"id": "111111", "url": "https://www.istockphoto.com/photo/x-gm111111-1", "preview": "https://media.istockphoto.com/id/111111/photo/x.jpg?s=612x612", "title": "X"}}}, files={"index.html": '<img src="img/a.jpg" alt="A">'})
    job = sitecreator.use_preview(job, "a.jpg", u)
    assert [p["file"] for p in job.brief["photos"]] == ["a.jpg"] and sitecreator.photo_slots(job)[0]["done"]
    job2 = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="t", brief={"chat": True}, files={"index.html": '<img src="img/a.jpg" alt="A">'})
    with pytest.raises(ValueError):
        sitecreator.use_preview(job2, "a.jpg", u)


@pytest.mark.django_db
def test_video_slots_are_found_searched_and_filled(django_user_model, monkeypatch):
    import io
    import urllib.request

    u = django_user_model.objects.create_user("istock4@example.com", "istock4@example.com", "x")
    html = '<video src="video/office-team.mp4" autoplay muted aria-label="Team in a meeting room"></video><img src="img/a.jpg" alt="A">'
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="t", brief={"chat": True}, files={"index.html": html})
    slots = {x["file"]: x for x in sitecreator.photo_slots(job)}
    assert slots["office-team.mp4"]["kind"] == "video" and "search/2/film" in slots["office-team.mp4"]["url"] and slots["a.jpg"]["kind"] == "photo"
    seen = []
    monkeypatch.setattr(sitecreator, "search_istock", lambda q, skip=(), video=False: seen.append(video) or [{"id": "700000" if video else "600000", "url": "https://www.istockphoto.com/x", "preview": "https://media.istockphoto.com/id/1/video/x.jpg?s=640x640", "video": "https://media.istockphoto.com/id/1/video/x.mp4?s=mp4-640x640-is" if video else "", "title": "T"}])
    job = sitecreator.find_istock(job)
    assert sorted(seen) == [False, True]
    v = {x["file"]: x for x in sitecreator.photo_slots(job)}["office-team.mp4"]
    assert v["video"].endswith("is") and v["istock"] == "700000"

    class R(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=0: R(b"\x00\x00\x00\x18ftypmp42" + b"0" * 100))
    job = sitecreator.use_preview(job, "office-team.mp4", u)
    assert [p["file"] for p in job.brief["videos"]] == ["office-team.mp4"] and not job.brief.get("photos")


@pytest.mark.django_db
def test_owner_gets_a_notification_when_the_design_is_ready(django_user_model, monkeypatch):
    from apps.core import modules
    from apps.notifications.models import Notification

    monkeypatch.setattr(modules, "enabled", lambda key: True)  # (other tests may have switched modules off)

    u = django_user_model.objects.create_user("note@example.com", "note@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="Mijn site", brief={}, files={"index.html": "x"})
    sitecreator._notify_done(job.pk, "Ontwerp klaar")
    n = Notification.objects.get(user=u, kind="design")
    assert "Mijn site" in n.title and n.url == f"/dashboard/admin/siteimport?design={job.pk}"


@pytest.mark.django_db
def test_a_found_istock_photo_goes_to_a_slot_and_only_istock_addresses_count(django_user_model):
    u = django_user_model.objects.create_user("pick@example.com", "pick@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="t", brief={"chat": True}, files={"index.html": '<img src="img/a.jpg" alt="A"><video src="video/v.mp4" aria-label="V"></video>'})
    item = {"id": "123456", "url": "https://www.istockphoto.com/photo/x-gm123456-1", "preview": "https://media.istockphoto.com/id/123456/photo/x.jpg?s=612x612", "title": "X"}
    job = sitecreator.set_istock_pick(job, "a.jpg", item)
    s = {x["file"]: x for x in sitecreator.photo_slots(job)}["a.jpg"]
    assert s["istock"] == "123456" and s["preview"].startswith("https://media.istockphoto.com/")
    with pytest.raises(ValueError):
        sitecreator.set_istock_pick(job, "a.jpg", {**item, "url": "https://evil.example/x"})
    with pytest.raises(ValueError):
        sitecreator.set_istock_pick(job, "v.mp4", item)  # a photo for a video slot


@pytest.mark.django_db
def test_a_chosen_istock_photo_is_added_to_the_list_without_a_slot(django_user_model):
    u = django_user_model.objects.create_user("add@example.com", "add@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="t", brief={"chat": True}, files={"index.html": "<p>x</p>"})
    assert sitecreator.photo_slots(job) == []
    item = {"id": "123456", "url": "https://www.istockphoto.com/photo/x-gm123456-1", "preview": "https://media.istockphoto.com/id/123456/photo/x.jpg?s=612x612", "title": "Office team"}
    job = sitecreator.add_pick(job, item)
    s = sitecreator.photo_slots(job)
    assert [x["file"] for x in s] == ["istock-123456.jpg"] and s[0]["extra"] and s[0]["istock"] == "123456" and s[0]["alt"] == "Office team"
    job = sitecreator.hide_slot(job, "istock-123456.jpg")  # removed from the list
    assert sitecreator.photo_slots(job) == []
    with pytest.raises(ValueError):
        sitecreator.add_pick(job, {**item, "url": "https://evil.example/x"})


def test_screenshots_are_checked_and_get_a_small_picture_for_the_chat():
    import base64
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (900, 600), "white").save(buf, "PNG")
    good = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    shots = sitecreator.clean_shots([good, "data:text/html;base64,AAAA", "javascript:alert(1)", good, good, good])
    assert len(shots) == 3 and shots[0][0] == "image/png"  # only pictures, at most three
    thumb = sitecreator._thumbs(shots[:1])[0]
    assert thumb.startswith("data:image/jpeg;base64,")


@pytest.mark.django_db
def test_the_ai_designer_gets_components_only_rules_with_the_real_markup():
    r = sitecreator.rules({})
    assert "COMPONENTS ONLY" in r and 'data-easy2edit-tag="ui-hero-split"' in r and 'class="e2e-nav"' in r  # the exact markup is in the rules
    assert "NEVER write css for a class that starts with e2e-" in r and len(r) < 90_000


def test_the_system_writes_the_theme_on_root_and_new_colours_change_it_without_the_ai():
    ai_css = ":root{--primary:#ff0000;--bg:#000000}\n.hero-x{color:var(--primary)}\n@media (prefers-color-scheme: dark){:root{--bg:#111}}\n.e2e-x{a:b}"
    b = {"colors": {"primary": "#1d4f74", "secondary": "#2f8f7f", "bg": "#ffffff", "card": "#ffffff", "text": "#16242d"}}
    files = sitecreator.themed({"style.css": ai_css, "index.html": "<p>x</p>"}, b)
    css = files["style.css"]
    assert "--primary: #1d4f74" in css and "#ff0000" not in css and "#000000" not in css and ".hero-x" in css and "prefers-color-scheme" not in css  # the AI colours are gone, own rules stay
    again = sitecreator.themed(files, {**b, "colors": {**b["colors"], "primary": "#aa3300"}})
    assert "--primary: #aa3300" in again["style.css"] and again["style.css"].count(":root {") == 1 and ".hero-x" in again["style.css"]
    zipped = sitecreator.themed({"style.css": ai_css}, {"mode": "improve", "palette_from_zip": True})
    assert zipped["style.css"] == ai_css  # a design from a ZIP keeps its own css


@pytest.mark.django_db
def test_a_new_design_is_built_in_small_pieces_and_never_fails_on_a_long_answer(django_user_model, monkeypatch):
    u = django_user_model.objects.create_user("pieces@example.com", "pieces@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="running", name="Mijn site", brief={"name": "Mijn site", "pages": "Home, Contact", "lang": "Dutch"})
    asked, steps = [], []

    def fake(system, prompt, max_tokens=24000, pk=None, images=None):
        asked.append(max_tokens)
        if system == sitecreator.SECTION_JSON:
            return '{"brand": "Mijn", "pages": [{"file": "index.html", "title": "Home", "description": "d", "sections": [{"tag": "ui-hero-split", "id": "hero", "goal": "g"}, {"tag": "ui-faq", "id": "faq", "goal": "q"}]}, {"file": "contact.html", "title": "Contact", "description": "c", "sections": [{"tag": "ui-contact", "id": "c", "goal": "g"}]}]}'
        tag = re.search(r"Component: (ui-[a-z0-9-]+)", prompt).group(1)
        if tag == "ui-faq":
            raise ValueError("Het antwoord van de AI werd afgebroken (te lang). Probeer het nog eens.")  # too long, every time
        return f'<div data-easy2edit-tag="{tag}"><section class="e2e-section"><p>tekst {tag}</p></section></div>'

    import re

    monkeypatch.setattr(sitecreator, "_ask", fake)
    monkeypatch.setattr(sitecreator, "_set", lambda pk, **kw: steps.append(kw.get("step")) or sitecreator.SiteDesignJob.objects.filter(pk=pk).update(**{k: v for k, v in kw.items() if k in ("files", "progress", "step")}))
    files = sitecreator._generate_sections(job.pk, job)
    assert set(files) >= {"index.html", "contact.html", "style.css"} and "tekst ui-hero-split" in files["index.html"] and 'data-easy2edit-tag="ui-navbar"' in files["contact.html"]
    assert 'data-easy2edit-tag="ui-faq"' in files["index.html"]  # a part that kept being too long: the template is used, the design is never lost
    assert max(asked) <= 6000 and len(asked) > 6  # many small answers, none of them big
    assert any(s and "sectie" in s for s in steps) and "--primary:" in files["style.css"]


@pytest.mark.django_db
def test_a_change_is_planned_and_only_the_changing_parts_are_redone(django_user_model, monkeypatch):
    import re

    u = django_user_model.objects.create_user("rev@example.com", "rev@example.com", "x")
    nav = '<div data-easy2edit-tag="ui-navbar"><nav><div>menu</div></nav></div>'
    foot = '<div data-easy2edit-tag="ui-footer"><p>voet</p></div>'
    mk = lambda secs: sitecreator._page_html({"name": "X", "lang": "Dutch"}, {"title": "Home", "description": "d"}, nav, secs, foot)  # noqa: E731
    files = {"style.css": "/* x */", "index.html": mk([("hero", '<div data-easy2edit-tag="ui-hero-split"><section><h1>Oud</h1></section></div>'), ("", '<div data-easy2edit-tag="ui-faq"><p>vragen</p></div>')]), "contact.html": mk([("", '<div data-easy2edit-tag="ui-contact"><p>c</p></div>')])}
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="running", name="X", brief={"name": "X", "pages": "Home, Contact", "sectioned": True}, files=files)
    asked = []

    def fake(system, prompt, max_tokens=24000, pk=None, images=None):
        asked.append(max_tokens)
        if system == sitecreator.SECTION_JSON:
            return ('{"reply": "Ik maak de kop nieuw.", "changes": [{"op": "edit", "file": "index.html", "index": 0, "goal": "nieuwe kop"}, {"op": "add", "file": "index.html", "after": 0, "tag": "ui-cta", "goal": "bel ons"},'
                    ' {"op": "delete", "file": "index.html", "index": 2}, {"op": "menu", "goal": "voeg Blog toe"}, {"op": "theme", "colors": {"primary": "#aa3300"}}]}')
        tag = re.search(r"Component: (ui-[a-z0-9-]+)", prompt).group(1)
        return f'<div data-easy2edit-tag="{tag}"><section><h1>nieuw {tag}</h1></section></div>'

    monkeypatch.setattr(sitecreator, "_ask", fake)
    monkeypatch.setattr(sitecreator, "_set", lambda pk, **kw: None)
    out, b, reply, changes = sitecreator._revise_sections(job.pk, job, "pas de homepage aan", "index.html", None)
    idx = out["index.html"]
    assert "nieuw ui-hero-split" in idx and "nieuw ui-cta" in idx and "vragen" not in idx  # edited, added, deleted
    assert "nieuw ui-navbar" in out["contact.html"] and "nieuw ui-navbar" in idx  # the menu changed on every page
    assert "--primary: #aa3300" in sitecreator.themed(out, b)["style.css"] and reply.startswith("Ik maak")
    assert "<h1>c</h1>" not in out["contact.html"] and "<p>c</p>" in out["contact.html"] and len(asked) == 4 and max(asked) <= 6000  # an untouched part is not asked


@pytest.mark.django_db
def test_bands_with_columns_are_built_listed_and_a_column_can_be_changed(django_user_model, monkeypatch):
    import re

    u = django_user_model.objects.create_user("band@example.com", "band@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="running", name="B", brief={"name": "B", "pages": "Home", "lang": "Dutch"})

    def fake(system, prompt, max_tokens=24000, pk=None, images=None):
        if system == sitecreator.SECTION_JSON:
            return '{"brand": "B", "pages": [{"file": "index.html", "title": "Home", "description": "d", "sections": [{"layout": "band", "id": "duo", "bg": "soft", "cols": "2-1", "valign": "center", "screen": true, "cells": [{"tag": "ui-split", "goal": "a"}, {"tag": "ui-contact", "goal": "b"}]}]}]}'
        tag = re.search(r"Component: (ui-[a-z0-9-]+)", prompt).group(1)
        return f'<div data-easy2edit-tag="{tag}"><section><p>kolom {tag}</p></section></div>'

    monkeypatch.setattr(sitecreator, "_ask", fake)
    monkeypatch.setattr(sitecreator, "_set", lambda pk, **kw: None)
    files = sitecreator._generate_sections(job.pk, job)
    idx = files["index.html"]
    assert 'class="band band--soft band--screen"' in idx and 'class="cols cols-2-1 cols--center"' in idx and idx.count('<div class="col">') == 2
    assert ".cols-2-1" in files["style.css"] and "grid-template-columns: 2fr 1fr" in files["style.css"]  # the layout css is written by the system
    assert "band with columns [ui-split | ui-contact]" in sitecreator._outline(files)
    b = {"name": "B", "pages": "Home", "sectioned": True}
    j2 = sitecreator.SiteDesignJob.objects.create(user=u, status="running", name="B", brief=b, files=files)

    def fake2(system, prompt, max_tokens=24000, pk=None, images=None):
        if system == sitecreator.SECTION_JSON:
            return '{"reply": "ok", "changes": [{"op": "edit", "file": "index.html", "index": 0, "cell": 1, "goal": "nieuw"}]}'
        return '<div data-easy2edit-tag="ui-contact"><section><p>NIEUWE kolom</p></section></div>'

    monkeypatch.setattr(sitecreator, "_ask", fake2)
    out, _b, _r, _c = sitecreator._revise_sections(j2.pk, j2, "pas de rechterkolom aan", "index.html", None)
    assert "NIEUWE kolom" in out["index.html"] and "kolom ui-split" in out["index.html"] and out["index.html"].count('<div class="col">') == 2


def test_questions_of_the_designer_are_checked():
    qs = sitecreator.clean_questions([{"id": "Mode!", "q": "Licht of donker?", "type": "choice", "options": ["Licht", "Donker", "Beide"], "default": "Licht"}, {"q": "Talen?", "type": "multi", "options": ["Engels", "Duits"], "default": ["Engels"]},
                                      {"q": "Wat bied je aan?", "type": "text"}, {"q": "", "type": "text"}, {"q": "Zonder opties", "type": "choice", "options": []}])
    assert [q["type"] for q in qs] == ["choice", "multi", "text", "text"] and qs[0]["id"] == "mode" and qs[1]["default"] == ["Engels"]


@pytest.mark.django_db
def test_the_designer_looks_for_istock_photos_before_designing(django_user_model, monkeypatch):
    u = django_user_model.objects.create_user("auto@example.com", "auto@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="running", name="A", brief={"name": "A", "istock_search": True})
    monkeypatch.setattr(sitecreator, "_ask", lambda *a, **k: '{"searches": [{"query": "accountant at desk", "purpose": "hero", "kind": "photo"}, {"query": "calm office", "purpose": "hero", "kind": "video"}, {"query": "team meeting", "purpose": "team", "kind": "photo"}]}')
    monkeypatch.setattr(sitecreator, "_set", lambda pk, **kw: None)
    calls = []
    monkeypatch.setattr(sitecreator, "search_istock", lambda q, skip=(), video=False: calls.append(video) or [{"id": str(100000 + len(calls)), "url": "https://www.istockphoto.com/photo/x-gm1-1", "preview": "https://media.istockphoto.com/id/1/photo/x.jpg?s=612x612", "video": "https://media.istockphoto.com/id/1/video/x.mp4?s=mp4-640" if video else "", "title": "T"}])
    out = sitecreator.auto_photos(job.pk, job)
    files = sorted(out.brief["picked"])
    assert files == ["istock-100001.jpg", "istock-100002.mp4", "istock-100003.jpg"] and calls == [False, True, False]  # one video at most, the rest photos
    assert "PHOTOS and VIDEOS that the user already chose" in sitecreator._brief_text(out.brief)


@pytest.mark.django_db
def test_what_the_wizard_chose_is_not_overwritten_by_the_designer(django_user_model, monkeypatch):
    u = django_user_model.objects.create_user("wiz@example.com", "wiz@example.com", "x")
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="running", name="Jansen", brief={"chat": True, "name": "Jansen", "kind": "company", "pages": "Home, Contact", "color_mode": "dark", "colors": {"primary": "#123456"}, "istock_search": False, "locked": ["name", "kind", "pages", "istock_search"]})
    answer = ('{"reply": "Top!", "ready": true, "questions": [], "brief": {"name": "Andere naam", "kind": "shop", "lang": "Dutch", "pages": "Home, Winkel, Over", "style": "rustig", "extra": "meer", '
              '"colors": {"primary": "#ff0000"}, "color_mode": "light", "istock_search": true}}')
    seen = {}
    monkeypatch.setattr(sitecreator, "_ask", lambda *a, **k: answer)
    monkeypatch.setattr(sitecreator, "_generate", lambda pk: seen.update(b=sitecreator.SiteDesignJob.objects.get(pk=pk).brief))
    sitecreator._chat(job.pk, "Maak een website", False)
    b = seen["b"]
    assert b["name"] == "Jansen" and b["kind"] == "company" and b["pages"] == "Home, Contact" and b["color_mode"] == "dark" and b["colors"]["primary"] == "#123456" and b["istock_search"] is False  # the wizard wins
    assert b["lang"] == "Dutch" and b["style"] == "rustig"  # what was not chosen is filled by the designer


@pytest.mark.django_db
def test_layout_wishes_are_kept_and_given_to_the_designer():
    from apps.core import sitecreator as sc
    b = sc.clean_brief({"layouts": ["split", "bogus", "rhythm"], "locked": ["layouts"]}, {})
    assert b["layouts"] == ["split", "rhythm"] and "layouts" in b["locked"]
    text = sc._brief_text({**b, "name": "X"})
    assert "LAYOUT wishes" in text and "two equal columns" in text


@pytest.mark.django_db
def test_maximum_width_is_written_by_the_system():
    from apps.core import sitecreator as sc
    assert sc.clean_brief({"max_width": 1280}, {})["max_width"] == 1280
    assert sc.clean_brief({"max_width": 777}, {})["max_width"] == 1100
    files = sc.themed({"style.css": ".container{max-width:1100px}"}, {"max_width": 1440})
    assert "max-width: 1440px" in files["style.css"] and "__MAXW__" not in files["style.css"]
    assert "max-width: none" in sc.themed({"style.css": "a{}"}, {"max_width": 0})["style.css"]


@pytest.mark.django_db
def test_theme_library_lists_themes_that_are_not_installed_and_apply_installs_and_swaps(tmp_path, settings):
    from apps.core import sitecreator as sc
    from apps.core import themepacks
    from apps.core.models import SiteDesignJob
    from django.contrib.auth import get_user_model

    lib = sc.theme_library()
    keys = {t["key"]: t for t in lib}
    assert keys and all(t.get("colors", {}).get("primary") for t in lib)
    todo = [t["key"] for t in lib if not t["installed"]][:2]
    if len(todo) < 2:
        pytest.skip("the library has no two themes that are not installed")
    u = get_user_model().objects.create_user("th", "th@example.com", "x", is_staff=True)
    job = SiteDesignJob.objects.create(user=u, name="t", status="draft", brief={"chat": True})
    job = sc.apply_theme(job, todo[0], u)
    assert themepacks.manifest_of(todo[0]) and job.brief["theme_installed"] == todo[0] and job.brief["colors"]["primary"]
    job = sc.apply_theme(job, todo[1], u)
    assert themepacks.manifest_of(todo[1]) and not themepacks.manifest_of(todo[0]) and job.brief["theme_installed"] == todo[1]
    themepacks.remove(todo[1])


@pytest.mark.django_db
def test_own_logo_photo_and_video_go_in_the_project_and_the_prompt():
    from apps.core import sitecreator as sc
    from apps.core.models import SiteDesignJob
    from apps.medialib.models import MediaItem
    from django.contrib.auth import get_user_model

    u = get_user_model().objects.create_user("own", "own@example.com", "x", is_staff=True)
    job = SiteDesignJob.objects.create(user=u, name="t", status="draft", brief={"chat": True, "name": "X"})
    logo = MediaItem.objects.create(key="design/logo1.png", name="Mijn logo.png", kind="image")
    logo2 = MediaItem.objects.create(key="design/logo2.png", name="Nieuw logo.png", kind="image")
    vid = MediaItem.objects.create(key="design/film.mp4", name="Film.mp4", kind="video")
    job = sc.add_own_media(job, logo.id, "logo")
    job = sc.add_own_media(job, logo2.id, "logo")
    job = sc.add_own_media(job, vid.id)
    assert [p["file"] for p in job.brief["photos"]] == ["logo.png"] and job.brief["photos"][0]["id"] == logo2.id  # one logo
    assert job.brief["videos"][0]["file"] == "film.mp4"
    text = sc._brief_text(job.brief)
    assert "LOGO of the company" in text and "VIDEOS the user uploaded" in text
    job = sc.remove_own_media(job, "film.mp4")
    assert not job.brief["videos"]


@pytest.mark.django_db
def test_one_pager_is_told_to_the_designer():
    from apps.core import sitecreator as sc
    text = sc._brief_text({"name": "X", "pages": "Home"})
    assert "ONE PAGER" in text
    assert "ONE PAGER" not in sc._brief_text({"name": "X", "pages": "Home, Contact"})


@pytest.mark.django_db
def test_search_terms_come_from_the_ai_and_are_cleaned(monkeypatch):
    from apps.core import sitecreator as sc
    monkeypatch.setattr(sc.ai, "available", lambda: True)
    monkeypatch.setattr(sc.ai, "claude", lambda *a, **k: 'ok {"terms": ["accountant at desk", "  ", 5, "tax documents calculator"]}')
    assert sc.search_terms("Bue", "boekhouding voor het MKB") == ["accountant at desk", "tax documents calculator"]
    assert sc.search_terms("", "") == []
    monkeypatch.setattr(sc.ai, "available", lambda: False)
    assert sc.search_terms("Bue", "boekhouding voor het MKB") == []
