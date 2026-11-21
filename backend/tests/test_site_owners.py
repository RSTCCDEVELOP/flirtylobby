# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The site owner and the company on the easy2edit master site: found or made, the domain added, removed again at a reset."""
import pytest
from django.contrib.auth import get_user_model

from apps.core import siteowners
from apps.core.models import EasySite, Entity


@pytest.fixture
def site(db):
    return EasySite.objects.create(instance_id="a" * 32, name="Shop", url="https://www.shop.nl", token_hash="x", status="active")


def _data(url, email="jan@example.com", kvk="12345678", name="Shop BV"):
    return {"url": url, "user": {"email": email, "first_name": "Jan", "last_name": "Jansen", "phone": "+31612345678"}, "company": {"name": name, "registration_no": kvk, "vat_no": "NL001", "email": "info@shop.nl", "city": "Utrecht"}}


def test_owner_and_company_are_made_with_unique_ids_and_the_domain(site, monkeypatch):
    monkeypatch.setattr("apps.core.entity._mail_account", lambda *a, **k: True)
    r = siteowners.register(site, _data("https://www.shop.nl"))
    assert r["user_new"] and r["company_new"] and len(r["user_id"]) == 36 and r["user_id"] != r["company_id"]
    u = get_user_model().objects.get(email="jan@example.com")
    e = Entity.objects.get(registration_no="12345678")
    assert u.domains == ["www.shop.nl"] and e.domains == ["www.shop.nl"] and not e.is_own and u in e.users.all()
    assert not u.is_staff and not u.roles.exists()  # a person with a login, no rights on the master site


def test_existing_person_and_company_are_used_and_the_other_domain_is_added(site, monkeypatch):
    monkeypatch.setattr("apps.core.entity._mail_account", lambda *a, **k: True)
    first = siteowners.register(site, _data("https://www.shop.nl"))
    other = EasySite.objects.create(instance_id="b" * 32, name="Blog", url="https://blog.nl", token_hash="y", status="active")
    second = siteowners.register(other, _data("https://blog.nl", email="JAN@example.com", name="Shop B.V."))
    assert not second["user_new"] and not second["company_new"] and second["user_id"] == first["user_id"] and second["company_id"] == first["company_id"]  # found by e-mail and by KvK
    assert get_user_model().objects.filter(email__iexact="jan@example.com").count() == 1 and Entity.objects.filter(registration_no="12345678").count() == 1
    assert get_user_model().objects.get(email="jan@example.com").domains == ["www.shop.nl", "blog.nl"]
    assert Entity.objects.get(registration_no="12345678").domains == ["www.shop.nl", "blog.nl"]


def test_a_website_that_is_not_approved_makes_nothing(db):
    pending = EasySite.objects.create(instance_id="c" * 32, name="New", url="https://new.nl", token_hash="z", status="pending")
    with pytest.raises(ValueError):
        siteowners.register(pending, _data("https://new.nl"))
    assert not get_user_model().objects.filter(email="jan@example.com").exists()


def test_remove_drops_the_domain_and_deletes_only_what_has_no_website_left(site, monkeypatch):
    monkeypatch.setattr("apps.core.entity._mail_account", lambda *a, **k: True)
    ids = siteowners.register(site, _data("https://www.shop.nl"))
    other = EasySite.objects.create(instance_id="b" * 32, name="Blog", url="https://blog.nl", token_hash="y", status="active")
    siteowners.register(other, _data("https://blog.nl"))
    out = siteowners.remove(site, {"user_id": ids["user_id"], "company_id": ids["company_id"], "url": "https://www.shop.nl"})
    assert out == {"user_removed": False, "company_removed": False}  # the blog still uses them
    assert get_user_model().objects.get(email="jan@example.com").domains == ["blog.nl"]
    out = siteowners.remove(other, {"user_id": ids["user_id"], "company_id": ids["company_id"], "url": "https://blog.nl"})
    assert out == {"user_removed": True, "company_removed": True}
    assert not get_user_model().objects.filter(email="jan@example.com").exists() and not Entity.objects.filter(registration_no="12345678").exists()


def test_unique_ids_exist_on_every_user_and_entity(db):
    a, b = get_user_model().objects.create(username="a"), get_user_model().objects.create(username="b")
    assert a.uid != b.uid and not a.remote_id
    assert Entity.objects.create(name="x").uid != Entity.objects.create(name="y").uid


def test_on_the_master_site_itself_the_own_id_is_the_easy2edit_id(db, monkeypatch):
    from apps.core import entity, sitemanager

    e = entity.own()
    Entity.objects.filter(pk=e.pk).update(name="Master BV")
    u = get_user_model().objects.create(username="o@master.nl", email="o@master.nl")
    monkeypatch.setattr(sitemanager, "server_enabled", lambda: True)
    monkeypatch.setattr(siteowners, "payload", lambda: {"url": "https://api.easy2edit.com"})
    monkeypatch.setattr(siteowners, "owner_user", lambda: u)
    monkeypatch.setattr(sitemanager, "payload", lambda ev, role="": {"url": "https://api.easy2edit.com"})
    assert siteowners.push()["ok"]
    u.refresh_from_db()
    e.refresh_from_db()
    assert u.remote_id == str(u.uid) and e.remote_id == str(e.uid) and "api.easy2edit.com" in u.domains and "api.easy2edit.com" in e.domains
