# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The overview of /easy2edit_version: version and modules are open, the e-mail addresses of the administrators are for a superadmin only."""
from rest_framework.test import APIClient

from apps.accounts.models import User


def test_overview_is_open_but_the_prices_are_not(db):
    User.objects.create(username="a", email="a@example.com", is_staff=True)
    r = APIClient().get("/api/system/overview/")
    assert r.status_code == 200 and r.data["version"] and r.data["modules"] and [a["email"] for a in r.data["admins"]] == ["a@example.com"]

    assert r.data["license"] is not None and "yearly" not in r.data["license"]  # the licence is open, the prices are not


def test_overview_gives_the_admins_to_a_superadmin(db):
    u = User.objects.create(username="a", email="a@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(u)
    r = c.get("/api/system/overview/")
    assert [a["email"] for a in r.data["admins"]] == ["a@example.com"]
