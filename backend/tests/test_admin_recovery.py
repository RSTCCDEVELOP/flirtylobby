# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""admin@easy2edit.com can always be got back: a code to that address, a new password, and the account is made again as superadmin+."""
import re

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.communication import sending

EMAIL = "admin@easy2edit.com"


@pytest.fixture
def mails(monkeypatch):
    sent = []
    monkeypatch.setattr(sending, "send_email", lambda to, subject, body, **kw: sent.append((to, kw.get("code"))))
    return sent


def test_gone_admin_is_made_again_after_the_code(db, mails):
    c = APIClient()
    assert not User.objects.filter(email__iexact=EMAIL).exists()
    c.post("/api/auth/password-reset/request/", {"email": EMAIL}, format="json")
    assert mails and mails[0][0] == EMAIL and re.fullmatch(r"\d{3}-\d{3}", mails[0][1])
    u = User.objects.get(email=EMAIL)
    assert not u.is_active and not u.has_usable_password()  # waiting: nobody can log in yet
    bad = c.post("/api/auth/password-reset/confirm/", {"email": EMAIL, "code": "999-999", "password": "Sterk-wachtwoord-77"}, format="json")
    assert bad.status_code == 400 and not User.objects.get(email=EMAIL).is_active
    ok = c.post("/api/auth/password-reset/confirm/", {"email": EMAIL, "code": mails[0][1], "password": "Sterk-wachtwoord-77"}, format="json")
    assert ok.status_code == 200
    u.refresh_from_db()
    assert (u.first_name, u.last_name, u.is_active, u.is_staff, u.is_superuser, u.is_superadmin_plus) == ("Ronald", "Stolk", True, True, True, True)
    assert u.check_password("Sterk-wachtwoord-77")


def test_other_addresses_are_not_made(db, mails):
    APIClient().post("/api/auth/password-reset/request/", {"email": "iemand@example.com"}, format="json")
    assert not mails and not User.objects.filter(email="iemand@example.com").exists()


def test_a_wrong_password_for_the_standard_admin_sends_the_code(db, mails):
    c = APIClient()
    r = c.post("/api/auth/login/", {"email": EMAIL, "password": "fout"}, format="json")  # the account is gone
    assert r.status_code == 200 and r.data["reset_required"] and mails and mails[0][0] == EMAIL
    User.objects.filter(email=EMAIL).update(is_active=True)
    u = User.objects.get(email=EMAIL)
    u.set_password("goed-wachtwoord-1")
    u.save()
    mails.clear()
    assert c.post("/api/auth/login/", {"email": EMAIL, "password": "goed-wachtwoord-1"}, format="json").data.get("token")  # the right password just logs in
    assert not mails
    PasswordResetRow = __import__("apps.accounts.models", fromlist=["PasswordReset"]).PasswordReset
    PasswordResetRow.objects.all().delete()
    r = c.post("/api/auth/login/", {"email": EMAIL, "password": "fout"}, format="json")  # the account exists but the password is wrong
    assert r.data["reset_required"] and mails
    other = c.post("/api/auth/login/", {"email": "iemand@example.com", "password": "fout"}, format="json")
    assert other.status_code == 400 and "reset_required" not in other.data
