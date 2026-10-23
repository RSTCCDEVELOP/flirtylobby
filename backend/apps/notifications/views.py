# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import re

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.access import level
from apps.core import modules

from . import registry, service
from .models import Notification, NotificationPref


def _off():
    return Response({"detail": "Deze module is uitgeschakeld."}, status=404)


def _out(n):
    return {"id": n.id, "kind": n.kind, "module": n.module, "title": n.title, "body": n.body, "url": n.url, "level": n.level, "read": bool(n.read_at), "created_at": n.created_at, "from": ({"id": n.from_user_id} if n.from_user_id else None)}


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def inbox(request):
    """The notifications of the user: ?unread=1, ?kind=..., ?limit=; DELETE removes all (or only the read ones with ?read=1)."""
    if not modules.enabled("notifications"):
        return _off()
    qs = Notification.objects.filter(user=request.user)
    if request.method == "DELETE":
        if request.query_params.get("read"):
            qs = qs.filter(read_at__isnull=False)
        qs.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.query_params.get("unread"):
        qs = qs.filter(read_at__isnull=True)
    if request.query_params.get("kind") in registry.BY_KEY:
        qs = qs.filter(kind=request.query_params["kind"])
    try:
        limit = min(max(int(request.query_params.get("limit") or 100), 1), 500)
    except ValueError:
        limit = 100
    from django.core.cache import cache

    if cache.add("notify-cleanup", 1, 3600):  # old read notifications are removed about once an hour
        service.cleanup()
    cfg = service.get_settings()
    return Response({"unread": Notification.objects.filter(user=request.user, read_at__isnull=True).count(), "items": [_out(n) for n in qs[:limit]],
                     "settings": {k: cfg[k] for k in ("layout", "toasts", "toast_position", "toast_seconds", "bell_max", "group")}})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark(request):
    """{ids: [..]} or {all: true}: mark as read (read: false = unread again)."""
    if not modules.enabled("notifications"):
        return _off()
    qs = Notification.objects.filter(user=request.user)
    if not request.data.get("all"):
        qs = qs.filter(pk__in=[i for i in (request.data.get("ids") or []) if isinstance(i, int)][:500])
    qs.update(read_at=None if request.data.get("read") is False else timezone.now())
    return Response({"unread": Notification.objects.filter(user=request.user, read_at__isnull=True).count()})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def remove(request, pk):
    Notification.objects.filter(user=request.user, pk=pk).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def prefs(request):
    """What the user wants per kind: {kinds: [{key, label, desc, module, show, email, user_can_hide}]}; PUT {kinds: {key: {show, email}}}."""
    if not modules.enabled("notifications"):
        return _off()
    if request.method == "PUT":
        for k, v in (request.data.get("kinds") or {}).items():
            meta = registry.BY_KEY.get(k)
            if not meta or not isinstance(v, dict):
                continue
            NotificationPref.objects.update_or_create(user=request.user, kind=k, defaults={"show": bool(v.get("show", True)) if meta["user_can_hide"] else True, "email": bool(v.get("email", False))})
    cur = service.prefs_of(request.user)
    cfg = service.get_settings()
    out = [{**registry.BY_KEY[k], "show": cur[k]["show"], "email": cur[k]["email"]} for k in registry.BY_KEY if cur[k]["enabled"]]
    return Response({"kinds": out, "email_on": cfg["email"]})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def admin_settings(request):
    if not modules.enabled("notifications") or level(request.user, "notifications") < 1:
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "PUT":
        if level(request.user, "notifications") < 2:
            return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
        service.save_settings(request.data)
    return Response({"settings": service.get_settings(), "kinds": list(registry.BY_KEY.values()), "layouts": registry.LAYOUTS, "positions": registry.TOAST_POS,
                     "stats": {"total": Notification.objects.count(), "unread": Notification.objects.filter(read_at__isnull=True).count()}})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_send(request):
    """A message of the administrator: {title, body, url, level, audience: all|staff|group, group}."""
    if not modules.enabled("notifications") or level(request.user, "notifications") < 2:
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
    d = request.data
    title = str(d.get("title") or "").strip()[:200]
    if not title:
        return Response({"detail": "Geef het bericht een titel."}, status=status.HTTP_400_BAD_REQUEST)
    url = str(d.get("url") or "").strip()
    if url and not re.fullmatch(r"/[^\s]{0,290}|https?://[^\s]{3,290}", url):
        return Response({"detail": "Geef een geldige link (/pad of https://…)."}, status=status.HTTP_400_BAD_REQUEST)
    n = service.broadcast(title, str(d.get("body") or "")[:2000], url, d.get("level") if d.get("level") in ("info", "success", "warning", "danger") else "info",
                          d.get("audience") if d.get("audience") in ("all", "staff", "group") else "all", d.get("group"))
    return Response({"sent": n})
