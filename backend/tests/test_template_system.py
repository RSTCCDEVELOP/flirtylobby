# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A template made of the current website: system settings and pages (no user data), read in again, and checked afterwards."""
import json
import zipfile

import pytest
from django.contrib.auth import get_user_model

from apps.core import templatepacks as tp
from apps.pages.models import Page


@pytest.fixture
def lib(tmp_path, monkeypatch):
    monkeypatch.setattr(tp, "library_dir", lambda: tmp_path / "lib")
    monkeypatch.setattr(tp, "site_dir", lambda: tmp_path / "site")
    return tmp_path


@pytest.mark.django_db
def test_template_of_the_site_has_system_site_previews_and_no_user_data(lib):
    u = get_user_model().objects.create_user("secret-person", "secret@example.com", "x", is_staff=True)
    Page.objects.create(key="demo", kind="content", title="Demo", scope="public")
    m = tp.build_from_site("demo-start", "Demo start", "<p>Een <b>demo</b></p>", "RSTCC", "1.0.0", [("shot.jpg", b"\xff\xd8\xff" + b"0" * 50)])
    assert m["system"] == "system.json" and m["requires"]["system_version"] and m["previews"]
    f = next((lib / "lib").glob("demo-start-1.0.0.zip"))
    with zipfile.ZipFile(f) as z:
        names = set(z.namelist())
        assert {"template.json", "system.json", "site.json"} <= names
        blob = b"".join(z.read(n) for n in names if n.endswith(".json"))
    assert b"secret@example.com" not in blob and b"secret-person" not in blob  # no users
    row = next(r for r in tp.listing() if r["key"] == "demo-start")
    assert row["system"] is True
    rep = tp.verify("demo-start", fix=False)
    assert rep["items"] and {"version", "modules", "pages", "media", "migrations"} <= {i["key"] for i in rep["items"]}
    assert next(i for i in rep["items"] if i["key"] == "pages")["ok"]
    _ = u


@pytest.mark.django_db
def test_apply_system_makes_a_backup_first_and_reports_the_check(lib, monkeypatch):
    from apps.backups import service as bs

    u = get_user_model().objects.create_user("boss", "boss@example.com", "x", is_staff=True)
    Page.objects.create(key="demo2", kind="content", title="Demo 2", scope="public")
    tp.build_from_site("demo-two", "Demo two")
    calls = []

    class Fake:
        file = "backup-test.zip"

    monkeypatch.setattr(bs, "create", lambda *a, **k: calls.append(a) or Fake())
    Page.objects.filter(key="demo2").delete()  # the template must bring it back
    out = tp.apply(("demo-two"), u, "copy", "system")
    assert calls and out["safety_backup"] == "backup-test.zip"
    assert Page.objects.filter(key="demo2").exists()
    assert out["check"]["items"] and any(i["key"] == "pages" and i["ok"] for i in out["check"]["items"])
    assert json.dumps(out)  # serializable for the API


@pytest.mark.django_db
def test_details_come_from_the_site_with_or_without_ai(lib, monkeypatch):
    from apps.core.models import SystemSettings
    from apps.integrations import ai

    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**(row.data or {}), "installation_name": "Bue Accountants", "tagline": "Duidelijke cijfers"}
    row.save()
    Page.objects.create(key="home-x", kind="content", title={"nl": "Start", "en": "Home"}, scope="public")
    monkeypatch.setattr(ai, "available", lambda: False)
    d = tp.suggest_details()  # without the AI: made of the site itself
    assert d["name"] == "Bue Accountants" and d["source"] == "site" and "Duidelijke cijfers" in d["description"] and "Start" in d["description"]
    monkeypatch.setattr(ai, "available", lambda: True)
    monkeypatch.setattr(ai, "claude", lambda *a, **k: "no json at all")  # the AI gives nothing usable: still the site
    assert tp.suggest_details()["name"] == "Bue Accountants"
    monkeypatch.setattr(ai, "claude", lambda *a, **k: 'x {"name": "Zakelijke start", "description": "Voor het MKB."}')
    d = tp.suggest_details()
    assert d["name"] == "Zakelijke start" and d["source"] == "ai" and d["key"] == "zakelijke-start" and d["version"] == "1.0.0"
    tp.build_from_site("zakelijke-start", "Zakelijke start")
    assert tp.suggest_details()["version"] == "1.0.1"  # exists: the next patch version


@pytest.mark.django_db
def test_template_has_only_the_pages_of_the_design_and_applying_removes_the_others(lib, monkeypatch):
    from apps.backups import service as bs
    from apps.pages.models import PageLayout

    u = get_user_model().objects.create_user("boss2", "boss2@example.com", "x", is_staff=True)
    Page.objects.create(key="eigen", kind="content", title={"nl": "Eigen"}, scope="public")
    Page.objects.create(key="oud", kind="content", title={"nl": "Oud"}, scope="public", source="preset:standaard-website")
    listing = {r["key"]: r for r in tp.site_pages()}
    assert listing["eigen"]["default"] and not listing["oud"]["default"] and listing["oud"]["reason"]
    m = tp.build_from_site("alleen-eigen", "Alleen eigen")
    assert m["requires"]["pages"] == ["eigen"] or "oud" not in m["requires"]["pages"]
    # an old page and layout that the template does not have must go when the template is used
    Page.objects.create(key="achtergebleven", kind="content", title={"nl": "Oud"}, scope="public")
    PageLayout.objects.create(key="achtergebleven", data={"rows": [{"id": "r1", "cols": 1, "cells": [{"id": "c1", "items": [{"id": "i1", "type": "text", "text": "x"}]}]}]})

    class Fake:
        file = "b.zip"

    monkeypatch.setattr(bs, "create", lambda *a, **k: Fake())
    out = tp.apply("alleen-eigen", u, "copy", "system")
    assert not Page.objects.filter(key__in=["achtergebleven", "oud"]).exists()
    assert Page.objects.filter(key="eigen").exists() and any("Verwijderd" in n for n in out["notes"])
