"""User dashboard: block layout per user (+ a default) and the data for the chart/list blocks."""
import re
from datetime import date, timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.access import level

from . import modules
from .models import DashboardLayout


def _theme():
    """The community theme chosen in the setup (normal, dating, sporters, business, webshop): the dashboard layout follows it."""
    try:
        from apps.social import service as social

        return social.get()["profiles"].get("theme") or "normal"
    except Exception:
        return "normal"


def _swipe():
    try:
        from apps.social.views import swipe_on

        return bool(swipe_on())
    except Exception:
        return False


def _cols(value, fallback=2):
    try:
        return min(4, max(1, int(value)))
    except (TypeError, ValueError):
        return fallback


def _clean(widgets, columns=4):
    out, seen = [], set()
    for w in widgets if isinstance(widgets, list) else []:
        wid = str(w.get("id", "")) if isinstance(w, dict) else ""
        if re.fullmatch(r"[a-z0-9_-]{1,40}", wid) and wid not in seen:
            seen.add(wid)
            col = w.get("col")
            out.append({"id": wid, "col": min(columns - 1, max(-1, col)) if isinstance(col, int) else None,
                        "size": 2 if w.get("size") == 2 else 1})
    return out[:30]


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def layout(request):
    """GET own layout (or the default). PUT saves own. DELETE returns to the default."""
    own = DashboardLayout.objects.filter(user=request.user).first()
    if request.method == "PUT":
        columns = _cols(request.data.get("columns"))
        widgets = _clean(request.data.get("widgets"), columns)
        own, _ = DashboardLayout.objects.update_or_create(user=request.user, defaults={"widgets": widgets, "columns": columns})
    elif request.method == "DELETE":
        DashboardLayout.objects.filter(user=request.user).delete()
        own = None
    default = DashboardLayout.objects.filter(user=None).first()
    chosen = own or default
    return Response({"widgets": chosen.widgets if chosen else None, "columns": chosen.columns if chosen else 2, "own": own is not None, "has_default": default is not None, "can_set_default": request.user.is_staff, "theme": _theme(), "swipe": _swipe()})


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def default_layout(request):
    """Superadmins: the layout everybody without an own layout gets."""
    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "DELETE":
        DashboardLayout.objects.filter(user=None).delete()
    else:
        columns = _cols(request.data.get("columns"))
        DashboardLayout.objects.update_or_create(user=None, defaults={"widgets": _clean(request.data.get("widgets"), columns), "columns": columns})
    return Response({"ok": True})


def _days(n):
    today = date.today()
    return [today - timedelta(days=i) for i in range(n - 1, -1, -1)]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stats(request):
    """?kind=users_growth | orders_daily | visits_daily | media_usage | orders_recent | low_stock (each needs the module + access level)."""
    me, kind = request.user, request.query_params.get("kind", "")
    deny = Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    since = timezone.now() - timedelta(days=30)

    if kind == "users_growth":
        if level(me, "users") < 1:
            return deny
        from apps.accounts.models import User

        rows = {r["m"].strftime("%Y-%m"): r["n"] for r in User.objects.annotate(m=TruncMonth("date_joined")).values("m").annotate(n=Count("id"))}
        today, months = date.today(), []
        for i in range(11, -1, -1):
            y, m = today.year, today.month - i
            while m <= 0:
                y, m = y - 1, m + 12
            months.append(f"{y}-{m:02d}")
        return Response({"points": [{"label": m, "value": rows.get(m, 0)} for m in months],
                         "total": User.objects.count(), "active": User.objects.filter(is_active=True).count(), "blocked": User.objects.filter(is_active=False).count()})

    if kind == "orders_daily":
        if level(me, "orders") < 1 or not modules.enabled("orders"):
            return deny
        from apps.shop.models import Order

        rows = {r["d"]: (r["n"], r["t"] or 0) for r in Order.objects.filter(created_at__gte=since).exclude(status__in=["canceled", "refunded"])
                .annotate(d=TruncDate("created_at")).values("d").annotate(n=Count("id"), t=Sum("total"))}
        pts = [{"label": d.strftime("%d/%m"), "value": float(rows.get(d, (0, 0))[1]), "count": rows.get(d, (0, 0))[0]} for d in _days(30)]
        return Response({"points": pts, "revenue": sum(p["value"] for p in pts), "orders": sum(p["count"] for p in pts)})

    if kind == "visits_daily":
        if not modules.enabled("profiles") or not modules.enabled("discover"):
            return deny
        from apps.social.models import ProfileVisit

        rows = {r["d"]: r["n"] for r in ProfileVisit.objects.filter(profile__user=me, visited_at__gte=since).annotate(d=TruncDate("visited_at")).values("d").annotate(n=Count("id"))}
        pts = [{"label": d.strftime("%d/%m"), "value": rows.get(d, 0)} for d in _days(30)]
        return Response({"points": pts, "total": sum(p["value"] for p in pts)})

    if kind == "media_usage":
        if level(me, "media") < 1 or not modules.enabled("media"):
            return deny
        from apps.medialib.models import MediaItem

        from apps.medialib import s3

        from apps.medialib.models import USER_PREFIXES

        lib = MediaItem.objects.all()
        for p in USER_PREFIXES:  # member files are not part of the site library
            lib = lib.exclude(key__startswith=p)
        rows = list(lib.values("kind", "storage").annotate(n=Count("id"), b=Sum("size")))
        with_s3 = s3.available() or any(r["storage"] == "s3" for r in rows)  # no S3 linked: no mention of local/S3
        parts = [{"label": f"{'Afbeeldingen' if r['kind'] == 'image' else 'Video\'s'}" + (f" · {'S3' if r['storage'] == 's3' else 'lokaal'}" if with_s3 else ""), "value": r["n"], "bytes": r["b"] or 0}
                 for r in rows]
        if not with_s3:  # merge image/video rows of the same kind
            merged = {}
            for p in parts:
                m = merged.setdefault(p["label"], {"label": p["label"], "value": 0, "bytes": 0})
                m["value"] += p["value"]; m["bytes"] += p["bytes"]
            parts = list(merged.values())
        return Response({"parts": parts, "total": sum(p["value"] for p in parts), "bytes": sum(p["bytes"] for p in parts)})

    if kind == "orders_recent":
        if level(me, "orders") < 1 or not modules.enabled("orders"):
            return deny
        from apps.shop.models import Order

        return Response([{"number": o.number, "name": o.name, "total": str(o.total), "status": o.status, "at": o.created_at} for o in Order.objects.all()[:6]])

    if kind == "low_stock":
        if level(me, "products") < 1 or not modules.enabled("products"):
            return deny
        from apps.shop.models import Product

        return Response([{"id": p.id, "name": p.name, "stock": p.stock} for p in Product.objects.filter(active=True, stock__isnull=False, stock__lte=5).order_by("stock")[:8]])
    return Response({"detail": "Onbekend."}, status=status.HTTP_400_BAD_REQUEST)
