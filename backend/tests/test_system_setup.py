# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net
import re

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

FULL = {"site_name": "Demo", "company_name": "Demo BV", "frontend_url": "https://www.demo.nl", "street": "Dorpsstraat", "house_number": "1", "postal_code": "1234AB",
        "city": "Utrecht", "country": "Nederland", "contact_first_name": "Jan", "contact_last_name": "Jansen", "contact_email": "jan@demo.nl", "phone": "", "mobile": "+31 612345678"}


@pytest.mark.django_db
def test_setup_flow():
    U = get_user_model()
    staff = U.objects.create_user("st", "st@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(staff)
    r = c.get("/api/system/setup/").json()
    assert r["needed"] and "contact_first_name" in r["missing"] and r["can_skip"]
    bad = c.put("/api/system/setup/", {**FULL, "mobile": ""}, format="json")
    assert bad.status_code == 400
    from apps.core import setup_consent

    setup_consent.mark_ok(staff)
    ok = c.put("/api/system/setup/", FULL, format="json")
    assert ok.status_code == 200 and ok.json()["needed"] is False
    plain = U.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c.force_authenticate(plain)
    assert c.get("/api/system/setup/").json()["needed"] is False


@pytest.mark.django_db
def test_url_without_scheme():
    from apps.core import system

    assert system.clean({"frontend_url": "www.demo.nl"})[0]["frontend_url"] == "https://www.demo.nl"
    assert system.clean({"frontend_url": "http://demo.nl/"})[0]["frontend_url"] == "http://demo.nl"


@pytest.mark.django_db
def test_setup_suggests_from_login():
    u = get_user_model().objects.create_user("sg", "sg@x.nl", "pw12345678!", is_staff=True, first_name="Piet", last_name="Puk")
    c = APIClient()
    c.force_authenticate(u)
    s = c.get("/api/system/setup/").json()["suggest"]
    assert s["contact_first_name"] == "Piet" and s["contact_last_name"] == "Puk" and s["contact_email"] == "sg@x.nl"
    from apps.core import system

    system.save(system.clean({"contact_first_name": "Anna"})[0])
    assert "contact_first_name" not in c.get("/api/system/setup/").json()["suggest"]


@pytest.mark.django_db
def test_suggest_splits_address():
    u = get_user_model().objects.create_user("sp", "sp@x.nl", "pw12345678!", is_staff=True)
    u.address = "Talmastraat 24"
    u.save()
    c = APIClient()
    c.force_authenticate(u)
    s = c.get("/api/system/setup/").json()["suggest"]
    assert s["street"] == "Talmastraat" and s["house_number"] == "24"


@pytest.mark.django_db
def test_setup_makes_license():
    from datetime import date, timedelta

    from apps.core.models import License

    u = get_user_model().objects.create_user("lc", "lc@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    r = c.get("/api/system/setup/").json()
    assert r["needs_license"] and r["license_until"] == (date.today() + timedelta(days=365)).isoformat()
    from apps.core import setup_consent

    assert c.put("/api/system/setup/", {**FULL, "license_until": (date.today() + timedelta(days=5)).isoformat()}, format="json").status_code == 400  # no consent yet
    setup_consent.mark_ok(u)
    assert c.put("/api/system/setup/", {**FULL, "license_until": "2001-01-01"}, format="json").status_code == 400
    until = (date.today() + timedelta(days=100)).isoformat()
    assert c.put("/api/system/setup/", {**FULL, "license_until": until, "renew_months": 5}, format="json").status_code == 400
    assert c.put("/api/system/setup/", {**FULL, "license_until": until, "renew_months": 3, "hosting": "nope"}, format="json").status_code == 400
    assert c.put("/api/system/setup/", {**FULL, "license_until": until, "renew_months": 3, "hosting": "shared"}, format="json").status_code == 200
    lic = License.objects.get(pk=1)
    assert lic.number and lic.valid_until.isoformat() == until and lic.main_url == "https://www.demo.nl" and lic.renew_months == 3 and lic.hosting == "shared" and lic.client == "Demo BV" and "Dorpsstraat" in lic.client_address
    assert c.get("/api/system/setup/").json()["needs_license"] is False


@pytest.mark.django_db
def test_license_address_in_parts():
    u = get_user_model().objects.create_user("lp", "lp@x.nl", "pw12345678!", is_staff=True)
    u.is_superadmin_plus = True
    u.save()
    c = APIClient()
    c.force_authenticate(u)
    r = c.put("/api/system/license/", {"client_parts": {"street": "Dorpsstraat", "house_number": "1", "postal_code": "1234ab", "city": "Utrecht", "country": "Nederland"}}, format="json").json()
    assert r["client_address"] == "Dorpsstraat 1, 1234AB Utrecht" and r["client_parts"]["postal_code"] == "1234AB"
    c.put("/api/system/license/", {"client_address": "Laan 5, 5678 CD Zeist"}, format="json")
    assert c.get("/api/system/license/").json()["client_parts"]["city"] == "Zeist"


@pytest.mark.django_db
def test_consent_code_flow(monkeypatch):
    from django.core.cache import cache

    from apps.core import setup_consent

    from apps.communication import sending

    sent = []
    monkeypatch.setattr(sending, "send_email", lambda *a, **k: sent.append(a))
    cache.clear()
    u = get_user_model().objects.create_user("cn", "cn@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    assert c.post("/api/system/setup/consent/", {"method": "email", "to": "geen"}, format="json").status_code == 400
    r = c.post("/api/system/setup/consent/", {"method": "email", "to": "jan@demo.nl"}, HTTP_HOST="localhost", format="json")
    assert r.status_code == 200
    code = r.json()["code"]  # on localhost a superadmin gets the code back
    import re

    assert re.fullmatch(r"\d{3}-\d{4}", code)
    assert c.post("/api/system/setup/consent/verify/", {"code": "000-0000"}, format="json").status_code == 400
    assert not setup_consent.ok(u)
    assert c.post("/api/system/setup/consent/verify/", {"code": code.replace("-", "")}, format="json").status_code == 200
    assert setup_consent.ok(u)
    assert setup_consent.normalize("123-4567") == "123-4567" and setup_consent.normalize("12") == ""


@pytest.mark.django_db
def test_pay_step(monkeypatch):
    from apps.core import license_stripe, setup_pay
    from apps.core.models import License

    u = get_user_model().objects.create_user("py", "py@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    assert c.get("/api/system/setup/").json()["pay"]["provider"] == ""
    assert c.post("/api/system/setup/pay/", {**FULL, "hosting": "shared", "renew_months": 3}, format="json").status_code == 400  # Stripe not linked
    assert License.objects.get(pk=1).hosting == "shared" and License.objects.get(pk=1).renew_months == 3  # the choices are kept
    plain = get_user_model().objects.create_user("pl2", "pl2@x.nl", "pw12345678!")
    cp = APIClient()
    cp.force_authenticate(plain)
    assert cp.post("/api/system/setup/pay/invoice/", {"hosting": "shared", "renew_months": 3}, format="json").status_code == 403  # only a superadmin may choose on account
    assert c.post("/api/system/setup/pay/invoice/", {"hosting": "shared", "renew_months": 5}, format="json").status_code == 400
    assert c.post("/api/system/setup/pay/invoice/", {"hosting": "shared", "renew_months": 3}, format="json").status_code == 200
    assert setup_pay.ok(u) and License.objects.get(pk=1).payment_method == "invoice"
    setup_pay.clear(u)
    # Stripe on: the licence is only made after paying
    monkeypatch.setattr(license_stripe, "active", lambda l=None: True)
    monkeypatch.setattr(license_stripe, "call", lambda method, path, data=None, l=None, key=None: {"url": "https://checkout.stripe.test/x", "payment_status": "paid", "subscription": "sub_1", "metadata": {"kind": "license_setup"}})
    monkeypatch.setattr(license_stripe, "public", lambda l=None: {"mode": "test"})
    r = c.post("/api/system/setup/pay/", {**FULL, "hosting": "shared", "renew_months": 3}, format="json")
    assert r.status_code == 200 and r.json()["url"].startswith("https://checkout.stripe.test")
    from apps.core import setup_consent

    setup_consent.mark_ok(u)
    assert c.put("/api/system/setup/", {**FULL, "hosting": "shared", "renew_months": 3}, format="json").status_code == 400  # not paid yet
    assert c.post("/api/system/setup/pay/confirm/", {"session_id": "nope"}, format="json").status_code == 400
    assert c.post("/api/system/setup/pay/confirm/", {"session_id": "cs_test_1"}, format="json").status_code == 200
    assert setup_pay.ok(u) and License.objects.get(pk=1).sub_status == "active"
    shown = c.get("/api/system/setup/").json()["license_number"]  # shown in the last step of the wizard
    done = c.put("/api/system/setup/", {**FULL, "hosting": "shared", "renew_months": 3}, format="json")
    assert done.status_code == 200 and re.fullmatch(r"[A-Z0-9]{4}(-[A-Z0-9]{4}){3}", done.json()["license"]["number"]) and done.json()["license"]["number"] == shown


@pytest.mark.django_db
def test_pay_none_gives_a_short_licence():
    from datetime import date, timedelta

    from apps.core import setup_consent, setup_pay
    from apps.core.models import License

    u = get_user_model().objects.create_user("pn", "pn@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    assert c.post("/api/system/setup/pay/none/", {"hosting": "shared", "renew_months": 12}, format="json").json()["trial_days"] == setup_pay.TRIAL_DAYS
    setup_consent.mark_ok(u)
    assert c.put("/api/system/setup/", {**FULL, "hosting": "shared", "renew_months": 12, "license_until": (date.today() + timedelta(days=365)).isoformat()}, format="json").status_code == 200
    assert License.objects.get(pk=1).valid_until == date.today() + timedelta(days=setup_pay.TRIAL_DAYS)  # not the year that was chosen
    assert not setup_pay.skipped(u)
    assert c.post("/api/system/setup/pay/test/", {}, HTTP_HOST="evil.example.com", format="json").status_code == 403


@pytest.mark.django_db
def test_overview_pdf():
    u = get_user_model().objects.create_user("pf", "pf@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    for lang in ("nl", "en", "xx"):  # a language without texts falls back to English
        r = c.post("/api/system/setup/pdf/", {**FULL, "hosting": "shared", "renew_months": 12, "license_until": "2027-11-17", "lang": lang, "pay": "stripe"}, format="json")
        assert r.status_code == 200 and r["Content-Type"] == "application/pdf" and r.content[:5] == b"%PDF-"


@pytest.mark.django_db
def test_licence_phases(monkeypatch):
    from datetime import date, timedelta

    from apps.core import global_settings, licence_reminder, system
    from apps.core.models import License

    system.license_changed()
    system.grace_changed()
    global_settings.save({"grace_1": "5", "grace_2": "5", "grace_3": "5", "grace_4": "30"})
    lic, _ = License.objects.get_or_create(pk=1)
    lic.number = "AAAA-BBBB-CCCC-DDDD"

    def at(days_over):
        lic.valid_until = date.today() - timedelta(days=days_over)
        lic.save()
        system.license_changed()
        return system.license_phase()

    assert at(-3)["phase"] == 0  # still valid
    p = at(1)
    assert p["phase"] == 1 and p["days_left"] == 4 and not system.maintenance_on()
    assert at(5)["phase"] == 1 and at(6)["phase"] == 2 and at(11)["phase"] == 3
    assert at(16)["phase"] == 4 and system.maintenance_on()
    # the rules: phase 2 closes the page editor, phase 3 closes the administration (except the licence)
    from rest_framework.authtoken.models import Token

    c = APIClient()
    u = get_user_model().objects.create_user("lp1", "lp1@x.nl", "pw12345678!", is_staff=True)
    c.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.get_or_create(user=u)[0].key)  # a real token: the middleware looks at the header
    at(1)
    assert c.get("/api/system/").status_code == 200  # phase 1: full control
    at(7)
    assert c.post("/api/pages/", {}, format="json").status_code == 403 and c.post("/api/pages/", {}, format="json").json()["license_phase"] == 2
    assert c.get("/api/system/").status_code == 200  # phase 2: only the page editor is closed
    at(12)
    r = c.get("/api/system/")
    assert r.status_code == 403 and r.json()["license_phase"] == 3  # phase 3: no administration
    assert c.get("/api/system/license/usage/").status_code == 200 and c.get("/api/system/setup/").status_code == 200  # ... only the licence
    at(2)
    assert system.public()["license_phase"]["phase"] == 1
    # the daily reminder: once a day
    sent = []
    from apps.communication import sending

    monkeypatch.setattr(sending, "send_email", lambda to, subject, body, **k: sent.append((to, subject, body)))
    s = system.get()
    from apps.core.models import SystemSettings

    SystemSettings.objects.update_or_create(pk=1, defaults={"data": {**(SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}), "admin_email": "boss@x.nl"}})
    system.save({"admin_email": "boss@x.nl"})
    assert licence_reminder.run() is True and len(sent) == 1 and sent[0][0] == "boss@x.nl" and "verlopen" in sent[0][1].lower()
    assert licence_reminder.run() is False and len(sent) == 1  # not twice on one day
    system.grace_changed()


@pytest.mark.django_db
def test_licence_change_mails(monkeypatch):
    from apps.communication import sending
    from apps.core import global_settings, licence_notify
    from apps.core.models import License

    sent = []
    monkeypatch.setattr(sending, "send_email", lambda to, subject, body, **k: sent.append((to, subject, body)))
    vals, errors = global_settings.clean({"notify_rstcc": "a@rstcc.net, b@rstcc.net", "notify_invoicing": "fin@rstcc.net;a@rstcc.net"})
    assert not errors and vals["notify_invoicing"] == "fin@rstcc.net, a@rstcc.net"
    assert global_settings.clean({"notify_support": "geen-adres"})[1] and global_settings.clean({"notify_support": "a@b.nl,b@b.nl,c@b.nl,d@b.nl,e@b.nl,f@b.nl"})[1]
    global_settings.save(vals)
    lic, _ = License.objects.get_or_create(pk=1)
    lic.reseller_email = "res@partner.nl"
    lic.number = "AAAA-BBBB-CCCC-DDDD"
    lic.save()
    assert licence_notify.recipients() == {"RST CC": ["a@rstcc.net", "b@rstcc.net"], "Reseller": ["res@partner.nl"], "Invoicing": ["fin@rstcc.net", "a@rstcc.net"]}  # reseller: the licence's own address
    # a change through the licence screen: everybody once, with what changed
    u = get_user_model().objects.create_user("lm", "lm@x.nl", "pw12345678!", is_staff=True)
    u.is_superadmin_plus = True
    u.save()
    c = APIClient()
    c.force_authenticate(u)
    assert c.put("/api/system/license/", {"client": "Nieuwe klant"}, format="json").status_code == 200
    assert sorted(x[0] for x in sent) == ["a@rstcc.net", "b@rstcc.net", "fin@rstcc.net", "res@partner.nl"]
    assert "Licentie gewijzigd" in sent[0][1] and "Opdrachtgever" in sent[0][2] and "Nieuwe klant" in sent[0][2] and "lm@x.nl" in sent[0][2]
    n = len(sent)
    c.put("/api/system/license/", {"client": "Nieuwe klant"}, format="json")  # nothing changed: no mail
    assert len(sent) == n


@pytest.mark.django_db
def test_licence_price_change_and_update(monkeypatch):
    from decimal import Decimal

    from apps.communication import sending
    from apps.core import license_price, setup_consent
    from apps.core.models import License, ModuleState

    monkeypatch.setattr(sending, "send_email", lambda *a, **k: None)
    u = get_user_model().objects.create_user("pc", "pc@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    assert c.get("/api/system/license/change/").json() == {"has": False, "changed": False}
    lic, _ = License.objects.get_or_create(pk=1)
    lic.number = "AAAA-BBBB-CCCC-DDDD"
    lic.save()
    first = c.get("/api/system/license/change/").json()  # starting point: nothing changed
    assert first["has"] and not first["changed"]
    monkeypatch.setattr(license_price, "monthly", lambda l=None, _b=Decimal(first["new"]): _b + 5)  # a module that costs money was switched on
    r = c.get("/api/system/license/change/").json()
    assert r["changed"] and r["delta"] == "5.00"
    assert c.post("/api/system/license/update/", {}, format="json").status_code == 400  # no consent yet
    assert c.post("/api/system/license/update/pay/", {"choice": "confirm"}, format="json").status_code == 400  # the payment step needs the consent first
    setup_consent.mark_ok(u)
    assert c.post("/api/system/license/update/", {}, format="json").status_code == 400  # consent given, not paid yet
    assert c.post("/api/system/license/update/pay/", {"choice": "x"}, format="json").status_code == 400
    assert c.post("/api/system/license/update/pay/", {"choice": "confirm"}, format="json").status_code == 200
    assert c.post("/api/system/license/update/reset/", {}, format="json").status_code == 200  # opened again: agreement and payment must be given again
    assert c.post("/api/system/license/update/", {}, format="json").status_code == 400
    setup_consent.mark_ok(u)
    assert c.post("/api/system/license/update/pay/", {"choice": "confirm"}, format="json").status_code == 200
    ok = c.post("/api/system/license/update/", {}, format="json")
    assert ok.status_code == 200 and ok.json()["license"]["number"] == "AAAA-BBBB-CCCC-DDDD"  # the same licence
    assert not c.get("/api/system/license/change/").json()["changed"]


@pytest.mark.django_db
def test_update_refreshes_local_themes(tmp_path, settings):
    import json

    from apps.core import themepacks

    settings.THEMES_DIR = tmp_path
    d = tmp_path / "mijn-thema"
    d.mkdir()
    doc = {"key": "mijn-thema", "name": "Mijn thema", "description": "", "version": "1.0.0", "system_version": "0.0.1", "values": {"primary": "#112233", "light_line": "#aabbcc"}}
    (d / "theme.json").write_text(json.dumps(doc))
    r = themepacks.refresh_local()
    assert r["checked"] == 1 and r["updated"] == ["mijn-thema"] and not r["problems"]
    assert json.loads((d / "theme.json").read_text())["system_version"] == settings.SYSTEM_VERSION  # brought up to date
    assert themepacks.refresh_local()["updated"] == []  # nothing left to do
    themepacks.use("mijn-thema")
    assert themepacks.refresh_local()["applied"] is None  # unchanged: the look stays as it is
    doc["values"]["primary"] = "#445566"  # the theme itself changed (a new version / an edited file)
    (d / "theme.json").write_text(json.dumps(doc))
    r = themepacks.refresh_local()
    assert r["applied"] == "mijn-thema" and themepacks.current_values()["primary"] == "#445566"
    (d / "theme.json").write_text(json.dumps({**doc, "values": {"primary": "nope"}}))
    assert themepacks.refresh_local()["problems"]  # a broken theme is reported, not lost


@pytest.mark.django_db
def test_first_switch_on_a_licence_without_a_price_is_not_swallowed():
    from apps.core import license_price
    from apps.core.models import License
    from apps.plugins.models import Plugin

    u = get_user_model().objects.create_user("fs", "fs@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    lic, _ = License.objects.get_or_create(pk=1)
    lic.number, lic.billed_monthly = "AAAA-BBBB-CCCC-DDDD", 0
    lic.save()
    Plugin.objects.update_or_create(name="agenda", defaults={"title": "Agenda", "enabled": True, "manifest": {"title": "Agenda"}})  # switched on just now; it costs money in the price list
    r = c.get("/api/system/license/change/?item=plugin:agenda&enabled=1").json()
    assert r["item"]["label"] == "Agenda" and float(r["item"]["price"]) > 0 and r["changed"] and float(r["delta"]) == float(r["item"]["price"])


@pytest.mark.django_db
def test_user_payment_method_one_active():
    from apps.core.models import License

    u = get_user_model().objects.create_user("pm", "pm@x.nl", "pw12345678!", is_staff=True)
    u.is_superadmin_plus = True
    u.save()
    c = APIClient()
    c.force_authenticate(u)
    assert c.put("/api/system/license/", {"payment_method": "cash"}, format="json").status_code == 400
    r = c.put("/api/system/license/", {"payment_method": "invoice"}, format="json").json()
    assert r["billing"]["method"] == "invoice" and License.objects.get(pk=1).payment_method == "invoice"
