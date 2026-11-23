# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo mode: planned restores, demo users that come back after a restore, nothing sent, the creator files in the backup."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient


@pytest.fixture
def boss(django_user_model):
    u = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(u)
    return c, u


@pytest.mark.django_db
def test_settings_are_for_superadmins_only(boss, django_user_model):
    c, _ = boss
    plain = APIClient(); plain.force_authenticate(django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!"))
    assert plain.get("/api/demo/settings/").status_code == 403
    r = c.put("/api/demo/settings/", {"times": ["3:00", "13:30"], "warn_minutes": 5, "enabled": True}, format="json")
    assert r.status_code == 400 and len(r.json()["problems"]) == 2  # no backup, no demo user: it does not go on
    assert c.get("/api/demo/settings/").json()["times"] == ["03:00", "13:30"] and not c.get("/api/demo/settings/").json()["enabled"]
    assert c.put("/api/demo/settings/", {"times": ["25:00"]}, format="json").status_code == 400


def ready(c, u, tmp_path, settings):
    """A backup, a time and a demo user: then the demo mode may go on."""
    from apps.backups import service

    settings.BACKUPS_DIR = tmp_path
    b = service.create("manual", u, "Demo")
    assert c.post("/api/demo/users/", {"email": "d@example.com", "password": "demo1234"}, format="json").status_code == 201
    return b


@pytest.mark.django_db
def test_demo_is_simulated_and_shown_publicly(boss, tmp_path, settings):
    from apps.sandbox import service

    c, _ = boss
    assert service.active("email") is False
    b = ready(c, _, tmp_path, settings)
    assert c.put("/api/demo/settings/", {"enabled": True}, format="json").status_code == 400
    assert c.put("/api/demo/settings/", {"enabled": True, "backup": b.id, "times": ["03:00"]}, format="json").json()["enabled"]
    assert service.active("email") and service.active("sms") and service.code_on_screen()
    assert service.get(raw=True)["enabled"] is False  # the stored sandbox settings are not changed by it
    st = APIClient().get("/api/sandbox/status/").json()["demo"]
    assert st["enabled"] and st["restoring"] is False and st["users"][0]["email"] == "d@example.com"


@pytest.mark.django_db
def test_demo_users_are_made_and_shown(boss, django_user_model, tmp_path, settings):
    settings.BACKUPS_DIR = tmp_path
    from apps.accounts.models import Role

    c, _ = boss
    Role.objects.create(name="Redacteur", slug="redacteur")
    r = c.post("/api/demo/users/", {"email": "Demo@Example.com", "first_name": "Dina", "password": "demo1234", "note": "Redacteur", "roles": ["Redacteur", "Bestaatniet"]}, format="json")
    assert r.status_code == 201
    u = django_user_model.objects.get(email="demo@example.com")
    assert u.check_password("demo1234") and list(u.roles.values_list("name", flat=True)) == ["Redacteur"] and not u.is_staff
    c.put("/api/demo/settings/", {"enabled": True, "times": ["03:00"], "backup": __import__("apps.backups.service", fromlist=["x"]).create("manual", None).id}, format="json")
    users = APIClient().get("/api/sandbox/status/").json()["demo"]["users"]
    users = [x for x in users if x["email"] == "demo@example.com"]
    assert users == [{"email": "demo@example.com", "password": "demo1234", "name": "Dina", "note": "Redacteur"}]
    c.put("/api/demo/settings/", {"show_on_login": False}, format="json")
    assert APIClient().get("/api/sandbox/status/").json()["demo"]["users"] == []
    # a superadmin can never be a demo user
    assert c.post("/api/demo/users/", {"email": "bo@x.nl", "password": "demo1234"}, format="json").status_code == 400
    # the user is made again after the account is gone
    django_user_model.objects.filter(email="demo@example.com").delete()
    from apps.sandbox import demo
    assert demo.sync_users() == 1 and django_user_model.objects.filter(email="demo@example.com").exists()


@pytest.mark.django_db
def test_restore_at_the_planned_time_and_the_message(boss, monkeypatch, tmp_path, settings):
    from apps.backups import service
    from apps.sandbox import demo

    settings.BACKUPS_DIR = tmp_path
    c, u = boss
    b = service.create("manual", u, "Demo")
    ready(c, u, tmp_path, settings)
    assert c.put("/api/demo/settings/", {"enabled": True, "backup": b.id, "times": ["03:00", "13:00"]}, format="json").status_code == 200
    cfg = demo.get()
    assert not demo.is_due(cfg)  # switching it on does not restore at once
    cfg.last_restore_at = timezone.now() - timedelta(days=2)
    cfg.save()
    assert demo.is_due(cfg)
    seen = []
    monkeypatch.setattr(service, "restore", lambda *a, **k: seen.append((demo.restoring(), k.get("safety"))) or ([], None))
    assert demo.run_due() is True
    assert seen == [(True, False)]  # the message was on during the restore, no safety backup
    assert not demo.restoring() and demo.get().last_status == "ok"
    assert demo.run_due() is False  # the same moment is not restored twice
    # the settings and users of the demo are not in a backup
    from apps.backups import full
    assert "sandbox.demouser" in full.EXCLUDE and "sandbox.demosettings" in full.EXCLUDE


@pytest.mark.django_db
def test_creator_part_in_backup(boss, tmp_path, settings):
    from apps.backups import service
    from apps.core.models import SiteDesignJob

    settings.BACKUPS_DIR = tmp_path
    _, u = boss
    job = SiteDesignJob.objects.create(user=u, name="Mijn ontwerp", status="done", files={"index.html": "<p>hi</p>"})
    b = service.create("manual", u)
    assert "creator" in [p["key"] for p in b.parts]
    SiteDesignJob.objects.all().delete()
    results, _ = service.restore(b, ["creator"], u)
    assert results[0]["key"] == "creator" and results[0]["ok"]
    assert SiteDesignJob.objects.get(pk=job.pk).files == {"index.html": "<p>hi</p>"}


@pytest.mark.django_db
def test_standard_demo_data_a_user_an_admin_and_companies(boss, django_user_model):
    from apps.accounts.models import Role
    from apps.core.models import Entity
    from apps.sandbox import demo

    c, _ = boss
    Role.objects.update_or_create(slug="admin", defaults={"name": "Admin", "all_permissions": True})
    r = c.post("/api/demo/seed/", {}, format="json").json()
    assert [u["note"] for u in r["users"]] == ["Gebruiker", "Beheerder (admin)"] and len(r["entities"]) == 2
    admin = django_user_model.objects.get(email="demo.admin@example.com")
    user = django_user_model.objects.get(email="demo.gebruiker@example.com")
    assert not admin.is_staff and not admin.is_superuser and admin.roles.filter(all_permissions=True).exists() and not user.roles.exists()
    firm = Entity.objects.get(name="Demo Bedrijf B.V.")
    assert set(firm.users.values_list("email", flat=True)) == {"demo.gebruiker@example.com", "demo.admin@example.com"}
    # after a restore everything is made again with the same data, also when the users and companies are gone
    django_user_model.objects.filter(email__startswith="demo.").delete(); Entity.objects.filter(name__startswith="Demo").delete()
    demo.sync_users(); demo.sync_entities()
    assert django_user_model.objects.get(email="demo.admin@example.com").check_password("demo-admin")
    assert Entity.objects.get(name="Demo Vereniging").users.count() == 1
    # even a superadmin's e-mail can never be turned into a demo user
    django_user_model.objects.create_user("su", "su@example.com", "pw12345678!", is_staff=True)
    assert c.post("/api/demo/users/", {"email": "su@example.com", "password": "demo1234"}, format="json").status_code == 400


@pytest.mark.django_db
def test_demo_accounts_may_switch_modules_and_plugins_only_in_demo_mode(boss, django_user_model, tmp_path, settings):
    from apps.sandbox import demo

    c, u = boss
    c.post("/api/demo/seed/", {}, format="json")
    d = APIClient(); d.force_authenticate(django_user_model.objects.get(email="demo.admin@example.com"))
    assert d.get("/api/modules/all/").status_code == 403 and d.get("/api/plugins/").status_code == 403  # demo mode is off
    assert not d.get("/api/auth/me/").json().get("demo_switch")
    b = ready(c, u, tmp_path, settings)
    c.put("/api/demo/settings/", {"enabled": True, "backup": b.id, "times": ["03:00"]}, format="json")
    assert demo.enabled()
    assert d.get("/api/modules/all/").status_code == 200 and d.get("/api/plugins/").status_code == 200
    assert d.patch("/api/modules/seo/", {"enabled": True}, format="json").status_code in (200, 400, 404)  # allowed: a module may still say no for its own reasons
    assert d.patch("/api/modules/owner_only_check/", {"owner_only": True}, format="json").status_code in (403, 404)  # never the superadmin+ setting
    assert d.delete("/api/plugins/hello/").status_code == 403  # only on and off, no removing
    assert d.get("/api/auth/me/").json()["demo_switch"] is True
    plain = APIClient(); plain.force_authenticate(django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!"))
    from django.core.cache import cache
    cache.clear()  # (a test client has no Authorization header, so the answer to the demo account was kept as a public one)
    assert plain.get("/api/modules/all/").status_code == 403
