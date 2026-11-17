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
