# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""This website as a client of the easy2edit server: a live check of the connection, disconnect and connect again (superadmin+)."""
import io
import json
import urllib.error

import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from apps.core import resources, sitemanager
from apps.core.models import EasySite

U = get_user_model()
JSON = "application/json"


@pytest.fixture(autouse=True)
def _clean_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


def http_error(code):
    return urllib.error.HTTPError("https://api.easy2edit.com", code, "x", {}, io.BytesIO(b"{}"))


def plus():
    return U.objects.create(username="p", email="p@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)


def auth(u):
    return {"HTTP_AUTHORIZATION": f"Token {Token.objects.get_or_create(user=u)[0].key}"}


@pytest.mark.django_db
def test_the_live_check_says_what_is_going_on(monkeypatch):
    sitemanager._save(token="KEY")
    monkeypatch.setattr(sitemanager, "_post", lambda url, body, key="": {"status": "active", "callback_key": "CB"})
    c = sitemanager.check()
    assert c["state"] == "connected" and sitemanager.info()["last_error"] == "" and sitemanager._state()["callback_key"] == "CB"
    monkeypatch.setattr(sitemanager, "_post", lambda url, body, key="": {"status": "pending"})
    assert sitemanager.check()["state"] == "pending"  # known, but not approved yet

    def err(code):
        def f(url, body, key=""):
            raise http_error(code)

        return f

    monkeypatch.setattr(sitemanager, "_post", err(404))
    assert sitemanager.check()["state"] == "disabled"  # the server has no site manager on
    monkeypatch.setattr(sitemanager, "_post", err(403))
    assert sitemanager.check()["state"] == "refused" and sitemanager._state()["token"] == ""  # not known / blocked: the key is dropped

    def down(url, body, key=""):
        raise OSError("no route")

    sitemanager._save(token="KEY")
    monkeypatch.setattr(sitemanager, "_post", down)
    c = sitemanager.check()
    assert c["state"] == "offline" and "no route" in c["error"] and "no route" in sitemanager.info()["last_error"]  # not live: an error


@pytest.mark.django_db
def test_the_installation_that_is_the_server_says_so():
    sitemanager.set_server(True)
    assert sitemanager.check() == {"state": "server"}


@pytest.mark.django_db
def test_disconnect_tells_the_server_and_stops_everything(monkeypatch):
    sitemanager._save(token="KEY", callback_key="CB")
    seen = []
    monkeypatch.setattr(sitemanager, "_post", lambda url, body, key="": seen.append((url.rsplit("/", 2)[-2], key)) or {})
    sitemanager.disconnect()
    assert seen == [("disconnect", "KEY")]
    st = sitemanager._state()
    assert st["token"] == "" and st["callback_key"] == "" and st["disconnected"] is True
    seen.clear()
    assert sitemanager.report("login", "admin") == {"ok": False, "error": "disconnected"} and not seen  # no call at all
    assert sitemanager.check() == {"state": "disconnected"}
    with pytest.raises(resources.SourceUnavailable) as e:  # no library, no keys from the server
        resources._remote_call("", {"kind": "themas"})
    assert e.value.reason == "disconnected"
    monkeypatch.setattr(sitemanager, "_post", lambda url, body, key="": {"key": "NEWKEY", "callback_key": "NEWCB"} if url.endswith("/register/") else {})
    assert sitemanager.connect()["ok"] and sitemanager._state()["token"] == "NEWKEY" and not sitemanager._state()["disconnected"]


@pytest.mark.django_db
def test_disconnect_works_when_the_server_cannot_be_reached(monkeypatch):
    sitemanager._save(token="KEY")

    def down(url, body, key=""):
        raise OSError("no route")

    monkeypatch.setattr(sitemanager, "_post", down)
    sitemanager.disconnect()
    assert sitemanager._state()["disconnected"] is True and sitemanager._state()["token"] == ""


@pytest.mark.django_db
def test_the_server_forgets_a_website_that_disconnects_and_lets_it_register_again(client):
    sitemanager.set_server(True)
    r = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": "f" * 20, "name": "Blue"}), content_type=JSON).json()
    EasySite.objects.update(status="active")
    assert client.post("/api/easy2edit/sites/disconnect/", "{}", content_type=JSON, HTTP_X_EASY2EDIT_KEY="wrong").status_code == 403
    assert client.post("/api/easy2edit/sites/disconnect/", "{}", content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"]).status_code == 200
    s = EasySite.objects.get()
    assert s.status == "disconnected" and not s.token_hash and not s.callback_key_enc
    assert client.post("/api/easy2edit/sites/ping/", "{}", content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"]).status_code == 403  # the old key is gone
    again = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": "f" * 20, "name": "Blue"}), content_type=JSON)
    assert again.status_code == 201 and EasySite.objects.count() == 1 and EasySite.objects.get().status == "pending"  # the same record, waiting for approval again


@pytest.mark.django_db
def test_the_actions_are_for_a_superadmin_plus(client, monkeypatch):
    plain = U.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True)
    p = plus()
    monkeypatch.setattr(sitemanager, "_post", lambda url, body, key="": {"status": "active"})
    sitemanager._save(token="KEY")
    for action in ("check", "disconnect", "connect"):
        assert client.post("/api/system/sites/", json.dumps({"action": action}), content_type=JSON, **auth(plain)).status_code == 403
    r = client.post("/api/system/sites/", json.dumps({"action": "check"}), content_type=JSON, **auth(p))
    assert r.status_code == 200 and r.json()["check"]["state"] == "connected"
    r = client.post("/api/system/sites/", json.dumps({"action": "disconnect"}), content_type=JSON, **auth(p))
    assert r.status_code == 200 and r.json()["me"]["disconnected"] is True


def server_with_site(client, status="active"):
    from apps.core import remote_info  # noqa: F401

    sitemanager.set_server(True)
    r = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": "9" * 20, "name": "Blue"}), content_type=JSON).json()
    EasySite.objects.update(status=status)
    return r


@pytest.mark.django_db
def test_blocking_a_website_takes_it_offline_with_a_message(client, monkeypatch):
    p = plus()
    r = server_with_site(client)
    calls = []
    monkeypatch.setattr(sitemanager, "call_site", lambda site, path, params=None, body=None, allow_blocked=False: calls.append((path, body, allow_blocked)) or {"online": False})
    sid = EasySite.objects.get().pk
    out = client.patch(f"/api/system/sites/{sid}/", json.dumps({"status": "blocked", "block_message": "Betaling ontbreekt."}), content_type=JSON, **auth(p))
    assert out.status_code == 200 and out.json()["offline"] == {"ok": True} and out.json()["status"] == "blocked"
    assert calls == [("state", {"online": False, "message": "Betaling ontbreekt."}, True)]  # offline, with the message, while its key still works
    s = EasySite.objects.get()
    assert s.blocked_offline and s.block_message == "Betaling ontbreekt."
    out = client.patch(f"/api/system/sites/{sid}/", json.dumps({"status": "active"}), content_type=JSON, **auth(p))
    assert out.json()["offline"] == {"ok": True} and calls[-1] == ("state", {"online": True, "message": ""}, True)  # released: online again
    assert not EasySite.objects.get().blocked_offline


@pytest.mark.django_db
def test_a_website_that_cannot_be_reached_is_blocked_anyway(client, monkeypatch):
    p = plus()
    server_with_site(client)

    def down(site, path, params=None, body=None, allow_blocked=False):
        raise sitemanager.RemoteError("unreachable", "De website is niet bereikbaar via zijn API.")

    monkeypatch.setattr(sitemanager, "call_site", down)
    sid = EasySite.objects.get().pk
    out = client.patch(f"/api/system/sites/{sid}/", json.dumps({"status": "blocked"}), content_type=JSON, **auth(p))
    assert out.status_code == 200 and out.json()["status"] == "blocked" and out.json()["offline"]["ok"] is False and out.json()["offline"]["reason"] == "unreachable"
    s = EasySite.objects.get()
    assert s.status == "blocked" and not s.blocked_offline and s.block_message == sitemanager.BLOCK_MESSAGE  # (the standard message)


@pytest.mark.django_db
def test_a_website_that_is_not_approved_is_not_called(client, monkeypatch):
    p = plus()
    server_with_site(client, status="pending")
    calls = []
    monkeypatch.setattr(sitemanager, "call_site", lambda *a, **k: calls.append(1))
    sid = EasySite.objects.get().pk
    out = client.patch(f"/api/system/sites/{sid}/", json.dumps({"status": "blocked"}), content_type=JSON, **auth(p))
    assert out.json()["offline"] is None and not calls and EasySite.objects.get().status == "blocked"


@pytest.mark.django_db
def test_the_server_tells_a_blocked_website_so(client):
    r = server_with_site(client)
    EasySite.objects.update(status="blocked", block_message="Geblokkeerd tot nader order.")
    p = client.post("/api/easy2edit/sites/ping/", "{}", content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"])
    assert p.status_code == 403 and p.json()["reason"] == "blocked" and p.json()["message"] == "Geblokkeerd tot nader order."
    assert client.post("/api/easy2edit/sites/ping/", "{}", content_type=JSON, HTTP_X_EASY2EDIT_KEY="unknown").json().get("reason") is None  # an unknown key is not "blocked"


@pytest.mark.django_db
def test_a_website_that_hears_it_is_blocked_goes_offline_and_comes_back(monkeypatch):
    from apps.core import remote_info, system

    sitemanager._save(token="KEY")

    def blocked(url, body, key=""):
        raise urllib.error.HTTPError(url, 403, "x", {}, io.BytesIO(json.dumps({"reason": "blocked", "message": "Niet beschikbaar."}).encode()))

    monkeypatch.setattr(sitemanager, "_post", blocked)
    assert sitemanager.report("login", "admin") == {"ok": False, "error": "blocked"}
    assert remote_info.status()["online"] is False and system.get()["maintenance_message"] == "Niet beschikbaar."
    assert sitemanager._state()["token"] == "KEY"  # the key stays: it is blocked, not unknown
    assert sitemanager.check() == {"state": "blocked"}
    monkeypatch.setattr(sitemanager, "_post", lambda url, body, key="": {"status": "active"})
    assert sitemanager.check()["state"] == "connected"  # released: online again
    assert remote_info.status()["online"] is True and not sitemanager._state()["blocked_offline"]


# ── a website that is live registers itself, named by its address ──────────────
@pytest.mark.django_db
def test_the_live_address(settings):
    from apps.core import system

    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "https://192.168.1.5", "https://demo.example.org", "https://second.example.org"]
    assert sitemanager.live_url() == "https://demo.example.org"  # the first public https address of the environment
    system.save({"frontend_url": "https://www.mine.nl"})
    assert sitemanager.live_url() == "https://www.mine.nl"  # the address in Basisgegevens comes first
    system.save({"frontend_url": ""})
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "https://localhost", "https://10.0.0.4", "http://demo.example.org"]
    assert sitemanager.live_url() == ""  # a development machine / local network / no https: not live


@pytest.mark.django_db
def test_a_website_without_a_name_is_named_by_its_address(settings):
    from apps.core import system

    settings.CORS_ALLOWED_ORIGINS = ["https://demo.example.org"]
    p = sitemanager.payload("register")
    assert p["name"] == "https://demo.example.org" and p["url"] == "https://demo.example.org"
    system.save({"site_name": "Blue BPS"})
    assert sitemanager.payload("register")["name"] == "Blue BPS"  # once it has a name


@pytest.mark.django_db
def test_a_live_website_registers_itself_at_its_start(settings, monkeypatch):
    settings.CORS_ALLOWED_ORIGINS = ["https://demo.example.org"]
    monkeypatch.setattr(sitemanager, "disabled", lambda: False)
    calls = []

    def fake(url, body, key=""):
        calls.append((url.rsplit("/", 2)[-2], body["event"], body["name"], key))
        return {"key": "K1", "callback_key": "CB"} if url.endswith("/register/") else {"ok": True}

    monkeypatch.setattr(sitemanager, "_post", fake)
    assert sitemanager.auto_register() == "registered"
    assert calls == [("register", "register", "https://demo.example.org", "")]  # named by its address; nobody logged in
    calls.clear()
    assert sitemanager.auto_register() == "alive" and calls == [("ping", "sync", "https://demo.example.org", "K1")]  # the next start: it only reports that it is alive
    sitemanager.disconnect()
    calls.clear()
    assert sitemanager.auto_register() == "skipped" and not calls  # disconnected on purpose: nothing


@pytest.mark.django_db
def test_a_development_machine_does_not_register_itself(settings, monkeypatch):
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
    monkeypatch.setattr(sitemanager, "disabled", lambda: False)
    monkeypatch.setattr(sitemanager, "_post", lambda *a, **k: pytest.fail("no call expected"))
    assert sitemanager.auto_register() == "not live"


@pytest.mark.django_db
def test_a_name_that_is_changed_in_the_site_manager_stays(client):
    p = plus()
    sitemanager.set_server(True)
    r = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": "8" * 20, "name": "https://demo.example.org"}), content_type=JSON).json()
    sid = EasySite.objects.get().pk
    assert client.patch(f"/api/system/sites/{sid}/", json.dumps({"name": "Demo klant"}), content_type=JSON, **auth(p)).json()["name"] == "Demo klant"
    client.post("/api/easy2edit/sites/ping/", json.dumps({"event": "login", "name": "https://demo.example.org"}), content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"])
    assert EasySite.objects.get().name == "Demo klant"  # the website does not overwrite it at its next report


# ── licence and installation of a website, shown in the Site manager ───────────
@pytest.mark.django_db
def test_licence_and_installation_of_a_website():
    from datetime import date, timedelta

    from apps.core import presets, system
    from apps.core.models import License

    assert sitemanager.licence_and_installation() == {"license": {"state": "none", "until": ""}, "installation": {"state": "empty", "name": ""}}  # a fresh, empty standard installation
    License.objects.update_or_create(pk=1, defaults={"number": "AAAA-BBBB-CCCC-DDDD", "valid_until": date.today() + timedelta(days=30)})
    system.license_changed()
    got = sitemanager.licence_and_installation()
    assert got["license"]["state"] == "active" and got["license"]["until"] == (date.today() + timedelta(days=30)).isoformat()
    License.objects.filter(pk=1).update(valid_until=date.today() - timedelta(days=1))
    system.license_changed()
    assert sitemanager.licence_and_installation()["license"]["state"] == "expired"
    system.save({"site_name": "Blue BPS"})
    assert sitemanager.licence_and_installation()["installation"]["state"] == "installed"  # it has a name of its own: set up
    system.save({"site_name": ""})
    d = presets._data()
    d["active_preset"] = "wizard"
    presets._save_data(d)
    assert sitemanager.licence_and_installation()["installation"] == {"state": "installed", "name": "wizard"}  # installed with the wizard


@pytest.mark.django_db
def test_the_server_shows_licence_and_installation(client):
    p = plus()
    sitemanager.set_server(True)
    body = {"instance_id": "7" * 20, "name": "https://demo.example.org", "license": {"state": "none", "until": ""}, "installation": {"state": "empty", "name": ""}}
    r = client.post("/api/easy2edit/sites/register/", json.dumps(body), content_type=JSON).json()
    row = client.get("/api/system/sites/", **auth(p)).json()["sites"][0]
    assert row["license_state"] == "none" and row["install_state"] == "empty"
    client.post("/api/easy2edit/sites/ping/", json.dumps({"event": "login", "license": {"state": "active", "until": "2027-01-31"}, "installation": {"state": "installed", "name": "Webshop"}}), content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"])
    row = client.get("/api/system/sites/", **auth(p)).json()["sites"][0]
    assert row["license_state"] == "active" and row["license_until"] == "2027-01-31" and row["install_state"] == "installed" and row["install_name"] == "Webshop"  # it follows the website
    client.post("/api/easy2edit/sites/ping/", json.dumps({"event": "login", "license": {"state": "nonsense"}, "installation": "x"}), content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"])
    assert client.get("/api/system/sites/", **auth(p)).json()["sites"][0]["license_state"] == "active"  # nonsense is ignored
