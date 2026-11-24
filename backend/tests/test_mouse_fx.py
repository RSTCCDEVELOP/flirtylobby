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


@pytest.mark.django_db
def test_the_mouse_effects_go_with_a_theme_package_and_a_standard_installation(settings, tmp_path):
    """A theme package (also the one that is kept in a standard installation, and so a template) holds the mouse effects: applying it sets them, and a theme without them switches them off."""
    from apps.core import preset_design, presets, themepacks
    from apps.core.models import SiteSettings

    settings.THEMES_DIR = tmp_path / "themes"
    settings.RESOURCE_DIR = tmp_path
    key = presets.PRESETS[0]["key"]
    row = SiteSettings.load()
    row.theme = {"primary": "#112233", "fx_cursor": "blob", "fx_tilt": "yes"}
    row.save()
    info = preset_design.capture_theme(key)  # kept in the installation
    assert info and (tmp_path / "presets" / key / "design" / "theme.zip").is_file()
    pk = themepacks.manifest_of(preset_design.theme_key(key))
    assert pk["values"]["fx_cursor"] == "blob" and pk["values"]["fx_tilt"] == "yes" and pk["values"]["fx_glow"] == "no"  # (complete: also what is off)
    row.theme = {"fx_ripple": "yes"}
    row.save()
    preset_design.install_theme(key)  # setting the installation brings the effects back
    th = themepacks.current_values()
    assert th["fx_cursor"] == "blob" and th["fx_tilt"] == "yes" and th["fx_ripple"] == "no"
    plain = themepacks.create("Zonder effecten", from_current=False)
    themepacks.use(plain)  # a theme without effects switches them off
    assert themepacks.current_values()["fx_cursor"] == "off"


def test_the_numbers_of_the_effects_have_limits_and_defaults():
    assert theme.DEFAULTS["fx_cursor_size"] == 34 and theme.DEFAULTS["fx_glow_size"] == 260 and theme.DEFAULTS["fx_cursor_color"] == "primary"
    ok, err = theme.validate({"fx_cursor_size": 50, "fx_cursor_grow": 2.5, "fx_cursor_color": "white", "fx_cursor_native": "yes", "fx_tilt_amount": 10})
    assert not err and ok["fx_cursor_size"] == 50
    _c, err = theme.validate({"fx_cursor_size": 500, "fx_glow_strength": 0, "fx_cursor_color": "pink"})
    assert set(err) == {"fx_cursor_size", "fx_glow_strength", "fx_cursor_color"}
