# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The mobile number in the profile (next to the phone number)."""
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_mobile_is_saved_checked_and_shown(django_user_model):
    u = django_user_model.objects.create_user("mo", "mo@x.nl", "pw12345678!")
    c = APIClient()
    c.force_authenticate(u)
    r = c.patch("/api/auth/me/", {"mobile": "+31 6 1234 5678"}, format="json")
    assert r.status_code == 200 and r.json()["mobile"] == "+31612345678"
    u.refresh_from_db()
    assert u.mobile == "+31612345678" and u.phone == ""  # the phone number (also the number for SMS codes) is not touched
    assert c.patch("/api/auth/me/", {"mobile": "0612345678"}, format="json").status_code == 400  # with a country code
    assert c.patch("/api/auth/me/", {"mobile": ""}, format="json").json()["mobile"] == ""
    assert c.get("/api/auth/me/").json()["mobile"] == ""
