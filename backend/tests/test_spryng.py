# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Spryng (sms): the link, the test, the use (verification only or also messages), and the SMS test screens."""
import json

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.communication import sms
from apps.integrations import spryng
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
        return json.dumps(self.body).encode()


@pytest.fixture
def calls(monkeypatch):
    sent = []

    def fake(req, timeout=0):
        sent.append((req.get_method(), req.full_url, json.loads(req.data) if req.data else None, (req.headers.get("X-api-key"), req.headers.get("Accountreference"))))
        return FakeRes({"available": "12.5", "reserved": "0"} if req.full_url.endswith("/balance") else {"requestId": "1"})

    monkeypatch.setattr(spryng.urllib.request, "urlopen", fake)
    return sent


def link(db, usage="verification", enabled=True):
    o = Integration(slug="spryng", name="Spryng", provider="spryng", enabled=enabled)
    o.config = {"api_key": "sk-test", "account_reference": "123456", "originator": "Mijn Bedrijf!", "usage": usage}
    o.save()
    return o


def test_number_and_originator():
    assert spryng.number("+31 6 12345678") == "+31612345678"
    assert spryng.number("0031612345678") == "+31612345678"
    with pytest.raises(spryng.SpryngError):
        spryng.number("12")
    assert spryng.sender({"originator": "Mijn Bedrijf BV!!"}) == "MijnBedrijf"  # letters and digits, at most 11
    assert spryng.sender({}) == ""


def test_the_test_button_reads_the_balance(db, calls):
    ok, msg = spryng.test(link(db).config)
    assert ok and "12.5" in msg and "verificatiecodes" in msg
    assert calls[0][1] == "https://api.spryng.nl/v2/balance" and calls[0][3] == ("sk-test", "123456")
    assert spryng.test({})[0] is False
    assert spryng.test({"api_key": "x"})[0] is False  # without the account reference


def test_a_code_goes_through_spryng_and_a_message_only_when_allowed(db, calls):
    link(db, usage="verification")
    twofa.send_sms("+31612345678", "Je code is 123-456")
    assert calls[-1][1] == "https://api.spryng.nl/v2/messages" and calls[-1][2]["recipients"] == [{"msisdn": "+31612345678"}] and calls[-1][2]["from"] == "MijnBedrijf"
    assert calls[-1][2]["messageType"] == "AuthenticationAndSecurity" and calls[-1][2]["accountReference"] == "123456" and calls[-1][2]["channel"] == "SMS"
    assert not sms.messages_allowed()
    with pytest.raises(sms.MessageNotAllowed):
        sms.send_message("+31612345678", "Herinnering")
    o = Integration.objects.get(slug="spryng")
    o.config = {**o.config, "usage": "messages"}
    o.save()
    assert sms.messages_allowed()
    sms.send_message("+31612345678", "Herinnering")
    assert calls[-1][2]["body"]["text"] == "Herinnering" and calls[-1][2]["messageType"] == "NotificationsAndReminders"


def test_a_link_that_is_off_sends_nothing(db, calls):
    link(db, enabled=False)
    assert twofa.availability()["sms"] is None
    assert twofa.sms_usage() == {"provider": None, "verification": False, "messages": False}


def test_the_sms_test_screens(db, calls, monkeypatch):
    o = link(db)
    admin = User.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(admin)
    bad = c.post(f"/api/admin/integrations/{o.pk}/sms-test/", {"phone": "12"}, format="json")
    assert bad.status_code == 400
    r = c.post(f"/api/admin/integrations/{o.pk}/sms-test/", {"phone": "+31612345678"}, format="json")
    assert r.status_code == 200 and r.data["token"]
    text = calls[-1][2]["body"]["text"]
    code = text.split(": ")[1]
    wrong = c.post(f"/api/admin/integrations/{o.pk}/sms-verify/", {"token": r.data["token"], "code": "000-000"}, format="json")
    assert wrong.status_code == 400
    ok = c.post(f"/api/admin/integrations/{o.pk}/sms-verify/", {"token": r.data["token"], "code": code}, format="json")
    assert ok.status_code == 200 and ok.data["ok"]
    o.refresh_from_db()
    assert o.last_test_ok is True


def test_an_unverified_account_gets_a_clear_message(db, monkeypatch):
    import io
    import urllib.error

    def refuse(req, timeout=0):
        raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {}, io.BytesIO(json.dumps({"errors": [{"errorMessage": "Unverified accounts require a registered msisdns"}]}).encode()))

    monkeypatch.setattr(spryng.urllib.request, "urlopen", refuse)
    with pytest.raises(spryng.SpryngError) as e:
        spryng.send(link(db).config, "+31612345678", "x")
    assert "proefaccount" in str(e.value)
