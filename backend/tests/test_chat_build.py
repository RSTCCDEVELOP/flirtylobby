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
    assert job.status == "done" and [m["role"] for m in job.messages] == ["user", "ai"] and not job.files and job.messages[-1]["ask"] == "prefill"  # first the customer is asked (no AI call yet)
    sitecreator.answer_prefill(job, False)  # "no": he fills the questions in himself
    job.refresh_from_db()
    assert job.status == "done" and [m["role"] for m in job.messages] == ["user", "ai", "ai"] and job.brief["prefill"] is False and job.messages[1]["answered"] == "nee"
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
    assert len(shots) == 4 and shots[0][0] == "image/png"  # only pictures (a web page and a script are left out)
    assert len(sitecreator.clean_shots([good] * 9)) == 6  # at most six, like the chat of the creator says (Er kunnen maximaal 6 afbeeldingen bij één bericht)
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
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="running", name="X", brief={"name": "X", "pages": "Home, Contact", "sectioned": True, "props_mode": False}, files=files)  # (this test answers with html: the html way)
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


def test_design_export_and_import_json(job):
    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": "<h1>Hoi</h1>"}, status="done", messages=[{"role": "ai", "text": "Vragen", "questions": [{"id": "name", "q": "Naam?", "type": "text", "options": []}], "answers": {"ans": {"name": "Blue"}, "own": {}}}])
    job.refresh_from_db()
    data = json.loads(json.dumps(sitecreator.export_job(job)))
    assert data["format"] == "easy2edit-design" and "files" not in data["design"]
    assert data["render"]["files"]["index.html"] == "<h1>Hoi</h1>" and data["render"]["pages"][0]["file"] == "index.html"  # the made pages: a section of their own
    got, info = sitecreator.import_job(job.user, data)  # the same id exists: the user is asked
    assert got is None and info["exists"] and info["id"] == str(job.pk)
    new, info = sitecreator.import_job(job.user, data, "add")  # a row is added
    assert new.pk != job.pk and info["added"] and new.messages[0]["answers"]["ans"]["name"] == "Blue" and new.status == "done"
    SiteDesignJob.objects.filter(pk=job.pk).update(files={})
    back, info = sitecreator.import_job(job.user, data, "replace")  # replaced
    assert back.pk == job.pk and info["replaced"] and back.files == {"index.html": "<h1>Hoi</h1>"}
    only, info = sitecreator.import_job(job.user, data, "add", "questions")  # only the questions and answers
    assert only.files == {} and only.status == "draft" and only.messages[0]["answers"]["ans"]["name"] == "Blue"
    with pytest.raises(ValueError):
        sitecreator.import_job(job.user, {"format": "iets-anders"})


def test_answers_of_questions_added_by_the_screen_are_kept(job):
    msgs = [{"role": "ai", "text": "Vragen", "questions": [{"id": "sfeer", "q": "Sfeer?", "type": "text", "options": []}]}]
    SiteDesignJob.objects.filter(pk=job.pk).update(messages=msgs)
    job.refresh_from_db()
    sitecreator.save_answers(job, 0, {"colors": "Thema Blue (hoofdkleur #123456)", "name": "Blue BV", "sfeer": "Rustig", "onbekend": "x"}, {})
    job.refresh_from_db()
    a = job.messages[0]["answers"]["ans"]
    assert a["colors"].startswith("Thema Blue") and a["name"] == "Blue BV" and a["sfeer"] == "Rustig" and "onbekend" not in a
    assert job.name == "Blue BV"


def test_design_costs_count_only_this_design_and_can_be_reset(job):
    from decimal import Decimal

    from apps.integrations.models import AiUsage

    AiUsage.objects.create(source="System", ref=sitecreator._ref_of(job.pk), charged=Decimal("0.5"), tokens_in=100, tokens_out=50)
    AiUsage.objects.create(source="System", ref=sitecreator._ref_of(job.pk), charged=Decimal("0.25"), tokens_in=10, tokens_out=5)
    AiUsage.objects.create(source="System", ref="d:andere", charged=Decimal("9"))
    c = sitecreator.design_costs(job)
    assert c["calls"] == 2 and c["charged"] == 0.75 and c["tokens"] == 165
    sitecreator.reset_costs(job)
    job.refresh_from_db()
    assert sitecreator.design_costs(job)["calls"] == 0
    AiUsage.objects.create(source="System", ref=sitecreator._ref_of(job.pk), charged=Decimal("0.1"))
    assert sitecreator.design_costs(job)["charged"] == 0.1


def test_fictional_answer_for_a_field(job, monkeypatch):
    monkeypatch.setattr(sitecreator.ai, "available", lambda: True)
    monkeypatch.setattr(sitecreator.ai, "claude", lambda system, prompt, **kw: '  "Voorbeeldstraat 1, 1000 AA Teststad, 010-1234567, info@example.com"  ')
    t = sitecreator.fictional_answer(job, "Welke contactgegevens?", "Blue BV", "advies", "nl")
    assert "example.com" in t and not t.startswith('"')
    with pytest.raises(ValueError):
        sitecreator.fictional_answer(job, "", "x")


def test_costs_of_all_designs_separately(job):
    from decimal import Decimal

    from apps.integrations.models import AiUsage

    other = SiteDesignJob.objects.create(user=job.user, name="Tweede", status="done", brief={})
    AiUsage.objects.create(source="System", ref=sitecreator._ref_of(job.pk), charged=Decimal("1.5"))
    AiUsage.objects.create(source="System", ref=sitecreator._ref_of(other.pk), charged=Decimal("0.5"))
    by = {d["id"]: d for d in sitecreator.designs_costs(job.user)["designs"]}
    assert by[str(job.pk)]["charged"] == 1.5 and by[str(other.pk)]["charged"] == 0.5
    sitecreator.reset_costs(other)  # each design has its own counter
    other.refresh_from_db()
    by = {d["id"]: d for d in sitecreator.designs_costs(job.user)["designs"]}
    assert str(other.pk) not in by and by[str(job.pk)]["charged"] == 1.5


def test_running_calls_of_a_design_count_along(job):
    from apps.integrations import aiusage

    with aiusage.for_ref(sitecreator._ref_of(job.pk)):
        rid = aiusage.begin("claude-sonnet-5-5", "systeem", "vraag " * 200)
    try:
        c = sitecreator.design_costs(job)
        assert c["busy"] == 1 and c["calls"] == 1 and c["tokens"] > 0
        assert any(d["id"] == str(job.pk) for d in sitecreator.designs_costs(job.user)["designs"])
    finally:
        aiusage.end(rid)
    assert sitecreator.design_costs(job)["busy"] == 0


def test_a_stuck_design_can_be_stopped_or_continued(job, monkeypatch):
    from django.utils import timezone

    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", progress=3, step="Het plan maken", brief={**job.brief, "run": {"fn": "_generate", "args": []}})
    SiteDesignJob.objects.filter(pk=job.pk).update(updated_at=timezone.now() - timezone.timedelta(minutes=3))
    job.refresh_from_db()
    assert sitecreator.is_stalled(job) and sitecreator.public(job)["stalled"] is True
    started = []
    monkeypatch.setattr(sitecreator, "_generate", lambda pk: started.append(pk))
    sitecreator.resume(job)
    import time as _t
    for _ in range(50):
        if started:
            break
        _t.sleep(0.05)
    assert started == [job.pk]
    for _ in range(100):  # the worker thread ends (it says "error": it did not finish the design)
        if job.pk not in sitecreator.ACTIVE:
            break
        _t.sleep(0.05)
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", updated_at=timezone.now() - timezone.timedelta(minutes=3))
    job.refresh_from_db()
    stopped = sitecreator.stop(job)
    assert stopped.status in ("draft", "done") and not sitecreator.is_stalled(stopped)
    with pytest.raises(ValueError):
        sitecreator.resume(stopped)


def test_an_error_in_the_work_is_reported_on_the_design(job):
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running")

    def boom(pk):
        raise RuntimeError("iStock is niet bereikbaar")

    sitecreator._run_for(boom, job.pk, (job.pk,))
    job.refresh_from_db()
    assert job.status == "error" and "iStock is niet bereikbaar" in job.error
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", error="")
    sitecreator._run_for(lambda pk: None, job.pk, (job.pk,))  # ends without a result: also reported
    job.refresh_from_db()
    assert job.status == "error" and "onverwacht" in job.error


def test_resume_of_a_design_that_started_before_the_work_was_kept(job, monkeypatch):
    from django.utils import timezone

    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", messages=[{"role": "user", "text": "Antwoorden"}, {"role": "ai", "text": "Klaar, ik ontwerp"}], brief={"chat": True, "name": "Chat"}, updated_at=timezone.now() - timezone.timedelta(minutes=5))
    job.refresh_from_db()
    started = []
    monkeypatch.setattr(sitecreator, "_generate", lambda pk: started.append(pk))
    sitecreator.resume(job)
    import time as _t
    for _ in range(60):
        if started:
            break
        _t.sleep(0.05)
    assert started == [job.pk]


def test_one_pager_gets_a_complete_plan_with_menu_anchors(job, monkeypatch):
    def broken(*a, **k):
        raise ValueError("geen AI")

    monkeypatch.setattr(sitecreator, "_ask", broken)
    plan = sitecreator._site_plan(job.pk, job, [("index.html", "Home")])
    secs = plan["pages"][0]["sections"]
    assert len(secs) >= 5 and secs[0]["id"] == "hero"
    ids = [x["id"] for x in secs]
    assert len(set(ids)) == len(ids) and {"about", "services", "contact"} <= set(ids)
    assert all(x["menu"] for x in secs if x["id"] != "hero")  # these go in the menu


def test_pages_that_the_customer_ticked_are_used(job):
    q = [{"id": "pages", "q": "Welke pagina's?", "type": "multi", "options": ["Home", "Over ons", "Diensten"]}]
    msgs = [{"role": "ai", "text": "Vragen", "questions": q, "answers": {"ans": {"pages": ["Home", "Over ons", "Diensten"]}, "own": {}}}]
    assert sitecreator._answered_pages(msgs) == "Home, Over ons, Diensten"
    msgs[0]["answers"]["ans"]["pages"] = ["One pager (alles op één pagina)"]
    assert sitecreator._answered_pages(msgs) == "Home"
    assert sitecreator._answered_pages([{"role": "ai", "text": "x"}]) is None


def test_every_section_gets_the_same_width(job):
    plan_page = {"title": "Home", "description": ""}
    html = sitecreator._page_html({"name": "X"}, plan_page, "<nav></nav>", [("hero", '<section class="e2e-hero"><div class="e2e-container">a</div></section>'), ("over", '<div data-easy2edit-tag="ui-features"><section>b</section></div>'),
                                                                        ("kolommen", '<section class="band"><div class="container"><div class="cols">c</div></div></section>')], "<p>f</p>")
    assert html.count('<div class="container">') == 2  # the band has its own, the hero has e2e-container: only the features section is wrapped
    assert '<div id="over" class="sec-plain">\n<div class="container">' in html  # a section without a band gets the same breathing space
    assert '<div id="hero">' in html and '<div id="kolommen">' in html  # heroes and bands bring their own space
    assert "margin: 0 auto" in sitecreator.layout_css({"max_width": 1100})


def test_the_design_fills_the_identity_of_the_website(job):
    from apps.core import system

    footer = ('<footer><div data-easy2edit-tag="ui-footer"><footer><b>Blue Business</b><p>Blue Business Process Solutions reimagines end-to-end business solutions for companies today.</p>'
              '<ul><li>48 Harbor Lane, Bristol, BS1 4QT, UK</li><li>+44 117 496 0123</li><li>hello@example.com</li></ul></footer></div></footer>')
    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": f"<html><body><main></main>{footer}</body></html>"}, brief={"name": "Blue Business Process Solutions"})
    job.refresh_from_db()
    got = sitecreator.apply_identity(job)
    assert got["site_name"] == "Blue Business Process Solutions" and got["contact_email"] == "hello@example.com"
    assert got["phone"].startswith("+44") and "Harbor Lane" in got["address"] and "reimagines" in got["footer_text"]
    assert system.site_name() == "Blue Business Process Solutions"
    again = sitecreator.apply_identity(job)  # existing details are not overwritten
    assert "contact_email" not in again and "phone" not in again and again["site_name"]


def test_contact_details_of_the_customer_are_used(job):
    q = [{"id": "contact_details", "q": "Which contact details should we display?", "type": "text", "options": []}]
    msgs = [{"role": "ai", "text": "x", "questions": q, "answers": {"ans": {"contact_details": "Greenfield Trading Co., 48 Marigold Lane, Fairview, TX 75001. Phone: (555) 204-9981. Email: contact@greenfieldtrading-example.com."}, "own": {}}}]
    got = sitecreator._answered_contact(msgs)
    assert "Marigold Lane" in got and "204-9981" in got
    assert sitecreator._answered_contact([{"role": "ai", "text": "x", "questions": q, "answers": {"ans": {"contact_details": "decide yourself"}}}]) == ""
    SiteDesignJob.objects.filter(pk=job.pk).update(brief={"name": "Greenfield", "contact": got}, files={"index.html": "<footer><p>Invented address 1, Bristol</p></footer>"})
    job.refresh_from_db()
    assert "CONTACT DETAILS" in sitecreator._brief_text(job.brief) and "Marigold Lane" in sitecreator._brief_text(job.brief)
    new = sitecreator.apply_identity(job)
    assert new["contact_email"] == "contact@greenfieldtrading-example.com" and "204-9981" in new["phone"] and "Marigold Lane" in new["address"]


def test_footer_of_the_website_follows_the_design(job):
    from apps.core import theme as T
    from apps.core.models import SiteSettings

    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": '<footer><div data-easy2edit-tag="ui-footer"><p>Blue Business Process Solutions helps companies optimise their operations.</p></div></footer>'}, brief={"name": "Blue"})
    job.refresh_from_db()
    new = sitecreator.apply_identity(job)
    v = T.merged(SiteSettings.load().theme)
    assert new.get("footer_tone") == "dark" and v["footer_tone"] == "dark" and v["footer_layout"] == "brand" and v["footer_brand"] == "name"


def test_unused_chosen_photos_fill_the_empty_places_and_missing_svgs_go(job):
    pick = {"id": "1111111", "url": "https://www.istockphoto.com/photo/gm1111111", "preview": "https://media.istockphoto.com/id/1111111/photo/x.jpg", "title": "Office"}
    html = '<img src="img/backoffice.jpg" alt="Back office"><img src="img/istock-2222222.jpg" alt="x"><img src="img/logo-client-1.svg" alt="Cascade Retail"><img src="img/hero.svg" alt="h">'
    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": html, "img/hero.svg": "<svg/>"},
                                                   brief={"picked": {"istock-1111111.jpg": pick, "istock-2222222.jpg": {**pick, "id": "2222222", "preview": "https://media.istockphoto.com/id/2222222/photo/x.jpg"}}})
    job.refresh_from_db()
    job, n = sitecreator.assign_unused_picked(job)
    assert n == 1 and job.brief["istock"]["backoffice.jpg"]["id"] == "1111111"  # the unused photo goes in the empty place
    cleaned = sitecreator._without_missing_svgs(html, {"img/hero.svg": "<svg/>"})
    assert "logo-client-1.svg" not in cleaned and "<span>Cascade Retail</span>" in cleaned and 'src="img/hero.svg"' in cleaned


def test_functions_that_the_customer_did_not_choose_are_not_used(job, monkeypatch):
    q = [{"id": "extras", "q": "Which extra functions fit your business?", "type": "multi", "options": ["FAQ", "Agenda/appointments", "Newsletter", "Documents/downloads"]},
         {"id": "pages", "q": "Which pages?", "type": "multi", "options": ["Home"]}]
    msgs = [{"role": "ai", "text": "x", "questions": q, "answers": {"ans": {"extras": [], "pages": ["Home"]}}}]
    assert sitecreator._answered_extras(msgs) == []
    block = sitecreator.blocked_tags([])
    assert {"ui-faq", "ui-newsletter", "ui-calendar", "ui-files-feed"} <= block
    assert "ui-faq" not in sitecreator.blocked_tags(["FAQ"]) and sitecreator.blocked_tags(None) == set()
    assert "None" not in sitecreator._brief_text({"name": "X", "extras": []}) and "only these extra functions: none" in sitecreator._brief_text({"name": "X", "extras": []})

    def one_pager_with_faq(*a, **k):
        return '{"pages": [{"file": "index.html", "title": "Home", "sections": [{"tag": "ui-hero-split", "id": "hero"}, {"tag": "ui-faq", "id": "faq", "menu": "FAQ"}, {"tag": "ui-newsletter", "id": "nieuws", "menu": "News"}, {"tag": "ui-cta", "id": "contact", "menu": "Contact"}]}], "brand": "X"}'

    monkeypatch.setattr(sitecreator, "_ask", one_pager_with_faq)
    SiteDesignJob.objects.filter(pk=job.pk).update(brief={"name": "X", "extras": []})
    job.refresh_from_db()
    plan = sitecreator._site_plan(job.pk, job, [("index.html", "Home")])
    assert [x["id"] for x in plan["pages"][0]["sections"]] == ["hero", "contact"]  # no FAQ and no newsletter section


def test_login_and_download_links_go_when_not_chosen():
    nav = '<ul><li><a href="#a">Over ons</a></li><li><a href="#d">Downloads</a></li></ul><a class="e2e-btn" href="/login">Inloggen</a><a href="/signup">Aanmelden</a><a href="#c">Contact</a>'
    out = sitecreator.strip_unchosen_links(nav, [])
    assert "Downloads" not in out and "Inloggen" not in out and "Aanmelden" not in out and "Over ons" in out and "Contact" in out
    assert "Downloads" in sitecreator.strip_unchosen_links(nav, ["Documents/downloads"]) and "Inloggen" not in sitecreator.strip_unchosen_links(nav, ["Documents/downloads"])
    assert sitecreator.strip_unchosen_links(nav, None) == nav  # without an answer nothing is removed


def test_new_version_and_discard_when_the_creator_is_closed(job):
    SiteDesignJob.objects.filter(pk=job.pk).update(name="Blue", files={"index.html": "<h1>oud</h1>"}, status="done")
    job.refresh_from_db()
    old = json.loads(json.dumps(sitecreator.snapshot(job)))
    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": "<h1>nieuw</h1>"})
    job.refresh_from_db()
    new = sitecreator.save_as_new_version(job, old)
    job.refresh_from_db()
    assert new.name == "Blue 2" and new.files["index.html"] == "<h1>nieuw</h1>" and job.files["index.html"] == "<h1>oud</h1>"
    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": "<h1>weer anders</h1>"})
    job.refresh_from_db()
    back = sitecreator.restore_snapshot(job, old)
    assert back.files["index.html"] == "<h1>oud</h1>"
    assert sitecreator.next_version_name("Blue 2") == "Blue 3" and sitecreator.next_version_name("Blue") == "Blue 2"


def test_one_pager_menu_only_has_what_the_customer_asked_for():
    b = {"pages": "Home", "extras": [], "one_pager_pages": "One pager (all on one page)"}
    ok = lambda i, m: sitecreator.menu_allowed(b, {"id": i, "menu": m})  # noqa: E731
    assert ok("about", "About") and ok("services", "Services") and ok("contact", "Contact")
    assert not ok("reviews", "Reviews") and not ok("results", "Results") and not ok("how", "How it works") and not ok("faq", "FAQ") and not ok("downloads", "Downloads") and not ok("showcase", "Showcase")
    assert sitecreator.menu_allowed({**b, "extras": ["FAQ"]}, {"id": "faq", "menu": "FAQ"})


def test_unanswered_questions_are_not_designed(job):
    q = [{"id": "extra_functions", "q": "Which extra functions fit your business?", "type": "multi", "options": ["FAQ", "None"]},
         {"id": "cta", "q": "What is the main goal of the website (call to action)?", "type": "choice", "options": ["Request a quote"]},
         {"id": "contact", "q": "What contact details should be shown?", "type": "text", "options": []}]
    msgs = [{"role": "ai", "text": "x", "questions": q, "answers": {"ans": {"extra_functions": [], "cta": "", "contact": "Marigold Lane 48, 555-204-9981"}}}]
    left = sitecreator._unanswered(msgs)
    assert "Which extra functions fit your business?" in left and "What is the main goal of the website (call to action)?" in left and len(left) == 2
    text = sitecreator._brief_text({"name": "X", "unanswered": left, "no_cta": True})
    assert "UNANSWERED" in text and "NO CALL TO ACTION" in text
    assert sitecreator._unanswered([{"role": "ai", "text": "x", "questions": q}]) == []  # nothing saved: the designer decides


def test_page_background_and_frontend_colour_are_separate():
    v = sitecreator.theme_values({"colors": {"bg": "#f4f6fa", "page": "#0b0f19", "dbg": "#0b0f19", "dpage": "#e5e9f2"}, "color_mode": "both"})
    assert v["light_bg"] == "#f4f6fa" and v["light_page"] == "#0b0f19"  # the frontend (content) is light, the page behind it dark
    assert v["dark_bg"] == "#0b0f19" and v["dark_page"] == "#e5e9f2"
    assert "page" in sitecreator._clean_colors({"page": "#111111", "dpage": "#eeeeee"})


def test_frontend_is_a_column_with_the_maximum_width_over_the_page_colour():
    css = sitecreator.layout_css({"max_width": 1100})
    assert "body { background: var(--page, var(--bg)); }" in css
    assert "body > main { max-width: 1100px;" in css and "background: var(--bg)" in css and "body > header { max-width: 1100px;" in css and "body > footer { max-width: 1100px;" in css  # the header and the footer have the width of the column (a wider header only when asked: header_wide)
    assert "max-width: none" in sitecreator.layout_css({"max_width": 0})


def test_name_becomes_text_logo_unless_customer_has_own_logo(db):
    from apps.branding.models import SiteAsset
    from apps.core import sitecreator as S

    colors = {"text": "#102030", "dtext": "#eeeeee", "primary": "#1b97d3"}
    SiteAsset(slot="logo").image.save("easy2edit-logo.png", __import__("django").core.files.base.ContentFile(b"x"), save=True)  # the standard logo of the system
    S.text_logo("Blue BPS", colors)
    a, b = SiteAsset.objects.get(slot="logo"), SiteAsset.objects.get(slot="logo_dark")
    assert a.image.name.endswith(".svg") and b.image.name.endswith(".svg")
    assert "#102030" in a.image.read().decode() and "#eeeeee" in b.image.read().decode()
    S.text_logo("Other name", colors)  # a text logo of an earlier design is replaced
    assert "Other" in SiteAsset.objects.get(slot="logo").image.read().decode()
    own = SiteAsset.objects.get(slot="logo")
    own.image.save("customer-logo.png", __import__("django").core.files.base.ContentFile(b"x"), save=True)  # an upload of the customer
    S.text_logo("Third", colors)
    assert SiteAsset.objects.get(slot="logo").image.name.endswith("customer-logo.png") or "customer-logo" in SiteAsset.objects.get(slot="logo").image.name


def test_footer_columns_and_brand_of_the_design(db):
    from apps.core import sitecreator as S, system

    html = ('<header><div data-easy2edit-tag="ui-navbar"><nav><a href="index.html" class="e2e-nav__brand">Blue<b>BPS</b></a></nav></div></header>'
            '<footer><div class="e2e-grid"><div><h4>Bedrijf</h4><ul><li><a href="#about">Over ons</a></li><li><a href="over-ons.html">Team</a></li><li><a href="https://x.nl/a">Extern</a></li></ul></div>'
            '<div><h4>Leeg</h4><ul></ul></div></div></footer>')
    assert S.brand_of(html) == ("Blue", "BPS")
    cols = S.footer_columns_of(html)
    assert cols == [{"title": "Bedrijf", "links": [{"label": "Over ons", "url": "/#about"}, {"label": "Team", "url": "/over-ons"}, {"label": "Extern", "url": "https://x.nl/a"}]}]
    cleaned, errors = system.clean({"footer_columns": cols + [{"title": "Slecht", "links": [{"label": "x", "url": "javascript:alert(1)"}]}]})
    assert not errors and cleaned["footer_columns"] == cols  # an unsafe address is dropped, and so is the column that is left empty by it


def test_made_up_partner_logos_become_text_but_the_customer_logo_stays():
    from apps.core import sitecreator as S

    html = ('<p><img src="img/partner-logo-northfield-group.jpg" alt="Northfield Group company logo"> <img src="img/logo.png" alt="Blue BPS"> '
            '<img src="img/istock-1.jpg" alt="Call centre"> <img src="img/client-logo-x.svg" alt="X"></p>')
    out = S._without_missing_svgs(html, {})
    assert "<span>Northfield Group company logo</span>" in out and "<span>X</span>" in out  # no picture exists for a made-up logo: its name is text
    assert 'src="img/logo.png"' in out and 'src="img/istock-1.jpg"' in out  # the customer's own logo and the photos stay


def test_photos_together_become_the_gallery_markup_of_easy2edit():
    from apps.core import sitecreator as S

    photos = "".join(f'<img src="img/istock-{n}.jpg" alt="p{n}">' for n in range(1, 6))
    # a row of photos in a logos row
    out = S.normalise_galleries(f'<main><div class="e2e-logos">{photos}</div></main>')
    assert out.count('data-easy2edit-tag="ui-gallery"') == 1 and 'class="e2e-gallery"' in out and out.count("<img") == 5 and "e2e-logos" not in out
    # a gallery with wrappers around the pictures
    wrapped = "".join(f'<div class="e2e-gallery__img" style="--g:{n}"><img src="img/istock-{n}.jpg" alt="p"></div>' for n in range(1, 5))
    out = S.normalise_galleries(f'<section><div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery">{wrapped}</div></div><p>x</p></section>')
    assert "e2e-gallery__img" not in out and out.count("<img") == 4 and out.count('data-easy2edit-tag="ui-gallery"') == 1 and out.endswith("<p>x</p></section>")
    # real logos (svg) stay a logos row
    logos = "".join(f'<img src="img/logo-{n}.svg" alt="l">' for n in range(1, 5))
    assert S.normalise_galleries(f'<div class="e2e-logos">{logos}</div>') == f'<div class="e2e-logos">{logos}</div>'


def test_section_heading_is_written_by_the_system():
    h = sitecreator._with_heading({"title": "Onze diensten", "eyebrow": "Wat we doen", "intro": "Drie manieren <b>x</b>"}, '<div data-easy2edit-tag="ui-cards">c</div>')
    assert h.index("<h2>Onze diensten</h2>") < h.index("ui-cards") and 'data-easy2edit-tag="ui-section-heading"' in h
    assert h.count('<div class="container">') == 2 and "<b>" not in h  # heading and section have the same width, no html from the plan
    assert sitecreator._with_heading({}, "<div>x</div>") == "<div>x</div>"
    assert sitecreator._heading_of({"title": "  "}) == {}


def test_tinted_band_is_visible_when_surface_equals_bg():
    assert "color-mix(in srgb, var(--primary)" in sitecreator.LAYOUT_CSS and "background: var(--soft)" in sitecreator.LAYOUT_CSS


def test_auto_objects_offer_media_objects_and_skip_checkout(db, monkeypatch):
    cat = [{"slug": "media-standaard-carousel", "kind": "media", "kind_label": "Media", "name": "Carousel"}, {"slug": "plugin-webshop-cart", "kind": "plugin_part", "kind_label": "Plugin", "name": "Cart"},
           {"slug": "plugin-agenda-upcoming", "kind": "plugin_part", "kind_label": "Plugin", "name": "Upcoming"}]
    monkeypatch.setattr(sitecreator, "catalog", lambda: {"objects": cat})
    monkeypatch.setattr(sitecreator, "module_items", lambda: [{"key": "agenda"}, {"key": "webshop"}])
    got = {o["slug"] for o in sitecreator.auto_objects({})}
    assert got == {"media-standaard-carousel", "plugin-agenda-upcoming"}  # every media object, the parts of the modules that are on, never the cart or checkout by itself
    assert "plugin-webshop-cart" in {o["slug"] for o in sitecreator.auto_objects({"objects": ["plugin-webshop-cart"]})}  # unless the customer chose it


def test_object_section_has_container_and_heading():
    h = sitecreator._object_section({"title": "Onze foto's"}, "media-standaard-coverflow")
    assert h.index("<h2>Onze foto&#x27;s</h2>" if "&#x27;" in h else "<h2>Onze foto's</h2>") < h.index('data-sysobject="media-standaard-coverflow"')
    assert h.count('class="container"') == 2
    assert sitecreator._object_section({}, "media-standaard-carousel").startswith('<div class="container">')


def test_chat_asks_for_a_slider_and_gets_a_media_object(job, monkeypatch):
    """The whole chat change: 'make an image slider' becomes a system object in the page, also when the plan says ui-gallery."""
    html = ('<!doctype html><html><head><title>x</title></head><body><header><div data-easy2edit-tag="ui-navbar">n</div></header><main>\n<div id="hero"><div data-easy2edit-tag="ui-hero-split"><div class="e2e-container">h</div></div></div>\n'
            '<div id="about"><div class="container"><div data-easy2edit-tag="ui-split">a</div></div></div>\n</main><footer>f</footer></body></html>')
    SiteDesignJob.objects.filter(pk=job.pk).update(files={"index.html": html, "style.css": ""}, brief={"chat": True, "name": "Chat", "sectioned": True})
    job.refresh_from_db()
    cat = [{"slug": "media-standaard-carousel", "kind": "media", "kind_label": "Media", "name": "Carousel"}, {"slug": "media-standaard-coverflow", "kind": "media", "kind_label": "Media", "name": "Coverflow"}]
    monkeypatch.setattr(sitecreator, "catalog", lambda: {"objects": cat})
    monkeypatch.setattr(sitecreator, "module_items", lambda: [])
    seen = {}

    def fake_ask(system, prompt, **k):
        seen["prompt"] = prompt
        return json.dumps({"reply": "Ik voeg een slider toe.", "changes": [{"op": "add", "file": "index.html", "after": 1, "tag": "ui-gallery", "goal": "image slider", "title": "Onze projecten"}]})

    monkeypatch.setattr(sitecreator, "_ask", fake_ask)
    files, _b, _reply, _changes = sitecreator._revise_sections(job.pk, job, "maak een image slider", "index.html", None)
    assert "media-standaard-carousel: Carousel" in seen["prompt"]  # the planner is told about the objects
    assert '<div data-sysobject="media-standaard-carousel"></div>' in files["index.html"] and "ui-gallery" not in files["index.html"]
    assert files["index.html"].index("Onze projecten") < files["index.html"].index("data-sysobject")


def _asked_msgs():
    return [{"role": "ai", "text": "Een paar vragen.", "questions": [{"id": "stijl", "q": "Welke stijl past bij jullie bedrijf?", "type": "choice", "options": ["Strak", "Warm"], "default": ""},
                                                                      {"id": "doel", "q": "Wat is het hoofddoel van de website?", "type": "text", "options": [], "default": ""}],
             "answers": {"ans": {"stijl": "Warm", "doel": ""}, "own": {}}}, {"role": "user", "text": "Klaar"}]


def test_a_question_is_asked_once():
    msgs = _asked_msgs()
    qs = [{"id": "stijl", "q": "x", "type": "text"}, {"id": "q9", "q": "Wat is het hoofddoel van jullie website?", "type": "text"}, {"id": "budget", "q": "Wat is jullie budget?", "type": "text"}]
    assert [q["id"] for q in sitecreator._drop_repeated(qs, msgs)] == ["budget"]  # same id and nearly the same words are dropped, a new question stays
    txt = sitecreator._answered_text(msgs)
    assert "Welke stijl past bij jullie bedrijf? -> Warm" in txt and "(skipped: you decide)" in txt  # the designer is told what was answered and what was skipped


def test_chat_that_only_repeats_questions_goes_on_and_designs(job, monkeypatch):
    SiteDesignJob.objects.filter(pk=job.pk).update(messages=_asked_msgs(), brief={"chat": True, "name": "Zwemschool"})
    job.refresh_from_db()
    answers = iter([
        json.dumps({"reply": "Nog even checken.", "ready": False, "questions": [{"id": "stijl", "q": "Welke stijl past bij jullie bedrijf?", "type": "choice", "options": ["Strak", "Warm"], "default": ""}]}),
        json.dumps({"reply": "Ik ontwerp het nu.", "ready": True, "brief": {"name": "Zwemschool", "kind": "company", "lang": "Dutch", "pages": "Home", "style": "warm"}}),
    ])
    monkeypatch.setattr(sitecreator.ai, "available", lambda: True)
    monkeypatch.setattr(sitecreator, "_ask", lambda *a, **k: next(answers))
    monkeypatch.setattr(sitecreator, "_generate", lambda pk: SiteDesignJob.objects.filter(pk=pk).update(status="done"))
    monkeypatch.setattr(sitecreator, "auto_photos", lambda *a, **k: None)
    sitecreator._chat(job.pk, "ok", False)
    job.refresh_from_db()
    ai = [m for m in job.messages if m["role"] == "ai"]
    assert ai[-1]["text"] == "Ik ontwerp het nu." and not ai[-1].get("questions") and job.status == "done"  # no second round of the same question


def test_check_and_repair_a_design(db):
    b = {"photos": [{"file": f"istock-{n}.jpg", "note": note} for n, note in ((1, "coach in pool"), (2, "kids swimming"), (3, "poolside"))], "name": "X"}
    page = ('<!doctype html><html><head><title>x</title></head><body><header><div data-easy2edit-tag="ui-navbar">n</div></header><main>'
            '<div id="hero"><div data-easy2edit-tag="ui-hero-split"><section class="e2e-hero"><h1>Kop</h1><img src="img/istock-1.jpg" alt="coach in pool"></section></div></div>'
            '<div id="about"><div class="container"><div data-easy2edit-tag="ui-split"><div class="e2e-split"><img src="img/istock-1.jpg" alt="kids swimming lesson"><h2 id="about">Over</h2></div></div></div></div>'
            '</main><footer>f</footer></body></html>')
    files = {"index.html": page, "style.css": ""}
    before = " ".join(x["problem"] for x in sitecreator.check_design(files, b))
    assert "The same id twice: about" in before and "The same picture more than once: istock-1.jpg" in before
    fixed, left = sitecreator.repair_design(files, b)
    assert sitecreator.check_design(fixed, b) == left and "twice" not in " ".join(x["problem"] for x in left) and "more than once" not in " ".join(x["problem"] for x in left)
    srcs = [m.group(2) for m in sitecreator.IMG_RE.finditer(fixed["index.html"])]
    assert len(set(srcs)) == 2 and srcs[0] == "img/istock-1.jpg" and srcs[1] == "img/istock-2.jpg"  # the second picture fits "kids swimming" best


def test_one_photo_one_place_is_in_every_rule_set(db):
    assert "ONE PHOTO, ONE PLACE" in sitecreator.rules({}) and "ONE PHOTO, ONE PLACE" in sitecreator.rules({"chat": True}) and "ONE PHOTO, ONE PLACE" in sitecreator.SECTION_SYSTEM


def test_header_has_the_width_of_the_content_unless_asked(db):
    assert "body > header { max-width: 1100px" in sitecreator.layout_css({}) and "body > header { max-width: 1280px" in sitecreator.layout_css({"max_width": 1280})
    assert "body > header" not in sitecreator.layout_css({"header_wide": True})  # only wider when the customer asks
    assert sitecreator.clean_brief({"header_wide": True}, {})["header_wide"] is True and sitecreator.clean_brief({"header_wide": False}, {"header_wide": True})["header_wide"] is False


def test_sections_keep_their_id_and_spacing_when_split_and_joined():
    html = '<html><body><header>h</header><main>\n<div id="about" class="sec-plain">\n<div class="container"><div data-easy2edit-tag="ui-split">a</div></div>\n</div>\n<div id="hero">\n<div data-easy2edit-tag="ui-hero-split"><section class="e2e-hero">x</section></div>\n</div>\n</main><footer>f</footer></body></html>'
    before, secs, after = sitecreator._main_parts(html)
    assert [i for i, _h in secs] == ["about", "hero"]  # the wrapper with the class is taken off too: the id is not lost
    again = sitecreator._join_main(before, secs, after)
    assert '<div id="about" class="sec-plain">' in again and '<div id="hero">' in again  # and put back the same way (a hero has its own space)


def test_the_customer_is_asked_before_the_questions_are_filled_in_with_assumptions(job, monkeypatch):
    prompts = []

    def fake(system, prompt, **k):
        prompts.append(prompt)
        return json.dumps({"reply": "Ik heb alles ingevuld met mijn aannames.", "ready": False, "questions": [{"id": "doel", "q": "Wat is het hoofddoel?", "type": "text", "default": "Nieuwe leden werven"},
                                                                                                          {"id": "pagina", "q": "Pagina's", "type": "multi", "options": ["Home", "Over ons"], "default": ["Home", "Over ons"]}]})

    monkeypatch.setattr(sitecreator.ai, "available", lambda: True)
    monkeypatch.setattr(sitecreator, "_ask", fake)
    monkeypatch.setattr(sitecreator.threading, "Thread", lambda target, args, daemon: type("T", (), {"start": lambda self: target(*args)})())
    sitecreator.chat(job, "maak een website voor een openwater zwemvereniging in Porbandar India")
    job.refresh_from_db()
    assert prompts == [] and job.messages[-1]["ask"] == "prefill"  # nothing is asked of the AI before the customer answered
    sitecreator.answer_prefill(SiteDesignJob.objects.get(pk=job.pk), True)
    with pytest.raises(ValueError):
        sitecreator.answer_prefill(SiteDesignJob.objects.get(pk=job.pk), True)  # an answer is given once
    job.refresh_from_db()
    assert job.brief["prefill"] is True and "PREFILL WITH ASSUMPTIONS" in prompts[0] and "Porbandar" in prompts[0]  # yes: the designer fills in the defaults
    q = [m for m in job.messages if m.get("questions")][-1]["questions"]
    assert q[0]["default"] == "Nieuwe leden werven" and q[1]["default"] == ["Home", "Over ons"]  # the defaults survive: the screen starts from them
    assert "PREFILL WITH ASSUMPTIONS" not in sitecreator.CHAT_SYSTEM  # (the rule is only added after a yes)


def test_yes_to_filling_in_also_searches_the_photos_but_keeps_no_text(job, monkeypatch):
    monkeypatch.setattr(sitecreator.ai, "available", lambda: True)
    monkeypatch.setattr(sitecreator.threading, "Thread", lambda target, args, daemon: type("T", (), {"start": lambda self: target(*args)})())
    seen = {}

    def fake(system, prompt, **k):
        if system == sitecreator.SECTION_JSON:  # the photo plan
            seen["plan"] = prompt
            return json.dumps({"searches": [{"query": "open water swimmers sea", "purpose": "hero", "kind": "photo"}]})
        return json.dumps({"reply": "Ingevuld.", "ready": False, "questions": [{"id": "name", "q": "Naam?", "type": "text", "default": "Porbandar Open Water Swimming Association"}]})

    monkeypatch.setattr(sitecreator, "_ask", fake)
    monkeypatch.setattr(sitecreator, "search_photos", lambda j, q, skip=(), video=False: [{"id": "123", "source": "istock", "title": "Swimmers", "url": "https://x/p.jpg"}])
    sitecreator.chat(job, "maak een website voor een openwater zwemvereniging in Porbandar India")
    sitecreator.answer_prefill(SiteDesignJob.objects.get(pk=job.pk), True)
    job.refresh_from_db()
    assert "Porbandar" in seen["plan"] and "Porbandar Open Water Swimming Association" in seen["plan"]  # the search knows the request and the assumed name
    assert list(job.brief["picked"]) == ["istock-123.jpg"] and "extra" not in job.brief and job.brief["name"] == "Chat"  # only the selection is kept (the name of the request is not)
    assert job.status == "done" and [m for m in job.messages if m.get("questions")]  # and the questionnaire is there


def test_a_design_made_by_the_designer_gets_the_name_of_the_website(django_user_model, monkeypatch):
    u = django_user_model.objects.create_user("n@example.com", "n@example.com", "x")
    new = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="Nieuw ontwerp", brief={"name": "Zwemvereniging De Fuut"})
    assert sitecreator.name_of(new) == "Zwemvereniging De Fuut" and sitecreator.listing(u)[0]["name"] == "Zwemvereniging De Fuut" and sitecreator.public(new)["name"] == "Zwemvereniging De Fuut"
    sitecreator._set(new.pk, brief={"name": "Zwemvereniging De Fuut"})  # saving: the name goes to the design itself
    new.refresh_from_db()
    assert new.name == "Zwemvereniging De Fuut"
    own = sitecreator.SiteDesignJob.objects.create(user=u, status="done", name="Mijn eigen naam", brief={"name": "Iets anders"})
    sitecreator._set(own.pk, brief={"name": "Iets anders"})
    own.refresh_from_db()
    assert own.name == "Mijn eigen naam" and sitecreator.name_of(own) == "Mijn eigen naam"  # a name that was chosen is never replaced

    monkeypatch.setattr(sitecreator.ai, "available", lambda: True)
    monkeypatch.setattr(sitecreator.threading, "Thread", lambda target, args, daemon: type("T", (), {"start": lambda self: target(*args)})())
    monkeypatch.setattr(sitecreator, "_prefill_photos", lambda pk, msgs: None)
    monkeypatch.setattr(sitecreator, "_ask", lambda *a, **k: json.dumps({"reply": "Ingevuld.", "ready": False, "questions": [{"id": "name", "q": "Naam?", "type": "text", "default": "Porbandar Open Water Swimming Association"}]}))
    job = sitecreator.SiteDesignJob.objects.create(user=u, status="draft", name="Nieuw ontwerp", brief={"chat": True})
    sitecreator.chat(job, "een website voor een zwemvereniging")
    sitecreator.answer_prefill(sitecreator.SiteDesignJob.objects.get(pk=job.pk), True)
    job.refresh_from_db()
    assert job.name == "Porbandar Open Water Swimming Association"  # the assumed name is the name of the design at once


def test_the_theme_of_a_design_has_a_header_as_wide_as_the_content_unless_asked(db):
    v = sitecreator.theme_values({"max_width": 1280})
    assert v["header_width"] == "content" and v["content_w"] == 1280
    assert sitecreator.theme_values({"header_wide": True})["header_width"] == "full"
    assert sitecreator.theme_values({"max_width": 0})["content_w"] == 1600
    assert "HEADER WIDTH" in sitecreator.rules({}) and "header_wide" in sitecreator.rules({})  # the standard rule is in the creator rules


def test_photo_names_in_the_pages_are_the_exact_names_of_the_library(db):
    b = {"photos": [{"id": 1, "file": "unsplash-tr7rwqdv5m4.jpg", "note": "swimmer"}, {"id": 2, "file": "sunrise.jpg", "note": "x"}], "name": "X"}
    files = {"index.html": '<div class="e2e-hero__visual" role="img"><img src="img/unsplash-tR7rwqdv5M4.jpg" alt="a"></div><img src="img/sunrise.jpg" alt="b"><p>img/NietEen.jpg</p>',
             "style.css": ".x { background: url(img/Unsplash-TR7rwqdv5M4.jpg); }"}
    fixed = sitecreator.fix_photo_names(files, b)
    assert 'src="img/unsplash-tr7rwqdv5m4.jpg"' in fixed["index.html"] and "url(img/unsplash-tr7rwqdv5m4.jpg)" in fixed["style.css"]  # the import matches names exactly: the hero keeps its picture
    assert 'src="img/sunrise.jpg"' in fixed["index.html"] and "img/NietEen.jpg" in fixed["index.html"]  # others stay as they are
    repaired, _left = sitecreator.repair_design(files, b)
    assert "tR7rwqdv5M4" not in repaired["index.html"]  # the repair after every design and change does it too


def test_a_failed_design_asks_to_redo_or_go_on(django_user_model, monkeypatch):
    u = django_user_model.objects.create_user("f@example.com", "f@example.com", "x")
    ran = []
    monkeypatch.setattr(sitecreator.threading, "Thread", lambda target, args, daemon: type("T", (), {"start": lambda self: ran.append((target, args))})())
    monkeypatch.setattr(sitecreator, "_generate", lambda pk: None)
    failed = sitecreator.SiteDesignJob.objects.create(user=u, status="error", error="afgebroken", name="X", brief={"name": "X", "run": {"fn": "_generate", "args": []}}, files={"index.html": "<html></html>"})
    sitecreator.failed_choice(failed, "continue")  # go on with what is there: no new work, the error is gone
    failed.refresh_from_db()
    assert failed.status == "done" and failed.error == "" and not ran
    again = sitecreator.SiteDesignJob.objects.create(user=u, status="error", error="afgebroken", name="Y", brief={"name": "Y", "run": {"fn": "_generate", "args": []}})
    sitecreator.failed_choice(again, "retry")  # the last order is done again
    again.refresh_from_db()
    assert again.status == "running" and again.error == "" and len(ran) == 1
    with pytest.raises(ValueError):
        sitecreator.failed_choice(again, "retry")  # only a failed design can be asked about
    empty = sitecreator.SiteDesignJob.objects.create(user=u, status="error", error="x", name="Z", brief={})
    with pytest.raises(ValueError):
        sitecreator.failed_choice(empty, "retry")  # nothing to redo
    empty.refresh_from_db()
    assert empty.status == "error"
