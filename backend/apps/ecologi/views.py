# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Management screens of Ecologi (Super admin): only for superadmins, and only while the API (the link "Ecologi") is switched on."""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response

from apps.accounts.access import level
from apps.accounts.permissions import LEVEL, has_level
from apps.core import modules

from . import service
from .models import EcologiSettings, TreeOrder

bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


class SuperAdminApiOn(BasePermission):
    """A superadmin, and the module and the API are on: otherwise the screens are not there (404)."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.is_staff and modules.enabled("ecologi") and service.api_on())


def _order(o):
    return {"id": o.id, "at": o.created_at.isoformat(), "number": o.number, "local": o.local, "country": o.country, "name": o.name, "test": o.test, "status": o.status, "source": o.source,
            "amount": float(o.amount) if o.amount is not None else None, "currency": o.currency, "tree_url": o.tree_url, "error": o.error, "by": (o.user.get_full_name() or o.user.email) if o.user else ""}


def _settings(st):
    return {"test_mode": st.test_mode, "local": st.local, "country": st.country, "name": st.name, "max_per_order": st.max_per_order, "monthly_trees": st.monthly_trees, "last_auto_month": st.last_auto_month,
            "show_on_site": st.show_on_site, "auto_on": st.auto_on, "cap_trees_month": st.cap_trees_month, "visitors_on": st.visitors_on, "visitors_per": st.visitors_per, "machine_on": st.machine_on,
            "machine_kg": st.machine_kg, "e2e_trees": st.e2e_trees, "admin_enabled": st.admin_enabled, "admin_trees": st.admin_trees, "admin_max_trees": st.admin_max_trees, "admin_name": st.admin_name}


def _admin_on(user):
    """The administrator's tile and screen: the module and the API are on, the superadmin allows it (Instellingen) and this person may use the module."""
    return bool(user and user.is_authenticated and modules.enabled("ecologi") and modules.enabled("ecologi_admin") and service.api_on() and EcologiSettings.load().admin_enabled
                and (user.is_staff or level(user, "ecologi_admin") >= LEVEL["use"]))


class AdminApiOn(BasePermission):
    def has_permission(self, request, view):
        return _admin_on(request.user)


@api_view(["GET"])
@permission_classes([AllowAny])
def state(request):
    """For the menus: do the screens exist? `enabled`: the management screens (superadmin, while the module and the API are on); `admin`: the tile of the administrator."""
    u = request.user
    on = bool(u and u.is_authenticated and u.is_staff and modules.enabled("ecologi") and service.api_on())
    return Response({"enabled": on, "admin": _admin_on(u)})


@api_view(["GET"])
@permission_classes([SuperAdminApiOn])
def overview(request):
    st = EcologiSettings.load()
    return Response({"settings": _settings(st), "totals": service.totals(), "report": service.report(), "recent": [_order(o) for o in TreeOrder.objects.select_related("user")[:5]],
                     "prices": {"tree": float(service.PRICE_TREE), "local": {k: float(v) for k, v in service.PRICE_LOCAL.items()}, "currency": "EUR"}, "countries": service.COUNTRIES})


@api_view(["POST"])
@permission_classes([SuperAdminApiOn])
def plant(request):
    d = request.data
    try:
        o = service.buy(d.get("number"), name=d.get("name", ""), local=d.get("local"), country=d.get("country"), test=d.get("test"), user=request.user)
    except service.EcologiError as e:
        return bad(str(e))
    return Response({"order": _order(o)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([SuperAdminApiOn])
def quote(request):
    d = request.data
    st = EcologiSettings.load()
    local = st.local if d.get("local") is None else bool(d.get("local"))
    return Response(service.estimate(d.get("number") or 0, local, str(d.get("country") or st.country or "UK").upper()))


@api_view(["GET"])
@permission_classes([SuperAdminApiOn])
def orders(request):
    qs = TreeOrder.objects.select_related("user")
    if request.query_params.get("status") in ("ok", "failed"):
        qs = qs.filter(status=request.query_params["status"])
    return Response({"orders": [_order(o) for o in qs[:200]]})


@api_view(["GET", "PATCH"])
@permission_classes([SuperAdminApiOn])
def settings_view(request):
    st = EcologiSettings.load()
    before = service.snapshot()
    if request.method == "PATCH":
        d = request.data
        if "test_mode" in d:
            st.test_mode = bool(d["test_mode"])
        if "local" in d:
            st.local = bool(d["local"])
        if "show_on_site" in d:
            st.show_on_site = bool(d["show_on_site"])
        if "country" in d:
            if str(d["country"]).upper() not in service.COUNTRIES:
                return bad("Kies een land uit de lijst.")
            st.country = str(d["country"]).upper()
        if "name" in d:
            st.name = "easy2edit" if str(d["name"] or "").strip().lower() == "easy2edit" else "site"
        for k in ("auto_on", "visitors_on", "machine_on", "admin_enabled"):
            if k in d:
                setattr(st, k, bool(d[k]))
        if "admin_name" in d:
            st.admin_name = "easy2edit" if str(d["admin_name"] or "").strip().lower() == "easy2edit" else "site"
        try:
            for k, lo, hi in (("cap_trees_month", 0, 250000), ("visitors_per", 1, 10_000_000), ("machine_kg", 1, 100000), ("e2e_trees", 0, 250000), ("admin_trees", 0, 250000), ("admin_max_trees", 0, 250000)):
                if k in d:
                    setattr(st, k, max(lo, min(hi, int(d[k] or 0))))
            if "max_per_order" in d:
                st.max_per_order = max(1, min(250000, int(d["max_per_order"])))
            if "monthly_trees" in d:
                st.monthly_trees = max(0, min(st.max_per_order, int(d["monthly_trees"] or 0)))
        except (TypeError, ValueError):
            return bad("Vul een getal in.")
        st.save()
        if service.turned_on(before, st):
            service.link_to_server("trees")
    return Response(_settings(st))


@api_view(["GET"])
@permission_classes([SuperAdminApiOn])
def stats(request):
    """Graphs and figures for the block on the Super admin page and the tab Bijdragen."""
    try:
        n = max(3, min(24, int(request.query_params.get("months", 12))))
    except (TypeError, ValueError):
        n = 12
    return Response(service.stats(n))


# ── the administrator: his own settings and gifts (Admin -> Systeem -> Bomen en giften) ──
@api_view(["GET", "PATCH"])
@permission_classes([AdminApiOn])
def me(request):
    st = EcologiSettings.load()
    before = service.snapshot()
    if request.method == "PATCH":
        d = request.data
        try:
            if "admin_trees" in d:
                st.admin_trees = max(0, min(st.admin_max_trees, int(d["admin_trees"] or 0)))
        except (TypeError, ValueError):
            return bad("Vul een getal in.")
        if "admin_name" in d:
            st.admin_name = "easy2edit" if str(d["admin_name"] or "").strip().lower() == "easy2edit" else "site"
        if "admin_max_eur" in d:
            try:
                st.admin_max_eur = max(0, min(100000, round(float(d["admin_max_eur"] or 0), 2)))
            except (TypeError, ValueError):
                return bad("Vul een bedrag in.")
        if isinstance(d.get("admin_funcs"), dict):
            cur = dict(st.admin_funcs or {})
            for k, v in d["admin_funcs"].items():
                if k in service.ADMIN_FUNCS and isinstance(v, dict):
                    old = cur.get(k) or {}
                    try:
                        per = max(1, min(10_000_000, int(v.get("per", old.get("per") or service.ADMIN_FUNCS[k][2]))))
                    except (TypeError, ValueError):
                        return bad("Vul een getal in.")
                    cur[k] = {"on": bool(v.get("on", old.get("on"))), "per": per}
            st.admin_funcs = cur
        st.save()
        if service.turned_on(before, st):
            service.link_to_server("trees")
    mine = TreeOrder.objects.select_related("user").filter(source__in=["admin_gift", "user"])[:20]
    real = TreeOrder.objects.filter(status="ok", test=False, source__in=["admin_gift", "user"])
    return Response({"settings": {"admin_trees": st.admin_trees, "admin_max_trees": st.admin_max_trees, "admin_name": st.admin_name, "test_mode": st.test_mode, "auto_on": st.auto_on, "last_auto_month": st.last_auto_month, "admin_max_eur": float(st.admin_max_eur or 0)},
                     "plan": service.admin_plan(service.this_month(), st), "stats": service.admin_stats(), "total_trees": sum(o.number for o in real), "orders": [_order(o) for o in mine], "price": float(service.PRICE_TREE), "currency": "EUR",
                     "next_settlement": service.stats(3)["next_settlement"], "report": service.report()})


@api_view(["POST"])
@permission_classes([AdminApiOn])
def give(request):
    try:
        o = service.gift(request.data.get("number"), request.user)
    except service.EcologiError as e:
        return bad(str(e))
    return Response({"order": _order(o)}, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def onboarding_trees(request):
    """The onboarding step "bomen planten" (a superadmin): GET = what it would cost and where it stands; POST {choice: "yes"|"no"} = the answer (yes switches the standard contributions on and links the website with the easy2edit server)."""
    if not request.user.is_staff:
        return Response({"detail": "Alleen voor een superadmin."}, status=403)
    if request.method == "POST":
        return Response({**service.onboarding_answer(str(request.data.get("choice") or "")), "asked": True})
    from apps.core.models import SystemSettings

    asked = bool((SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get("trees_asked"))
    per = service.estimate(1)["per_tree"]
    return Response({"asked": asked, "linked": service.api_on(), "per_tree": per, "currency": "EUR", "service_fee": __import__("apps.core.pricing", fromlist=["x"]).load()["items"].get("module:ecologi", 0),
                     "examples": [{"trees": n, "amount": round(per * n, 2)} for n in (5, 20, 50)]})
