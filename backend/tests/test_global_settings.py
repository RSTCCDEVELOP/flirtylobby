# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Default and global settings (the data of the default easy2edit server): the standard, checking, saving, superadmins only, and going with the default settings."""
import json

import pytest

from apps.core import global_settings, site_defaults


@pytest.mark.django_db
def test_standard_and_saving():
    assert {k: v for k, v in global_settings.get().items() if k not in global_settings.GRACE + global_settings.NOTIFY + global_settings.RESELLER + global_settings.LOCAL + global_settings.TREES + ("energy_badge", "energy_badge_show") and k != "grace_reminder"} == {"base_domain": "easy2edit.com", "api_url": "https://api.easy2edit.com", "site_url": "https://easy2edit.com", "source_mode": "local"}
    assert [global_settings.get()[k] for k in global_settings.GRACE] == ["14", "14", "14", "30"]  # the standard phases of a licence that has ended
    vals, errors = global_settings.clean({"base_domain": ".Example.com", "api_url": "api.example.com/"})
    assert not errors and vals == {"base_domain": "example.com", "api_url": "https://api.example.com"}  # ".example.com" and a bare host are completed
    global_settings.save(vals)
    g = global_settings.get()
    assert g["base_domain"] == "example.com" and g["api_url"] == "https://api.example.com" and g["site_url"] == "https://easy2edit.com"
    global_settings.save({"api_url": ""})  # empty: back to the standard
    assert global_settings.get()["api_url"] == "https://api.easy2edit.com"


def test_checks():
    _, errors = global_settings.clean({"base_domain": "https://x.com/path", "api_url": "http://x.com", "site_url": "https://x.com/a"})
    assert set(errors) == {"base_domain", "api_url", "site_url"}


@pytest.mark.django_db
def test_only_superadmins(client):
    from django.contrib.auth import get_user_model
    from rest_framework.authtoken.models import Token

    U = get_user_model()
    adm = U.objects.create(username="a", email="a@example.com", is_staff=False)
    sup = U.objects.create(username="s", email="s@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    plain = U.objects.create(username="p", email="p@example.com", is_staff=True, is_superuser=True)  # a normal superadmin
    h = lambda u: {"HTTP_AUTHORIZATION": f"Token {Token.objects.get_or_create(user=u)[0].key}"}  # noqa: E731
    assert client.get("/api/system/global-settings/", **h(adm)).status_code == 403
    assert client.get("/api/system/global-settings/", **h(plain)).status_code == 403  # the data of the easy2edit server: superadmin+ only
    assert client.put("/api/system/global-settings/", json.dumps({"base_domain": "x.com"}), content_type="application/json", **h(adm)).status_code == 403
    r = client.put("/api/system/global-settings/", json.dumps({"base_domain": "klant.nl", "api_url": "https://api.klant.nl"}), content_type="application/json", **h(sup))
    assert r.status_code == 200 and r.json()["values"]["base_domain"] == "klant.nl"
    bad = client.put("/api/system/global-settings/", json.dumps({"api_url": "ftp://x"}), content_type="application/json", **h(sup))
    assert bad.status_code == 400


@pytest.mark.django_db
def test_goes_with_the_default_settings(tmp_path, monkeypatch):
    monkeypatch.setattr(site_defaults, "PATH", tmp_path / "site_defaults.json")
    global_settings.save({"base_domain": "mijn.nl"})
    site_defaults.capture()
    assert json.loads((tmp_path / "site_defaults.json").read_text())["global"]["base_domain"] == "mijn.nl"
    global_settings.save({"base_domain": "ander.nl"})
    site_defaults.apply()  # a new installation / reset puts the saved default back
    assert global_settings.get()["base_domain"] == "mijn.nl"
