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
    from apps.integrations import linkcrypt

    link = ok.json()["links"][0]
    assert ok.status_code == 200 and "SECRETKEY" not in ok.content.decode() and "api_key" not in link["config"]  # the key is not in the clear
    assert linkcrypt.unseal(link["secret_enc"], linkcrypt.hash_of(key)) == {"api_key": "SECRETKEY"}  # only this website can open it
    EasySite.objects.update(status="blocked")
    assert client.get("/api/easy2edit/default-links/", HTTP_X_EASY2EDIT_KEY=key).status_code == 403


@pytest.mark.django_db
def test_keys_travel_sealed_and_are_renewed_in_an_update(monkeypatch):
    """The server seals the keys for one website only; the website opens them at the installation and, in an update, renews a changed key of a superadmin+ link."""
    from apps.integrations import default_links, linkcrypt
    from apps.integrations.models import Integration

    th = linkcrypt.hash_of("token-of-site-A")
    blob = linkcrypt.seal({"api_key": "NEW-KEY"}, th)
    assert "NEW-KEY" not in blob and linkcrypt.unseal(blob, th) == {"api_key": "NEW-KEY"}
    assert linkcrypt.unseal(blob, linkcrypt.hash_of("token-of-site-B")) == {}  # another website can not open it
    Integration.objects.create(slug="unsplash", provider="unsplash", name="Unsplash", superadmin_only=True, enabled=True, config={"api_key": "OLD-KEY"})
    monkeypatch.setattr(default_links, "_read", lambda: [{"slug": "unsplash", "provider": "unsplash", "name": "Unsplash", "superadmin_only": True}])
    monkeypatch.setattr(default_links, "_remote", lambda: {"unsplash": {"slug": "unsplash", "provider": "unsplash", "superadmin_only": True, "config": {"api_key": "NEW-KEY"}}})
    default_links.apply()  # a normal start leaves a key that is there as it is
    assert Integration.objects.get(slug="unsplash").config["api_key"] == "OLD-KEY"
    res = default_links.apply(refresh_keys=True)  # an update renews it
    assert Integration.objects.get(slug="unsplash").config["api_key"] == "NEW-KEY" and res[0]["message"] == "Sleutel vernieuwd."


@pytest.mark.django_db
def test_check_and_update_of_the_api_links_by_a_superadmin(monkeypatch, admin_client_factory=None):
    """The check compares with the easy2edit server without showing keys; the update (superadmin only) takes along every changed setting."""
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.integrations import default_links
    from apps.integrations.models import Integration

    Integration.objects.create(slug="anthropic", provider="anthropic", name="Claude", superadmin_only=True, enabled=True, in_installation=True, config={"api_key": "OLD", "model": "claude-sonnet-4"})
    remote = {"anthropic": {"slug": "anthropic", "provider": "anthropic", "name": "Claude Easy2edit", "superadmin_only": True, "config": {"api_key": "NEW", "model": "claude-sonnet-5-5"}},
              "pexels": {"slug": "pexels", "provider": "pexels", "name": "Pexels", "superadmin_only": True, "config": {"api_key": "P"}}}
    monkeypatch.setattr(default_links, "_remote", lambda strict=False: remote)
    monkeypatch.setattr(default_links, "_read", lambda: [])
    monkeypatch.setattr("apps.core.sitemanager.server_enabled", lambda: False)
    monkeypatch.setattr("apps.core.sitemanager.disabled", lambda: False)
    user = get_user_model().objects.create_user(username="su", email="su@x.nl", password="x", is_staff=True)
    plain = get_user_model().objects.create_user(username="pl", email="pl@x.nl", password="x")
    c, other = APIClient(), APIClient()
    c.force_authenticate(user)
    other.force_authenticate(plain)
    assert other.get("/api/admin/integrations/links/").status_code == 403
    from apps.integrations import keygate

    g = c.get("/api/admin/integrations/links/")  # the gate: first a code by e-mail or SMS
    assert g.status_code == 403 and g.json()["gate"] is True
    keygate.grant(user)
    chk = c.get("/api/admin/integrations/links/").json()
    states = {x["slug"]: x["state"] for x in chk["links"]}
    assert states == {"anthropic": "update", "pexels": "missing"} and chk["need_update"] and "NEW" not in str(chk)
    r = c.post("/api/admin/integrations/links/", {}, format="json").json()
    ant = Integration.objects.get(slug="anthropic")
    assert ant.config == {"api_key": "NEW", "model": "claude-sonnet-5-5"} and ant.name == "Claude Easy2edit"
    assert Integration.objects.filter(slug="pexels").exists()
    assert not r["need_update"]


@pytest.mark.django_db
def test_installation_file_locks_the_keys_and_installs_them_at_the_destination(tmp_path, monkeypatch):
    """The keys go with the installation as an encrypted file; without the password nothing is readable, with it the links are installed and updated."""
    from apps.integrations import default_links
    from apps.integrations.models import Integration

    monkeypatch.setattr(default_links, "SEALED", tmp_path / "links.enc")
    Integration.objects.create(slug="anthropic", provider="anthropic", name="Claude", superadmin_only=True, enabled=True, in_installation=True, always_on=True, config={"api_key": "SECRET-ABC", "model": "claude-sonnet-5-5"})
    with pytest.raises(ValueError):
        default_links.seal_file("kort")  # too short
    assert default_links.seal_file("een-lang-wachtwoord-123") == ["anthropic"]
    raw = (tmp_path / "links.enc").read_text()
    assert "SECRET-ABC" not in raw and "anthropic" not in raw.split('"data"')[0].replace('"provider"', "")  # the keys are not in the file
    assert default_links.sealed_links("een-lang-wachtwoord-123")["anthropic"]["config"]["api_key"] == "SECRET-ABC"
    with pytest.raises(ValueError):
        default_links.sealed_links("verkeerd-wachtwoord-1")
    Integration.objects.all().delete()  # the destination: nothing there yet
    monkeypatch.setenv(default_links.PASSPHRASE_ENV, "een-lang-wachtwoord-123")
    monkeypatch.setattr(default_links, "_read", lambda: [])
    monkeypatch.setattr(default_links, "_remote", lambda strict=False: {})
    default_links.apply()
    o = Integration.objects.get(slug="anthropic")
    assert o.config["api_key"] == "SECRET-ABC" and o.always_on and o.enabled


@pytest.mark.django_db
def test_gate_sends_a_code_and_opens_for_the_right_one(monkeypatch):
    from django.core.cache import cache
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.integrations import keygate

    cache.clear()
    u = get_user_model().objects.create_user(username="gt", email="gt@x.nl", password="x", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    sent = {}
    monkeypatch.setattr("apps.security.twofa.availability", lambda: {"email": "Postmark", "sms": None})
    monkeypatch.setattr("apps.communication.sending.send_email", lambda to, subj, body, **k: sent.update(to=to, body=body))
    assert c.post("/api/admin/integrations/links/", {"gate": "send", "method": "sms"}, format="json").status_code == 400  # no SMS available
    r = c.post("/api/admin/integrations/links/", {"gate": "send", "method": "email"}, format="json")
    assert r.status_code == 200 and sent["to"] == "gt@x.nl"
    code = sent["body"].split("is: ")[1][:6]
    assert c.post("/api/admin/integrations/links/", {"gate": "verify", "code": "000000"}, format="json").status_code == 400
    assert not keygate.granted(u)
    assert c.post("/api/admin/integrations/links/", {"gate": "verify", "code": code}, format="json").json() == {"granted": True}
    assert keygate.granted(u)


@pytest.mark.django_db
def test_verify_with_an_account_on_the_master_server(client, monkeypatch):
    """A superadmin of a website proves who he is with his account on the master server: password first, then the code of that account; only for an approved website."""
    import json

    from django.contrib.auth import get_user_model
    from django.core.cache import cache

    from apps.core import sitemanager
    from apps.core.models import EasySite

    cache.clear()
    sitemanager.set_server(True)
    key = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": "d" * 20, "name": "Shop"}), content_type=JSON).json()["key"]
    me = get_user_model().objects.create_user(username="ms", email="ms@easy2edit.com", password="goed-wachtwoord-1", is_staff=True)
    sent = {}
    monkeypatch.setattr("apps.security.twofa.issue_code", lambda u, force_email=False: sent.update(user=u.pk, code="123456"))
    monkeypatch.setattr("apps.security.twofa.check_code", lambda u, c: c == "123456")
    H = {"HTTP_X_EASY2EDIT_KEY": key}
    assert client.post("/api/easy2edit/verify/login/", json.dumps({"email": "ms@easy2edit.com", "password": "x"}), content_type=JSON, **H).status_code == 403  # the website is not approved yet
    EasySite.objects.update(status="active")
    assert client.post("/api/easy2edit/verify/login/", json.dumps({"email": "ms@easy2edit.com", "password": "fout"}), content_type=JSON, **H).status_code == 400
    r = client.post("/api/easy2edit/verify/login/", json.dumps({"email": "ms@easy2edit.com", "password": "goed-wachtwoord-1"}), content_type=JSON, **H)
    assert r.status_code == 200 and sent["user"] == me.pk
    ch = r.json()["challenge"]
    assert client.post("/api/easy2edit/verify/code/", json.dumps({"challenge": ch, "code": "000000"}), content_type=JSON, **H).status_code == 400
    assert client.post("/api/easy2edit/verify/code/", json.dumps({"challenge": ch, "code": "123456"}), content_type=JSON, **H).json()["ok"] is True
    assert client.post("/api/easy2edit/verify/code/", json.dumps({"challenge": ch, "code": "123456"}), content_type=JSON, **H).status_code == 400  # a challenge is used once
