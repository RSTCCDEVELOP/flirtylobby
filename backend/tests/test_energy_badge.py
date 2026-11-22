# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The energy label at the bottom of the website: off by default, and only what the administrator chose is given out."""
import pytest
from rest_framework.test import APIClient

from apps.energy import service
from apps.energy.models import EnergySettings


@pytest.mark.django_db
def test_off_by_default_and_only_the_chosen_items_are_given():
    anon = APIClient()
    assert anon.get("/api/energy/badge/").json() == {"enabled": False}
    st = EnergySettings.load()
    st.badge_on, st.badge_show = True, ["rating", "views"]
    st.save()
    d = anon.get("/api/energy/badge/").json()
    assert d["enabled"] is True and d["show"] == ["rating", "views"]
    assert "co2_g" not in d and "page_bytes" not in d and "live" not in d  # not chosen: not given out
    assert "views" in d


def test_green_status_follows_the_label():
    assert service.green_status("A+") == service.green_status("B") == "green"
    assert service.green_status("D") == "orange" and service.green_status("F") == "red" and service.green_status("") == ""


@pytest.mark.django_db
def test_the_administrator_sets_it(django_user_model):
    u = django_user_model.objects.create_user("en", "en@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    r = c.patch("/api/admin/energy/settings/", {"badge_on": True, "badge_show": ["co2", "live", "nonsense"]}, format="json")
    assert r.status_code == 200
    j = r.json()
    assert j["badge_on"] is True and j["badge_show"] == ["co2", "live"] and "rating" in j["badge_items"]


@pytest.mark.django_db
def test_the_energy_label_is_part_of_the_standard_settings():
    """Standaard en globale instellingen -> Instellingen: the label is carried with a new installation and put on it (also at an update, unless the tab is kept)."""
    from apps.core import global_settings as g
    from apps.core import site_defaults as sd

    assert g.get()["energy_badge"] == "0"  # off until somebody switches it on
    vals, err = g.clean({"energy_badge": "1", "energy_badge_show": "co2,live,nonsense"})
    assert not err and vals["energy_badge_show"] == "co2,live"
    g.save(vals)
    st = EnergySettings.load()
    assert st.badge_on is True and st.badge_show == ["co2", "live"]
    assert g.get()["energy_badge"] == "1" and g.get()["energy_badge_show"] == "co2,live"  # the screen shows what the installation does
    assert sd._shared_global()["energy_badge"] == "1"  # carried
    # an update puts the carried values on an installation, except when the tab is kept there
    import json

    sd.PATH.write_text(json.dumps({"format": "site-defaults", "version": 1, "bundle": {"sections": {}}, "global": {"energy_badge": "0", "energy_badge_show": "rating"}}))
    g.save({"keep_settings": "1"})
    sd.push()
    assert EnergySettings.load().badge_on is True  # kept
    sd.push(force=True, tabs=["settings"])
    assert EnergySettings.load().badge_on is False and EnergySettings.load().badge_show == ["rating"]
