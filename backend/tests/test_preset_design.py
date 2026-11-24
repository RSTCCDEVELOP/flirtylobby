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
