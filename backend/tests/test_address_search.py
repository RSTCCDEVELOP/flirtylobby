# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Address search with the free sources PDOK and OpenStreetMap (the internet is never called in the tests)."""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient


def test_free_sources_postcode_and_name(monkeypatch):
    from apps.integrations import addresssearch as ad

    pdok = {"response": {"docs": [{"woonplaatsnaam": "Utrecht", "weergavenaam": "Ambachtsweg 46, 3542DH Utrecht", "postcode": "3542DH", "huisnummer": 46, "straatnaam": "Ambachtsweg"}]}}
    osm = [{"osm_type": "node", "osm_id": 7, "name": "RST Coaching", "display_name": "RST Coaching, Ambachtsweg 46, Utrecht", "address": {"road": "Ambachtsweg", "house_number": "46", "postcode": "3542 DH", "city": "Utrecht", "country": "Nederland"}}]
    seen = []
    monkeypatch.setattr(ad, "_http_json", lambda url: (seen.append(url) or (pdok if "pdok" in url else osm)))
    monkeypatch.setattr(ad.time, "sleep", lambda s: None)
    r = ad.free_search("RST Coaching 3542 DH")
    assert r[0]["naam"] == "RST Coaching" and r[0]["postal_code"] == "3542 DH" and r[0]["bron"] == "OpenStreetMap"
    assert any("RST+Coaching+Utrecht" in u for u in seen)  # the town of the postcode is added to the name
    r = ad.free_search("3542 DH 46")
    assert r == [{"id": "pdok:Ambachtsweg 46, 3542DH Utrecht", "naam": "", "adres": "Ambachtsweg 46, 3542DH Utrecht", "street": "Ambachtsweg", "house_number": "46", "postal_code": "3542 DH", "city": "Utrecht", "country": "Nederland", "bron": "PDOK"}]
    monkeypatch.setattr(ad, "_http_json", lambda url: pdok if "pdok" in url else [])
    assert ad.free_search("Onbekend 3542 DH")[0]["bron"] == "PDOK"  # no business found: the addresses of that postcode
    many = {"response": {"docs": [{"woonplaatsnaam": "Utrecht", "weergavenaam": f"Ambachtsweg {n}, 3542DH Utrecht", "postcode": "3542DH", "huisnummer": n, "straatnaam": "Ambachtsweg"} for n in (46, 48, 50)]}}
    monkeypatch.setattr(ad, "_http_json", lambda url: many if "pdok" in url else [])
    r = ad.free_search("Onbekend 3542 DH")
    assert len(r) == 1 and r[0]["street"] == "Ambachtsweg" and r[0]["house_number"] == "" and r[0]["adres"] == "Ambachtsweg, 3542 DH Utrecht"  # the street only once


@pytest.mark.django_db
def test_address_search_is_plain_json_for_admins(monkeypatch, django_user_model):
    cache.clear()
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    plain = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c, p = APIClient(), APIClient()
    c.force_authenticate(boss); p.force_authenticate(plain)
    monkeypatch.setattr("apps.integrations.addresssearch.free_search", lambda q, limit=5: [{"id": "osm:n1", "naam": "X", "city": "Utrecht", "bron": "OpenStreetMap"}])
    assert p.get("/api/address/search/?q=rst").status_code == 403
    assert c.get("/api/address/search/?q=bol.com Utrecht").json()["source"] == "free"
    assert c.post("/api/address/search/", {"q": "bol.com Utrecht"}, format="json").json()["results"][0]["city"] == "Utrecht"
    assert c.post("/api/system/setup/address/search/", {"q": "bol.com Utrecht"}, format="json").json()["source"] == "free"
    assert c.post("/api/system/setup/address/place/", {"id": "x"}, format="json").status_code == 404


@pytest.mark.django_db
def test_every_logged_in_person_can_look_up_an_address(monkeypatch, django_user_model):
    cache.clear()
    monkeypatch.setattr("apps.integrations.addresssearch.free_search", lambda q, limit=5: [{"id": "pdok:x", "naam": "", "street": "Ambachtsweg", "house_number": "46", "postal_code": "3542 DH", "city": "Utrecht", "country": "Nederland", "bron": "PDOK"}])
    plain = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c = APIClient(); c.force_authenticate(plain)
    r = c.get("/api/address/lookup/?q=3542 DH 46").json()
    assert r["source"] == "free" and r["results"][0]["city"] == "Utrecht"
    assert APIClient().get("/api/address/lookup/?q=3542 DH 46").status_code in (401, 403)
    assert c.get("/api/address/search/?q=3542").status_code == 403  # the one for the admin screens stays for administrators
