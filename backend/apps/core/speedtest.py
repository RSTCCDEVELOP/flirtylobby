# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The speed test (Admin -> Cache en snelheid): the browser measures every second how fast the website answers, live in a pop-up with charts; a run can be recorded and is then kept here for analysis.
Per second the browser measures: `html` (the front page as a visitor gets it, ms), `api` (a cached public answer of the backend, ms), `db` (a call that really asks the database, ms), `mbps` (the speed
of a download of 256 KB, Mbit/s) and `server` (the time the backend itself needed for the database call, ms). The two endpoints below are what the browser measures against."""
import os
import time

from django.db import connection
from django.http import HttpResponse, JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import syscache, system
from .models import SpeedRun

METRICS = ("html", "api", "db", "mbps", "server")
MAX_SAMPLES = 400
MAX_RUNS = 100


def _allowed(user):
    from apps.accounts.access import level

    return bool(user.is_authenticated and (user.is_staff or level(user, "system") >= 3))


def _deny():
    return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ping(request):
    """A call that really asks the database (never cached): {server_ms}."""
    if not _allowed(request.user):
        return _deny()
    t = time.perf_counter()
    with connection.cursor() as c:
        c.execute("SELECT COUNT(*) FROM django_session")
        c.fetchone()
    from django.contrib.auth import get_user_model

    get_user_model().objects.order_by("-pk").values_list("pk", flat=True)[:1].first()
    return Response({"server_ms": round((time.perf_counter() - t) * 1000, 2)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def blob(request):
    """Bytes to measure the download speed with: ?kb=256 (at most 1024), different every time, never kept."""
    if not _allowed(request.user):
        return _deny()
    try:
        kb = max(1, min(1024, int(request.query_params.get("kb") or 256)))
    except ValueError:
        kb = 256
    r = HttpResponse(os.urandom(kb * 1024), content_type="application/octet-stream")
    r["Cache-Control"] = "no-store"
    return r


def summarize(samples):
    out = {}
    for m in METRICS:
        v = sorted(float(s[m]) for s in samples if isinstance(s.get(m), (int, float)) and s[m] >= 0)
        if v:
            out[m] = {"avg": round(sum(v) / len(v), 2), "min": round(v[0], 2), "max": round(v[-1], 2), "p95": round(v[min(len(v) - 1, int(len(v) * 0.95))], 2), "n": len(v)}
    return out


def _brief(r):
    return {"id": r.pk, "created_at": r.created_at.isoformat(), "by": r.by, "label": r.label, "seconds": r.seconds, "summary": r.summary, "settings": r.settings, "host": r.host}


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def runs(request):
    """GET: the recorded runs (newest first, without the samples). POST {label, seconds, samples}: keep a run (at most 100 are kept; the oldest go)."""
    if not _allowed(request.user):
        return _deny()
    if request.method == "POST":
        d = request.data
        samples = []
        for s in (d.get("samples") or [])[:MAX_SAMPLES]:
            if isinstance(s, dict):
                samples.append({"t": int(s.get("t") or 0), **{m: (round(float(s[m]), 2) if isinstance(s.get(m), (int, float)) else None) for m in METRICS}})
        if len(samples) < 3:
            return Response({"detail": "Neem minstens drie metingen op."}, status=status.HTTP_400_BAD_REQUEST)
        st = system.get()
        run = SpeedRun.objects.create(by=request.user.email, label=str(d.get("label") or "")[:120], seconds=max(0, min(3600, int(d.get("seconds") or len(samples)))), samples=samples, summary=summarize(samples),
                                      settings={"page_cache": bool(st["page_cache"]), "page_cache_seconds": str(st["page_cache_seconds"]), "system_cache": bool(st["system_cache"]), "system_cache_seconds": str(st["system_cache_seconds"]),
                                                "gen": syscache.generation()}, host=request.get_host()[:200])
        for old in SpeedRun.objects.order_by("-created_at")[MAX_RUNS:]:
            old.delete()
        return Response({**_brief(run), "samples": run.samples}, status=status.HTTP_201_CREATED)
    return Response({"runs": [_brief(r) for r in SpeedRun.objects.all()[:MAX_RUNS]]})


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def run_detail(request, pk):
    if not _allowed(request.user):
        return _deny()
    r = SpeedRun.objects.filter(pk=pk).first()
    if not r:
        return Response({"detail": "Niet gevonden."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        r.delete()
        return Response({"ok": True})
    return Response({**_brief(r), "samples": r.samples})
