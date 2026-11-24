# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The mouse effects of the website are theme settings (fx_*): off by default, saved with the theme."""
import pytest
from rest_framework.test import APIClient

from apps.core import theme

FX = ("fx_cursor", "fx_magnetic", "fx_tilt", "fx_glow", "fx_ripple", "fx_parallax")


def test_the_effects_are_off_by_default_and_only_known_values_are_accepted():
    assert theme.DEFAULTS["fx_cursor"] == "off" and all(theme.DEFAULTS[k] == "no" for k in FX[1:])
    ok, err = theme.validate({"fx_cursor": "blob", "fx_tilt": "yes"})
    assert ok == {"fx_cursor": "blob", "fx_tilt": "yes"} and not err
    _c, err = theme.validate({"fx_cursor": "laser", "fx_glow": "maybe"})
    assert set(err) == {"fx_cursor", "fx_glow"}


@pytest.mark.django_db
def test_a_superadmin_saves_the_effects_with_the_theme(django_user_model):
    su = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(su)
    r = c.get("/api/theme/").json()
    assert {"fx_cursor", "fx_magnetic"} <= {f["key"] for g in r["schema"] for f in g["fields"]}
    vals = {**r["values"], "fx_cursor": "ring", "fx_magnetic": "yes"}
    assert c.put("/api/theme/", {"values": vals}, format="json").status_code == 200
    assert c.get("/api/theme/").json()["values"]["fx_cursor"] == "ring"
