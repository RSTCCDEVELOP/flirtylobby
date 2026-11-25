# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""easy2edit admin setup: the settings of the admin and the dashboards; the module is always on, also in every standard installation."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core import adminsetup, modules, presets


def _client(staff):
    u = get_user_model().objects.create(username="s" if staff else "p", email="x@example.com", is_staff=staff)
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_the_module_is_core_and_always_on_in_every_installation():
    assert modules.BY_KEY["admin_setup"]["core"] and "admin_setup" in modules.ALWAYS_ON and "admin_setup" in presets.ALWAYS_ON
    assert modules.enabled("admin_setup")


def test_validation_accepts_good_values_and_refuses_bad_ones():
    ok, err = adminsetup.validate({"view": "list", "page_size": "25", "sidebar": "open", "menu_search": False, "hidden_tiles": ["/dashboard/admin/tags"], "blocks": {"ai": False}})
    assert not err and ok["view"] == "list" and ok["blocks"]["ai"] is False and ok["blocks"]["about"] is True
    for bad in ({"view": "x"}, {"page_size": "7"}, {"sidebar": "x"}, {"hidden_tiles": ["https://x.nl"]}, {"hidden_tiles": ["/dashboard/admin/admin-setup"]}, {"blocks": {"zzz": True}}, {"nope": 1}):
        assert adminsetup.validate(bad)[1], bad


@pytest.mark.django_db
def test_an_administrator_saves_and_resets_and_a_person_only_reads():
    admin, person = _client(True), _client(False)
    assert person.get("/api/admin-setup/").json()["settings"]["view"] == "tiles"
    assert person.put("/api/admin-setup/", {"view": "list"}, format="json").status_code == 403
    r = admin.put("/api/admin-setup/", {"view": "list", "blocks": {"about": False}}, format="json")
    assert r.status_code == 200 and r.json()["settings"]["view"] == "list" and r.json()["settings"]["blocks"] == {"ai": True, "presets": True, "backup": True, "about": False}
    assert person.get("/api/admin-setup/").json()["settings"]["view"] == "list"  # everybody gets the website's starting value
    assert admin.put("/api/admin-setup/", {"view": "x"}, format="json").status_code == 400
    assert admin.delete("/api/admin-setup/").json()["settings"]["view"] == "tiles"


@pytest.mark.django_db
def test_not_logged_in_gets_nothing():
    assert APIClient().get("/api/admin-setup/").status_code in (401, 403)
