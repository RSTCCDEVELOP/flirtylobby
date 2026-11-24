# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Example layouts for a new page."""
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_sample_layout_is_applied_once(django_user_model):
    from apps.pages.layout import clean
    from apps.pages.models import PageLayout

    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    c = APIClient(); c.force_authenticate(boss)
    assert {s["key"] for s in c.get("/api/pages/samples/").json()["samples"]} >= {"empty", "text", "cards", "landing"}
    pid = c.post("/api/pages/", {"kind": "content", "title": {"nl": "Mooi"}, "key": "mooi", "scope": "public"}, format="json").json()["id"]
    r = c.post(f"/api/pages/{pid}/sample/", {"sample": "about"}, format="json")
    assert r.status_code == 200 and len(r.json()["rows"]) == 3 and r.json()["rows"][0].get("hero")
    clean(PageLayout.objects.get(key="mooi").data)  # a layout that the editor accepts
    assert c.post(f"/api/pages/{pid}/sample/", {"sample": "text"}, format="json").status_code == 400  # not over blocks that are there
    assert c.post(f"/api/pages/{pid}/sample/", {"sample": "nope"}, format="json").status_code == 400
