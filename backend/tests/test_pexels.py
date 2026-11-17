# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Searching photos and videos on Pexels (free) next to iStock: the search through the API, the checks of the chosen items and the use of the free photo."""
import io
import json
import urllib.request

import pytest

from apps.core import sitecreator
from apps.core.models import SiteDesignJob
from apps.integrations.models import Integration

PHOTO = {"id": 3184418, "url": "https://www.pexels.com/photo/team-at-work-3184418/", "alt": "Team at work", "src": {"large": "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?w=650", "large2x": "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?w=940"}}
VIDEO = {"id": 855564, "url": "https://www.pexels.com/video/calm-sea-855564/", "image": "https://images.pexels.com/videos/855564/free-video-855564.jpg", "video_files": [{"file_type": "video/mp4", "width": 640, "link": "https://videos.pexels.com/video-files/855564/a.mp4"}, {"file_type": "video/mp4", "width": 1280, "link": "https://videos.pexels.com/video-files/855564/b.mp4"}]}


class Reply(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def link(enabled=True):
    o = Integration(name="Pexels", slug="pexels", provider="pexels", enabled=enabled)
    o.config = {"api_key": "KEY"}
    o.save()


@pytest.fixture
def job(db):
    from django.contrib.auth import get_user_model

    u = get_user_model().objects.create(username="px", email="px@example.com", is_staff=True, is_superuser=True)
    return SiteDesignJob.objects.create(user=u, name="P", status="done", brief={"chat": True}, files={"index.html": '<img src="img/team.jpg" alt="Team at work">'})


@pytest.mark.django_db
def test_search_needs_the_link_and_sends_the_key(monkeypatch):
    with pytest.raises(ValueError):
        sitecreator.search_pexels("team")  # not linked yet
    link()
    seen = {}

    def fake(req, timeout=0):
        seen["url"], seen["auth"] = req.full_url, req.get_header("Authorization")
        return Reply(json.dumps({"photos": [PHOTO, {**PHOTO, "id": 5, "url": "https://evil.example/x"}]}).encode())

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    out = sitecreator.search_pexels("office team")
    assert seen["auth"] == "KEY" and seen["url"].startswith("https://api.pexels.com/v1/search?")
    assert [x["id"] for x in out] == ["3184418"] and out[0]["source"] == "pexels" and out[0]["full"].startswith("https://images.pexels.com/")  # an address of another site is dropped


@pytest.mark.django_db
def test_video_search_takes_the_mp4_closest_to_hd(monkeypatch):
    link()
    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=0: Reply(json.dumps({"videos": [VIDEO]}).encode()))
    out = sitecreator.search_pexels("sea", video=True)
    assert out[0]["video"].endswith("/b.mp4") and out[0]["preview"].startswith("https://images.pexels.com/")


def test_chosen_pexels_items_are_checked(job):
    item = {"id": "3184418", "url": PHOTO["url"], "preview": PHOTO["src"]["large"], "full": PHOTO["src"]["large2x"], "video": "", "title": "T", "source": "pexels"}
    job = sitecreator.add_pick(job, item)
    assert "pexels-3184418.jpg" in job.brief["picked"] and job.brief["picked"]["pexels-3184418.jpg"]["source"] == "pexels"
    with pytest.raises(ValueError):
        sitecreator.add_pick(job, {**item, "preview": "https://evil.example/x.jpg"})
    with pytest.raises(ValueError):
        sitecreator.add_pick(job, {**item, "id": "abc"})
    with pytest.raises(ValueError):
        sitecreator.add_pick(job, {**item, "source": "istock"})  # iStock rules: this is no iStock address


def test_free_photo_is_used_in_full_size(job, monkeypatch):
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "grey").save(buf, "JPEG")
    got = []
    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=0: got.append(req.full_url) or Reply(buf.getvalue()))
    item = {"id": "3184418", "url": PHOTO["url"], "preview": PHOTO["src"]["large"], "full": PHOTO["src"]["large2x"], "video": "", "title": "T", "source": "pexels"}
    job = sitecreator.set_istock_pick(job, "team.jpg", item)
    slot = sitecreator.photo_slots(job)[0]
    assert slot["source"] == "pexels" and slot["full"]
    job = sitecreator.use_preview(job, "team.jpg", job.user)
    assert got == [PHOTO["src"]["large2x"]] and sitecreator.photo_slots(job)[0]["done"]  # the free photo in full size, not an example with a watermark


@pytest.mark.django_db
def test_automatic_search_follows_the_choice(job, monkeypatch):
    calls = []
    monkeypatch.setattr(sitecreator, "search_istock", lambda q, skip=(), video=False: calls.append("istock") or [])
    monkeypatch.setattr(sitecreator, "search_pexels", lambda q, skip=(), video=False: calls.append("pexels") or [])
    assert sitecreator.photo_source(job) == "istock"  # Pexels is the default but is not linked: iStock
    link()
    assert sitecreator.photo_source(job) == "pexels"
    sitecreator.search_photos(job, "team")
    job = sitecreator.set_photo_source(job, "istock")
    sitecreator.search_photos(job, "team")
    job = sitecreator.set_photo_source(job, "bogus")  # an unknown choice changes nothing
    assert calls == ["pexels", "istock"] and job.brief["photo_source"] == "istock"
