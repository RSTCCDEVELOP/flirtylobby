# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""AI improve in the editor: texts (older proposal) and the page itself (layout ops, validated by layout.clean, apply with the way back)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core.models import ContentBlock
from apps.pages import ai_texts
from apps.pages.models import Page

pytestmark = pytest.mark.django_db


def _staff():
    u = get_user_model().objects.create_user(username="ed", email="ed@x.nl", password="x", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_improve_proposal_only(monkeypatch):
    Page.objects.create(key="over", kind="content", title={"nl": "Over"})
    d = ai_texts.default_code()
    ContentBlock.objects.create(key="layout.over.a", lang=d, text="html:<p>Wij zijn goed</p>")
    ContentBlock.objects.create(key="layout.over.b", lang=d, text="Prima titel")
    monkeypatch.setattr("apps.integrations.ai.available", lambda: True)
    monkeypatch.setattr(ai_texts, "_ask", lambda system, payload, need: {"_": "ok", "layout.over.a": "html:<p>Wij zijn <strong>de beste</strong><script>x()</script></p>", "layout.over.b": "Prima titel", "bestaat.niet": "x"})
    r = _staff().post("/api/pages/improve/over/", {"action": "texts", "instruction": "korter"}, format="json")
    assert r.status_code == 200
    ch = r.json()["changes"]
    assert [c["key"] for c in ch] == ["layout.over.a"]
    assert "<script" not in ch[0]["new"] and "de beste" in ch[0]["new"]
    assert ContentBlock.objects.get(key="layout.over.a", lang=d).text == "html:<p>Wij zijn goed</p>"  # nothing saved


def test_improve_without_texts(monkeypatch):
    Page.objects.create(key="leeg", kind="content", title={"nl": "Leeg"})
    monkeypatch.setattr("apps.integrations.ai.available", lambda: True)
    r = _staff().post("/api/pages/improve/leeg/", {"action": "texts"}, format="json")
    assert r.status_code == 400


def _layout():
    from apps.pages.models import PageLayout

    PageLayout.objects.create(key="lay", data={"rows": [{"id": "aaaa1111", "cols": 1, "width": "default", "gap": "md", "cells": [{"id": "bbbb2222", "width": "auto", "halign": "left", "valign": "top", "items": [
        {"id": "cccc3333", "type": "heading", "ref": "", "style": {"size": 1.5}}]}]}]})


def test_improve_page_proposes_valid_ops_only(monkeypatch):
    _layout()
    monkeypatch.setattr("apps.integrations.ai.available", lambda: True)
    answer = {"ops": [{"id": "aaaa1111", "set": {"padding": {"t": 64, "b": 64}, "gap": "lg", "evil": 1}, "why": "meer ruimte"},
                      {"id": "cccc3333", "set": {"style": {"size": 3, "color": "javascript:x"}}, "why": "sterkere kop"},
                      {"id": "nope0000", "set": {"gap": "sm"}}],
              "media": [{"id": "aaaa1111", "kind": "video", "query": "Open Water, swimmers!", "why": "hero"}, {"id": "cccc3333", "kind": "image", "query": "x"}]}
    import json

    from apps.integrations import ai
    monkeypatch.setattr(ai, "claude", lambda *a, **k: json.dumps(answer))
    r = _staff().post("/api/pages/improve/lay/", {"action": "suggest", "instruction": ""}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()
    ids = {c["id"] for c in d["changes"]}
    assert ids == {"aaaa1111", "cccc3333"}
    row = next(c for c in d["changes"] if c["id"] == "aaaa1111")
    assert {x["key"] for x in row["diff"]} == {"padding.t", "padding.b", "gap"}
    item = next(c for c in d["changes"] if c["id"] == "cccc3333")
    assert item["diff"][0]["new"] == 3 and all(x["key"] != "color" for x in item["diff"])
    assert [m["id"] for m in d["media"]] == ["aaaa1111"] or d["media"][0]["query"] == "open water swimmers"  # a video only for a row; the query is cleaned


def test_improve_page_apply_gives_way_back():
    from apps.pages.models import PageLayout

    _layout()
    r = _staff().post("/api/pages/improve/lay/", {"action": "apply", "ops": [{"id": "aaaa1111", "set": {"gap": "lg"}}]}, format="json")
    assert r.status_code == 200
    assert PageLayout.objects.get(key="lay").data["rows"][0]["gap"] == "lg"
    assert r.json()["before"]["rows"][0]["gap"] == "md"


def test_improve_job_with_progress_and_usage(monkeypatch):
    import json

    from apps.integrations import ai
    _layout()
    monkeypatch.setattr("apps.integrations.ai.available", lambda: True)
    monkeypatch.setattr(ai, "claude", lambda *a, **k: json.dumps({"ops": [{"id": "aaaa1111", "set": {"gap": "lg"}, "why": "x"}], "media": []}))
    c = _staff()
    job = c.post("/api/pages/improve/lay/", {"action": "start", "instruction": ""}, format="json").json()["id"]
    st = c.post("/api/pages/improve/lay/", {"action": "status", "job": job}, format="json").json()
    assert st["status"] == "done" and st["progress"] == 100 and st["result"]["changes"][0]["id"] == "aaaa1111"
    assert set(st["usage"]) == {"calls", "tokens", "charged", "busy"}
