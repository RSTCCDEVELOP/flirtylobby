# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The easy2edit server asks a website for information (users, reseller, AI) and takes it offline / online, through its API with a callback key."""
import io
import json
import urllib.request
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from apps.core import remote_info, sitemanager, system
from apps.core.models import EasySite

U = get_user_model()
JSON = "application/json"
IID = "d1e2f3a4b5c60718293a4b5c6d7e8f91"


def mk(email, **kw):
    return U.objects.create(username=email, email=email, **kw)


def auth(u):
    return {"HTTP_AUTHORIZATION": f"Token {Token.objects.get_or_create(user=u)[0].key}"}


def register(client, approve=True, api="https://blue.example.org"):
    r = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": IID, "name": "Blue", "api_url": api, "url": "https://www.blue.example.org"}), content_type=JSON)
    if approve:
        EasySite.objects.update(status="active")
    return r.json()


@pytest.fixture(autouse=True)
def _clean_cache():
    from django.core.cache import cache

    cache.clear()  # (the counters of wrong guesses must not carry over to the next test)
    yield
    cache.clear()


@pytest.fixture
def plus(db):
    return mk("p@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)


@pytest.mark.django_db
def test_a_website_gets_a_callback_key_and_the_server_keeps_it_encrypted(client):
    sitemanager.set_server(True)
    r = register(client)
    assert r["callback_key"] and len(r["callback_key"]) > 20
    s = EasySite.objects.get()
    assert s.api_url == "https://blue.example.org" and s.callback_key_enc and r["callback_key"] not in s.callback_key_enc  # encrypted
    p = client.post("/api/easy2edit/sites/ping/", json.dumps({"event": "login"}), content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"])
    assert p.status_code == 200 and "callback_key" not in p.json()  # it has one: nothing new
    p = client.post("/api/easy2edit/sites/ping/", json.dumps({"event": "login", "callback": "missing"}), content_type=JSON, HTTP_X_EASY2EDIT_KEY=r["key"])
    assert p.json()["callback_key"]  # a website that lost its key gets a new one


@pytest.mark.django_db
def test_the_website_only_answers_the_key_it_was_given(client):
    sitemanager._save(callback_key="GOODKEY")
    assert client.get("/api/easy2edit/remote/info/?part=users").status_code == 403
    assert client.get("/api/easy2edit/remote/info/?part=users", HTTP_X_EASY2EDIT_CALLBACK="wrong").status_code == 403
    assert client.get("/api/easy2edit/remote/info/?part=users", HTTP_X_EASY2EDIT_CALLBACK="GOODKEY").status_code == 200
    assert client.get("/api/easy2edit/remote/info/?part=nothing", HTTP_X_EASY2EDIT_CALLBACK="GOODKEY").status_code == 400
    assert client.post("/api/easy2edit/remote/state/", json.dumps({"online": False}), content_type=JSON).status_code == 403
    for _ in range(25):  # guessing is stopped
        client.get("/api/easy2edit/remote/info/?part=users", HTTP_X_EASY2EDIT_CALLBACK="guess")
    assert client.get("/api/easy2edit/remote/info/?part=users", HTTP_X_EASY2EDIT_CALLBACK="GOODKEY").status_code == 403


@pytest.mark.django_db
def test_what_a_website_tells():
    mk("a@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    mk("u1@example.com")
    mk("u2@example.com", is_active=False)
    u = remote_info.users()
    assert u["total"] == 3 and u["active"] == 2 and u["blocked"] == 1 and u["admins"] == 1 and u["superadmin_plus"] == 1
    assert u["admin_accounts"][0]["email"] == "a@example.com" and "u1@example.com" not in json.dumps(u)  # the administrators, not the end users
    r = remote_info.reseller()
    assert set(r) == {"reseller", "licence"} and "number" in r["licence"]
    from apps.integrations.models import AiUsage

    AiUsage.objects.create(group="user", owner="system", billable=True, cost=Decimal("1.5"), charged=Decimal("2.5"), tokens_in=100, tokens_out=50)
    AiUsage.objects.create(group="user", owner="system", billable=False, cost=Decimal("9"), charged=Decimal("9"))  # a cost of the reseller himself: not charged
    a = remote_info.ai()
    assert a["total"]["calls"] == 2 and a["total"]["end_user_price"] == 2.5 and a["total"]["tokens"] == 150  # the end user price, never the purchase price
    assert "cost" not in json.dumps(a)


@pytest.mark.django_db
def test_offline_and_online():
    assert remote_info.status()["online"] is True
    assert remote_info.set_online(False, "Onderhoud tot 12:00")["online"] is False
    assert system.maintenance_on() and system.get()["maintenance_message"] == "Onderhoud tot 12:00"
    assert remote_info.set_online(True)["online"] is True and not system.get()["maintenance"]


class Route:
    """urlopen that goes to the Django test client instead of the network: the call of the easy2edit server to the website."""

    def __init__(self, client):
        self.client, self.seen = client, []

    def __call__(self, req, timeout=0):
        from urllib.parse import urlparse

        u = urlparse(req.full_url)
        self.seen.append((req.get_method(), u.path, req.get_header("X-easy2edit-callback")))
        h = {"HTTP_X_EASY2EDIT_CALLBACK": req.get_header("X-easy2edit-callback") or ""}
        r = self.client.post(u.path, req.data.decode(), content_type=JSON, **h) if req.get_method() == "POST" else self.client.get(u.path + ("?" + u.query if u.query else ""), **h)
        if r.status_code != 200:
            raise urllib.error.HTTPError(req.full_url, r.status_code, "x", {}, io.BytesIO(r.content))

        class Out(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        return Out(r.content)


@pytest.mark.django_db
def test_the_server_asks_a_website_through_its_api(client, plus, monkeypatch, settings):
    settings.DEBUG = True  # (the address of the test website is not a public one)
    sitemanager.set_server(True)
    reg = register(client)
    sitemanager._save(callback_key=reg["callback_key"])  # (the website keeps the key it was given)
    route = Route(client)
    monkeypatch.setattr(urllib.request, "urlopen", route)
    monkeypatch.setattr(sitemanager, "_safe_base", lambda site: "http://testserver")
    sid = EasySite.objects.get().pk
    mk("e@example.com")
    r = client.get(f"/api/system/sites/{sid}/info/?part=users", **auth(plus))
    assert r.status_code == 200 and r.json()["total"] >= 1 and route.seen[0][1] == "/api/easy2edit/remote/info/" and route.seen[0][2] == reg["callback_key"]
    assert client.get(f"/api/system/sites/{sid}/info/?part=ai", **auth(plus)).json()["currency"]
    off = client.post(f"/api/system/sites/{sid}/online/", json.dumps({"online": False}), content_type=JSON, **auth(plus))
    assert off.status_code == 200 and off.json()["online"] is False and system.maintenance_on()
    assert client.post(f"/api/system/sites/{sid}/online/", json.dumps({"online": True}), content_type=JSON, **auth(plus)).json()["online"] is True


@pytest.mark.django_db
def test_only_a_superadmin_plus_and_only_for_an_approved_website(client, plus, settings):
    plain = mk("a@example.com", is_staff=True, is_superuser=True)
    sitemanager.set_server(True)
    register(client, approve=False)
    sid = EasySite.objects.get().pk
    assert client.get(f"/api/system/sites/{sid}/info/?part=users", **auth(plain)).status_code == 403
    r = client.get(f"/api/system/sites/{sid}/info/?part=users", **auth(plus))
    assert r.status_code == 502 and r.json()["reason"] == "pending"  # first approve it
    assert client.post(f"/api/system/sites/{sid}/online/", json.dumps({"online": False}), content_type=JSON, **auth(plain)).status_code == 403
    EasySite.objects.update(status="active", callback_key_enc="")
    assert client.get(f"/api/system/sites/{sid}/info/?part=users", **auth(plus)).json()["reason"] == "nokey"


@pytest.mark.django_db
def test_a_website_cannot_make_us_call_an_inside_address(client, settings):
    settings.DEBUG = False
    sitemanager.set_server(True)
    register(client, api="http://192.168.1.5")
    s = EasySite.objects.get()
    with pytest.raises(sitemanager.RemoteError) as e:
        sitemanager._safe_base(s)
    assert e.value.reason == "unsafe"  # not https
    s.api_url = "https://localhost"
    with pytest.raises(sitemanager.RemoteError):
        sitemanager._safe_base(s)  # an address in our own network


class FakeStats:
    """The service of the plugin Statistics, with a few numbers."""

    DATA = {"visitor": [1, 2, 3], "page_view": [4, 5, 6], "search_click": [0, 1, 0], "ai_click": [0, 0, 1], "bot_search": [2, 2, 2], "bot_ai": [1, 0, 0], "bot_other": [0, 0, 5]}

    def series(self, source, event, days=30):
        return [{"x": f"2026-11-0{i + 1}", "y": y} for i, y in enumerate(self.DATA.get(event, [0, 0, 0]))]

    def top(self, source, event, days=30, limit=10):
        return {"referral": [{"label": "search:google", "value": 7}, {"label": "search:bing", "value": 2}, {"label": "direct:Direct", "value": 5}],
                "bot_visit": [{"label": "ai:GPTBot", "value": 9}, {"label": "search:Googlebot", "value": 30}],
                "page_view": [{"label": "/", "value": 12}], "landing": [{"label": "/blog", "value": 3}]}.get(event, [])


@pytest.mark.django_db
def test_the_page_statistics_of_a_website(monkeypatch):
    assert remote_info.stats() == {"available": False}  # the plugin Statistics is not on
    from apps.plugins import facade

    monkeypatch.setattr(facade, "mod", lambda plugin, name: FakeStats() if (plugin, name) == ("statistics", "service") else None)
    d = remote_info.stats()
    assert d["available"] and d["dates"] == ["2026-11-01", "2026-11-02", "2026-11-03"]
    assert d["series"]["visitors"] == [1, 2, 3] and d["totals"]["page_views"] == 15 and d["totals"]["bot_other"] == 5
    assert d["referrers"][0] == {"label": "search", "value": 9}  # grouped per kind
    assert {"label": "GPTBot", "ai": True, "value": 9} in d["bots"] and d["pages"][0]["label"] == "/"


@pytest.mark.django_db
def test_the_energy_of_a_website():
    d = remote_info.energy()
    assert set(d) >= {"summary", "benchmark", "series", "pages", "advice"}
    assert set(d["advice"]) >= {"current", "after_apply", "after_all", "items"} and "rating" in d["advice"]["current"]
    assert all(set(i) == {"key", "status", "saving", "applicable"} for i in d["advice"]["items"])  # no page paths or other details
    assert "stats" in remote_info.PARTS and "energy" in remote_info.PARTS


@pytest.mark.django_db
def test_the_plugin_statistics_can_be_switched_through_the_api(monkeypatch):
    from apps.plugins import installer, switch
    from apps.plugins.models import Plugin

    calls = []

    def fake_switch(p, want, with_requires=False):
        calls.append((p.name, want, with_requires))
        Plugin.objects.filter(pk=p.pk).update(enabled=want)
        p.refresh_from_db()
        return p

    monkeypatch.setattr(switch, "set_enabled", fake_switch)
    monkeypatch.setattr(installer, "install_from_library", lambda name: Plugin.objects.create(name=name, title="Statistics", enabled=False))  # (not installed yet: from the library)
    assert remote_info.action({"action": "plugin", "name": "statistics", "enabled": True}) == {"ok": True, "enabled": True}
    assert remote_info.action({"action": "plugin", "name": "statistics", "enabled": False}) == {"ok": True, "enabled": False}
    assert calls == [("statistics", True, True), ("statistics", False, True)]
    with pytest.raises(ValueError):
        remote_info.action({"action": "plugin", "name": "webshop", "enabled": True})  # only the plugin Statistics can be switched from here
    with pytest.raises(ValueError):
        remote_info.action({"action": "something"})

    def refuse(p, want, with_requires=False):
        raise switch.SwitchError("Eerst deze plugins uitzetten: seo.")

    monkeypatch.setattr(switch, "set_enabled", refuse)
    with pytest.raises(ValueError, match="Eerst deze plugins"):
        remote_info.action({"action": "plugin", "name": "statistics", "enabled": False})  # the message of the plugin screen goes along


@pytest.mark.django_db
def test_a_measurement_of_the_energy_use_can_be_started(monkeypatch):
    from apps.energy import service

    seen = []
    monkeypatch.setattr(service, "scan", lambda base, paths=None: seen.append(base))
    with pytest.raises(ValueError, match="website-adres"):
        remote_info.action({"action": "energy_scan"})  # no address set
    system.save({"frontend_url": "https://www.blue.example.org"})
    assert remote_info.action({"action": "energy_scan"}) == {"ok": True, "started": True} and seen == ["https://www.blue.example.org"]


@pytest.mark.django_db
def test_the_actions_go_through_the_api_with_the_callback_key(client, plus, monkeypatch, settings):
    settings.DEBUG = True
    sitemanager.set_server(True)
    reg = register(client)
    sitemanager._save(callback_key=reg["callback_key"])
    monkeypatch.setattr(urllib.request, "urlopen", Route(client))
    monkeypatch.setattr(sitemanager, "_safe_base", lambda site: "http://testserver")
    sid = EasySite.objects.get().pk
    assert client.post("/api/easy2edit/remote/action/", json.dumps({"action": "energy_scan"}), content_type=JSON).status_code == 403  # no key
    system.save({"frontend_url": ""})
    r = client.post(f"/api/system/sites/{sid}/action/", json.dumps({"action": "energy_scan"}), content_type=JSON, **auth(plus))
    assert r.status_code == 502 and r.json()["reason"] == "refused" and "website-adres" in r.json()["detail"]  # the reason of the website is shown
    plain = mk("a@example.com", is_staff=True, is_superuser=True)
    assert client.post(f"/api/system/sites/{sid}/action/", json.dumps({"action": "energy_scan"}), content_type=JSON, **auth(plain)).status_code == 403


@pytest.mark.django_db
def test_what_has_to_be_brought_up_to_date():
    d = remote_info.maintenance()
    assert set(d) >= {"version", "build", "pending_migrations", "pending_count", "library_updates", "needs_update", "check_needed", "online", "update"}
    assert d["pending_migrations"] == [] and d["pending_count"] == 0  # (the test database is up to date)
    assert "maintenance" in remote_info.PARTS


@pytest.mark.django_db
def test_the_update_runs_the_steps_and_can_keep_the_website_offline_meanwhile(monkeypatch):
    from apps.core import sysupdate

    seen = []

    def fake_run(step, user):
        seen.append((step, remote_info.status()["online"], user.is_staff))
        return {"ok": step != "plugins", "message": "klaar" if step != "plugins" else "plugin kapot"}

    monkeypatch.setattr(sysupdate, "run", fake_run)
    assert remote_info.action({"action": "update", "offline": True}) == {"ok": True, "started": True}
    assert [x[0] for x in seen] == [k for k, _l in sysupdate.STEPS]  # every step, in order
    assert all(online is False and staff for _s, online, staff in seen)  # offline while it runs, as the system itself
    assert remote_info.status()["online"] is True  # and back online afterwards
    st = remote_info.maintenance()["update"]
    assert st["running"] is False and st["finished"] and len(st["steps"]) == len(sysupdate.STEPS)
    assert "plugin kapot" in st["error"] and any(not x["ok"] for x in st["steps"])  # a step that fails does not stop the others, and is reported
    seen.clear()
    remote_info.action({"action": "update"})  # without "offline": the website stays online
    assert all(online is True for _s, online, _u in seen)


@pytest.mark.django_db
def test_an_update_that_is_running_is_not_started_twice(monkeypatch):
    from apps.core import sitemanager

    sitemanager._save(update={"running": True})
    with pytest.raises(ValueError, match="al bijgewerkt"):
        remote_info.action({"action": "update"})


@pytest.mark.django_db
def test_the_server_compares_a_website_with_its_own_version(client, plus):
    sitemanager.set_server(True)
    register(client)
    sid = EasySite.objects.get().pk
    # (the own website is read directly, without a call: its key is not needed)
    own = EasySite.objects.create(instance_id=sitemanager.instance_id(), name="own", status="active")
    d = client.get(f"/api/system/sites/{own.pk}/info/?part=maintenance", **auth(plus)).json()
    assert set(d["latest"]) == {"version", "build"} and d["latest"]["version"] == d["version"]


@pytest.mark.django_db
def test_the_info_of_a_website_is_the_info_of_its_info_popup():
    from datetime import date

    from apps.core.models import License

    License.objects.update_or_create(pk=1, defaults={"number": "9WRH-WTQ6-JPQD-YJ3C", "client": "RST coaching en Consultancy BV", "client_address": "Ambachtsweg 46 3542 DH Utrecht", "valid_until": date(2027, 11, 17), "reseller_name": "Studio2"})
    system.license_changed()
    system.save({"contact_email": "info@example.org", "kvk": "12345678"})
    d = remote_info.info()
    lic = d["license"]
    assert lic["number"] == "9WRH-WTQ6-JPQD-YJ3C" and lic["client"] == "RST coaching en Consultancy BV" and lic["client_address"] == "Ambachtsweg 46 3542 DH Utrecht"
    assert lic["valid_until"] == "2027-11-17" and lic["has"] and not lic["expired"] and lic["state"] == "active"
    assert d["reseller"]["name"] == "Studio2" and d["site"]["contact_email"] == "info@example.org" and d["site"]["kvk"] == "12345678"
    assert set(d["plugins"]) == {"on", "total"} and set(d["modules"]) == {"on", "total"} and d["installation"]["state"] in ("installed", "empty")
    assert "info" in remote_info.PARTS
