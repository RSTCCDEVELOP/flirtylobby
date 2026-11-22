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
