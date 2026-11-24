# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Websites that the customer likes: pictures of them go to the designer (at most five, only public websites)."""
import io

import pytest
from PIL import Image
from rest_framework.test import APIClient

from apps.core import siteshots


def _jpg():
    b = io.BytesIO(); Image.new("RGB", (1000, 700), (40, 120, 90)).save(b, "JPEG"); return b.getvalue()


@pytest.fixture
def job(django_user_model, monkeypatch):
    from apps.core import sitecreator

    monkeypatch.setattr(sitecreator.ai, "available", lambda *a, **k: True)
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(boss)
    pk = c.post("/api/sitecreator/", {"name": "x"}, format="json").json()["id"]
    return c, pk


def test_internal_addresses_are_refused():
    for bad in ("http://127.0.0.1/", "http://localhost:8000", "https://192.168.1.5/x", "http://10.0.0.1", "ftp://example.com", "https://user:pw@example.com", "javascript:alert(1)"):
        with pytest.raises(siteshots.ShotError):
            siteshots.clean_url(bad)


@pytest.mark.django_db
def test_add_five_sites_and_the_designer_gets_the_pictures(job, monkeypatch):
    from apps.core import sitecreator
    from apps.core.models import SiteDesignJob

    c, pk = job
    monkeypatch.setattr(siteshots, "clean_url", lambda u: "https://" + str(u).replace("https://", "").strip("/"))
    monkeypatch.setattr(siteshots, "capture", lambda u: _jpg())
    for i in range(5):
        r = c.post(f"/api/sitecreator/{pk}/refs/", {"url": f"voorbeeld{i}.nl"}, format="json")
        assert r.status_code == 201 and len(r.json()["refs"]) == i + 1 and r.json()["refs"][-1]["thumb"].startswith("data:image/jpeg")
    r = c.post(f"/api/sitecreator/{pk}/refs/", {"url": "zesde.nl"}, format="json")
    assert r.status_code == 400 and "maximaal 5" in r.json()["detail"]
    job_ = SiteDesignJob.objects.get(pk=pk)
    assert len(sitecreator.refs_images(job_.brief)) == 5 and "REFERENCE WEBSITES" in sitecreator._brief_text(job_.brief)
    r = c.delete(f"/api/sitecreator/{pk}/refs/", {"url": "https://voorbeeld0.nl"}, format="json")
    assert len(r.json()["refs"]) == 4


@pytest.mark.django_db
def test_without_a_browser_there_is_a_clear_message(job, monkeypatch):
    c, pk = job
    monkeypatch.setattr(siteshots, "clean_url", lambda u: "https://voorbeeld.nl")
    monkeypatch.setattr(siteshots, "browser", lambda: "")
    r = c.post(f"/api/sitecreator/{pk}/refs/", {"url": "voorbeeld.nl"}, format="json")
    assert r.status_code == 400 and "geen browser" in r.json()["detail"]
    assert c.get(f"/api/sitecreator/{pk}/refs/").json()["available"] is False


@pytest.mark.django_db
def test_a_dropped_or_pasted_picture_counts_as_an_example(job):
    from apps.core import sitecreator
    from apps.core.models import SiteDesignJob

    c, pk = job
    from django.core.files.uploadedfile import SimpleUploadedFile

    r = c.post(f"/api/sitecreator/{pk}/refs/", {"file": SimpleUploadedFile("plak.jpg", _jpg(), content_type="image/jpeg")}, format="multipart")
    assert r.status_code == 201 and r.json()["refs"][0]["url"] == "" and r.json()["refs"][0]["thumb"].startswith("data:image/jpeg")
    assert len(sitecreator.refs_images(SiteDesignJob.objects.get(pk=pk).brief)) == 1
    bad = c.post(f"/api/sitecreator/{pk}/refs/", {"file": SimpleUploadedFile("x.txt", b"geen afbeelding", content_type="text/plain")}, format="multipart")
    assert bad.status_code == 400 and "geen afbeelding" in bad.json()["detail"]
    rid = r.json()["refs"][0]["id"]
    assert c.delete(f"/api/sitecreator/{pk}/refs/", {"id": rid}, format="json").json()["refs"] == []
