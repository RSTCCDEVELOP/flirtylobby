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


@pytest.fixture(autouse=True)
def fresh_cache():
    from django.core.cache import cache

    cache.clear()  # (the wait of 30 seconds between two test codes)


@pytest.fixture
def calls(monkeypatch):
    sent = []

    def fake(req, timeout=0):
        sent.append((req.get_method(), req.full_url, json.loads(req.data) if req.data else None, (req.headers.get("X-api-key"), req.headers.get("Accountreference"))))
        return FakeRes({"available": "12.5", "reserved": "0"} if req.full_url.endswith("/balance") else {"requestId": "1"})

    monkeypatch.setattr(spryng.urllib.request, "urlopen", fake)
    return sent


def link(db, usage="verification", enabled=True, tested=True):
    o = Integration(slug="spryng", name="Spryng", provider="spryng", enabled=enabled)
    o.config = {"api_key": "sk-test", "account_reference": "123456", "originator": "Mijn Bedrijf!", "usage": usage}
    o.last_test_ok = True if tested else None  # SMS is only offered for a link that passed its online test
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


def test_a_link_that_is_always_on_is_switched_on_at_start_and_cannot_be_switched_off(db):
    from apps.integrations import activation

    o = link(db, enabled=False)
    assert activation.ensure_always_on() == []  # not marked: nothing happens
    Integration.objects.filter(pk=o.pk).update(always_on=True)
    assert activation.ensure_always_on() == ["spryng"]
    o.refresh_from_db()
    assert o.enabled
    admin = User.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    c = APIClient()
    c.force_authenticate(admin)
    off = c.patch(f"/api/admin/integrations/{o.pk}/", {"enabled": False}, format="json")
    assert off.status_code == 400
    ok = c.patch(f"/api/admin/integrations/{o.pk}/", {"always_on": False, "enabled": False}, format="json")  # first take Altijd aan off
    assert ok.status_code == 200
    Integration.objects.filter(pk=o.pk).update(always_on=True, enabled=False, config_encrypted="")
    assert activation.ensure_always_on() == []  # without a key there is nothing to switch on


def test_delete_needs_the_link_off_and_a_system_link_needs_a_superadmin_plus(db):
    o = link(db, enabled=True)
    plain = User.objects.create(username="s", email="s@example.com", is_staff=True, is_superuser=True)
    plus = User.objects.create(username="p", email="p@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    c = APIClient()
    c.force_authenticate(plus)
    assert c.delete(f"/api/admin/integrations/{o.pk}/").status_code == 400  # on: first switch it off
    Integration.objects.filter(pk=o.pk).update(enabled=False, always_on=True)
    c.force_authenticate(plain)
    assert c.delete(f"/api/admin/integrations/{o.pk}/").status_code == 403  # a system link: superadmin+ only
    assert c.patch(f"/api/admin/integrations/{o.pk}/", {"always_on": False}, format="json").data["always_on"] is True  # a superadmin cannot take it off
    c.force_authenticate(plus)
    assert c.patch(f"/api/admin/integrations/{o.pk}/", {"always_on": False}, format="json").status_code == 200
    assert c.delete(f"/api/admin/integrations/{o.pk}/").status_code == 204


def test_a_locked_link_is_closed_until_it_is_opened_with_its_password(db):
    o = link(db)
    plus = User.objects.create(username="p", email="p@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    other = User.objects.create(username="o", email="o@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(plus)
    no = c.patch(f"/api/admin/integrations/{o.pk}/", {"locked": True}, format="json")
    assert no.status_code == 400 and "lock_password" in no.data  # a password is needed
    ok = c.patch(f"/api/admin/integrations/{o.pk}/", {"locked": True, "lock_password": "geheim-wachtwoord"}, format="json")
    assert ok.status_code == 200 and "lock_password" not in ok.data
    o.refresh_from_db()
    assert o.locked and o.lock_password and o.lock_password != "geheim-wachtwoord"  # kept as a hash
    # a superadmin that did not open it sees a closed card: no settings, no test message, no change, no test
    c.force_authenticate(other)
    r = c.get(f"/api/admin/integrations/{o.pk}/")
    assert r.data["locked"] and not r.data["unlocked"] and r.data["config"] == {} and r.data["last_test_message"] == ""
    assert c.patch(f"/api/admin/integrations/{o.pk}/", {"name": "x"}, format="json").status_code == 403
    assert c.post(f"/api/admin/integrations/{o.pk}/test/").status_code == 403
    assert c.delete(f"/api/admin/integrations/{o.pk}/").status_code == 403
    assert c.post(f"/api/admin/integrations/{o.pk}/unlock/", {"password": "fout"}, format="json").status_code == 400
    opened = c.post(f"/api/admin/integrations/{o.pk}/unlock/", {"password": "geheim-wachtwoord"}, format="json")
    assert opened.status_code == 200 and opened.data["unlocked"] and opened.data["config"]["usage"] == "verification"
    assert c.patch(f"/api/admin/integrations/{o.pk}/", {"name": "Nieuw"}, format="json").status_code == 200  # open: it can be changed
    assert c.post(f"/api/admin/integrations/{o.pk}/lock/").data["unlocked"] is False  # closed again
    # only a superadmin+ can lock or unlock the setting
    assert c.patch(f"/api/admin/integrations/{o.pk}/", {"locked": False}, format="json").status_code == 403


def test_too_many_wrong_passwords_block_for_a_while(db):
    o = link(db)
    Integration.objects.filter(pk=o.pk).update(locked=True, lock_password=__import__("apps.integrations.lock", fromlist=["x"]).hash_password("geheim-wachtwoord"))
    u = User.objects.create(username="s", email="s@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(u)
    codes = [c.post(f"/api/admin/integrations/{o.pk}/unlock/", {"password": "x"}, format="json").status_code for _ in range(6)]
    assert codes[:5] == [400] * 5 and codes[5] == 429
