# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API of the module Energie: the measurement by the browsers, the figures for the website and for other websites, the settings, and the collector (superadmin)."""
import hmac
import secrets

from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response

from apps.accounts.permissions import has_level
from apps.core.modules import module_required

from . import service
from .layouts import LAYOUTS
from .models import EnergySettings, EnergySite

ADMIN = [has_level("energy", "use"), module_required("energy")]
MANAGE = [has_level("energy", "manage"), module_required("energy")]
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


class SuperAdmin(BasePermission):
    """The collector is for superadmins only."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.is_staff)


SUPER = [SuperAdmin, module_required("energy_network")]


def _open(resp, cache_s=0):
    """Figures for other websites: readable from any address (nothing personal in them)."""
    resp["Access-Control-Allow-Origin"] = "*"
    resp["Access-Control-Expose-Headers"] = "Content-Type"
    if cache_s:
        resp["Cache-Control"] = f"public, max-age={cache_s}"
    return resp


def _days(request):
    try:
        d = int(request.GET.get("days", 30))
    except ValueError:
        d = 30
    return d if d in service.DAYS else 30


def _ip(request):
    return (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0] or request.META.get("REMOTE_ADDR", "")).strip()


# ── the measurement ──
@api_view(["POST"])
@permission_classes([AllowAny, module_required("energy")])
def beacon(request):
    """The browser of a visitor says how heavy the page was that it just loaded: the page, the bytes and the requests. No cookie, no address stored."""
    key = f"energy:rl:{_ip(request)}"
    n = cache.get(key, 0)
    if n >= 90:  # at most 90 per minute per address
        return Response(status=status.HTTP_429_TOO_MANY_REQUESTS)
    cache.set(key, n + 1, 60)
    d = request.data if isinstance(request.data, dict) else {}
    service.record(d.get("path"), d.get("bytes"), d.get("requests"))
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── the figures ──
@api_view(["GET"])
@permission_classes([AllowAny, module_required("energy")])
def view(request):
    """For the blocks on this website's own pages."""
    return Response(service.public_payload(_days(request)))


@api_view(["GET"])
@permission_classes([AllowAny, module_required("energy")])
def public(request):
    """For other websites: the figures of this website. On by default; an API key can be required (Admin → Energie → API)."""
    st = EnergySettings.load()
    if not st.api_public:
        return _open(bad("De energie-API van deze website staat uit.", status.HTTP_403_FORBIDDEN))
    if st.api_key:
        given = request.headers.get("X-Energy-Key") or request.GET.get("key") or ""
        if not hmac.compare_digest(given.encode(), st.api_key.encode()):
            return _open(bad("Een geldige sleutel is nodig.", status.HTTP_401_UNAUTHORIZED))
    return _open(Response(service.public_payload(_days(request))), 0 if st.api_key else 300)


@api_view(["GET"])
@permission_classes(ADMIN)
def overview(request):
    from apps.sysobjects.models import SystemObject

    st = EnergySettings.load()
    on = set(SystemObject.objects.filter(kind="energy").values_list("ref_key", flat=True))
    base = request.build_absolute_uri("/api/energy/public/")
    return Response({**service.public_payload(_days(request)), "settings": _settings(st), "endpoints": {"public": base, "network": request.build_absolute_uri("/api/energy/network/")},
                     "layouts": [{"key": k, "label": v["label"], "desc": v["desc"], "on": k in on, "slug": f"energy-{k}"} for k, v in LAYOUTS.items()]})


def _settings(st):
    return {"kwh_per_gb": float(st.kwh_per_gb), "g_per_kwh": float(st.g_per_kwh), "api_public": st.api_public, "api_key": st.api_key, "scan_paths": st.scan_paths or ["/"], "retention_days": st.retention_days,
            "network_public": st.network_public, "network_title": st.network_title}


@api_view(["GET", "PATCH"])
@permission_classes(MANAGE)
def settings(request):
    st = EnergySettings.load()
    if request.method == "PATCH":
        d = request.data
        try:
            if "kwh_per_gb" in d:
                st.kwh_per_gb = max(0.05, min(5, float(d["kwh_per_gb"])))
            if "g_per_kwh" in d:
                st.g_per_kwh = max(10, min(1500, float(d["g_per_kwh"])))
            if "retention_days" in d:
                st.retention_days = max(30, min(1100, int(d["retention_days"])))
        except (TypeError, ValueError):
            return bad("Vul een getal in.")
        if "api_public" in d:
            st.api_public = bool(d["api_public"])
        if d.get("new_key"):
            st.api_key = secrets.token_urlsafe(24)
        elif "api_key" in d:
            st.api_key = str(d["api_key"] or "").strip()[:80]
        if "scan_paths" in d:
            raw = d["scan_paths"] if isinstance(d["scan_paths"], list) else str(d["scan_paths"] or "").replace(",", "\n").split("\n")
            st.scan_paths = [service.clean_path(p) for p in raw if str(p).strip()][:20]
        st.save()
    return Response(_settings(st))


@api_view(["POST"])
@permission_classes(MANAGE)
def scan_now(request):
    """Measure now: the server opens the pages and adds up everything they load (also gives figures before there are visitors)."""
    base = service.site_base(request.META.get("HTTP_ORIGIN", ""))
    if not base:
        return bad("Vul bij Admin → Basisgegevens het website-adres in, dan kan ik de pagina's meten.")
    scans = service.scan(base, request.data.get("paths") if isinstance(request.data, dict) else None)
    return Response({"scanned": len(scans), "failed": [{"path": s.path, "error": s.error} for s in scans if not s.ok], **service.public_payload(_days(request))})


@api_view(["GET", "POST"])
@permission_classes(MANAGE)
def objects(request):
    """Which layouts exist as system objects (they can then be put on a page in the edit mode)."""
    from apps.sysobjects.models import SystemObject

    if request.method == "POST":
        key, on = str(request.data.get("key") or ""), bool(request.data.get("on"))
        if key not in LAYOUTS:
            return bad("Onbekende weergave.")
        if on:
            SystemObject.objects.get_or_create(kind="energy", ref_id=1, ref_key=key, defaults={"slug": f"energy-{key}"})
        else:
            SystemObject.objects.filter(kind="energy", ref_key=key).delete()
    have = set(SystemObject.objects.filter(kind="energy").values_list("ref_key", flat=True))
    return Response([{"key": k, "label": v["label"], "desc": v["desc"], "on": k in have, "slug": f"energy-{k}"} for k, v in LAYOUTS.items()])


# ── the collector ──
def _site(s):
    return {"id": s.pk, "name": s.name, "url": s.url, "api_key": bool(s.api_key), "enabled": s.enabled, "order": s.order, "ok": s.last_ok, "error": s.last_error, "fetched": s.last_fetched.isoformat() if s.last_fetched else None,
            "summary": (s.data or {}).get("summary") or {}}


@api_view(["GET"])
@permission_classes([AllowAny, module_required("energy_network")])
def network_view(request):
    """The total picture for other websites and for the blocks on a page: only when the superadmin published it."""
    st = EnergySettings.load()
    if not st.network_public:
        return _open(bad("Het totaalbeeld is niet gepubliceerd.", status.HTTP_403_FORBIDDEN))
    return _open(Response(service.network(public=True)), 300)


@api_view(["GET"])
@permission_classes(SUPER)
def network_admin(request):
    st = EnergySettings.load()
    return Response({**service.network(), "sites_admin": [_site(s) for s in EnergySite.objects.all()], "settings": {"network_public": st.network_public, "network_title": st.network_title}, "endpoint": request.build_absolute_uri("/api/energy/network/")})


@api_view(["POST"])
@permission_classes(SUPER)
def network_settings(request):
    st = EnergySettings.load()
    if "network_public" in request.data:
        st.network_public = bool(request.data["network_public"])
    if "network_title" in request.data:
        st.network_title = str(request.data["network_title"] or "").strip()[:120]
    st.save()
    return Response({"network_public": st.network_public, "network_title": st.network_title})


@api_view(["GET", "POST"])
@permission_classes(SUPER)
def sites(request):
    if request.method == "POST":
        d = request.data
        name, url = str(d.get("name") or "").strip()[:120], str(d.get("url") or "").strip()[:300]
        if not name or not url:
            return bad("Geef de website een naam en een adres.")
        s = EnergySite.objects.create(name=name, url=url, api_key=str(d.get("api_key") or "").strip()[:120], order=EnergySite.objects.count())
        service.fetch_site(s)
        return Response(_site(s), status=status.HTTP_201_CREATED)
    return Response([_site(s) for s in EnergySite.objects.all()])


@api_view(["PATCH", "DELETE"])
@permission_classes(SUPER)
def site_one(request, pk):
    s = EnergySite.objects.filter(pk=pk).first()
    if not s:
        return bad("Deze website bestaat niet (meer).", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        s.delete()
        return Response({"ok": True})
    d = request.data
    for k, n in (("name", 120), ("url", 300), ("api_key", 120)):
        if k in d:
            setattr(s, k, str(d[k] or "").strip()[:n])
    if "enabled" in d:
        s.enabled = bool(d["enabled"])
    s.save()
    if any(k in d for k in ("url", "api_key")):
        service.fetch_site(s)
    return Response(_site(s))


@api_view(["POST"])
@permission_classes(SUPER)
def network_refresh(request):
    """Reads the API of all connected sites (or one: id) again."""
    pk = request.data.get("id") if isinstance(request.data, dict) else None
    if pk:
        s = EnergySite.objects.filter(pk=pk).first()
        if s:
            service.fetch_site(s)
    else:
        service.refresh_all()
    st = EnergySettings.load()
    return Response({**service.network(), "sites_admin": [_site(s) for s in EnergySite.objects.all()], "settings": {"network_public": st.network_public, "network_title": st.network_title}})
