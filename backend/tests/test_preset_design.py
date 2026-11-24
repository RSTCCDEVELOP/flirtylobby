# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The tab Design: chosen pages (with their pictures) are kept in the installation and come back exactly like that."""
import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.test import APIClient

from apps.core import preset_design, presets
from apps.core.models import ContentBlock
from apps.medialib.models import MediaItem
from apps.pages.models import Page, PageLayout


@pytest.fixture(autouse=True)
def _no_browser(monkeypatch, settings, tmp_path):
    """No test starts a real browser: the pictures of the pages are made by a stand-in."""
    from apps.core import siteshots

    preset_design._JOBS.clear()
    settings.THEMES_DIR = tmp_path / "themes-test"  # (the theme that is kept with the pages never lands in the real folder of the website)
    monkeypatch.setattr(siteshots, "capture", lambda url, allow_private=False: b"\xff\xd8jpegbytes")
    monkeypatch.setattr(preset_design, "start_sample", lambda *a, **k: False)


def _png(color):
    from PIL import Image

    b = io.BytesIO()
    Image.new("RGB", (4, 4), color).save(b, "PNG")
    return b.getvalue()


def _media(name, color):
    stored = default_storage.save(f"library/test/{name}", ContentFile(_png(color)))
    m = MediaItem.objects.get(key=stored)
    m.name, m.kind = name, "image"
    m.save()
    return m


@pytest.mark.django_db
def test_design_pages_come_back_exactly_with_their_pictures(settings, tmp_path, django_user_model):
    settings.RESOURCE_DIR = tmp_path
    key = presets.PRESETS[0]["key"]
    bg, pic = _media("achtergrond.png", "red"), _media("foto.png", "blue")
    Page.objects.create(key="over-ons-x", kind="content", title={"nl": "Over ons X"}, in_menu=True)
    own = {"rows": [{"id": "r1aa", "cols": 1, "gap": "md", "bg": {"type": "image", "media": bg.id, "overlay": 0.3}, "cells": [{"id": "c1aa", "items": [{"id": "i1aa", "type": "text", "ref": ""}, {"id": "i2aa", "type": "image", "ref": ""}]}]}]}
    PageLayout.objects.create(key="over-ons-x", data=own)
    ContentBlock.objects.create(key="layout.over-ons-x.i1aa", lang="nl", text="Hallo wereld")
    ContentBlock.objects.create(key="layout.over-ons-x.i2aa", lang="nl", text=f"media:{pic.id}")
    home = Page.objects.filter(key="home").first() or Page.objects.create(key="home", kind="system", title={"nl": "Home"}, url="/")
    PageLayout.objects.update_or_create(key="home", defaults={"data": {"rows": [{"id": "r2aa", "cols": 1, "gap": "md", "cells": [{"id": "c2aa", "items": [{"id": "i3aa", "type": "text", "ref": ""}]}]}]}})
    ContentBlock.objects.create(key="layout.home.i3aa", lang="nl", text="Welkom thuis")

    su = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(su)
    got = c.get(f"/api/system/presets/{key}/design/").json()
    assert {"over-ons-x", "home"} <= {p["key"] for p in got["pages"]}
    r = c.post(f"/api/system/presets/{key}/design/", {"pages": ["over-ons-x", "home"]}, format="json")
    assert r.status_code == 200 and r.json()["count"] == 2
    assert (tmp_path / "presets" / key / "design" / "over-ons-x.zip").is_file()

    # a new website: the pages and the pictures are gone
    Page.objects.filter(key="over-ons-x").delete()
    PageLayout.objects.all().delete()
    ContentBlock.objects.filter(key__startswith="layout.").delete()
    MediaItem.objects.all().delete()
    done = preset_design.install(key)
    assert set(done) == {"over-ons-x", "home"}
    page = Page.objects.get(key="over-ons-x")
    assert page.source == f"preset:{key}" and page.in_menu and page.title["nl"] == "Over ons X"
    lay = PageLayout.objects.get(key="over-ons-x").data
    row = lay["rows"][0]
    assert MediaItem.objects.get(pk=row["bg"]["media"]).name == "achtergrond.png" and row["bg"]["overlay"] == 0.3
    assert ContentBlock.objects.get(key="layout.over-ons-x.i1aa", lang="nl").text == "Hallo wereld"
    img = ContentBlock.objects.get(key="layout.over-ons-x.i2aa", lang="nl").text
    assert MediaItem.objects.get(pk=int(img[6:])).name == "foto.png"
    assert ContentBlock.objects.get(key="layout.home.i3aa", lang="nl").text == "Welkom thuis"
    assert Page.objects.get(key="home").kind != "content"  # the standard page stays a standard page

    # again: the pictures are not stored twice
    n = MediaItem.objects.count()
    preset_design.install(key)
    assert MediaItem.objects.count() == n

    # removing the installation: the own page goes, the standard page loses the design
    preset_design.remove(key)
    assert not Page.objects.filter(key="over-ons-x").exists()
    assert not ContentBlock.objects.filter(key="layout.over-ons-x.i1aa").exists()


@pytest.mark.django_db
def test_only_superadmins_use_the_design_tab(django_user_model):
    key = presets.PRESETS[0]["key"]
    u = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c = APIClient(); c.force_authenticate(u)
    assert c.get(f"/api/system/presets/{key}/design/").status_code == 403
    assert c.post(f"/api/system/presets/{key}/design/", {"pages": []}, format="json").status_code == 403


@pytest.mark.django_db
def test_samples_are_made_when_a_page_is_switched_on_and_removed_when_it_is_off(settings, tmp_path, django_user_model, monkeypatch):
    from apps.core import siteshots

    settings.RESOURCE_DIR = tmp_path
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
    key = presets.PRESETS[0]["key"]
    seen = []
    monkeypatch.undo()  # (this test makes the pictures, with a stand-in for the browser)
    monkeypatch.setattr(siteshots, "capture", lambda url, allow_private=False: (seen.append((url, allow_private)) or b"\xff\xd8jpegbytes"))
    Page.objects.create(key="over-ons-x", kind="content", title={"nl": "Over ons X"}, source="")
    PageLayout.objects.create(key="over-ons-x", data={"rows": [{"id": "r1aa", "cols": 1, "gap": "md", "cells": [{"id": "c1aa", "items": [{"id": "i1aa", "type": "text", "ref": ""}]}]}]})
    su = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(su)
    assert preset_design.save(key, ["over-ons-x"], "http://localhost:5173", wait=True)["pages"]
    assert seen == [("http://localhost:5173/p/over-ons-x", True)]
    assert (tmp_path / "presets" / key / "design" / "samples" / "over-ons-x.jpg").is_file()
    assert [s["key"] for s in preset_design.samples_of(key)] == ["over-ons-x"]
    assert c.get(f"/api/system/presets/{key}/samples/over-ons-x.jpg").status_code == 200
    assert APIClient().get(f"/api/system/presets/{key}/samples/over-ons-x.jpg").status_code == 200  # (it presents the installation)
    preset_design.save(key, [], "http://localhost:5173", wait=True)  # switched off: picture and package are gone
    assert not (tmp_path / "presets" / key / "design" / "samples" / "over-ons-x.jpg").exists()
    assert APIClient().get(f"/api/system/presets/{key}/samples/over-ons-x.jpg").status_code == 404
    assert preset_design.own_origin(None) == "http://localhost:5173"


def test_the_own_website_may_have_another_port_but_a_reference_site_may_not():
    from apps.core import siteshots

    assert siteshots.clean_url("http://localhost:5173/p/x", True) == "http://localhost:5173/p/x"
    with pytest.raises(siteshots.ShotError):
        siteshots.clean_url("http://localhost:5173/p/x")


@pytest.mark.django_db
def test_update_of_the_installation_puts_the_design_pages_back(settings, tmp_path):
    from apps.core import preset_pages

    settings.RESOURCE_DIR = tmp_path
    key = presets.PRESETS[0]["key"]
    Page.objects.update_or_create(key="home", defaults={"kind": "system", "title": {"nl": "Home"}, "url": "/"})
    mine = {"rows": [{"id": "r2aa", "cols": 1, "gap": "md", "cells": [{"id": "c2aa", "items": [{"id": "i3aa", "type": "text", "ref": ""}]}]}]}
    PageLayout.objects.update_or_create(key="home", defaults={"data": mine})
    ContentBlock.objects.update_or_create(key="layout.home.i3aa", lang="nl", defaults={"text": "Mijn thuis"})
    preset_design.save(key, ["home"], "")
    assert preset_design.outdated(key) == []  # nothing changed
    # the site is changed (the standard design came back): the page is listed and an update puts it back
    PageLayout.objects.filter(key="home").update(data={"rows": [{"id": "zzzz", "cols": 1, "gap": "md", "cells": [{"id": "yyyy", "items": []}]}]})
    ContentBlock.objects.filter(key="layout.home.i3aa").delete()
    assert "home" in [o["key"] for o in preset_pages.outdated(key)]
    presets.update_pages(key, ["home"])
    assert PageLayout.objects.get(key="home").data["rows"][0]["id"] == "r2aa"
    assert ContentBlock.objects.get(key="layout.home.i3aa", lang="nl").text == "Mijn thuis"
    assert preset_design.outdated(key) == []
    ContentBlock.objects.filter(key="layout.home.i3aa").update(text="Anders")  # only a text changed
    assert [o["key"] for o in preset_design.outdated(key)] == ["home"]


@pytest.mark.django_db
def test_apply_can_leave_out_the_design_and_the_theme(settings, tmp_path, django_user_model, monkeypatch):
    settings.RESOURCE_DIR = tmp_path
    key = presets.PRESETS[0]["key"]
    seen = {"design": 0, "theme": 0}
    monkeypatch.setattr(preset_design, "install", lambda *a, **k: seen.__setitem__("design", seen["design"] + 1) or [])
    su = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    c = APIClient(); c.force_authenticate(su)
    assert c.post(f"/api/system/presets/{key}/apply/", {"design": False, "theme": False}, format="json").status_code == 200
    assert seen["design"] == 0  # (the pages of the installation are not put in)
    assert c.post(f"/api/system/presets/{key}/apply/", {}, format="json").status_code == 200
    assert seen["design"] == 1
    rows = c.get("/api/system/presets/").json()
    assert "design_pages" in rows[0]


@pytest.mark.django_db
def test_a_design_with_other_parts_is_never_put_right_by_itself_and_the_refresh_leaves_design_pages(settings, tmp_path):
    from apps.core import preset_pages

    settings.RESOURCE_DIR = tmp_path
    key = presets.PRESETS[0]["key"]
    Page.objects.update_or_create(key="home", defaults={"kind": "system", "title": {"nl": "Home"}, "url": "/"})
    # a design of the website designer: headings and images next to texts
    PageLayout.objects.update_or_create(key="home", defaults={"data": {"rows": [{"id": "r9aa", "cols": 1, "gap": "md", "cells": [{"id": "c9aa", "items": [{"id": "h9aa", "type": "heading", "ref": ""}, {"id": "t9aa", "type": "text", "ref": ""}]}]}]}})
    assert "home" not in preset_pages.pristine_wrong(key)  # (it was "put right" with the standard layout before: the design was gone)
    # the automatic refresh never installs a kept design page
    called = []
    orig = preset_design.install
    preset_design.install = lambda *a, **k: called.append(1) or []
    try:
        presets.update_pages(key, ["home"], with_design=False)
    finally:
        preset_design.install = orig
    assert not called


@pytest.mark.django_db
def test_the_theme_of_the_installation_is_kept_and_installed_and_the_choice_is_asked(settings, tmp_path, django_user_model):
    from apps.core import themepacks
    from apps.core.models import SiteSettings

    settings.RESOURCE_DIR = tmp_path
    settings.THEMES_DIR = tmp_path / "themes"
    key = presets.PRESETS[0]["key"]
    row = SiteSettings.load()
    row.theme = {"primary": "#aa3311", "font_heading": row.theme.get("font_heading", "") or "Inter"}
    row.save()
    su = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    c = APIClient(); c.force_authenticate(su)
    assert c.get(f"/api/system/presets/{key}/design/").json()["theme"] is None
    r = c.post(f"/api/system/presets/{key}/design/theme/", {"action": "capture"}, format="json").json()
    assert r["theme"]["colors"]["primary"] == "#aa3311" and (tmp_path / "presets" / key / "design" / "theme.zip").is_file()
    assert any(x["theme_pack"] for x in c.get("/api/system/presets/").json() if x["key"] == key)
    # the website gets other colours; setting the installation with "standard" brings the kept theme back
    row.theme = {"primary": "#112233"}
    row.save()
    assert c.post(f"/api/system/presets/{key}/apply/", {"theme": "keep"}, format="json").status_code == 200
    assert SiteSettings.load().theme.get("primary") == "#112233"  # keep: the colours stay
    assert c.post(f"/api/system/presets/{key}/apply/", {"theme": "standard"}, format="json").status_code == 200
    assert SiteSettings.load().theme.get("primary") == "#aa3311"
    # another colour theme that was chosen
    other = themepacks.create("Mijn ander thema", from_current=False)
    themepacks.update_meta(other, {"values": {"primary": "#00aa55"}})
    assert c.post(f"/api/system/presets/{key}/apply/", {"theme": other}, format="json").status_code == 200
    assert SiteSettings.load().theme.get("primary") == "#00aa55"
    assert c.post(f"/api/system/presets/{key}/apply/", {"theme": "bestaat-niet"}, format="json").status_code == 400
    assert c.post(f"/api/system/presets/{key}/design/theme/", {"action": "remove"}, format="json").json()["theme"] is None
