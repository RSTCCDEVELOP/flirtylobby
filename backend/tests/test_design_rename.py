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


@pytest.mark.django_db
def test_the_questionnaire_asks_for_the_standard_installation(django_user_model, monkeypatch):
    """The designer always asks which standard installation fits (once), with the choice of the AI as the default; the answer is part of the brief."""
    from apps.core import sitecreator, presets
    from apps.core.models import SiteDesignJob

    monkeypatch.setattr(sitecreator.ai, "available", lambda *a, **k: True)
    monkeypatch.setattr(sitecreator, "_spawn", lambda fn, pk, *a: fn(pk, *a))
    seen = []
    monkeypatch.setattr(sitecreator, "_ask", lambda system, prompt, **k: seen.append(prompt) or '{"reply": "Een paar vragen", "ready": false, "questions": [{"id": "name", "q": "Naam?", "type": "text"}, {"id": "installation", "q": "x", "type": "choice", "options": ["Iets anders"], "default": "Webwinkel"}], "brief": {"kind": "shop"}}')
    u = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    c = APIClient(); c.force_authenticate(u)
    pk = c.post("/api/sitecreator/", {"name": "x"}, format="json").json()["id"]
    SiteDesignJob.objects.filter(pk=pk).update(brief={"chat": True, "prefill": False}, messages=[{"role": "user", "text": "webshop voor sokken"}, {"role": "ai", "text": "?", "ask": "prefill", "answered": "nee"}])
    r = c.post(f"/api/sitecreator/{pk}/chat/", {"text": "webshop voor sokken"}, format="json")
    assert r.status_code == 200
    q = next(x for m in c.get(f"/api/sitecreator/{pk}/").json()["messages"] for x in (m.get("questions") or []) if x["id"] == "installation")
    names = [p["name"] for p in presets.PRESETS]
    assert q["options"] == names and q["default"] == "Webwinkel" and q["type"] == "choice"
    assert "STANDARD INSTALLATIONS" in seen[0]
    idx = next(i for i, m in enumerate(c.get(f"/api/sitecreator/{pk}/").json()["messages"]) if m.get("questions"))
    sitecreator.save_answers(SiteDesignJob.objects.get(pk=pk), idx, {"installation": "Webwinkel"}, {})
    assert SiteDesignJob.objects.get(pk=pk).brief["installation"] == "webshop"
