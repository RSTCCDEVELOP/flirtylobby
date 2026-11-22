# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The tabs of Standaard en globale instellingen: always carried; an update leaves a tab alone that is marked "do not overwrite" (unless forced); the easy2edit server lists the websites and can push."""
import json

import pytest
from rest_framework.test import APIClient

from apps.core import global_settings as g
from apps.core import site_defaults as sd
from apps.core import sitemanager
from apps.core.models import EasySite
from apps.security import service


@pytest.mark.django_db
def test_everything_is_carried_also_a_tab_that_is_not_overwritten():
    g.save({"reseller_company": "Hier BV", "notify_support": "a@x.nl", "keep_reseller": "1"})
    service.save(service.clean({"twofa": {"max_attempts": 3}}, []))
    sd.capture()
    data = json.loads(sd.PATH.read_text())
    assert data["global"]["reseller_company"] == "Hier BV" and data["global"]["notify_support"] == "a@x.nl"  # carried with new installations
    assert not any(k.startswith("keep_") for k in data["global"])  # the flags themselves stay on the installation
    assert data["push"]["twofa"]["twofa"]["max_attempts"] == 3


@pytest.mark.django_db
def test_an_update_leaves_a_kept_tab_alone_unless_forced():
    sd.PATH.write_text(json.dumps({"format": "site-defaults", "version": 1, "bundle": {"sections": {}}, "global": {"notify_support": "nieuw@x.nl", "reseller_company": "Pushed BV"},
                                   "push": {"twofa": {"twofa": {"required_for": "admins", "max_attempts": 7}, "basic": {"lockout_minutes": 45}}}}))
    g.save({"keep_reseller": "1", "reseller_company": "Mijn eigen BV"})
    r = sd.push()
    cur = g.get()
    assert cur["notify_support"] == "nieuw@x.nl" and cur["reseller_company"] == "Mijn eigen BV"  # pushed / kept
    assert "reseller" in r["kept"] and "mails" in r["applied"] and "twofa" in r["applied"]
    assert service.raw()["twofa"]["max_attempts"] == 7
    r = sd.push(force=True, tabs=["reseller"])  # forced: also a tab that is kept
    assert g.get()["reseller_company"] == "Pushed BV" and r["applied"] == ["reseller"]
    g.save({"keep_twofa": "1"})
    sd.PATH.write_text(sd.PATH.read_text().replace('"max_attempts": 7', '"max_attempts": 2'))
    sd.push()
    assert service.raw()["twofa"]["max_attempts"] == 7  # kept here


@pytest.mark.django_db
def test_the_server_lists_the_websites_and_pushes(monkeypatch, django_user_model):
    u = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    monkeypatch.setattr(type(u), "is_superplus", True, raising=False)
    assert c.get("/api/system/sites-defaults/").json()["server"] is False  # not the easy2edit server
    sitemanager.set_server(True)
    s = EasySite.objects.create(instance_id="b" * 32, name="Klant", url="https://klant.nl", status="active", defaults_state={"keep": ["reseller"]})
    calls = []
    monkeypatch.setattr(sitemanager, "site_action", lambda site, body: calls.append(body) or {"ok": True, "applied": ["mails"], "kept": ["reseller"], "errors": []})
    r = c.get("/api/system/sites-defaults/").json()
    assert r["sites"][0]["keep"] == ["reseller"]
    r = c.post("/api/system/sites-defaults/", {"site_ids": "all", "force": False}, format="json").json()
    assert calls and calls[0]["action"] == "defaults_push" and calls[0]["force"] is False
    row = next(x for x in r["sites"] if x["id"] == s.pk)
    assert row["applied"] == ["mails"] and row["kept"] == ["reseller"] and row["pushed_at"]


@pytest.mark.django_db
def test_a_website_reports_what_it_does_not_overwrite():
    from apps.core import sitemanager as sm

    g.save({"keep_mails": "1"})
    assert sm.payload("login")["defaults"] == {"keep": ["mails"]}
    site = EasySite(instance_id="c" * 32)
    sm._fill(site, {"defaults": {"keep": ["mails"]}}, "1.2.3.4")
    assert site.defaults_state["keep"] == ["mails"]


def test_footer_width_is_a_theme_value_like_the_header():
    from apps.core import theme as T
    from apps.core import themepacks

    keys = {f["key"]: f for g in T.SCHEMA for f in g["fields"]}
    assert keys["footer_width"]["default"] == "content" and [c["value"] for c in keys["footer_width"]["choices"]] == ["content", "full"]
    assert "footer_width" in themepacks.COMPLETE_KEYS  # goes with a theme pack and a design


@pytest.mark.django_db
def test_sites_on_the_not_updated_list_are_skipped_up_to_their_build(monkeypatch):
    from apps.core import site_defaults, sitemanager
    from apps.core.models import EasySite

    a = EasySite.objects.create(instance_id="a1", name="A", url="https://a.nl", status="active", build="150", token_hash="")
    b = EasySite.objects.create(instance_id="b1", name="B", url="https://b.nl", status="active", build="158", token_hash="")
    site_defaults.set_skip(a.pk, 150)
    site_defaults.set_skip(b.pk, 157)  # B is already above that build: updated
    assert site_defaults.is_skipped(a) and not site_defaults.is_skipped(b)
    assert site_defaults.build_of("build 159") == 159
    site_defaults.set_skip(a.pk, None)
    assert not site_defaults.is_skipped(a)
