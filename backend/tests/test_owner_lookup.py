# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Licence form: a contact e-mail that the master site knows already -> code by e-mail -> the data is downloaded."""
import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.core import ownerlookup
from apps.core.models import EasySite, Entity


@pytest.fixture
def site(db):
    cache.clear()
    return EasySite.objects.create(instance_id="a" * 32, name="Shop", url="https://www.shop.nl", token_hash="x", status="active")


@pytest.fixture
def person(db):
    u = get_user_model().objects.create_user(username="jan@example.com", email="jan@example.com", password="x", first_name="Jan", last_name="Jansen", phone="+31612345678")
    e = Entity.objects.create(kind="bedrijf", is_own=False, name="Shop BV", street="Hoofdstraat", house_number="1", postal_code="3511AA", city="Utrecht", country="Nederland")
    e.users.add(u)
    return u


def test_lookup_only_tells_whether_the_address_is_known(site, person):
    assert ownerlookup.lookup(site, "JAN@example.com") == {"exists": True}
    assert ownerlookup.lookup(site, "other@example.com") == {"exists": False}
    assert ownerlookup.lookup(site, "no-mail") == {"exists": False}


def test_data_only_after_the_right_code(site, person, monkeypatch):
    sent = {}
    monkeypatch.setattr("apps.security.twofa.issue_code", lambda user, force_email=False: sent.update(user=user, force=force_email))
    r = ownerlookup.send(site, "jan@example.com")
    assert sent["force"] and "@" in r["hint"] and "jan" not in r["hint"].split("@")[0][1:]
    monkeypatch.setattr("apps.security.twofa.check_code", lambda user, code: code == "123456")
    with pytest.raises(ValueError):
        ownerlookup.fetch(site, r["challenge"], "000000")
    out = ownerlookup.fetch(site, r["challenge"], "123-456")["fields"]
    assert out["contact_first_name"] == "Jan" and out["company_name"] == "Shop BV" and out["city"] == "Utrecht" and out["mobile"] == "+31612345678"
    with pytest.raises(ValueError):  # the challenge is used up
        ownerlookup.fetch(site, r["challenge"], "123456")


def test_another_website_cannot_use_the_challenge(site, person, monkeypatch):
    monkeypatch.setattr("apps.security.twofa.issue_code", lambda *a, **k: None)
    monkeypatch.setattr("apps.security.twofa.check_code", lambda *a: True)
    r = ownerlookup.send(site, "jan@example.com")
    other = EasySite.objects.create(instance_id="b" * 32, name="B", url="https://b.nl", token_hash="y", status="active")
    with pytest.raises(ValueError):
        ownerlookup.fetch(other, r["challenge"], "123456")


def test_unknown_address_gets_no_code_and_tries_are_limited(site, person, monkeypatch):
    monkeypatch.setattr("apps.security.twofa.issue_code", lambda *a, **k: None)
    with pytest.raises(ValueError):
        ownerlookup.send(site, "nobody@example.com")
    for _ in range(ownerlookup.TRIES):
        try:
            ownerlookup.send(site, "jan@example.com")
        except ValueError:
            pass
    with pytest.raises(ValueError, match="Te veel"):
        ownerlookup.send(site, "jan@example.com")


def test_company_is_found_by_name_and_the_code_goes_to_its_contact(site, person, monkeypatch):
    sent = {}
    monkeypatch.setattr("apps.security.twofa.issue_code", lambda user, force_email=False: sent.update(user=user))
    monkeypatch.setattr("apps.security.twofa.check_code", lambda user, code: code == "123456")
    r = ownerlookup.lookup_company(site, "shop b.v.")  # spelling and legal form do not matter
    assert r["exists"] and "jan" not in r["hint"].split("@")[0][1:]
    assert ownerlookup.lookup_company(site, "Unknown Company") == {"exists": False, "hint": ""}
    assert ownerlookup.lookup_company(site, "ab") == {"exists": False, "hint": ""}
    c = ownerlookup.send(site, "", company="SHOP bv")
    assert sent["user"] == person
    out = ownerlookup.fetch(site, c["challenge"], "123456")["fields"]
    assert out["company_name"] == "Shop BV" and out["city"] == "Utrecht" and out["contact_first_name"] == "Jan"


def test_own_company_of_the_master_is_never_found(site, person):
    from apps.core.models import Entity

    own = Entity.objects.create(kind="bedrijf", is_own=True, name="Master BV")
    own.users.add(person)
    assert ownerlookup.lookup_company(site, "Master BV")["exists"] is False


def test_search_finds_part_of_name_address_postcode_and_email_without_giving_addresses_back(site, person):
    for q in ("shop", "Hoofdstr", "3511 aa", "3511AA", "utrecht", "jan@example"):
        r = ownerlookup.search(site, q)["results"]
        assert [x["name"] for x in r] == ["Shop BV"], q
        assert set(r[0]) == {"id", "name", "city"}
    assert ownerlookup.search(site, "ab")["results"] == [] and ownerlookup.search(site, "zzzz")["results"] == []
    assert ownerlookup.lookup_company(site, "shop")["exists"]  # a part of the name is enough when it is only one company


def test_contact_person_is_chosen_from_the_linked_names_and_gets_the_code(site, person, monkeypatch):
    sent = {}
    monkeypatch.setattr("apps.security.twofa.issue_code", lambda user, force_email=False: sent.update(user=user))
    monkeypatch.setattr("apps.security.twofa.check_code", lambda user, code: code == "123456")
    other = get_user_model().objects.create_user(username="els@example.com", email="els@example.com", password="x", first_name="Els", last_name="Bakker")
    ent = Entity.objects.get(name="Shop BV")
    ent.users.add(other)
    c = ownerlookup.contacts(site, ent.pk)["contacts"]
    assert [x["name"] for x in c] == ["Els Bakker", "Jan Jansen"] and all(set(x) == {"id", "name"} for x in c)
    els = [x for x in c if x["name"] == "Els Bakker"][0]
    r = ownerlookup.send(site, "", entity=ent.pk, user_id=els["id"])
    assert sent["user"] == other and "els" not in r["hint"].split("@")[0][1:]
    out = ownerlookup.fetch(site, r["challenge"], "123456")["fields"]
    assert out["contact_first_name"] == "Els" and out["company_name"] == "Shop BV"
    with pytest.raises(ValueError):
        ownerlookup.send(site, "", entity=ent.pk, user_id=99999)
