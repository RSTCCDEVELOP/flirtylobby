# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A backup saved as a template: demo content only (no users, no data of plugins, no secrets), with example pictures."""
import io
import json
import zipfile

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def setup(django_user_model, tmp_path, settings):
    from apps.backups import service
    from apps.core import templatepacks as tp

    settings.BACKUPS_DIR = tmp_path / "b"
    settings.RESOURCE_DIR = tmp_path / "res"
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(boss)
    return c, boss, service.create("manual", boss, "Demo"), tp


@pytest.mark.django_db
def test_backup_becomes_a_template_with_previews(setup, monkeypatch, tmp_path):
    c, boss, b, tp = setup
    monkeypatch.setattr(tp, "library_dir", lambda: tmp_path / "lib")
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 50
    r = c.post("/api/templates/", {"action": "create_from_backup", "backup": b.id, "key": "demo-site", "name": "Demo site", "version": "1.0.0", "demo_only": "false", "previews": io.BytesIO(png)}, format="multipart")
    assert r.status_code == 400  # first the confirmation that it only holds demo data
    f = io.BytesIO(png); f.name = "home.png"
    r = c.post("/api/templates/", {"action": "create_from_backup", "backup": b.id, "key": "demo-site", "name": "Demo site", "version": "1.0.0", "demo_only": "true", "previews": f}, format="multipart")
    assert r.status_code == 201 and r.json()["made"]["key"] == "demo-site"
    z = zipfile.ZipFile(tmp_path / "lib" / "demo-site-1.0.0.zip")
    names = z.namelist()
    man = json.loads(z.read("template.json"))
    assert "system.json" in names and "site.json" in names and man["previews"] == ["previews/1.png"] and "previews/1.png" in names
    system = json.loads(z.read("system.json"))
    assert not system["secrets_included"] and set(system["sections"]) <= set(tp.SYSTEM_SECTIONS)
    assert not any(n.startswith("files/") or n == "data.json" for n in names)  # no users, no files of people
    assert any(t["key"] == "demo-site" for t in tp.listing())


@pytest.mark.django_db
def test_only_a_superadmin_and_pages_list(setup, django_user_model):
    c, boss, b, tp = setup
    plain = APIClient(); plain.force_authenticate(django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!"))
    assert plain.post("/api/templates/", {"action": "create_from_backup", "backup": b.id, "key": "x1", "demo_only": "true"}, format="json").status_code in (400, 403)
    assert isinstance(c.get(f"/api/templates/?backup_pages={b.id}").json()["pages"], list)


@pytest.mark.django_db
def test_only_a_just_made_backup_of_an_unchanged_site(setup, monkeypatch, tmp_path):
    from datetime import timedelta

    from django.utils import timezone

    from apps.pages.models import Page

    c, boss, b, tp = setup
    monkeypatch.setattr(tp, "library_dir", lambda: tmp_path / "lib")
    body = {"action": "create_from_backup", "backup": b.id, "key": "vers", "name": "Vers", "demo_only": "true"}
    type(b).objects.filter(pk=b.pk).update(created_at=timezone.now() - timedelta(minutes=45))
    r = c.post("/api/templates/", body, format="json")
    assert r.status_code == 400 and "net gemaakte backup" in r.json()["detail"]
    assert c.get(f"/api/templates/?backup_pages={b.id}").status_code == 400
    type(b).objects.filter(pk=b.pk).update(created_at=timezone.now())
    Page.objects.filter(key="home").update(title={"nl": "Veranderd"})  # a change after the backup
    Page.objects.filter(key="home").first().save()
    r = c.post("/api/templates/", body, format="json")
    assert r.status_code == 400 and "veranderd" in r.json()["detail"]


@pytest.mark.django_db
def test_templates_are_their_own_module_with_levels_and_an_update_notice(setup, django_user_model, monkeypatch, tmp_path):
    """The module Templates: administrators use them (level 3), others do not see them; a newer version in the library is announced after the template was used."""
    from apps.accounts.models import ModuleGrant, Role

    c, boss, b, tp = setup
    monkeypatch.setattr(tp, "library_dir", lambda: tmp_path / "lib")
    f = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 40); f.name = "home.png"
    assert c.post("/api/templates/", {"action": "create_from_backup", "backup": b.id, "key": "demo-site", "name": "Demo", "version": "1.0.0", "demo_only": "true", "previews": f}, format="multipart").status_code == 201
    plain = APIClient(); plain.force_authenticate(django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!"))
    assert plain.get("/api/templates/").status_code == 403  # no access to the module
    adm_user = django_user_model.objects.create_user("ad", "ad@x.nl", "pw12345678!")
    role = Role.objects.create(name="Sitebeheer", slug="sitebeheer")
    ModuleGrant.objects.create(module="templates", role=role, level=1)
    adm_user.roles.add(role)
    adm = APIClient(); adm.force_authenticate(adm_user)
    r = adm.get("/api/templates/").json()
    assert [t["key"] for t in r["templates"]] == ["demo-site"] and r["can_use"] is False and r["manage"] is False  # level 1: look only
    # a template that was used, and then a newer version arrives
    tp.record_applied("demo-site", "1.0.0")
    assert not c.get("/api/templates/").json()["templates"][0]["update"]
    zf = zipfile.ZipFile(tmp_path / "lib" / "demo-site-1.0.0.zip")
    new = io.BytesIO()
    with zipfile.ZipFile(new, "w") as z:
        for n in zf.namelist():
            z.writestr(n, zf.read(n).replace(b'"version": "1.0.0"', b'"version": "1.1.0"') if n == "template.json" else zf.read(n))
    tp.add_upload(io.BytesIO(new.getvalue()))
    row = c.get("/api/templates/").json()["templates"][0]
    assert row["version"] == "1.1.0" and row["applied_version"] == "1.0.0" and row["update"] is True


def test_the_migration_copies_the_page_rights_to_the_templates():
    from importlib import import_module

    assert hasattr(import_module("apps.accounts.migrations.0031_templates_grants"), "copy")


@pytest.mark.django_db
def test_the_templates_module_is_on_in_every_installation(settings):
    """A new installation (or an installation that is set again) has the module Templates on; so does a site that had it off before the module existed (migration)."""
    from apps.core import modules, presets
    from apps.core.models import ModuleState

    assert all("templates" in presets._wanted_modules(p) for p in presets.PRESETS)
    ModuleState.objects.update_or_create(key="templates", defaults={"enabled": False})
    modules.invalidate()
    assert modules.enabled("templates") is False
    from importlib import import_module

    class Apps:
        @staticmethod
        def get_model(app, name):
            return ModuleState

    import_module("apps.core.migrations.0063_templates_module_on").switch_on(Apps, None)
    modules.invalidate()
    assert modules.enabled("templates") is True
