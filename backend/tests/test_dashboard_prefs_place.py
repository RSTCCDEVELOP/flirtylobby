# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The last place of a person is kept on the server (to come back to after logging in); only pages of this site."""
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_last_place_is_kept_and_checked(django_user_model):
    u = django_user_model.objects.create_user("lp", "lp@x.nl", "pw12345678!")
    c = APIClient(); c.force_authenticate(u)
    r = c.put("/api/dashboard/prefs/", {"set": {"lastPlace": "/dashboard/admin/cache?x=1"}, "remove": []}, format="json").json()
    assert r["prefs"]["lastPlace"] == "/dashboard/admin/cache?x=1"
    for bad in ("//evil.com", "https://evil.com", "/\\evil.com"):
        r = c.put("/api/dashboard/prefs/", {"set": {"lastPlace": bad}, "remove": []}, format="json").json()
        assert r["prefs"]["lastPlace"] == "/dashboard/admin/cache?x=1"
