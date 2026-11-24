# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The invoices of the easy2edit server: a charge of a website, the reseller and the customer who look at them."""
import pytest
from rest_framework.test import APIClient

from apps.core import invoicing, sitemanager
from apps.core.models import ChargeOutbox, EasySite, Entity, Invoice, Reseller, ResellerLogin


@pytest.fixture
def world(db, django_user_model):
    res = Reseller.objects.create(name="Partner BV")
    site = EasySite.objects.create(instance_id="i1", name="Shop", url="https://shop.nl", status="active", reseller=res)
    owner = django_user_model.objects.create_user("own", "own@shop.nl", "pw12345678!")
    owner.domains = ["shop.nl"]; owner.save()
    comp = Entity.objects.create(name="Shop BV", kind="bedrijf", domains=["shop.nl"])
    return {"res": res, "site": site, "owner": owner, "comp": comp}


def _charge(ref="r1", amount="12.10", kind="company"):
    return {"ref": ref, "kind": "ai", "description": "AI-tegoed", "amount_incl": amount, "vat_rate": "21", "payer": {"kind": kind, "name": "Shop BV", "vat": "NL1B01", "email": "fin@shop.nl", "is_own": True, "user_email": "own@shop.nl"}}


def test_a_charge_becomes_a_line_on_the_invoice_of_the_website(world):
    n = invoicing.add_charge(world["site"], _charge("r1"))
    assert n.endswith("-0001") and invoicing.add_charge(world["site"], _charge("r1")) == n  # the same reference twice is one line
    assert invoicing.add_charge(world["site"], _charge("r2", "24.20")) == n  # the same payer and month: the same invoice
    inv = Invoice.objects.get()
    assert inv.lines.count() == 2 and inv.reseller == world["res"] and inv.entity == world["comp"] and inv.person == world["owner"]
    t = invoicing.totals(inv)
    assert t["incl"] == 36.3 and t["ex"] == 30.0 and t["vat"] == 6.3
    assert invoicing.add_charge(world["site"], _charge("r3", kind="person")) != n  # another payer: another invoice
    with pytest.raises(ValueError):
        invoicing.add_charge(world["site"], _charge("r4", "-5"))


def test_who_may_look_at_an_invoice(world, django_user_model):
    invoicing.add_charge(world["site"], _charge())
    inv = Invoice.objects.get()
    plus = django_user_model.objects.create_user("plus", "plus@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    staff = django_user_model.objects.create_user("st", "st@x.nl", "pw12345678!", is_staff=True)
    rl = django_user_model.objects.create_user("rl", "rep@partner.nl", "pw12345678!")
    ResellerLogin.objects.create(reseller=world["res"], email="rep@partner.nl", host=True)
    other = django_user_model.objects.create_user("ot", "ot@x.nl", "pw12345678!")
    member = django_user_model.objects.create_user("mb", "mb@shop.nl", "pw12345678!")
    world["comp"].users.add(member)
    inv.entity = world["comp"]; inv.save()
    ids = lambda u: list(invoicing.visible_to(u).values_list("pk", flat=True))
    assert ids(plus) == [inv.pk] and ids(world["owner"]) == [inv.pk] and ids(rl) == [inv.pk] and ids(member) == [inv.pk]  # a superadmin+, the owner, the reseller, a member of the company
    assert ids(other) == [] and ids(staff) == []  # a superadmin who is none of them sees nothing
    c = APIClient(); c.force_authenticate(rl)
    r = c.get("/api/invoices/").json()
    assert r["role"] == "reseller" and r["invoices"][0]["number"] == inv.number and r["invoices"][0]["reseller"] == "Partner BV"
    assert c.get(f"/api/invoices/{inv.pk}/").json()["lines"][0]["amount_incl"] == 12.1
    assert c.post(f"/api/invoices/{inv.pk}/paid/", {}, format="json").status_code == 403
    o = APIClient(); o.force_authenticate(other)
    assert o.get(f"/api/invoices/{inv.pk}/").status_code == 404
    p = APIClient(); p.force_authenticate(plus)
    assert p.post(f"/api/invoices/{inv.pk}/paid/", {}, format="json").json()["status"] == "paid"


def test_a_website_sends_its_charge_with_its_key(world, monkeypatch):
    monkeypatch.setattr(sitemanager, "server_enabled", lambda: True)
    monkeypatch.setattr(sitemanager, "site_for_key", lambda k: world["site"] if k == "good" else None)
    c = APIClient()
    assert c.post("/api/easy2edit/invoices/charge/", _charge(), format="json", HTTP_X_EASY2EDIT_KEY="bad").status_code == 403
    r = c.post("/api/easy2edit/invoices/charge/", _charge(), format="json", HTTP_X_EASY2EDIT_KEY="good")
    assert r.status_code == 200 and r.json()["number"].endswith("-0001")


def test_the_outbox_keeps_a_charge_until_the_server_has_it(world, monkeypatch):
    monkeypatch.setattr(sitemanager, "server_enabled", lambda: False)
    calls = []
    def post(payload):
        calls.append(payload["ref"])
        if len(calls) == 1:
            raise OSError("no connection")
        return {"number": "2026-0007"}
    monkeypatch.setattr(invoicing, "_post_charge", post)
    row = invoicing.charge("ai-x", "ai", "AI-tegoed", 5, {"kind": "person", "name": "A"})
    row.refresh_from_db()
    assert not row.sent and row.tries == 1 and "no connection" in row.last_error  # it stays
    assert invoicing.send_pending() == 1
    row.refresh_from_db()
    assert row.sent and row.number == "2026-0007"
    assert invoicing.charge("ai-x", "ai", "AI-tegoed", 5) is not None and len(calls) == 2  # the same reference: not sent again
