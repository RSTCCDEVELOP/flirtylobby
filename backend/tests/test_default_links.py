# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API links that go with every installation: the file only holds their shape, the keys come from the easy2edit server (and only for an approved website)."""
import json

import pytest

from apps.core import sitemanager
from apps.core.models import EasySite
from apps.integrations import default_links
from apps.integrations.models import Integration

JSON = "application/json"


def make(slug="unsplash", provider="unsplash", key="SECRETKEY", enabled=True, flag=True):
    o = Integration(name=slug.capitalize(), slug=slug, provider=provider, enabled=enabled, in_installation=flag)
    o.config = {"api_key": key, "model": "m"}
    o.save()
    return o


@pytest.mark.django_db
def test_the_file_never_holds_a_key_or_a_setting():
    make()
    make("stripe", "stripe", "OTHER", flag=False)
    assert default_links.capture() == ["unsplash"]
    text = default_links.PATH.read_text()
    assert "SECRETKEY" not in text and "OTHER" not in text and '"model"' not in text  # only slug, kind and name
    assert json.loads(text)["links"] == [{"slug": "unsplash", "provider": "unsplash", "name": "Unsplash", "superadmin_only": False}]


@pytest.mark.django_db
def test_an_installation_gets_the_key_from_the_server(monkeypatch):
    make()
    default_links.capture()
    Integration.objects.all().delete()
    monkeypatch.setattr(default_links, "_remote", lambda: {"unsplash": {"slug": "unsplash", "provider": "unsplash", "name": "Unsplash", "superadmin_only": False, "config": {"api_key": "FROMSERVER"}}})
    res = default_links.apply(force=True)
    o = Integration.objects.get(slug="unsplash")
    assert res[0]["ok"] and o.enabled and o.in_installation and o.config["api_key"] == "FROMSERVER"


@pytest.mark.django_db
def test_without_the_server_the_link_is_made_empty_and_filled_in_later(monkeypatch):
    make()
    default_links.capture()
    Integration.objects.all().delete()
    monkeypatch.setattr(default_links, "_remote", lambda: {})  # not approved yet, or not reachable
    default_links.apply()
    o = Integration.objects.get(slug="unsplash")
    assert o.enabled and not (o.config or {}).get("api_key")
    o.enabled = False  # switched off by the site on purpose
    o.save()
    monkeypatch.setattr(default_links, "_remote", lambda: {"unsplash": {"slug": "unsplash", "provider": "unsplash", "name": "Unsplash", "config": {"api_key": "LATER"}}})
    default_links.apply()  # a normal start: only the empty key is filled in, the switch stays off
    o.refresh_from_db()
    assert o.config["api_key"] == "LATER" and not o.enabled


@pytest.mark.django_db
def test_an_own_key_is_kept(monkeypatch):
    make(key="OWN")
    default_links.capture()
    monkeypatch.setattr(default_links, "_remote", lambda: {"unsplash": {"slug": "unsplash", "provider": "unsplash", "name": "U", "config": {"api_key": "SERVER"}}})
    default_links.apply(force=True)
    assert Integration.objects.get(slug="unsplash").config["api_key"] == "OWN"


@pytest.mark.django_db
def test_the_server_gives_the_keys_to_an_approved_website_only(client):
    sitemanager.set_server(True)
    make()
    r = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": "e" * 20, "name": "Blue"}), content_type=JSON)
    key = r.json()["key"]
    assert EasySite.objects.get().status == "pending"  # a new website waits for approval
    assert client.get("/api/easy2edit/default-links/").status_code == 403  # no key
    p = client.get("/api/easy2edit/default-links/", HTTP_X_EASY2EDIT_KEY=key)
    assert p.status_code == 403 and p.json()["reason"] == "pending" and "SECRETKEY" not in p.content.decode()
    EasySite.objects.update(status="active")
    ok = client.get("/api/easy2edit/default-links/", HTTP_X_EASY2EDIT_KEY=key)
    assert ok.status_code == 200 and ok.json()["links"][0]["config"]["api_key"] == "SECRETKEY"
    EasySite.objects.update(status="blocked")
    assert client.get("/api/easy2edit/default-links/", HTTP_X_EASY2EDIT_KEY=key).status_code == 403
