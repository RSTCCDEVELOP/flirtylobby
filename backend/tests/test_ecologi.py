# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Ecologi: the link (API) and the management screens in the Super admin menu: only for a superadmin and only while the API is on; orders are logged, test orders are not real."""
import json

import pytest
from rest_framework.test import APIClient

from apps.ecologi import service
from apps.ecologi.models import EcologiSettings, TreeOrder
from apps.integrations.models import Integration


class FakeEcologi:
    """Stands in for https://public.ecologi.com: records the calls."""

    def __init__(self, monkeypatch, code=201, payload=None):
        self.calls = []
        self.code, self.payload = code, payload if payload is not None else {"amount": 1.8, "currency": "GBP", "treeUrl": "https://ecologi.com/x", "name": "Site"}
        monkeypatch.setattr(service, "_request", self.request)

    def request(self, method, path, body=None, key="", idem="", host=None):
        self.calls.append({"method": method, "path": path, "body": body, "key": key, "idem": idem, "host": host})
        return self.code, self.payload


def link(on=True, **cfg):
    o = Integration(name="Ecologi", slug="ecologi", provider="ecologi", enabled=on)
    o.config = {"api_key": "sleutel-123", **cfg}
    o.save()
    return o


@pytest.fixture
def staff(django_user_model):
    u = django_user_model.objects.create_user("eco", "eco@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    return c


@pytest.mark.django_db
def test_screens_only_exist_for_a_superadmin_while_the_api_is_on(staff, django_user_model):
    assert staff.get("/api/ecologi/state/").json()["enabled"] is False  # no link yet
    assert staff.get("/api/ecologi/overview/").status_code == 403
    link(on=False)
    assert staff.get("/api/ecologi/state/").json()["enabled"] is False  # the link is off
    Integration.objects.update(enabled=True)
    assert staff.get("/api/ecologi/state/").json()["enabled"] is True
    assert staff.get("/api/ecologi/overview/").status_code == 200
    plain = APIClient()
    plain.force_authenticate(django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!"))
    assert plain.get("/api/ecologi/state/").json()["enabled"] is False and plain.get("/api/ecologi/overview/").status_code == 403  # not a superadmin


@pytest.mark.django_db
def test_planting_is_a_test_order_by_default_and_logged(staff, monkeypatch):
    link()
    fake = FakeEcologi(monkeypatch)
    r = staff.post("/api/ecologi/plant/", {"number": 3, "name": "easy2edit"}, format="json")
    assert r.status_code == 201 and r.json()["order"]["test"] is True
    call = fake.calls[0]
    assert call["path"] == "/impact/trees" and call["body"] == {"number": 3, "test": True, "name": "easy2edit"} and call["key"] == "sleutel-123" and call["idem"]
    o = TreeOrder.objects.get()
    assert o.status == "ok" and float(o.amount) == 1.8 and o.currency == "GBP" and o.tree_url
    assert service.totals()["trees"] == 0 and service.totals()["tests"] == 1  # a test order is not counted as planted


@pytest.mark.django_db
def test_a_real_local_order_and_the_limits(staff, monkeypatch):
    link()
    fake = FakeEcologi(monkeypatch)
    EcologiSettings.load()
    staff.patch("/api/ecologi/settings/", {"test_mode": False, "max_per_order": 10}, format="json")
    assert staff.post("/api/ecologi/plant/", {"number": 11}, format="json").status_code == 400  # over the safety limit
    r = staff.post("/api/ecologi/plant/", {"number": 2, "local": True, "country": "UK"}, format="json")
    assert r.status_code == 201 and fake.calls[-1]["path"] == "/impact/local-trees" and fake.calls[-1]["body"]["country"] == "UK" and fake.calls[-1]["body"]["test"] is False
    assert service.totals()["trees"] == 2
    assert staff.post("/api/ecologi/plant/", {"number": 0}, format="json").status_code == 400


@pytest.mark.django_db
def test_a_refused_order_is_logged_with_the_reason(staff, monkeypatch):
    link()
    FakeEcologi(monkeypatch, code=401, payload={"message": "bad key"})
    r = staff.post("/api/ecologi/plant/", {"number": 1}, format="json")
    assert r.status_code == 400 and "API-sleutel" in r.json()["detail"]
    o = TreeOrder.objects.get()
    assert o.status == "failed" and "API-sleutel" in o.error
    assert staff.get("/api/ecologi/orders/?status=failed").json()["orders"][0]["status"] == "failed"


@pytest.mark.django_db
def test_connection_test_of_the_link_uses_a_test_order(monkeypatch):
    fake = FakeEcologi(monkeypatch, code=201)
    ok, msg = service.check_key("abc")
    assert ok and fake.calls[0]["body"] == {"number": 1, "test": True}
    FakeEcologi(monkeypatch, code=403, payload={})
    assert service.check_key("abc")[0] is False
    from apps.integrations.providers import PROVIDERS

    assert "ecologi" in PROVIDERS and PROVIDERS["ecologi"]["fields"][0]["secret"] is True


@pytest.mark.django_db
def test_the_public_report_and_the_monthly_planting(monkeypatch):
    link(username="mijnbedrijf")
    FakeEcologi(monkeypatch, code=200, payload={"total": 120, "pending": 5})
    assert service.report() == {"trees": 120, "pending": 5, "username": "mijnbedrijf"}
    fake = FakeEcologi(monkeypatch)
    st = EcologiSettings.load()
    st.monthly_trees, st.auto_on = 4, True
    st.save()
    assert service.run_auto() is True and fake.calls[0]["body"]["number"] == 4 and TreeOrder.objects.get().source == "user"
    assert service.run_auto() is False  # once a month


@pytest.mark.django_db
def test_a_key_of_the_new_app_and_one_of_the_legacy_app_both_work(monkeypatch):
    """Keys from the new Ecologi app only work on x.api.ecologi.com, keys from the legacy app on public.ecologi.com: the other host is tried when a key is refused, and the good one is remembered."""
    calls = []

    def fake(method, path, body=None, key="", idem="", host=None):
        calls.append(host)
        ok = (key == "oud" and host == service.HOSTS[1]) or (key == "nieuw" and host == service.HOSTS[0])
        return (201, {"amount": 0.8, "currency": "EUR"}) if ok else (401, {"message": "No user found for that API key."})

    monkeypatch.setattr(service, "_request", fake)
    assert service.check_key("nieuw")[0] is True and calls == [service.HOSTS[0]]
    calls.clear()
    assert service.check_key("oud")[0] is True and calls == [service.HOSTS[0], service.HOSTS[1]]  # refused on the new host, accepted on the legacy host
    calls.clear()
    assert service.check_key("oud")[0] is True and calls == [service.HOSTS[1]]  # remembered
    calls.clear()
    assert service.check_key("fout")[0] is False and calls == [service.HOSTS[0], service.HOSTS[1]]


@pytest.mark.django_db
def test_an_always_on_link_with_a_key_is_on_and_saving_it_does_not_give_an_error(django_user_model):
    """A link that is "Altijd aan" and has its key is switched on at once; saving a link that is off as off again (the edit window sends the state) is not an error."""
    plus = django_user_model.objects.create_user("plus", "plus@x.nl", "pw12345678!", is_staff=True, is_superadmin_plus=True)
    staff = APIClient()
    staff.force_authenticate(plus)
    r = staff.post("/api/admin/integrations/", {"name": "Ecologi", "slug": "ecologi", "provider": "ecologi", "enabled": False, "always_on": True, "config": {"api_key": "abc"}}, format="json")
    assert r.status_code == 201 and r.json()["enabled"] is True  # switched on at once
    pk = r.json()["id"]
    Integration.objects.filter(pk=pk).update(enabled=False)  # (the state the dev database was in)
    r = staff.patch(f"/api/admin/integrations/{pk}/", {"enabled": False, "name": "Ecologi", "config": {"api_key": "••••", "username": "x"}}, format="json")
    assert r.status_code == 200 and r.json()["enabled"] is True  # no 400; it is on
    r = staff.patch(f"/api/admin/integrations/{pk}/", {"enabled": False}, format="json")
    assert r.status_code == 400  # switching an always-on link off that is on is still refused


@pytest.mark.django_db
def test_the_contributions_use_the_page_views_and_the_energy_and_stay_under_the_maximum(staff, monkeypatch):
    from datetime import date

    from apps.energy.models import EnergyDay

    link()
    ym = service.prev_month()
    y, m = int(ym[:4]), int(ym[5:7])
    EnergyDay.objects.create(day=date(y, m, 5), path="/", views=2500, bytes_total=2500 * 2_000_000, requests_total=2500 * 40)  # 5 GB
    st = EcologiSettings.load()
    st.visitors_on, st.visitors_per, st.machine_on, st.machine_kg, st.monthly_trees, st.admin_trees, st.e2e_trees, st.cap_trees_month, st.auto_on = True, 1000, True, 1, 3, 2, 10, 6, True
    st.save()
    p = service.plan(ym)
    rows = {r["key"]: r for r in p["rows"]}
    assert rows["visitors"]["asked"] == 2  # 2500 visits / 1000
    assert rows["machine"]["asked"] >= 1 and p["usage"]["co2_kg"] > 0
    assert rows["user"]["asked"] == 5  # 3 by the owner + 2 by the administrator
    assert p["own_total"] == 6 and p["cap"] == 6 and p["easy2edit"] == 10  # the maximum holds; easy2edit's trees are only shown
    assert sum(r["cut"] for r in p["rows"]) == sum(r["asked"] for r in p["rows"]) - 6
    fake = FakeEcologi(monkeypatch)
    assert service.run_auto() is True
    assert sum(c["body"]["number"] for c in fake.calls) == 6 and {o.source for o in TreeOrder.objects.all()} <= {"visitors", "machine", "user"}
    s = staff.get("/api/ecologi/stats/").json()
    assert len(s["months"]) == 12 and s["now"]["cap"] == 6 and s["next_settlement"] and s["totals"]["tests"] >= 1  # (test mode is on: the orders are test orders)


@pytest.mark.django_db
def test_the_administrator_sets_his_own_gift_and_gives_trees_when_the_superadmin_allows_it(django_user_model, monkeypatch):
    link()
    fake = FakeEcologi(monkeypatch)
    admin = django_user_model.objects.create_user("ad", "ad@x.nl", "pw12345678!")  # not a superadmin
    from apps.accounts.models import ModuleGrant, Role

    role = Role.objects.create(name="Beheerder", slug="beheer-x")
    admin.roles.add(role)
    ModuleGrant.objects.create(role=role, module="ecologi_admin", level=1)  # the superadmin gives the role access to the module (Super admin -> Modules)
    c = APIClient()
    c.force_authenticate(admin)
    assert c.get("/api/ecologi/state/").json()["admin"] is False and c.get("/api/ecologi/me/").status_code == 403  # the superadmin did not allow it yet
    st = EcologiSettings.load()
    st.admin_enabled, st.admin_max_trees = True, 5
    st.save()
    assert c.get("/api/ecologi/state/").json()["admin"] is True
    assert c.patch("/api/ecologi/me/", {"admin_trees": 99}, format="json").json()["settings"]["admin_trees"] == 5  # limited to his maximum
    r = c.post("/api/ecologi/give/", {"number": 3}, format="json")
    assert r.status_code == 201 and fake.calls[-1]["body"]["number"] == 3 and TreeOrder.objects.get().source == "admin_gift"
    assert c.post("/api/ecologi/give/", {"number": 6}, format="json").status_code == 400
    assert c.get("/api/ecologi/overview/").status_code == 403  # he does not get the superadmin screens


@pytest.mark.django_db
def test_admin_functions_and_max_amount():
    """The administrator picks the functions he plants trees for; his maximum amount per month cuts what they ask."""
    from apps.ecologi import service
    from apps.ecologi.models import EcologiSettings

    st = EcologiSettings.load()
    st.admin_funcs = {"members": {"on": True, "per": 1}, "ai": {"on": False, "per": 1}}
    st.admin_trees = 0
    st.save()
    ym = service.this_month()
    from django.contrib.auth import get_user_model

    for i in range(5):
        get_user_model().objects.create_user(username=f"m{i}", email=f"m{i}@x.nl", password="x")
    p = service.admin_plan(ym)
    assert p["funcs_trees"] == 5 and p["trees"] == 5 and p["cut"] == 0
    assert next(r for r in p["rows"] if r["key"] == "ai")["trees"] == 0  # switched off
    st.admin_max_eur = 2.4  # 3 trees at EUR 0.80
    st.save()
    p = service.admin_plan(ym)
    assert p["trees"] == 3 and p["cut"] == 2 and p["amount"] == 2.4


@pytest.mark.django_db
def test_remote_payload_and_server_overview(monkeypatch):
    """The website tells the easy2edit server about tree planting (info part "trees"); the server sums it up per company; the server can switch contributions."""
    from apps.core import remote_info, sitemanager
    from apps.core.models import EasySite, Entity
    from apps.ecologi import service as eco

    p = remote_info.build("trees")
    assert p["enabled"] is False and p["linked"] is False  # no link with Ecologi yet
    out = remote_info.action({"action": "trees", "settings": {"auto_on": True, "visitors_on": True, "cap_trees_month": 30, "evil": 1}})
    assert out["trees"]["settings"]["auto_on"] is True and out["trees"]["settings"]["cap_trees_month"] == 30 and "evil" not in out["trees"]["settings"]
    monkeypatch.setattr(sitemanager, "site_info", lambda site, part: {"enabled": True, "totals": {"trees": 7, "donated": 5.6}, "costs": {"month_estimate": 8.0, "year_estimate": 96.0, "total_12": 5.6}})
    EasySite.objects.create(instance_id="x1", name="Shop", url="https://shop.nl", status="active", token_hash="")
    Entity.objects.create(name="Shop BV", kind="bedrijf", domains=["shop.nl"])
    res = sitemanager.trees_overview(refresh=True)
    c = next(c for c in res["companies"] if c["name"] == "Shop BV")
    assert c["totals"]["trees"] == 7 and c["totals"]["month_estimate"] == 8.0 and res["totals"]["on"] == 1


@pytest.mark.django_db
def test_onboarding_answer_links_and_switches_on(monkeypatch):
    from apps.ecologi import service as eco
    from apps.ecologi.models import EcologiSettings

    called = []
    monkeypatch.setattr(eco, "link_to_server", lambda reason="trees": called.append(reason))
    eco.onboarding_answer("no")
    assert not EcologiSettings.load().auto_on and not called
    eco.onboarding_answer("yes")
    st = EcologiSettings.load()
    assert st.auto_on and st.visitors_on and st.test_mode and called == ["trees"]  # still a test order until the owner switches that off


@pytest.mark.django_db
def test_tree_defaults_go_with_the_standard_settings():
    """Standaard en globale instellingen carries the tree planting standard: it is put on the installation and read back live."""
    from apps.core import global_settings
    from apps.ecologi.models import EcologiSettings

    vals, errors = global_settings.clean({"trees_auto": "1", "trees_visitors": "0", "trees_e2e": "2", "trees_cap": "30", "trees_name": "easy2edit", "trees_test": "1"})
    assert not errors
    global_settings.save(vals)
    st = EcologiSettings.load()
    assert st.auto_on and not st.visitors_on and st.e2e_trees == 2 and st.cap_trees_month == 30 and st.name == "easy2edit"
    live = global_settings.get()
    assert live["trees_e2e"] == "2" and live["trees_visitors"] == "0" and live["trees_name"] == "easy2edit"
