# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core import modules

from . import service
from .models import LogEntry


def _allowed(user):
    """The log is for admins and superadmins (rank 1 and up) while the module is on."""
    return bool(modules.enabled("log") and service.rank_of(user) >= 1)


def _deny():
    return Response({"detail": "Geen toegang tot het logboek."}, status=status.HTTP_403_FORBIDDEN)


def _out(e):
    label, _cat = service.EVENTS.get(e.event, (e.event, e.category))
    return {"id": e.id, "at": e.created_at, "event": e.event, "label": label, "category": e.category, "level": e.level, "rank": service.RANKS.get(e.level, ""),
            "actor": e.actor_name or e.actor_email, "email": e.actor_email, "ip": e.ip, "target": e.target, "detail": e.detail}


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def entries(request):
    """GET: the lines the person may read (their rank and lower), newest first. ?q= (search), ?category=, ?event=, ?from= / ?to= (YYYY-MM-DD), ?page= ?size=.
    DELETE: remove ALL lines (superadmin only)."""
    if not _allowed(request.user):
        return _deny()
    if request.method == "DELETE":
        if service.rank_of(request.user) < 2:
            return Response({"detail": "Alleen een superadmin mag het logboek legen."}, status=status.HTTP_403_FORBIDDEN)
        return Response({"removed": service.clear(request.user)})
    qs = service.visible_to(request.user)
    p = request.query_params
    if p.get("category"):
        qs = qs.filter(category=p["category"])
    if p.get("event"):
        qs = qs.filter(event=p["event"])
    if p.get("from"):
        qs = qs.filter(created_at__date__gte=p["from"][:10])
    if p.get("to"):
        qs = qs.filter(created_at__date__lte=p["to"][:10])
    q = (p.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(actor_email__icontains=q) | Q(actor_name__icontains=q) | Q(target__icontains=q) | Q(detail__icontains=q) | Q(ip__icontains=q))
    try:
        size = min(max(int(p.get("size") or 50), 10), 200)
        page = max(int(p.get("page") or 1), 1)
    except ValueError:
        size, page = 50, 1
    total = qs.count()
    from django.utils import timezone

    day = service.visible_to(request.user).filter(created_at__gte=timezone.now() - timezone.timedelta(hours=24))  # the figures of the last 24 hours (of the lines this person may read)
    stats = {"day": day.count(), "logins": day.filter(event="auth.login").count(), "failed": day.filter(event="auth.login_failed").count(), "errors": day.filter(event="system.error").count()}
    rows = [_out(e) for e in qs[(page - 1) * size: page * size]]
    return Response({"results": rows, "total": total, "page": page, "size": size, "events": [{"key": k, "label": v[0], "category": v[1]} for k, v in service.EVENTS.items()],
                     "categories": service.CATEGORIES, "stats": stats, "can_clear": service.rank_of(request.user) >= 2})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def log_settings(request):
    """How long the lines are kept (days; 0 = unlimited). Everybody who may read the log sees it; only a superadmin changes it."""
    if not _allowed(request.user):
        return _deny()
    if request.method == "PUT":
        if service.rank_of(request.user) < 2:
            return Response({"detail": "Alleen een superadmin mag de bewaartermijn wijzigen."}, status=status.HTTP_403_FORBIDDEN)
        d = request.data
        try:
            out = service.save_settings(d.get("retention_days"), d.get("disabled_events") if "disabled_events" in d else None)
        except (ValueError, TypeError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        service.log("system.log_settings", request.user, detail=("bewaartermijn: " + (str(out["retention_days"]) + " dagen" if out["retention_days"] else "onbeperkt")) if "retention_days" in d else f"niet gelogd: {', '.join(out['disabled_events']) or 'niets'}", request=request)
        return Response({**out, "choices": service.RETENTION_CHOICES})
    return Response({**service.settings(), "choices": service.RETENTION_CHOICES, "can_edit": service.rank_of(request.user) >= 2, "count": service.visible_to(request.user).count()})
