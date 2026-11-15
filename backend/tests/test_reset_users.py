# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Reset: the administrators and the other superadmins stay unless the reset asks for them to go; the standard superadmin always stays."""
import pytest

from apps.accounts.models import Role, User
from apps.core import reset


@pytest.fixture
def users(db, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "standaard@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "geheim-wachtwoord-1")
    sa = User.objects.create(username="sa2", email="sa2@example.com", is_staff=True, is_superuser=True)
    admin = User.objects.create(username="adm", email="adm@example.com")
    admin.roles.add(Role.objects.create(name="Beheerder"))
    plain = User.objects.create(username="plain", email="plain@example.com")
    return sa, admin, plain


def test_administrators_are_found_by_their_role(users):
    _sa, admin, plain = users
    ids = reset._admin_ids()
    assert admin.pk in ids and plain.pk not in ids


def test_the_standard_superadmin_is_made_and_the_others_stay_or_go(users):
    sa, _admin, _plain = users
    assert reset.standard_admin("keep") == "standaard@example.com"
    sa.refresh_from_db()
    assert User.objects.filter(email="standaard@example.com", is_staff=True).exists() and sa.is_active  # stays active
    reset.standard_admin("deactivate")
    sa.refresh_from_db()
    assert not sa.is_active  # switched off
    reset.standard_admin("delete")
    assert not User.objects.filter(pk=sa.pk).exists()  # removed
    assert User.objects.filter(email="standaard@example.com", is_staff=True).exists()  # the standard one always stays


def test_the_summary_counts_admins_and_other_superadmins(users):
    s = reset.summary()
    assert s["admins"] == 1 and s["other_superadmins"] >= 1
