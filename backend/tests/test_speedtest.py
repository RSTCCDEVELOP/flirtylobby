# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The speed test: the two things the browser measures against, and the recorded runs for the analysis."""
import pytest
from rest_framework.test import APIClient

from apps.core import speedtest
from apps.core.models import SpeedRun


def _clients(django_user_model):
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    plain = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    c, p = APIClient(), APIClient()
    c.force_authenticate(boss); p.force_authenticate(plain)
    return c, p


@pytest.mark.django_db
def test_ping_and_blob_are_for_administrators(django_user_model):
    c, p = _clients(django_user_model)
    assert p.get("/api/system/speedtest/ping/").status_code == 403 and p.get("/api/system/speedtest/blob/").status_code == 403
    assert APIClient().get("/api/system/speedtest/ping/").status_code in (401, 403)
    r = c.get("/api/system/speedtest/ping/").json()
    assert r["server_ms"] >= 0
    b = c.get("/api/system/speedtest/blob/?kb=256")
    assert b.status_code == 200 and len(b.content) == 256 * 1024 and "no-store" in b["Cache-Control"]
    assert len(c.get("/api/system/speedtest/blob/?kb=99999").content) == 1024 * 1024  # never more than 1 MB


@pytest.mark.django_db
def test_a_run_is_recorded_summarized_listed_and_removed(django_user_model):
    c, p = _clients(django_user_model)
    samples = [{"t": i, "html": 800 + i * 10, "api": 40, "db": 12 + i, "mbps": 50, "server": 3} for i in range(10)]
    assert c.post("/api/system/speedtest/runs/", {"label": "x", "samples": samples[:2]}, format="json").status_code == 400  # at least three
    r = c.post("/api/system/speedtest/runs/", {"label": "Voor de cache", "seconds": 10, "samples": samples}, format="json")
    assert r.status_code == 201
    run = r.json()
    assert run["summary"]["html"]["avg"] == 845.0 and run["summary"]["html"]["min"] == 800 and run["summary"]["html"]["max"] == 890 and run["summary"]["db"]["n"] == 10
    assert run["settings"]["page_cache"] is True and len(run["samples"]) == 10
    lst = c.get("/api/system/speedtest/runs/").json()["runs"]
    assert [x["label"] for x in lst] == ["Voor de cache"] and "samples" not in lst[0]
    assert len(c.get(f"/api/system/speedtest/runs/{run['id']}/").json()["samples"]) == 10
    longer = samples + [{"t": 10 + i, "html": 900, "api": 40, "db": 12, "mbps": 50, "server": 3} for i in range(5)]
    upd = c.put(f"/api/system/speedtest/runs/{run['id']}/", {"seconds": 15, "samples": longer, "label": "Lang"}, format="json").json()  # a long run is saved while it runs
    assert upd["label"] == "Lang" and len(upd["samples"]) == 15 and upd["summary"]["html"]["n"] == 15 and upd["seconds"] == 15
    assert c.put(f"/api/system/speedtest/runs/{run['id']}/", {"samples": samples[:1]}, format="json").status_code == 400
    assert p.get("/api/system/speedtest/runs/").status_code == 403 and p.get(f"/api/system/speedtest/runs/{run['id']}/").status_code == 403
    assert c.delete(f"/api/system/speedtest/runs/{run['id']}/").json() == {"ok": True} and SpeedRun.objects.count() == 0
    assert c.get("/api/system/speedtest/runs/9999/").status_code == 404


def test_summary_ignores_missing_values():
    s = speedtest.summarize([{"html": 100}, {"html": 300, "db": None}, {"html": None}, {"html": 200}])
    assert s["html"] == {"avg": 200.0, "min": 100.0, "max": 300.0, "p95": 300.0, "n": 3} and "db" not in s
