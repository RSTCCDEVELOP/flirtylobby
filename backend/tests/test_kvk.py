# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""KVK Handelsregister link: search and company profile (the KVK itself is never called in the tests)."""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.integrations import kvk
from apps.integrations.models import Integration


def link(env="production", key="abc"):
    o = Integration(name="KVK", slug="kvk", provider="kvk", enabled=True)
    o.config = {"api_key": key, "omgeving": env}
    o.save()
    return o


ZOEKEN = {"resultaten": [
    {"kvkNummer": "12345678", "naam": "RST Coaching en Consultancy BV", "type": "hoofdvestiging", "adres": {"binnenlandsAdres": {"straatnaam": "Dorpsstraat", "huisnummer": 1, "postcode": "1234AB", "plaats": "Hilversum"}}},
    {"kvkNummer": "12345678", "naam": "dubbel", "type": "nevenvestiging"},
]}
PROFIEL = {"kvkNummer": "12345678", "naam": "RST Coaching en Consultancy BV", "handelsnamen": [{"naam": "RSTCC", "volgorde": 0}],
           "_embedded": {"hoofdvestiging": {"adressen": [{"type": "bezoekadres", "straatnaam": "Dorpsstraat", "huisnummer": 1, "huisletter": "A", "postcode": "1234AB", "plaats": "Hilversum"}], "websites": ["www.rstcc.net"]}, "eigenaar": {"rechtsvorm": "Besloten Vennootschap"}}}


@pytest.mark.django_db
def test_nothing_without_a_link():
    assert kvk.settings() is None
    with pytest.raises(ValueError):
        kvk.search("rstcc")


@pytest.mark.django_db
def test_search_and_profile_are_mapped_and_the_test_environment_needs_no_key(monkeypatch):
    link(env="test", key="")
    assert kvk.settings() == {"api_key": kvk.TEST_KEY, "omgeving": "test"}
    seen = []
    monkeypatch.setattr(kvk, "_get", lambda path, params, cfg=None: (seen.append((path, params)) or (ZOEKEN if "zoeken" in path else PROFIEL)))
    r = kvk.search("RST")
    assert r == [{"kvk": "12345678", "naam": "RST Coaching en Consultancy BV", "straat": "Dorpsstraat", "postcode": "1234AB", "plaats": "Hilversum", "type": "hoofdvestiging"}]
    assert seen[0][1]["naam"] == "RST"
    kvk.search("12345678"); kvk.search("1234 ab")
    assert seen[1][1]["kvkNummer"] == "12345678" and seen[2][1]["postcode"] == "1234AB"
    assert kvk.search("ab") == []
    f = kvk.profile("12345678")["fields"]
    assert f["registration_no"] == "12345678" and f["street"] == "Dorpsstraat" and f["house_number"] == "1A" and f["postal_code"] == "1234AB" and f["city"] == "Hilversum" and f["country"] == "Nederland"
    assert f["legal_name"] == "RST Coaching en Consultancy BV" and f["trade_names"] == ["RSTCC"] and f["website"] == "www.rstcc.net"
    with pytest.raises(ValueError):
        kvk.profile("123")


@pytest.mark.django_db
def test_endpoint_is_for_admins_and_tells_when_not_linked(monkeypatch, django_user_model):
    cache.clear()
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    plain = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c, p = APIClient(), APIClient()
    c.force_authenticate(boss); p.force_authenticate(plain)
    assert p.post("/api/system/setup/kvk/search/", {"q": "rst"}, format="json").status_code == 403
    assert c.post("/api/system/setup/kvk/search/", {"q": "rst"}, format="json").json() == {"linked": False, "results": []}
    link()
    monkeypatch.setattr(kvk, "_get", lambda path, params, cfg=None: ZOEKEN if "zoeken" in path else PROFIEL)
    r = c.post("/api/system/setup/kvk/search/", {"q": "rst"}, format="json").json()
    assert r["linked"] and r["results"][0]["kvk"] == "12345678"
    assert c.post("/api/system/setup/kvk/profile/", {"kvk": "12345678"}, format="json").json()["fields"]["city"] == "Hilversum"
    assert c.post("/api/system/setup/kvk/profile/", {"kvk": "1"}, format="json").status_code == 400


@pytest.mark.django_db
def test_connection_test_of_the_link(monkeypatch):
    from apps.integrations import providers

    monkeypatch.setattr(kvk, "_get", lambda path, params, cfg=None: ZOEKEN)
    assert providers.PROVIDERS["kvk"]["test"]({"api_key": "x", "omgeving": "production"})[0] is True
    assert providers.PROVIDERS["kvk"]["test"]({"api_key": "", "omgeving": "production"})[0] is False
    assert providers.PROVIDERS["kvk"]["test"]({"api_key": "", "omgeving": "test"})[0] is True
    def deny(path, params, cfg=None):
        raise ValueError("De KVK weigert de sleutel")
    monkeypatch.setattr(kvk, "_get", deny)
    assert providers.PROVIDERS["kvk"]["test"]({"api_key": "x", "omgeving": "production"}) == (False, "De KVK weigert de sleutel")
