# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""seven.io (sms): the link, the test, the use (verification only or also messages) and the SMS test screens."""
import json
import urllib.parse

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.communication import sms
from apps.integrations import seven
from apps.integrations.models import Integration
from apps.security import twofa


class FakeRes:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return (self.body if isinstance(self.body, str) else json.dumps(self.body)).encode()


@pytest.fixture(autouse=True)
def fresh_cache():
    from django.core.cache import cache

    cache.clear()  # (the wait of 30 seconds between two test codes)


@pytest.fixture
def calls(monkeypatch):
    sent = []

    def fake(req, timeout=0):
        form = dict(urllib.parse.parse_qsl(req.data.decode())) if req.data else None
        sent.append((req.get_method(), req.full_url, form, req.headers.get("X-api-key")))
        if req.full_url.endswith("/balance"):
            return FakeRes({"amount": 9.925, "currency": "EUR"})
        return FakeRes({"success": "100", "total_price": 0.075, "balance": 9.85, "messages": [{"success": True, "error": None, "error_text": None}]})

    monkeypatch.setattr(seven.urllib.request, "urlopen", fake)
    return sent


def link(db, usage="verification", enabled=True, tested=True):
    o = Integration(slug="seven", name="seven.io", provider="seven", enabled=enabled)
    o.config = {"api_key": "key-1", "originator": "Mijn Bedrijf!", "usage": usage}
    o.last_test_ok = True if tested else None  # SMS is only offered for a link that passed its online test
    o.save()
    return o


def test_number_and_sender():
    assert seven.number("+31 6 12345678") == "31612345678"
    with pytest.raises(seven.SevenError):
        seven.number("12")
    assert seven.sender({"originator": "Mijn Bedrijf BV!!"}) == "MijnBedrijf"
    assert seven.sender({"originator": "0031612345678901234"}) == "0031612345678901"  # digits: up to 16
    assert seven.sender({}) == ""


def test_the_test_button_reads_the_balance(db, calls):
    ok, msg = seven.test(link(db).config)
    assert ok and "9.925" in msg and calls[0][1] == "https://gateway.seven.io/api/balance" and calls[0][3] == "key-1"
    assert seven.test({})[0] is False


def test_a_code_and_a_message(db, calls):
    link(db)
    twofa.send_sms("+31612345678", "Je code is 482913")
    m, url, form, key = calls[-1]
    assert url == "https://gateway.seven.io/api/sms" and form["to"] == "31612345678" and form["from"] == "MijnBedrijf" and form["text"] == "Je code is 482913" and key == "key-1"
    with pytest.raises(sms.MessageNotAllowed):
        sms.send_message("+31612345678", "Herinnering")
    o = Integration.objects.get(slug="seven")
    o.config = {**o.config, "usage": "messages"}
    o.save()
    sms.send_message("+31612345678", "Herinnering")
    assert calls[-1][2]["text"] == "Herinnering"


def test_a_refused_message_is_an_error(db, monkeypatch):
    monkeypatch.setattr(seven.urllib.request, "urlopen", lambda req, timeout=0: FakeRes({"success": "100", "messages": [{"success": False, "error": "9", "error_text": "Invalid sender"}]}))
    with pytest.raises(seven.SevenError) as e:
        seven.send(link(db).config, "+31612345678", "x")
    assert "Invalid sender" in str(e.value)


def test_the_sms_test_goes_through_this_link(db, calls):
    o = link(db)
    admin = User.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(admin)
    r = c.post(f"/api/admin/integrations/{o.pk}/sms-test/", {"phone": "+31612345678"}, format="json")
    assert r.status_code == 200 and calls[-1][1].endswith("/sms")
    code = calls[-1][2]["text"].split(": ")[1]
    assert c.post(f"/api/admin/integrations/{o.pk}/sms-verify/", {"token": r.data["token"], "code": code}, format="json").data["ok"]


def test_a_message_that_the_operator_rejects_is_reported(db, monkeypatch):
    o = link(db)

    def fake(req, timeout=0):
        if "/journal/outbound" in req.full_url:
            return FakeRes([{"id": "7", "dlr": "REJECTED", "error": "407001"}])
        if req.full_url.endswith("/sms"):
            return FakeRes({"success": "100", "total_price": 0.075, "balance": 9.8, "messages": [{"id": "7", "success": True}]})
        return FakeRes({})

    monkeypatch.setattr(seven.urllib.request, "urlopen", fake)
    assert seven.delivery(o.config, "7", wait=0) == ("REJECTED", "407001")
    admin = User.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(admin)
    r = c.post(f"/api/admin/integrations/{o.pk}/sms-test/", {"phone": "+31653646056"}, format="json")
    assert r.status_code == 502 and "407001" in r.data["detail"] and "REJECTED" in r.data["detail"]
    o.refresh_from_db()
    assert o.last_test_ok is False and "407001" in o.last_test_message  # the card shows the reason


def test_a_typed_number_is_kept_in_the_profile_when_there_is_none(db, calls):
    o = link(db)
    admin = User.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(admin)
    r = c.post(f"/api/admin/integrations/{o.pk}/sms-test/", {"phone": "06 53646056"}, format="json")
    assert r.status_code == 400  # not an international number: nothing is kept
    admin.refresh_from_db()
    assert admin.mobile == ""
    r = c.post(f"/api/admin/integrations/{o.pk}/sms-test/", {"phone": "+31 6 53646056"}, format="json")
    assert r.status_code == 200 and r.data["phone_saved"] == "+31653646056"
    admin.refresh_from_db()
    assert admin.mobile == "+31653646056"
    from django.core.cache import cache

    cache.clear()
    r = c.post(f"/api/admin/integrations/{o.pk}/sms-test/", {"phone": "+31611111111"}, format="json")
    admin.refresh_from_db()
    assert "phone_saved" not in r.data and admin.mobile == "+31653646056"  # a number in the profile is never replaced by a test number


def test_sms_is_only_offered_for_a_link_that_is_on_tested_online_and_has_credit(db, calls):
    """THE standard rule: no SMS anywhere unless an SMS link is on and its last online test passed (the test checks the credit)."""
    o = link(db, enabled=False, tested=False)
    assert twofa.availability()["sms"] is None
    Integration.objects.filter(pk=o.pk).update(enabled=True)  # on, but never tested
    assert twofa.availability()["sms"] is None and "sms" not in twofa.allowed_methods()
    Integration.objects.filter(pk=o.pk).update(last_test_ok=True)  # tested
    assert twofa.availability()["sms"] == "seven.io"
    Integration.objects.filter(pk=o.pk).update(last_test_ok=False)  # the test failed (or no credit)
    assert twofa.availability()["sms"] is None
    assert twofa.sms_usage()["messages"] is False


def test_no_credit_fails_the_test(db, monkeypatch):
    monkeypatch.setattr(seven.urllib.request, "urlopen", lambda req, timeout=0: FakeRes({"amount": 0, "currency": "EUR"}))
    ok, msg = seven.test(link(db).config)
    assert ok is False and "tegoed" in msg.lower()


def test_a_failed_send_takes_the_link_out_of_the_offer(db, monkeypatch):
    o = link(db)
    Integration.objects.filter(pk=o.pk).update(last_test_ok=True)
    monkeypatch.setattr(seven.urllib.request, "urlopen", lambda req, timeout=0: (_ for _ in ()).throw(OSError("down")))
    with pytest.raises(twofa.DeliveryError):
        twofa.send_sms("+31612345678", "code")
    o.refresh_from_db()
    assert o.last_test_ok is False and twofa.availability()["sms"] is None


def test_sms_ready_endpoint(db):
    admin = User.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(admin)
    assert c.get("/api/system/sms-ready/").data == {"sms": False, "messages": False}
    link(db, usage="messages")
    assert c.get("/api/system/sms-ready/").data == {"sms": True, "messages": True}
