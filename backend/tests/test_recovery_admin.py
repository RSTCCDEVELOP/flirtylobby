# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The recovery superadmin: stored encrypted, made only when no superadmin exists."""
import pytest

from apps.accounts import superplus
from apps.core.models import SystemSettings


@pytest.mark.django_db
def test_the_credentials_are_stored_encrypted_and_the_account_is_made_only_without_a_superadmin(django_user_model):
    superplus.store_recovery("Admin@Easy2edit.com", "Een-Sterk-Wachtwoord-1", "Ronald", "Stolk")
    raw = SystemSettings.objects.get(pk=1).data[superplus.RECOVERY_KEY]
    assert "Een-Sterk-Wachtwoord-1" not in raw and "easy2edit" not in raw.lower()  # (encrypted: not readable in the settings)
    assert superplus.recovery()["email"] == "admin@easy2edit.com"
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    assert superplus.ensure_recovery() == "" and not django_user_model.objects.filter(email="admin@easy2edit.com").exists()  # a superadmin exists
    boss.is_active = False
    boss.save()
    assert superplus.ensure_recovery() == "admin@easy2edit.com"
    u = django_user_model.objects.get(email="admin@easy2edit.com")
    assert u.is_staff and u.is_superuser and u.is_superadmin_plus and u.check_password("Een-Sterk-Wachtwoord-1") and (u.first_name, u.last_name) == ("Ronald", "Stolk")
    assert superplus.ensure_recovery() == ""  # (once)


@pytest.mark.django_db
def test_nothing_stored_nothing_made():
    assert superplus.ensure_recovery() == ""
