# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Google address search link (Google itself is never called in the tests)."""
import io
import json
import urllib.error

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.integrations import googleplaces as gp
from apps.integrations.models import Integration

PLACES = {"places": [{"id": "ChIJabcdefghijk123", "displayName": {"text": "RST Coaching & Consultancy", "languageCode": "nl"}, "formattedAddress": "Voorbeeldlaan 12 A, 3542 DH Utrecht",
                      "addressComponents": [{"longText": "12", "types": ["street_number"]}, {"longText": "A", "types": ["subpremise"]}, {"longText": "Voorbeeldlaan", "types": ["route"]},
                                            {"longText": "Utrecht", "types": ["locality", "political"]}, {"longText": "3542 DH", "types": ["postal_code"]}, {"longText": "Nederland", "types": ["country"]}]}]}


def link(key="k"):
    o = Integration(name="Google adressen", slug="google-adres", provider="google_adres", enabled=True)
    o.config = {"api_key": key, "region": "nl", "language": "nl"}
    o.save()


@pytest.mark.django_db
def test_search_maps_the_address_and_asks_only_cheap_fields(monkeypatch):
    with pytest.raises(ValueError):
        gp.search("RST Coaching Utrecht")
    link()
    assert gp.settings() == {"api_key": "k", "region": "NL", "language": "nl"}
    seen = {}
    monkeypatch.setattr(gp, "_call", lambda method, path, mask, body=None, cfg=None: (seen.update(method=method, path=path, mask=mask, body=body) or PLACES))
    r = gp.search("RST Coaching 3542 DH")
    assert r == [{"id": "ChIJabcdefghijk123", "naam": "RST Coaching & Consultancy", "adres": "Voorbeeldlaan 12 A, 3542 DH Utrecht", "street": "Voorbeeldlaan", "house_number": "12 A", "postal_code": "3542 DH", "city": "Utrecht", "country": "Nederland"}]
    assert seen["path"] == "/places:searchText" and seen["body"]["textQuery"] == "RST Coaching 3542 DH" and seen["body"]["regionCode"] == "NL"
    assert "nationalPhoneNumber" not in seen["mask"] and "websiteUri" not in seen["mask"]  # the expensive group only for a chosen place
    assert gp.search("ab") == []
    monkeypatch.setattr(gp, "_call", lambda method, path, mask, body=None, cfg=None: {"nationalPhoneNumber": "030 123 4567", "internationalPhoneNumber": "+31 30 123 4567", "websiteUri": "https://www.rstcc.net/"})
    assert gp.place("ChIJabcdefghijk123") == {"phone": "+31 30 123 4567", "website": "https://www.rstcc.net/"}
    with pytest.raises(ValueError):
        gp.place("../x")


@pytest.mark.django_db
def test_errors_are_readable(monkeypatch):
    link()

    def boom(code, body):
        def op(req, timeout=0):
            raise urllib.error.HTTPError(req.full_url, code, "x", {}, io.BytesIO(json.dumps(body).encode()))
        return op

    monkeypatch.setattr("urllib.request.urlopen", boom(403, {"error": {"status": "PERMISSION_DENIED", "message": "Places API (New) has not been used"}}))
    with pytest.raises(ValueError, match="Places API"):
        gp.search("rst coaching")
    monkeypatch.setattr("urllib.request.urlopen", boom(400, {"error": {"status": "INVALID_ARGUMENT", "message": "API key not valid. Please pass a valid API key."}}))
    with pytest.raises(ValueError, match="sleutel"):
        gp.search("rst coaching")


@pytest.mark.django_db
def test_endpoint_is_for_admins_and_the_connection_test(monkeypatch, django_user_model):
    from apps.integrations import providers

    cache.clear()
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    plain = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c, p = APIClient(), APIClient()
    c.force_authenticate(boss); p.force_authenticate(plain)
    assert p.post("/api/system/setup/address/search/", {"q": "rst"}, format="json").status_code == 403
    monkeypatch.setattr("apps.integrations.addresssearch.free_search", lambda q, limit=5: [{"id": "osm:n1", "naam": "X", "city": "Utrecht", "bron": "OpenStreetMap"}])
    assert c.post("/api/system/setup/address/search/", {"q": "rst coaching"}, format="json").json()["source"] == "free"  # without a link: the free sources
    assert c.post("/api/system/setup/address/place/", {"id": "ChIJabcdefghijk123"}, format="json").status_code == 400
    link()
    monkeypatch.setattr(gp, "_call", lambda method, path, mask, body=None, cfg=None: PLACES)
    r = c.post("/api/system/setup/address/search/", {"q": "rst coaching utrecht"}, format="json").json()
    assert r["source"] == "google" and r["results"][0]["city"] == "Utrecht" and r["results"][0]["bron"] == "Google"
    assert providers.PROVIDERS["google_adres"]["test"]({"api_key": "x"})[0] is True
    assert providers.PROVIDERS["google_adres"]["test"]({"api_key": ""})[0] is False


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
