# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The easy2edit site manager: websites register with the easy2edit server the first time and report every administrator login; the list is for a superadmin+."""
import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from apps.core import global_settings, sitemanager
from apps.core.models import EasySite

U = get_user_model()
JSON = "application/json"


def mk(email, **kw):
    return U.objects.create(username=email, email=email, **kw)


def auth(u):
    return {"HTTP_AUTHORIZATION": f"Token {Token.objects.get_or_create(user=u)[0].key}"}


def post(client, path, body, key=""):
    return client.post(path, json.dumps(body), content_type=JSON, **({"HTTP_X_EASY2EDIT_KEY": key} if key else {}), REMOTE_ADDR="203.0.113.7")


IID = "a1b2c3d4e5f60718293a4b5c6d7e8f90"


@pytest.mark.django_db
def test_a_website_registers_and_reports_logins(client):
    assert post(client, "/api/easy2edit/sites/register/", {"instance_id": IID}).status_code == 404  # not the easy2edit server
    sitemanager.set_server(True)
    global_settings.save({"base_domain": "easy2edit.com"})
    r = post(client, "/api/easy2edit/sites/register/", {"instance_id": IID, "name": "Blue BPS", "ip": "198.51.100.4", "version": "1.0.0", "build": "125"})
    assert r.status_code == 201
    key = r.json()["key"]
    s = EasySite.objects.get(instance_id=IID)
    assert s.url == "https://blue-bps.easy2edit.com" and s.url_generated and s.ip == "198.51.100.4" and s.seen_ip == "203.0.113.7"  # the address is made from the base domain
    assert key and s.token_hash != key  # only a hash of the key is kept
    assert post(client, "/api/easy2edit/sites/register/", {"instance_id": IID}).status_code == 403  # known: it has to use its key
    assert post(client, "/api/easy2edit/sites/ping/", {"event": "login", "role": "superadmin+"}, "wrong").status_code == 403
    assert post(client, "/api/easy2edit/sites/ping/", {"event": "login", "role": "superadmin+", "version": "1.0.0", "build": "126", "url": "https://www.blue.nl"}, key).status_code == 200
    s.refresh_from_db()
    assert s.login_count == 1 and s.last_login_role == "superadmin+" and s.build == "126" and s.url == "https://www.blue.nl" and not s.url_generated and s.last_login_at
    s.status = "blocked"
    s.save()
    assert post(client, "/api/easy2edit/sites/ping/", {"event": "login"}, key).status_code == 403


@pytest.mark.django_db
def test_two_sites_get_different_addresses(client):
    sitemanager.set_server(True)
    for i, iid in enumerate(("a" * 16, "b" * 16)):
        post(client, "/api/easy2edit/sites/register/", {"instance_id": iid, "name": "Same name"})
    assert sorted(EasySite.objects.values_list("url", flat=True)) == ["https://same-name-2.easy2edit.com", "https://same-name.easy2edit.com"]


@pytest.mark.django_db
def test_this_website_registers_once_and_then_pings(monkeypatch):
    calls = []

    def fake(url, body, key=""):
        calls.append((url.rsplit("/", 2)[-2], key, body["event"], body["role"]))
        return {"key": "KEY1"} if url.endswith("/register/") else {"ok": True}

    monkeypatch.setattr(sitemanager, "_post", fake)
    assert sitemanager.report("login", "admin")["ok"]
    assert sitemanager.report("login", "superadmin")["ok"]
    assert calls == [("register", "", "login", "admin"), ("ping", "KEY1", "login", "admin"), ("ping", "KEY1", "login", "superadmin")]  # first register (and report the login), after that only pings
    assert sitemanager.info()["last_error"] == "" and sitemanager.info()["last_ok_at"]


@pytest.mark.django_db
def test_a_failing_server_never_breaks_anything(monkeypatch):
    def boom(*a, **k):
        raise OSError("no connection")

    monkeypatch.setattr(sitemanager, "_post", boom)
    r = sitemanager.report("login", "admin")
    assert r["ok"] is False and "no connection" in sitemanager.info()["last_error"]


@pytest.mark.django_db
def test_the_server_lists_its_own_website():
    sitemanager.set_server(True)
    assert sitemanager.report("login", "superadmin+")["ok"]
    s = EasySite.objects.get(instance_id=sitemanager.instance_id())
    assert s.login_count == 1 and s.last_login_role == "superadmin+" and s.url


@pytest.mark.django_db
def test_roles_of_administrators():
    plain = mk("u@example.com")
    adm = mk("a@example.com", is_staff=True, is_superuser=True)
    plus = mk("p@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    assert sitemanager.role_of(plain) == "" and sitemanager.role_of(adm) == "superadmin" and sitemanager.role_of(plus) == "superadmin+"


@pytest.mark.django_db
def test_the_list_is_for_a_superadmin_plus(client):
    plain = mk("a@example.com", is_staff=True, is_superuser=True)
    plus = mk("p@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    sitemanager.set_server(True)
    post(client, "/api/easy2edit/sites/register/", {"instance_id": IID, "name": "Blue"})
    assert client.get("/api/system/sites/", **auth(plain)).status_code == 403
    r = client.get("/api/system/sites/", **auth(plus))
    assert r.status_code == 200 and r.json()["me"]["server"] and r.json()["sites"][0]["name"] == "Blue"
    pk = r.json()["sites"][0]["id"]
    assert client.patch(f"/api/system/sites/{pk}/", json.dumps({"name": "Nieuw"}), content_type=JSON, **auth(plain)).status_code == 403
    assert client.patch(f"/api/system/sites/{pk}/", json.dumps({"name": "Nieuw", "status": "blocked", "url": "https://x.nl"}), content_type=JSON, **auth(plus)).json()["status"] == "blocked"
    assert client.patch(f"/api/system/sites/{pk}/", json.dumps({"url": "ftp://x"}), content_type=JSON, **auth(plus)).status_code == 400
    assert client.delete(f"/api/system/sites/{pk}/", **auth(plus)).status_code == 204 and not EasySite.objects.exists()
