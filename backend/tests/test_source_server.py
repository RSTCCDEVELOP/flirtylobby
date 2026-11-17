# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The library (source) from the easy2edit server: the setting, the server that hands out its folder resource/ to known websites, and a website that reads the library from there."""
import io
import json
import zipfile

import pytest

from apps.core import global_settings, resources, sitemanager

JSON = "application/json"
IID = "c1d2e3f405162738495a6b7c8d9e0f10"


def theme_zip(key="t1", version="1.0.0"):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("theme.json", json.dumps({"key": key, "name": "Theme " + key, "version": version, "description": "x"}))
    return b.getvalue()


@pytest.fixture
def library(tmp_path, settings):
    (tmp_path / "themas").mkdir()
    (tmp_path / "themas" / "t1-1.0.0.zip").write_bytes(theme_zip())
    settings.RESOURCE_DIR = tmp_path
    return tmp_path


def key_of(client, approve=True):
    r = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": IID, "name": "Blue"}), content_type=JSON)
    if approve:
        from apps.core.models import EasySite

        EasySite.objects.update(status="active")  # (a new website waits for approval)
    return r.json()["key"]


def test_the_setting_is_checked():
    assert global_settings.clean({"source_mode": "easy2edit"})[0] == {"source_mode": "easy2edit"}
    assert "source_mode" in global_settings.clean({"source_mode": "elsewhere"})[1]


@pytest.mark.django_db
def test_the_server_hands_out_its_library_to_known_websites_only(client, library):
    assert client.get("/api/easy2edit/source/?kind=themas").status_code == 404  # not the easy2edit server
    sitemanager.set_server(True)
    key = key_of(client)
    assert client.get("/api/easy2edit/source/?kind=themas").status_code == 403  # no key
    assert client.get("/api/easy2edit/source/?kind=themas", HTTP_X_EASY2EDIT_KEY="wrong").status_code == 403
    r = client.get("/api/easy2edit/source/?kind=themas", HTTP_X_EASY2EDIT_KEY=key)
    assert r.status_code == 200 and [e["name"] for e in r.json()["items"]] == ["t1"]
    assert client.get("/api/easy2edit/source/?kind=nothing", HTTP_X_EASY2EDIT_KEY=key).status_code == 400
    f = client.get("/api/easy2edit/source/file/?kind=themas&file=t1-1.0.0.zip", HTTP_X_EASY2EDIT_KEY=key)
    assert f.status_code == 200 and f.content[:2] == b"PK"
    for bad in ("../x.zip", "t1-1.0.0.zip/../../x.zip", "..%2Fthemas%2Ft1-1.0.0.zip"):  # nothing outside the library
        assert client.get(f"/api/easy2edit/source/file/?kind=themas&file={bad}", HTTP_X_EASY2EDIT_KEY=key).status_code in (400, 404)
    assert client.get("/api/easy2edit/source/file/?kind=themas&file=missing.zip", HTTP_X_EASY2EDIT_KEY=key).status_code == 404
    from apps.core.models import EasySite

    EasySite.objects.update(status="blocked")  # a blocked website gets nothing
    assert client.get("/api/easy2edit/source/?kind=themas", HTTP_X_EASY2EDIT_KEY=key).status_code == 403


@pytest.mark.django_db
def test_a_website_that_waits_for_approval_gets_no_library(client, library):
    sitemanager.set_server(True)
    key = key_of(client, approve=False)
    r = client.get("/api/easy2edit/source/?kind=themas", HTTP_X_EASY2EDIT_KEY=key)
    assert r.status_code == 403 and r.json()["reason"] == "pending"
    assert client.get("/api/easy2edit/source/file/?kind=themas&file=t1-1.0.0.zip", HTTP_X_EASY2EDIT_KEY=key).status_code == 403


@pytest.mark.django_db
def test_a_website_reads_the_library_from_the_server(monkeypatch, library):
    assert not resources.remote()  # local is the standard
    global_settings.save({"source_mode": "easy2edit"})
    assert resources.remote()
    seen = []

    def fake(path, params):
        seen.append((path, params))
        if path == "":
            return json.dumps({"items": [{"name": "far", "title": "Far", "version": "2.0.0", "description": "", "author": "", "built_for": "", "file": "far-2.0.0.zip", "size": 10, "bundle": False, "preview": None}]}).encode()
        return theme_zip("far", "2.0.0")

    monkeypatch.setattr(resources, "_remote_call", fake)
    cat = {e["name"]: e for e in resources.catalog("themas")}
    assert set(cat) == {"far"} and cat["far"]["origin"] == "easy2edit"  # the local folder resource/ is not read any more
    assert resources._zip_bytes("themas", cat["far"])[:2] == b"PK" and ("file/", {"kind": "themas", "file": "far-2.0.0.zip"}) in seen
    global_settings.save({"source_mode": "local"})
    assert {e["name"] for e in resources.catalog("themas")} == {"t1"}


@pytest.mark.django_db
def test_the_server_itself_always_reads_its_own_folder(library):
    global_settings.save({"source_mode": "easy2edit"})
    sitemanager.set_server(True)
    assert not resources.remote() and {e["name"] for e in resources.catalog("themas")} == {"t1"}


def down_with(reason):
    def down(path, params):
        raise resources.SourceUnavailable(reason, "De easy2edit-server is niet bereikbaar.")

    return down


@pytest.mark.django_db
def test_the_check_names_the_reason(monkeypatch, library):
    global_settings.save({"source_mode": "easy2edit"})
    for reason in ("disabled", "refused", "unreachable"):
        monkeypatch.setattr(resources, "_remote_call", down_with(reason))
        assert resources.test_source() == (False, reason)


@pytest.mark.django_db
def test_showing_the_library_never_fails_but_installing_says_why(client, monkeypatch, library):
    from django.contrib.auth import get_user_model
    from rest_framework.authtoken.models import Token

    u = get_user_model().objects.create(username="s", email="s@example.com", is_staff=True, is_superuser=True)
    h = {"HTTP_AUTHORIZATION": f"Token {Token.objects.get_or_create(user=u)[0].key}"}
    global_settings.save({"source_mode": "easy2edit"})
    monkeypatch.setattr(resources, "_remote_call", down_with("disabled"))
    r = client.get("/api/resource/", **h)  # showing the library: no error, a quiet note
    assert r.status_code == 200 and r.json()["source"] == {"remote": True, "error": "disabled"}
    r = client.post("/api/resource/install/", json.dumps({"kind": "themas", "name": "far"}), content_type=JSON, **h)  # installing: the reason, for a pop-up
    assert r.status_code == 400 and r.json()["source"] == "disabled"
    r = client.post("/api/resource/update/", json.dumps({"kind": "themas"}), content_type=JSON, **h)
    assert r.status_code == 400 and r.json()["source"] == "disabled"
    global_settings.save({"source_mode": "local"})  # local: no note at all
    assert client.get("/api/resource/", **h).json()["source"] == {"remote": False, "error": ""}


@pytest.mark.django_db
def test_the_check_endpoint_gives_the_reason(client, monkeypatch, library):
    from django.contrib.auth import get_user_model
    from rest_framework.authtoken.models import Token

    u = get_user_model().objects.create(username="p", email="p@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    h = {"HTTP_AUTHORIZATION": f"Token {Token.objects.get_or_create(user=u)[0].key}"}
    monkeypatch.setattr(resources, "_remote_call", down_with("refused"))
    r = client.post("/api/system/global-settings/", json.dumps({"action": "test_source"}), content_type=JSON, **h)
    assert r.status_code == 200 and r.json() == {"ok": False, "message": "refused", "source": "refused"}
