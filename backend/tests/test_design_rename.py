# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_rename(django_user_model, monkeypatch):
    from apps.core import sitecreator
    monkeypatch.setattr(sitecreator.ai, "available", lambda *a, **k: True)
    u = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(u)
    pk = c.post("/api/sitecreator/", {"name": "x"}, format="json").json()["id"]
    assert c.patch(f"/api/sitecreator/{pk}/", {"name": "Voetbalclub Ajax"}, format="json").json()["name"] == "Voetbalclub Ajax"
    assert [d["name"] for d in c.get("/api/sitecreator/").json()["designs"]] == ["Voetbalclub Ajax"]


@pytest.mark.django_db
def test_the_design_answer_carries_the_chat(django_user_model, monkeypatch):
    """The chat window shows what is in the answer of the server: the messages, the brief and the other fields must all be in it (a comment in the middle of a line had swallowed them)."""
    from apps.core import sitecreator
    from apps.core.models import SiteDesignJob

    monkeypatch.setattr(sitecreator.ai, "available", lambda *a, **k: True)
    u = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(u)
    pk = c.post("/api/sitecreator/", {"name": "x"}, format="json").json()["id"]
    SiteDesignJob.objects.filter(pk=pk).update(messages=[{"role": "user", "text": "hoi"}, {"role": "ai", "text": "dag"}])
    d = c.get(f"/api/sitecreator/{pk}/?files=1").json()
    assert [m["text"] for m in d["messages"]] == ["hoi", "dag"]
    assert {"brief", "translations", "file_names", "can_restore", "modules_off_effective", "translation_files"} <= set(d)
