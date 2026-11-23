# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Two-step verification is required for admins and superadmins by default, and the administrator always gets a mail when someone is blocked."""
import pytest
from rest_framework.test import APIClient

from apps.communication import sending
from apps.core import system
from apps.security import service, twofa


@pytest.mark.real_twofa_default
def test_standard_is_required_for_admins():
    assert service.DEFAULTS["twofa"]["required_for"] == "admins"


@pytest.mark.real_twofa_default
@pytest.mark.django_db
def test_admin_must_set_up_but_a_normal_user_not(django_user_model):
    admin = django_user_model.objects.create_user("ad", "ad@x.nl", "pw12345678!", is_staff=True)
    user = django_user_model.objects.create_user("us", "us@x.nl", "pw12345678!")
    assert twofa.needs_setup(admin) is True
    assert twofa.needs_setup(user) is False


@pytest.mark.django_db
def test_administrator_gets_a_mail_when_a_login_is_blocked(monkeypatch, django_user_model):
    sent = []
    monkeypatch.setattr(sending, "send_email", lambda to, subject, body, **kw: sent.append((to, subject, body)))
    system.save({"admin_email": "beheer@x.nl"})
    service.save({"basic": {"login_max_attempts": 3, "lockout_minutes": 10}}) if hasattr(service, "save") else None
    django_user_model.objects.create_user("vi", "vic@x.nl", "pw12345678!")
    c = APIClient()
    n = service.get()["basic"]["login_max_attempts"]
    for _ in range(n):
        c.post("/api/auth/login/", {"email": "vic@x.nl", "password": "fout"}, format="json")
    assert len(sent) == 1 and sent[0][0] == "beheer@x.nl" and "vic@x.nl" in sent[0][1]


@pytest.mark.django_db
def test_two_step_and_blocking_are_saved_from_the_defaults_screen_and_go_with_the_defaults(django_user_model):
    """The tab "Twee-staps verificatie" of Standaard en globale instellingen saves a part of the security settings; they are part of the default settings (the security section)."""
    from apps.core import site_defaults

    u = django_user_model.objects.create_user("sp", "sp@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    body = {"twofa": {"enabled": True, "required_for": "all", "allow_email": True, "allow_app": True, "allow_sms": False, "code_minutes": 5, "max_attempts": 3, "app_issuer": "Studio2"}, "basic": {"login_max_attempts": 4, "lockout_minutes": 30}}
    r = c.put("/api/security/settings/", body, format="json")
    assert r.status_code == 200
    s = r.json()["settings"]
    assert s["twofa"]["required_for"] == "all" and s["twofa"]["max_attempts"] == 3 and s["basic"]["login_max_attempts"] == 4 and s["basic"]["token_lifetime_hours"] == 168  # the rest stays
    data = site_defaults.capture()
    assert data
    import json

    saved = json.loads(site_defaults.PATH.read_text())["bundle"]["sections"]["security"]["data"]
    assert saved["twofa"]["required_for"] == "all" and saved["basic"]["lockout_minutes"] == 30


@pytest.mark.real_twofa_default
@pytest.mark.django_db
def test_superadmin_can_bypass_the_forced_setup_for_this_login_only(django_user_model):
    from rest_framework.authtoken.models import Token

    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    plain = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=boss).key)
    assert c.get("/api/entities/").status_code == 403 and c.get("/api/auth/me/").json()["twofa"]["setup_required"] is True  # the server refuses everything until it is set up
    assert c.get("/api/auth/me/").json()["twofa"]["can_bypass"] is True
    r = c.post("/api/auth/2fa/bypass/")
    assert r.status_code == 200 and r.json()["twofa"]["setup_required"] is False and r.json()["twofa"]["bypassed"] is True
    assert c.get("/api/auth/me/").json()["twofa"]["setup_required"] is False  # still bypassed
    Token.objects.filter(user=boss).delete()  # a new login (new token) asks again
    c2 = APIClient()
    c2.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=boss).key)
    assert c2.get("/api/auth/me/").json()["twofa"]["setup_required"] is True
    # once a licence exists nobody can bypass any more
    from apps.core.models import License

    License.objects.update_or_create(pk=1, defaults={"number": "E2E-TEST-0001"})
    assert c2.get("/api/auth/me/").json()["twofa"]["can_bypass"] is False and c2.post("/api/auth/2fa/bypass/").status_code == 403
    License.objects.filter(pk=1).delete()
    # an admin who is not a superadmin cannot bypass
    admin_role = django_user_model.objects.create_user("ad", "ad@x.nl", "pw12345678!")
    c3 = APIClient()
    c3.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=admin_role).key)
    assert c3.post("/api/auth/2fa/bypass/").status_code == 403 and plain.pk


@pytest.mark.django_db
def test_phone_for_the_sms_code_comes_from_the_login_or_the_contact_data(django_user_model):
    from apps.core import system

    u = django_user_model.objects.create_user("ph", "ph@x.nl", "pw12345678!")
    assert twofa.suggested_phone(u) == ""
    system.save({"contact_email": "ph@x.nl", "mobile": "+31 612345678"})
    assert twofa.suggested_phone(u) == "+31 612345678"  # the contact person of the website
    u.phone = "+31200000000"
    assert twofa.suggested_phone(u) == "+31 612345678"  # the phone number is not the number for SMS codes
    u.mobile = "+31611111111"
    assert twofa.suggested_phone(u) == "+31611111111" and twofa.state(u)["phone"] == "+31611111111"  # the mobile number of the login wins
    other = django_user_model.objects.create_user("o2", "o2@x.nl", "pw12345678!")
    assert twofa.suggested_phone(other) == ""


@pytest.mark.django_db
def test_sms_is_allowed_by_default_and_the_sandbox_says_it_sent_nothing(django_user_model, monkeypatch):
    from rest_framework.authtoken.models import Token

    from apps.sandbox import service as sandbox

    assert service.DEFAULTS["twofa"]["allow_sms"] is True
    sandbox.save({"enabled": True, "code_on_screen": True}) if hasattr(sandbox, "save") else None
    u = django_user_model.objects.create_user("sb", "sb@x.nl", "pw12345678!")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=u).key)
    r = c.post("/api/auth/2fa/start/", {"method": "email"}, format="json")
    assert r.status_code == 200 and r.json()["sandbox"] is True and len(r.json()["sandbox_code"]) == 6  # nothing was sent: the form shows the code
    type(u).objects.filter(pk=u.pk).update(otp_sent_at=None)  # (a new code may only be asked for after a short wait)
    r = c.post("/api/auth/2fa/start/", {"method": "sms", "phone": "+31612345678"}, format="json")
    assert r.status_code == 200 and r.json()["sandbox"] is True


@pytest.mark.django_db
def test_code_is_given_to_the_screen_only_while_the_sandbox_is_on(django_user_model, monkeypatch):
    from apps.sandbox import service as sandbox

    monkeypatch.setattr(twofa, "deliver", lambda *a, **k: None)  # (no e-mail link in a test)

    u = django_user_model.objects.create_user("cv", "cv@x.nl", "pw12345678!", twofa_method="email")
    sandbox.save({"enabled": False})
    assert twofa.issue_code(u) is None  # sandbox off: nothing on the screen, ever
    u.otp_sent_at = None  # (a new code may only be asked for after a short wait)
    sandbox.save({"enabled": True, "code_on_screen": False})
    code = twofa.issue_code(u)
    assert code and len(code) == 6 and sandbox.code_visible() and not sandbox.code_on_screen()  # filled in, the message still goes to the sandbox messages


@pytest.mark.django_db
def test_method_can_be_changed_but_only_after_the_new_one_is_proven(django_user_model, monkeypatch):
    from rest_framework.authtoken.models import Token

    monkeypatch.setattr(twofa, "deliver", lambda *a, **k: None)
    monkeypatch.setattr(twofa, "allowed_methods", lambda: ["email", "sms", "app"])
    u = django_user_model.objects.create_user("cm", "cm@x.nl", "pw12345678!", otp_active=True, twofa_method="email")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=u).key)
    r = c.post("/api/auth/2fa/start/", {"method": "sms", "phone": "+31612345678", "change": True}, format="json")
    assert r.status_code == 200
    u.refresh_from_db()
    assert u.twofa_method == "email" and u.phone == ""  # nothing changed yet: a wrong number can not lock anybody out
    assert c.post("/api/auth/2fa/confirm/", {"change": True, "code": "000000"}, format="json").status_code == 400
    u.refresh_from_db()
    code = "123456"
    u.otp_token = twofa._hash(u, code)
    u.otp_attempts = 0
    from django.utils import timezone
    from datetime import timedelta
    u.otp_expires = timezone.now() + timedelta(minutes=5)
    u.save()
    r = c.post("/api/auth/2fa/confirm/", {"change": True, "code": code}, format="json")
    assert r.status_code == 200
    u.refresh_from_db()
    assert u.twofa_method == "sms" and u.mobile == "+31612345678" and u.otp_active
    # the same method again is refused; a change needs two-step verification to be on
    assert c.post("/api/auth/2fa/start/", {"method": "sms", "phone": "+31612345678", "change": True}, format="json").status_code == 400
    plain = django_user_model.objects.create_user("pn", "pn@x.nl", "pw12345678!")
    c2 = APIClient()
    c2.credentials(HTTP_AUTHORIZATION="Token " + Token.objects.create(user=plain).key)
    assert c2.post("/api/auth/2fa/start/", {"method": "email", "change": True}, format="json").status_code == 400
