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
    assert c.post("/api/system/setup/address/search/", {"q": "rst coaching"}, format="json").json() == {"linked": False, "results": []}
    link()
    monkeypatch.setattr(gp, "_call", lambda method, path, mask, body=None, cfg=None: PLACES)
    r = c.post("/api/system/setup/address/search/", {"q": "rst coaching utrecht"}, format="json").json()
    assert r["linked"] and r["results"][0]["city"] == "Utrecht"
    assert providers.PROVIDERS["google_adres"]["test"]({"api_key": "x"})[0] is True
    assert providers.PROVIDERS["google_adres"]["test"]({"api_key": ""})[0] is False
