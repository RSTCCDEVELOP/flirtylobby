# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Onboarding of an empty installation as a reseller: a code from the master, the first superuser, the link with the reseller."""
import re

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.core import reseller_signup, sitemanager
from apps.core.models import EasySite, Reseller


@pytest.fixture
def master(monkeypatch):
    """This installation answers as the master site itself; the e-mail is caught."""
    cache.clear()
    sent = []
    monkeypatch.setattr(sitemanager, "server_enabled", lambda: True)
    monkeypatch.setattr("apps.communication.sending.send_email", lambda to, subject, body, *a, **k: sent.append((to, body)))
    monkeypatch.setattr(sitemanager, "report", lambda *a, **k: {"ok": True})
    Reseller.objects.create(name="Webbouwer BV", active=True, email="info@webbouwer.nl", contacts=[{"id": "a", "role": "sales", "name": "Piet Puk", "email": "piet@webbouwer.nl", "phone": "0612345678"}])
    return sent


def _code(sent):
    return re.search(r"\b(\d{6})\b", sent[-1][1]).group(1)


@pytest.mark.django_db
def test_an_empty_installation_offers_the_onboarding_and_a_used_one_does_not(django_user_model, master):
    c = APIClient()
    assert c.get("/api/system/first-run/").json() == {"empty": True}
    plus = django_user_model.objects.create_user("std", "std@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    plus.is_superadmin_plus = True
    plus.save()
    assert c.get("/api/system/first-run/").json() == {"empty": True}  # a clean installation after a reset has the standard superadmin: still open
    django_user_model.objects.create_user("x", "x@x.nl", "pw12345678!")
    assert c.get("/api/system/first-run/").json() == {"empty": False}  # an ordinary user: the website is in use
    assert c.post("/api/system/first-run/send/", {"email": "piet@webbouwer.nl"}, format="json").status_code == 403  # (never when it is in use)
    assert c.post("/api/system/first-run/verify/", {"challenge": "x", "code": "123456", "password": "abcdefghijk"}, format="json").status_code == 403


@pytest.mark.django_db
def test_a_reseller_signs_up_gets_a_superuser_and_the_website_is_linked(django_user_model, master):
    c = APIClient()
    r = c.post("/api/system/first-run/send/", {"email": "Piet@Webbouwer.nl"}, format="json").json()
    assert r["challenge"] and master and master[-1][0] == "piet@webbouwer.nl" and "@" in r["hint"]
    bad = c.post("/api/system/first-run/verify/", {"challenge": r["challenge"], "code": "000000", "password": "abcdefghijk"}, format="json")
    assert bad.status_code == 400 and not django_user_model.objects.exists()
    ok = c.post("/api/system/first-run/verify/", {"challenge": r["challenge"], "code": _code(master), "password": "abcdefghijk"}, format="json")
    assert ok.status_code == 200 and ok.json()["token"] and ok.json()["reseller"] == "Webbouwer BV"
    u = django_user_model.objects.get(email="piet@webbouwer.nl")
    assert u.is_staff and u.is_superuser and u.check_password("abcdefghijk") and u.first_name == "Piet"
    assert c.post("/api/system/first-run/send/", {"email": "piet@webbouwer.nl"}, format="json").status_code == 403  # it works once


@pytest.mark.django_db
def test_an_unknown_address_looks_the_same_and_gets_no_code(master):
    c = APIClient()
    r = c.post("/api/system/first-run/send/", {"email": "nobody@nowhere.nl"}, format="json")
    assert r.status_code == 200 and r.json()["challenge"] and not master  # no mail, but the same answer
    assert c.post("/api/system/first-run/verify/", {"challenge": r.json()["challenge"], "code": "123456", "password": "abcdefghijk"}, format="json").status_code == 400


@pytest.mark.django_db
def test_too_many_wrong_codes_and_a_short_password(django_user_model, master):
    c = APIClient()
    ch = c.post("/api/system/first-run/send/", {"email": "piet@webbouwer.nl"}, format="json").json()["challenge"]
    code = _code(master)
    short = c.post("/api/system/first-run/verify/", {"challenge": ch, "code": code, "password": "kort"}, format="json")
    assert short.status_code == 400 and not django_user_model.objects.exists()
    ch2 = c.post("/api/system/first-run/send/", {"email": "piet@webbouwer.nl"}, format="json").json()["challenge"]
    for _ in range(6):
        c.post("/api/system/first-run/verify/", {"challenge": ch2, "code": "000000", "password": "abcdefghijk"}, format="json")
    assert c.post("/api/system/first-run/verify/", {"challenge": ch2, "code": _code(master), "password": "abcdefghijk"}, format="json").status_code == 400  # locked


@pytest.mark.django_db
def test_the_grant_links_the_website_to_the_reseller_once(master):
    r = Reseller.objects.get(name="Webbouwer BV")
    ch = reseller_signup.send("piet@webbouwer.nl")["challenge"]
    grant = reseller_signup.verify(ch, _code(master))["grant"]
    site, key, _cb = sitemanager.register({"instance_id": "a" * 20, "name": "Nieuwe site", "url": "https://nieuw.example.nl", "reseller_grant": grant}, "1.2.3.4")
    assert site.reseller_id == r.pk
    other, _k, _c = sitemanager.register({"instance_id": "b" * 20, "name": "Andere", "url": "https://andere.example.nl", "reseller_grant": grant}, "1.2.3.4")
    assert other.reseller_id != r.pk  # the grant works once


@pytest.mark.django_db
def test_on_a_clean_installation_the_standard_superadmin_stays_and_an_existing_address_is_taken_over(django_user_model, master):
    plus = django_user_model.objects.create_user("std", "std@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    plus.is_superadmin_plus = True
    plus.save()
    old = django_user_model.objects.create_user("piet", "piet@webbouwer.nl", "oud-wachtwoord1!", is_staff=False)  # (an old account, not a superadmin+)
    c = APIClient()
    # an ordinary account makes it "in use": no onboarding
    assert c.post("/api/system/first-run/send/", {"email": "piet@webbouwer.nl"}, format="json").status_code == 403
    old.delete()
    ch = c.post("/api/system/first-run/send/", {"email": "piet@webbouwer.nl"}, format="json").json()["challenge"]
    r = c.post("/api/system/first-run/verify/", {"challenge": ch, "code": _code(master), "password": "nieuw-wachtwoord!"}, format="json")
    assert r.status_code == 200 and django_user_model.objects.filter(email="std@x.nl").exists()
    u = django_user_model.objects.get(email="piet@webbouwer.nl")
    assert u.is_staff and u.is_superuser and u.check_password("nieuw-wachtwoord!")
