# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Custom pages (own pages) are no part of a standard installation and are gone after a reset."""
import pytest

from apps.core import presets
from apps.pages.models import Page, PageLayout


@pytest.mark.django_db
def test_a_custom_page_is_not_offered_not_saved_and_not_used_by_an_installation():
    key = presets.PRESETS[0]["key"]
    Page.objects.create(key="mijn-eigen", kind="content", title={"nl": "Mijn pagina"}, source="")
    PageLayout.objects.create(key="mijn-eigen", data={"rows": [{"cells": [{"items": [{"type": "text", "id": "a", "ref": "x"}]}]}]})
    assert "mijn-eigen" not in [p["key"] for p in presets.edit_options(key)["pages"]]
    with pytest.raises(ValueError):
        presets.save_page(key, "mijn-eigen")
    d = presets._data()
    d["preset_pages"] = {key: {"mijn-eigen": {"layout": {}, "blocks": {}}}}
    d["preset_edits"] = {key: {"pages": {"add": ["mijn-eigen"], "remove": []}}}
    presets._save_data(d)
    assert "mijn-eigen" not in presets.saved_pages(key) and "mijn-eigen" not in presets.page_edits(key)["add"]


@pytest.mark.django_db
def test_a_reset_removes_custom_pages_and_what_installations_kept_of_them(django_user_model):
    from apps.core import reset
    from apps.core.models import SystemSettings

    key = presets.PRESETS[0]["key"]
    Page.objects.create(key="mijn-eigen", kind="content", title={"nl": "Mijn pagina"}, source="")
    d = presets._data()
    d["preset_pages"] = {key: {"mijn-eigen": {"layout": {}, "blocks": {}}}}
    d["preset_edits"] = {key: {"pages": {"add": ["mijn-eigen"], "remove": []}, "modules": ["x"]}}
    presets._save_data(d)
    django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    reset.perform()
    assert not Page.objects.filter(key="mijn-eigen").exists()
    data = SystemSettings.objects.get(pk=1).data
    assert "preset_pages" not in data and "pages" not in (data.get("preset_edits") or {}).get(key, {})


@pytest.mark.django_db
def test_dev_login_gives_the_local_password_with_the_token(django_user_model, monkeypatch, settings):
    """On your own computer "@" fills in the password: with a superadmin+ the answer has the token AND the password of DEV_LOGIN_PASSWORD (the reset screen needs it)."""
    from rest_framework.test import APIClient

    settings.DEBUG = True
    monkeypatch.setenv("DEV_LOGIN_PASSWORD", "lokaal-wachtwoord")
    u = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    u.is_superadmin_plus = True
    u.save()
    r = APIClient().get("/api/auth/dev-login/", REMOTE_ADDR="127.0.0.1", HTTP_HOST="localhost").json()
    assert r["configured"] and r["token"] and r["password"] == "lokaal-wachtwoord"


@pytest.mark.django_db
def test_the_reset_accepts_the_local_password_that_at_fills_in_only_on_this_computer(django_user_model, monkeypatch, settings):
    from rest_framework.test import APIClient

    u = django_user_model.objects.create_user("su", "su@x.nl", "echt-wachtwoord-1!", is_staff=True, is_superuser=True)
    c = APIClient(); c.force_authenticate(u)
    monkeypatch.setenv("DEV_LOGIN_PASSWORD", "lokaal-wachtwoord")
    body = {"confirm": "RESET", "password": "lokaal-wachtwoord"}
    settings.DEBUG = False
    assert c.post("/api/system/reset/", body, format="json", REMOTE_ADDR="127.0.0.1", HTTP_HOST="localhost").status_code == 400  # not in production
    settings.DEBUG = True
    assert c.post("/api/system/reset/", body, format="json", REMOTE_ADDR="10.1.2.3", HTTP_HOST="localhost").status_code == 400  # not from another computer
    r = c.post("/api/system/reset/", {"confirm": "RESET", "password": "fout"}, format="json", REMOTE_ADDR="127.0.0.1", HTTP_HOST="localhost")
    assert r.status_code == 400 and "klopt niet" in r.json()["detail"]


@pytest.mark.django_db
def test_the_local_password_is_accepted_on_this_computer(django_user_model, monkeypatch, settings):
    from rest_framework.test import APIClient

    from apps.core import reset

    u = django_user_model.objects.create_user("su", "su@x.nl", "echt-wachtwoord-1!", is_staff=True, is_superuser=True)
    c = APIClient(); c.force_authenticate(u)
    monkeypatch.setenv("DEV_LOGIN_PASSWORD", "lokaal-wachtwoord")
    monkeypatch.setattr(reset, "perform", lambda *a, **k: {"removed": {}})
    settings.DEBUG = True
    r = c.post("/api/system/reset/", {"confirm": "RESET", "password": "lokaal-wachtwoord"}, format="json", REMOTE_ADDR="127.0.0.1", HTTP_HOST="localhost")
    assert "klopt niet" not in str(r.content)
