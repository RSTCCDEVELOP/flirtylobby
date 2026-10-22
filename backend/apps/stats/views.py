from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.accounts.permissions import has_level
from apps.core import modules
from apps.core.modules import module_required

from . import collectors, plugin_stats, service

ADMIN = [has_level("stats", "use"), module_required("stats")]


class HitThrottle(AnonRateThrottle):
    rate = "300/min"
    scope = "stats_hit"


def _days(request):
    try:
        return max(1, min(int(request.query_params.get("days") or 30), 365))
    except ValueError:
        return 30


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([HitThrottle])
def hit(request):
    """A page of the website was opened (sent by the site, not for staff): {path, referrer, lang}."""
    if not service.enabled():
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data if isinstance(request.data, dict) else {}
    service.record_hit(request, d.get("path") or "/", str(d.get("referrer") or "")[:300], str(d.get("lang") or ""))
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([HitThrottle])
def bot(request):
    """A program asked for a page (sent by the server of the site, which sees the user agent): {path, ua}. Only known programs are counted."""
    if not service.enabled():
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data if isinstance(request.data, dict) else {}
    service.record_bot(request, str(d.get("path") or "")[:200], ua=str(d.get("ua") or "")[:300])
    return Response(status=status.HTTP_204_NO_CONTENT)


EVENTS = {"age_gate": {"confirmed", "left"}, "gambling": {"confirmed", "left"}, "cookies": {"accept_all", "reject", "custom"}}


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([HitThrottle])
def event(request):
    """A choice a visitor made in a pop-up: {module, event}. Only the known ones."""
    d = request.data if isinstance(request.data, dict) else {}
    if service.enabled() and d.get("event") in EVENTS.get(d.get("module"), set()):
        service.record(d["module"], d["event"])
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes(ADMIN)
def tabs(request):
    """The tabs of the page: General, SEO and visitors, every module, every plugin."""
    from apps.plugins.models import Plugin

    mods = [{"key": m["key"], "label": m["label"], "group": m.get("group", ""), "on": modules.enabled(m["key"])} for m in modules.MODULES if m["key"] != "stats"]
    plug = [{"key": p.name, "label": p.title or p.name, "on": p.enabled} for p in Plugin.objects.order_by("name")]
    return Response({"modules": mods, "plugins": plug})


def _safe(fn, days):
    try:
        return fn(days)
    except Exception as e:  # noqa: BLE001 - one broken widget must not blank the page
        return [{"type": "number", "title": "Fout in deze statistiek", "value": "—", "sub": str(e)[:120]}]


@api_view(["GET"])
@permission_classes(ADMIN)
def general(request):
    return Response({"widgets": _safe(collectors.general, _days(request))})


@api_view(["GET"])
@permission_classes(ADMIN)
def module(request, key):
    fn = collectors.COLLECTORS.get(key)
    if key not in modules.BY_KEY:
        return Response({"detail": "Onbekende module."}, status=status.HTTP_404_NOT_FOUND)
    days = _days(request)
    out = _safe(fn, days) if fn else []
    # what this module records itself that is not shown above
    return Response({"widgets": out or [{"type": "number", "title": "Nog geen statistieken", "value": "—", "sub": "Deze module heeft nog niets om te tellen."}], "enabled": modules.enabled(key)})


@api_view(["GET"])
@permission_classes(ADMIN)
def plugin(request, name):
    return Response({"widgets": _safe(lambda d: plugin_stats.widgets(name, d), _days(request))})
