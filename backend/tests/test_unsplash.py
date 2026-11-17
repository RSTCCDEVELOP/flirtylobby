# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Searching photos on Unsplash (free, photos only) next to Pexels and iStock: the search through the API, the checks of the chosen items and which sources are offered."""
import io
import json
import urllib.request

import pytest

from apps.core import sitecreator
from apps.integrations.models import Integration

PHOTO = {"id": "abc123XYZ_9", "alt_description": "team at work", "user": {"name": "Jane Doe"}, "links": {"html": "https://unsplash.com/photos/abc123XYZ_9", "download_location": "https://api.unsplash.com/photos/abc123XYZ_9/download"}, "urls": {"small": "https://images.unsplash.com/photo-1?w=400", "regular": "https://images.unsplash.com/photo-1?w=1080"}}


class Reply(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def link(enabled=True):
    o = Integration(name="Unsplash", slug="unsplash", provider="unsplash", enabled=enabled)
    o.config = {"api_key": "KEY"}
    o.save()


@pytest.mark.django_db
def test_search_needs_the_link_and_sends_the_key(monkeypatch):
    with pytest.raises(ValueError):
        sitecreator.search_unsplash("team")  # not linked yet
    link()
    seen = {}

    def fake(req, timeout=0):
        seen["url"], seen["auth"] = req.full_url, req.get_header("Authorization")
        return Reply(json.dumps({"results": [PHOTO, {**PHOTO, "id": "other12345", "links": {"html": "https://evil.example/x"}}]}).encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    out = sitecreator.search_unsplash("office team")
    assert seen["auth"] == "Client-ID KEY" and seen["url"].startswith("https://api.unsplash.com/search/photos?")
    assert [x["id"] for x in out] == ["abc123XYZ_9"] and out[0]["source"] == "unsplash" and "Jane Doe" in out[0]["title"]  # an address of another site is dropped, the maker is named
    assert sitecreator.search_unsplash("office", video=True) == []  # Unsplash has no videos


@pytest.mark.django_db
def test_pick_checks_the_addresses():
    good = {"source": "unsplash", **{k: PHOTO["links"]["html"] if k == "url" else PHOTO["urls"]["small"] if k == "preview" else PHOTO["urls"]["regular"] for k in ("url", "preview", "full")}, "id": PHOTO["id"], "title": "x"}
    assert sitecreator._pick_entry(good)["source"] == "unsplash"
    with pytest.raises(ValueError):
        sitecreator._pick_entry({**good, "full": "https://evil.example/a.jpg"})


@pytest.mark.django_db
def test_photo_sources_endpoint_and_fallback(client):
    from django.contrib.auth import get_user_model

    from apps.core.models import SiteDesignJob

    u = get_user_model().objects.create(username="us", email="us@example.com", is_staff=True, is_superuser=True)
    job = SiteDesignJob.objects.create(user=u, name="U", status="done", brief={"photo_source": "unsplash"})
    assert sitecreator.photo_source(job) == "istock"  # not linked: iStock
    link()
    assert sitecreator.photo_source(job) == "unsplash"
    assert sitecreator.unsplash_key() == "KEY"
