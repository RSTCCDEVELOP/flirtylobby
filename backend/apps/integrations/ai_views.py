# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""

"""The AI dashboard of the superadmin: all AI traffic (who, where, how much, what it costs) and the prices and margin."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F as Fld, Max, Q, Sum
from django.db.models.functions import TruncDate, TruncHour, TruncMonth, TruncWeek
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from . import aiusage
from .models import AiAccount, AiLedger, AiSettings, AiTopup, AiUsage

class AiAdmin(BasePermission):
    """Superadmins, and admins who got the right to see the AI use of their users (Rollen → AI-gebruik)."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and (u.is_staff or "ai.manage" in u.permission_keys()))


def _strip(v):
    """No purchase prices, margin or own costs for admins."""
    if isinstance(v, dict):
        return {k: _strip(x) for k, x in v.items() if k not in ("cost", "margin", "own", "cost_sale", "cost_currency", "avg_cost")}
    if isinstance(v, list):
        return [_strip(x) for x in v]
    return v


F = lambda v: round(float(v or 0), 4)  # noqa: E731
SUMS = dict(calls=Count("id"), tin=Sum("tokens_in"), tout=Sum("tokens_out"), cost=Sum("cost"), charged=Sum("c_charged", filter=Q(billable=True)), own=Sum("c_charged", filter=Q(billable=False)), cost_sale=Sum(ExpressionWrapper(Fld("c_cost") * Fld("c_rate"), output_field=DecimalField(max_digits=20, decimal_places=8)), filter=Q(billable=True)))


def _row(r, **extra):
    return {"calls": r["calls"], "tokens_in": r["tin"] or 0, "tokens_out": r["tout"] or 0, "cost": F(r["cost"]), "charged": F(r["charged"]), "own": F(r["own"]), "margin": F((r["charged"] or 0) - (r["cost_sale"] or 0)), **extra}


@api_view(["GET"])
@permission_classes([IsAdminUser])
def overview(request):
    return Response(_overview(request, False))


@api_view(["GET"])
@permission_classes([AiAdmin])
def admin_overview(request):
    """The overview for an admin: users and admins, with what is charged; no purchase prices and no margin."""
    return Response(_overview(request, not request.user.is_staff or request.query_params.get("users") == "1"))  # users=1: only users and admins, also for a superadmin


def _overview(request, admin=False):
    period = request.query_params.get("period") or "month"
    owner = _owner(request) if admin else "system"
    qs = AiUsage.objects.filter(created_at__gte=aiusage.since(period), owner=owner)
    month = request.query_params.get("month") or ""  # a whole calendar month (2026-10): then it replaces the period
    if len(month) == 7 and month[:4].isdigit() and month[5:].isdigit() and 1 <= int(month[5:]) <= 12:
        y, mo = int(month[:4]), int(month[5:])
        tz = timezone.get_current_timezone()
        begin = timezone.datetime(y, mo, 1, tzinfo=tz)
        end = timezone.datetime(y + (mo == 12), 1 if mo == 12 else mo + 1, 1, tzinfo=tz)
        qs = AiUsage.objects.filter(created_at__gte=begin, created_at__lt=end, owner=owner)
        period = "month"
    if admin:
        qs = qs.filter(group__in=("user", "admin"))
    qs = qs.annotate(c_cost=Fld("cost"), c_rate=Fld("rate"), c_charged=Fld("charged"))
    group = request.query_params.get("group")
    if group in ("user", "admin", "super", "system", "site"):
        qs = qs.filter(group=group)
    st = AiSettings.load()
    t = qs.aggregate(**SUMS, errors=Count("id", filter=Q(ok=False)), ms=Avg("duration_ms"), users=Count("user", distinct=True))
    totals = {**_row(t), "errors": t["errors"], "avg_ms": int(t["ms"] or 0), "users": t["users"]}
    series = {}
    trunc = TruncHour if period == "day" else TruncDate
    for r in qs.annotate(d=trunc("created_at")).values("d", "group").annotate(**SUMS):
        k = r["d"].strftime("%Y-%m-%d %H:00" if period == "day" else "%Y-%m-%d")
        series.setdefault(k, {})[r["group"]] = _row(r)
    by_group = [_row(r, group=r["group"], name=aiusage.group_names().get(r["group"], r["group"]), users=r["users"]) for r in qs.values("group").annotate(**SUMS, users=Count("user", distinct=True)).order_by("-charged")]
    by_source = [_row(r, source=r["source"] or "Onbekend", errors=r["errors"]) for r in qs.values("source").annotate(**SUMS, errors=Count("id", filter=Q(ok=False))).order_by("-calls")[:15]]
    by_model = [_row(r, model=r["model"] or "?") for r in qs.values("model").annotate(**SUMS).order_by("-calls")[:10]]
    by_purpose = [_row(r, purpose=r["purpose"] or "?") for r in qs.values("purpose").annotate(**SUMS).order_by("-calls")[:10]]
    by_user = [_row(r, user=r["user_label"] or "Systeem", user_id=r["user_id"], group=r["group"], last=r["last"].isoformat() if r["last"] else "", avg_ms=int(r["ms"] or 0)) for r in
               qs.values("user_id", "user_label", "group").annotate(**SUMS, last=Max("created_at"), ms=Avg("duration_ms")).order_by("-charged", "-calls")[:30]]
    hours = {h: 0 for h in range(24)}
    days = {d: 0 for d in range(7)}
    for r in qs.values_list("created_at", flat=True):
        lt = timezone.localtime(r)
        hours[lt.hour] += 1
        days[lt.weekday()] += 1
    recent = [{"at": r.created_at.isoformat(), "user": r.user_label or "Systeem", "group": r.group, "source": r.source, "model": r.model, "tokens_in": r.tokens_in, "tokens_out": r.tokens_out, "ms": r.duration_ms, "ok": r.ok, "error": r.error,
               "charged": F(r.charged)} for r in qs[:25]]
    out = {"period": period, "currency": st.currency, "cost_currency": st.cost_currency, "totals": totals, "series": series, "by_group": by_group, "by_source": by_source, "by_model": by_model, "by_purpose": by_purpose, "by_user": by_user,
                     "own": F(t["own"]), "hours": [hours[h] for h in range(24)], "weekdays": [days[d] for d in range(7)], "recent": recent, "group_names": aiusage.group_names()}
    bal = dict(AiAccount.objects.values_list("user_id", "balance"))
    for r in out["by_user"]:
        r["balance"] = F(bal.get(r["user_id"])) if r["user_id"] else None
    out["credit_required"] = st.credit_required
    return _strip(out) if admin else out


@api_view(["GET"])
@permission_classes([IsAdminUser])
def costs(request):
    """The costs per month or week: for every group and for every user."""
    by = "week" if request.query_params.get("by") == "week" else "month"
    n = max(1, min(int(request.query_params.get("count") or (12 if by == "month" else 12)), 52))
    start = timezone.now() - (timedelta(weeks=n) if by == "week" else timedelta(days=31 * n))
    trunc = (TruncWeek if by == "week" else TruncMonth)("created_at")
    qs = AiUsage.objects.filter(created_at__gte=start, owner="system").annotate(p=trunc, c_cost=Fld("cost"), c_rate=Fld("rate"), c_charged=Fld("charged"))
    key = lambda d: d.strftime("%G-W%V" if by == "week" else "%Y-%m")  # noqa: E731
    periods = sorted({key(r["p"]) for r in qs.values("p").distinct()})[-n:]
    groups = {}
    for r in qs.values("p", "group").annotate(**SUMS):
        groups.setdefault(r["group"], {})[key(r["p"])] = _row(r)
    users = {}
    for r in qs.values("p", "user_id", "user_label", "group").annotate(**SUMS):
        u = users.setdefault(r["user_id"] or 0, {"user": r["user_label"] or "Systeem", "user_id": r["user_id"], "group": r["group"], "periods": {}})
        u["periods"][key(r["p"])] = _row(r)
    for u in users.values():
        u["total"] = F(sum(x["charged"] for x in u["periods"].values()))
    return Response({"by": by, "periods": periods, "currency": AiSettings.load().currency, "cost_currency": AiSettings.load().cost_currency, "groups": groups, "group_names": aiusage.group_names(), "users": sorted(users.values(), key=lambda u: -u["total"])[:60]})


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def settings(request):
    st = AiSettings.load()
    if request.method == "POST":
        d = request.data or {}
        try:
            if "bill_internal" in d:
                st.bill_internal = bool(d["bill_internal"])
            if isinstance(d.get("margins"), dict):  # per group: users, admins, reseller (= superadmin)
                out = {}
                for g in ("user", "admin", "super"):
                    m = d["margins"].get(g) or {}
                    pair = {}
                    for k in ("in", "out"):
                        v = Decimal(str(m.get(k) if m.get(k) not in (None, "") else 0))
                        if v < -100 or v > 10000:
                            raise ValueError
                        pair[k] = float(v)
                    out[g] = pair
                st.margins = out
                st.margin_in, st.margin_out = Decimal(str(out["user"]["in"])), Decimal(str(out["user"]["out"]))
            for k in ("currency", "cost_currency"):
                if k in d:
                    setattr(st, k, "".join(c for c in str(d[k]).upper() if c.isalpha())[:5] or ("EUR" if k == "currency" else "USD"))
            if "rate" in d:
                r = Decimal(str(d["rate"] if d["rate"] != "" else 1))
                if not (Decimal("0.0001") <= r <= Decimal("100000")):
                    raise ValueError
                if r != st.rate:
                    st.rate_note, st.rate_at = "Handmatig ingevuld", timezone.now()
                st.rate = r
            if isinstance(d.get("prices"), dict):  # {provider: {part of the model name: {"in", "out"}}}
                st.prices = {prov: {str(k).lower()[:60]: {"in": max(0.0, float(v.get("in") or 0)), "out": max(0.0, float(v.get("out") or 0))} for k, v in rows.items() if isinstance(v, dict) and str(k).strip()}
                             for prov, rows in d["prices"].items() if prov in dict(aiusage.PROVIDERS) and isinstance(rows, dict)}
        except (ValueError, TypeError, ArithmeticError):
            return Response({"detail": "Controleer de getallen."}, status=status.HTTP_400_BAD_REQUEST)
        st.save()
    return Response(_settings(st))


def _settings(st):
    return {"currency": st.currency, "cost_currency": st.cost_currency, "rate": F(st.rate), "rate_at": st.rate_at.isoformat() if st.rate_at else "", "rate_note": st.rate_note, "bill_internal": st.bill_internal, "margins": {g: {"in": aiusage.margins_of(st, g)[0], "out": aiusage.margins_of(st, g)[1]} for g in ("user", "admin", "super")}, "site_name": aiusage.group_names()["site"], "prices": aiusage.own_prices(st), "catalog": aiusage.CATALOG}


@api_view(["POST"])
@permission_classes([IsAdminUser])
def rate(request):
    """Ask Claude (with the web search) for the rate of today: how much of the selling currency is one unit of the purchase currency."""
    from apps.core import themeimport

    from . import ai

    st = AiSettings.load()
    a, b = st.cost_currency, st.currency
    if a == b:
        st.rate, st.rate_at, st.rate_note = Decimal(1), timezone.now(), "Zelfde munt"
        st.save()
        return Response(_settings(st))
    if not ai.available():
        return Response({"detail": "Koppel Claude eerst bij Admin → API keys (Anthropic)."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        out = themeimport._parse_json(ai.claude("You look up current currency exchange rates on the web. Answer with ONE JSON object only.", f'What is today\'s exchange rate: how many {b} is 1 {a}? Use a reliable source (for example the European Central Bank or a bank). Answer only: {{"rate": number with at least 4 decimals, "date": "YYYY-MM-DD", "source": "name of the source"}}', max_tokens=800, timeout=90, web=True), need=("rate",))
        value = Decimal(str(out.get("rate")))
        if not (Decimal("0.0001") <= value <= Decimal("100000")):
            raise ValueError("onbruikbare koers")
    except Exception as e:  # noqa: BLE001
        return Response({"detail": f"De koers kon niet worden opgehaald: {e}"}, status=status.HTTP_400_BAD_REQUEST)
    st.rate, st.rate_at, st.rate_note = value, timezone.now(), f"AI: {str(out.get('source') or 'web')[:80]} ({str(out.get('date') or '')[:10]})"
    st.save()
    return Response(_settings(st))


_live = {}  # the models an API key offers, kept for a few minutes: {(provider, key): (time, models | error text)}


def _live_models(provider, obj, refresh):
    import hashlib
    import time

    from . import providers

    key = (provider, hashlib.sha1((obj.config.get("api_key") or "").encode()).hexdigest())
    hit = _live.get(key)
    if hit and not refresh and time.time() - hit[0] < 600:
        return hit[1]
    try:
        out = [m["value"] for m in providers.list_models(provider, dict(obj.config))]
    except ValueError as e:
        out = str(e)
    _live[key] = (time.time(), out)
    return out


@api_view(["GET"])
@permission_classes([IsAdminUser])
def models(request):
    """Per AI provider (Claude, OpenAI, Gemini): is it linked and on, which model is in use, which models the API key offers (active in the API), and the price of each."""
    from .models import Integration

    st = AiSettings.load()
    refresh = bool(request.query_params.get("refresh"))
    used = {(r["provider"], r["model"]): r["n"] for r in AiUsage.objects.filter(created_at__gte=aiusage.since("month")).values("provider", "model").annotate(n=Count("id"))}
    out = []
    for prov, label in aiusage.PROVIDERS:
        obj = Integration.objects.filter(provider=prov).order_by("-enabled", "id").first()
        linked = bool(obj and obj.config.get("api_key"))
        live = _live_models(prov, obj, refresh) if linked and obj.enabled else []
        error = live if isinstance(live, str) else ""
        live = [] if isinstance(live, str) else live
        active = (obj.config.get("model") or "") if obj else ""
        rows, seen = [], set()

        def add(model, api):
            if model in seen:
                return
            seen.add(model)
            pin, pout, src = aiusage.price_of(st, prov, model)
            rows.append({"model": model, "api": api, "in_use": model == active, "calls": used.get((prov, model), 0), "in": pin, "out": pout, "source": src})

        for m in live:
            add(m, True)
        if active:
            add(active, active in live)
        for k in aiusage.table_for(st, prov):  # the models of the price list that the API does not offer (or that is not linked)
            add(k, False)
        out.append({"provider": prov, "label": label, "linked": linked, "enabled": bool(obj and obj.enabled), "active_model": active, "error": error, "count_api": len(live), "models": rows})
    return Response({"providers": out, "currency": st.cost_currency})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def prices(request):
    """Look up the current price per million tokens (in and out) of the models of one provider, with Claude and its web search, and fill them in."""
    import json

    from apps.core import themeimport

    from . import ai

    prov = str(request.data.get("provider") or "")
    names = {"anthropic": "Anthropic (Claude)", "openai": "OpenAI", "gemini": "Google (Gemini)"}
    models_ = [str(m)[:80] for m in (request.data.get("models") or [])][:60]
    if prov not in names or not models_:
        return Response({"detail": "Geen modellen om de prijs van op te zoeken."}, status=status.HTTP_400_BAD_REQUEST)
    if not ai.available():
        return Response({"detail": "Koppel Claude eerst bij Admin → API keys (Anthropic): die zoekt de prijzen op."}, status=status.HTTP_400_BAD_REQUEST)
    st = AiSettings.load()
    cur = st.cost_currency
    system = "You look up the current API prices of AI models on the official pricing page of the supplier. Answer with ONE JSON object only."
    prompt = (f"Official API prices of {names[prov]} per 1,000,000 tokens, in {cur} (convert from USD at today's rate when the page shows USD and the currency is not USD). Models: {json.dumps(models_)}. "
              'Answer only: {"models": {"<model id exactly as given>": {"in": price of 1M input tokens, "out": price of 1M output tokens}}, "source": "page used", "date": "YYYY-MM-DD"}. '
              "Use the normal (not batch, not cached, shortest-context) price. Leave a model out when you cannot find its price; never guess.")
    try:
        out = themeimport._parse_json(ai.claude(system, prompt, max_tokens=3500, timeout=150, web=True), need=("models",))
    except Exception as e:  # noqa: BLE001
        return Response({"detail": f"De prijzen konden niet worden opgezocht: {e}"}, status=status.HTTP_400_BAD_REQUEST)
    own = {k: dict(v) for k, v in aiusage.own_prices(st).get(prov, {}).items()}
    filled, missing = [], []
    got = out.get("models") if isinstance(out.get("models"), dict) else {}
    for m in models_:
        v = got.get(m)
        try:
            pin, pout = float(v["in"]), float(v["out"])
            if not (0 <= pin <= 10000 and 0 <= pout <= 10000) or (pin == 0 and pout == 0):
                raise ValueError
        except (TypeError, KeyError, ValueError):
            missing.append(m)
            continue
        own[m.lower()] = {"in": round(pin, 4), "out": round(pout, 4)}
        filled.append(m)
    allp = {k: dict(v) for k, v in aiusage.own_prices(st).items()}
    allp[prov] = own
    st.prices = allp
    st.save()
    return Response({**_settings(st), "filled": filled, "missing": missing, "source": f"{str(out.get('source') or 'web')[:80]} ({str(out.get('date') or '')[:10]})"})


def _owner(request):
    """Whose AI use is looked at: the superadmin sees that of the system; an admin sees that of his own system when that is on."""
    return "tenant" if (not request.user.is_staff and aiusage.tenant_active()) else "system"


def _scope(params, admin=False, owner="system"):
    """The calls of a period or a calendar month (and a group), as overview() and the PDF need them: (queryset, text of the period)."""
    period = params.get("period") or "month"
    qs = AiUsage.objects.filter(created_at__gte=aiusage.since(period), owner=owner)
    label = dict(day="laatste 24 uur", week="laatste 7 dagen", month="laatste 30 dagen", quarter="laatste 90 dagen", year="laatste jaar").get(period, "laatste 30 dagen")
    month = params.get("month") or ""
    if len(month) == 7 and month[:4].isdigit() and month[5:].isdigit() and 1 <= int(month[5:]) <= 12:
        y, mo = int(month[:4]), int(month[5:])
        tz = timezone.get_current_timezone()
        qs = AiUsage.objects.filter(created_at__gte=timezone.datetime(y, mo, 1, tzinfo=tz), created_at__lt=timezone.datetime(y + (mo == 12), 1 if mo == 12 else mo + 1, 1, tzinfo=tz), owner=owner)
        label = f"{y}-{mo:02d}"
    who = params.get("user")  # the report of one user ("0" = the system, without login)
    if who not in (None, ""):
        qs = qs.filter(user__isnull=True) if who == "0" else qs.filter(user_id=int(who) if str(who).isdigit() else -1)
        label += " · " + (qs.values_list("user_label", flat=True).first() or "Systeem")
    if admin:
        qs = qs.filter(group__in=("user", "admin"))
    group = params.get("group")
    if group in ("user", "admin", "super", "system", "site"):
        qs = qs.filter(group=group)
        label += f" · {aiusage.group_names()[group]}"
    return qs.annotate(c_cost=Fld("cost"), c_rate=Fld("rate"), c_charged=Fld("charged")), label


@api_view(["GET"])
@permission_classes([AiAdmin])
def report(request):
    """The AI use as a PDF: kind=usage (the period of the dashboard) or kind=costs (per month or week); detail=1 adds the complete list of every call."""
    from django.http import HttpResponse

    from apps.core.models import SiteSettings

    from . import aireport as R

    from rest_framework.exceptions import PermissionDenied

    st = AiSettings.load()
    cur, cc = st.currency, st.cost_currency
    if not request.user.is_staff and (request.query_params.get("kind") == "costs" or request.query_params.get("user") in (None, "")):
        raise PermissionDenied("Een admin kan het rapport van één gebruiker maken.")
    detail = request.query_params.get("detail") in ("1", "true")
    kind = "costs" if request.query_params.get("kind") == "costs" else "usage"
    mc, ms = (lambda v: R.money(v, cc)), (lambda v: R.money(v, cur))  # noqa: E731
    sections = []
    one = request.query_params.get("user") not in (None, "")  # the report of one user: only what is charged, no purchase price and no margin
    if kind == "usage" and one:
        qs, label = _scope(request.query_params, not request.user.is_staff, _owner(request))
        t = qs.aggregate(**SUMS, errors=Count("id", filter=Q(ok=False)), ms=Avg("duration_ms"))
        sections.append({"heading": "Samenvatting", "head": ["Onderdeel", "Waarde"], "widths": [3, 2], "right": [1], "rows": [
            ["Aanroepen", R.num(t["calls"])], ["Tokens in", R.num(t["tin"])], ["Tokens uit", R.num(t["tout"])], [f"Kosten ({cur})", ms(t["charged"])], ["Gemiddelde duur", f"{(t['ms'] or 0) / 1000:.1f} s"]]})
        sections.append({"heading": "Waarvoor is AI gebruikt", "head": ["Onderdeel", "Aanroepen", "Tokens in", "Tokens uit", f"Kosten ({cur})"], "widths": [4, 1.5, 2, 2, 2], "right": [1, 2, 3, 4],
                         "rows": [[r["source"] or "Onbekend", R.num(r["calls"]), R.num(r["tin"]), R.num(r["tout"]), ms(r["charged"])] for r in qs.values("source").annotate(**SUMS).order_by("-calls")],
                         "total": ["Totaal", R.num(t["calls"]), R.num(t["tin"]), R.num(t["tout"]), ms(t["charged"])]})
        sections.append({"heading": "Per model", "head": ["Model", "Aanroepen", "Tokens in", "Tokens uit", f"Kosten ({cur})"], "widths": [4, 1.5, 2, 2, 2], "right": [1, 2, 3, 4],
                         "rows": [[r["model"] or "?", R.num(r["calls"]), R.num(r["tin"]), R.num(r["tout"]), ms(r["charged"])] for r in qs.values("model").annotate(**SUMS).order_by("-calls")]})
        title, sub = "AI-gebruik", f"{label.split(' · ', 1)[1] if ' · ' in label else ''} · periode {label.split(' · ')[0]}".strip(" ·")
    elif kind == "usage":
        qs, label = _scope(request.query_params, False, _owner(request))
        t = qs.aggregate(**SUMS, errors=Count("id", filter=Q(ok=False)), ms=Avg("duration_ms"), users=Count("user", distinct=True))
        sections.append({"heading": "Samenvatting", "head": ["Onderdeel", "Waarde"], "widths": [3, 2], "right": [1], "rows": [
            ["Aanroepen", R.num(t["calls"])], ["Mislukt", R.num(t["errors"])], ["Actieve gebruikers", R.num(t["users"])], ["Tokens in", R.num(t["tin"])], ["Tokens uit", R.num(t["tout"])],
            [f"Kosten (inkoop, {cc})", mc(t["cost"])], [f"In rekening gebracht ({cur})", ms(t["charged"])], [f"Eigen kosten reseller, zonder marge ({cur})", ms(t["own"])], [f"Marge ({cur})", ms(float(t["charged"] or 0) - float(t["cost_sale"] or 0))], ["Gemiddelde duur", f"{(t['ms'] or 0) / 1000:.1f} s"]]})
        sections.append({"heading": "Per groep", "head": ["Groep", "Gebruikers", "Aanroepen", "Tokens in", "Tokens uit", f"Inkoop ({cc})", f"In rekening ({cur})", f"Marge ({cur})"], "widths": [3, 1.5, 1.5, 2, 2, 2, 2, 2], "right": [1, 2, 3, 4, 5, 6, 7],
                         "rows": [[aiusage.group_names().get(r["group"], r["group"]), r["users"], R.num(r["calls"]), R.num(r["tin"]), R.num(r["tout"]), mc(r["cost"]), ms(r["charged"]), ms(float(r["charged"] or 0) - float(r["cost_sale"] or 0))]
                                  for r in qs.values("group").annotate(**SUMS, users=Count("user", distinct=True)).order_by("-charged")]})
        sections.append({"heading": "Waar wordt AI gebruikt", "head": ["Onderdeel", "Aanroepen", "Mislukt", "Tokens in", "Tokens uit", f"Inkoop ({cc})", f"In rekening ({cur})"], "widths": [4, 1.5, 1.5, 2, 2, 2, 2], "right": [1, 2, 3, 4, 5, 6],
                         "rows": [[r["source"] or "Onbekend", R.num(r["calls"]), r["errors"], R.num(r["tin"]), R.num(r["tout"]), mc(r["cost"]), ms(r["charged"])] for r in qs.values("source").annotate(**SUMS, errors=Count("id", filter=Q(ok=False))).order_by("-calls")]})
        sections.append({"heading": "Per model", "head": ["Model", "Aanroepen", "Tokens in", "Tokens uit", f"Inkoop ({cc})", f"In rekening ({cur})"], "widths": [4, 1.5, 2, 2, 2, 2], "right": [1, 2, 3, 4, 5],
                         "rows": [[r["model"] or "?", R.num(r["calls"]), R.num(r["tin"]), R.num(r["tout"]), mc(r["cost"]), ms(r["charged"])] for r in qs.values("model").annotate(**SUMS).order_by("-calls")]})
        sections.append({"heading": "Per gebruiker", "head": ["Gebruiker", "Groep", "Aanroepen", "Tokens in", "Tokens uit", "Duur (gem.)", f"Inkoop ({cc})", f"In rekening ({cur})"], "widths": [4, 1.7, 1.5, 2, 2, 1.5, 2, 2], "right": [2, 3, 4, 5, 6, 7],
                         "rows": [[r["user_label"] or "Systeem", aiusage.group_names().get(r["group"], r["group"]), R.num(r["calls"]), R.num(r["tin"]), R.num(r["tout"]), f"{(r['ms'] or 0) / 1000:.1f} s", mc(r["cost"]), ms(r["charged"])]
                                  for r in qs.values("user_label", "group").annotate(**SUMS, ms=Avg("duration_ms")).order_by("-charged", "-calls")],
                         "total": ["Totaal", "", R.num(t["calls"]), R.num(t["tin"]), R.num(t["tout"]), "", mc(t["cost"]), ms(t["charged"])]})
        title, sub = "AI-gebruik", f"Periode: {label}"
    else:
        by = "week" if request.query_params.get("by") == "week" else "month"
        n = 12
        start = timezone.now() - (timedelta(weeks=n) if by == "week" else timedelta(days=31 * n))
        trunc = (TruncWeek if by == "week" else TruncMonth)("created_at")
        qs = AiUsage.objects.filter(created_at__gte=start, owner="system").annotate(p=trunc, c_cost=Fld("cost"), c_rate=Fld("rate"), c_charged=Fld("charged"))
        key = lambda d: d.strftime("%G-W%V" if by == "week" else "%Y-%m")  # noqa: E731
        periods = sorted({key(r["p"]) for r in qs.values("p").distinct()})[-n:]
        sections.append({"heading": f"In rekening gebracht per {'week' if by == 'week' else 'maand'}, per groep ({cur})", "head": ["Groep", *periods, "Totaal"], "right": list(range(1, len(periods) + 2)), "widths": [3, *([1.6] * len(periods)), 2],
                         "rows": [], "total": None})
        groups = {}
        for r in qs.values("p", "group").annotate(**SUMS):
            groups.setdefault(r["group"], {})[key(r["p"])] = r
        tot = {p: 0.0 for p in periods}
        for g in ("user", "admin", "super", "site", "system"):
            if g in groups:
                vals = [float(groups[g].get(p, {}).get("charged") or 0) for p in periods]
                for p, v in zip(periods, vals):
                    tot[p] += v
                sections[0]["rows"].append([aiusage.group_names()[g], *[ms(v) if v else "–" for v in vals], ms(sum(vals))])
        sections[0]["total"] = ["Totaal", *[ms(tot[p]) for p in periods], ms(sum(tot.values()))]
        sections.append({"heading": f"Inkoop per {'week' if by == 'week' else 'maand'}, per groep ({cc})", "head": ["Groep", *periods, "Totaal"], "right": list(range(1, len(periods) + 2)), "widths": [3, *([1.6] * len(periods)), 2],
                         "rows": [[aiusage.group_names()[g], *[mc(groups[g].get(p, {}).get("cost")) if groups[g].get(p) else "–" for p in periods], mc(sum(float(x["cost"] or 0) for x in groups[g].values()))] for g in ("user", "admin", "super", "site", "system") if g in groups]})
        users = {}
        for r in qs.values("p", "user_id", "user_label", "group").annotate(**SUMS):
            u = users.setdefault(r["user_id"] or 0, {"name": r["user_label"] or "Systeem", "group": r["group"], "v": {}})
            u["v"][key(r["p"])] = float(r["charged"] or 0)
        sections.append({"heading": f"In rekening gebracht per gebruiker ({cur})", "head": ["Gebruiker", "Groep", *periods, "Totaal"], "right": list(range(2, len(periods) + 3)), "widths": [4, 1.8, *([1.6] * len(periods)), 2],
                         "rows": [[u["name"], aiusage.group_names().get(u["group"], u["group"]), *[ms(u["v"][p]) if u["v"].get(p) else "–" for p in periods], ms(sum(u["v"].values()))] for u in sorted(users.values(), key=lambda u: -sum(u["v"].values()))]})
        qs = qs.filter(created_at__gte=start)
        title, sub = "AI-kosten", f"Per {'week' if by == 'week' else 'maand'}, {n} periodes"
    mg = {g: aiusage.margins_of(st, g) for g in ("user", "admin", "super")}
    note = f"Bedragen in {cur}." if one else (f"Inkoop in {cc}, in rekening gebracht in {cur}. Marge op tokens in/uit: gebruikers {mg['user'][0]:g}%/{mg['user'][1]:g}%, admins {mg['admin'][0]:g}%/{mg['admin'][1]:g}%, reseller {mg['super'][0]:g}%/{mg['super'][1]:g}%; koers 1 {cc} = {float(st.rate):g} {cur}. "
            + ("Het gebruik van superadmins en het systeem is voor rekening van de website." if st.bill_internal else "Het gebruik van superadmins en het systeem is voor rekening van de reseller (zonder marge) en niet in rekening gebracht."))
    if detail:
        cap = 5000
        rows = list(qs.order_by("-created_at")[:cap])
        if one:
            sections.append({"heading": f"Alle aanroepen ({len(rows)}{' van ' + str(qs.count()) if qs.count() > cap else ''})", "head": ["Datum", "Onderdeel", "Model", "Tokens in", "Tokens uit", "Duur", "Status", f"Kosten ({cur})"],
                             "widths": [2.6, 3.6, 3.4, 1.6, 1.6, 1.2, 1.4, 1.8], "right": [3, 4, 5, 7],
                             "rows": [[timezone.localtime(r.created_at).strftime("%d-%m-%Y %H:%M"), r.source, r.model, R.num(r.tokens_in), R.num(r.tokens_out), f"{r.duration_ms / 1000:.1f} s", "ok" if r.ok else (r.error or "mislukt"), ms(r.charged if r.billable else 0)] for r in rows],
                             "total": ["Totaal", "", "", R.num(sum(r.tokens_in for r in rows)), R.num(sum(r.tokens_out for r in rows)), "", "", ms(sum(float(r.charged) for r in rows if r.billable))]})
        else:
          sections.append({"heading": f"Alle aanroepen ({len(rows)}{' van ' + str(qs.count()) if qs.count() > cap else ''})", "head": ["Datum", "Gebruiker", "Groep", "Onderdeel", "Model", "In", "Uit", "Duur", "Status", f"Inkoop ({cc})", f"In rekening ({cur})"],
                         "widths": [2.6, 3.4, 1.7, 2.8, 3, 1.3, 1.3, 1.1, 1.3, 1.9, 1.9], "right": [5, 6, 7, 9, 10],
                         "rows": [[timezone.localtime(r.created_at).strftime("%d-%m-%Y %H:%M"), r.user_label or "Systeem", aiusage.group_names().get(r.group, r.group), r.source, r.model, R.num(r.tokens_in), R.num(r.tokens_out), f"{r.duration_ms / 1000:.1f} s",
                                   "ok" if r.ok else (r.error or "mislukt"), mc(r.cost), ms(r.charged)] for r in rows],
                         "total": ["Totaal", "", "", "", "", R.num(sum(r.tokens_in for r in rows)), R.num(sum(r.tokens_out for r in rows)), "", "", mc(sum(float(r.cost) for r in rows)), ms(sum(float(r.charged) for r in rows))]})
        if qs.count() > cap:
            note += f" De lijst toont de {cap} meest recente aanroepen."
    site = aiusage.group_names()["site"] if st.bill_internal else ""
    pdf = R.build(title + (" (gedetailleerd)" if detail else ""), sub, sections, site, note)
    res = HttpResponse(pdf, content_type="application/pdf")
    res["Content-Disposition"] = f'attachment; filename="easy2edit-ai-{kind}{"-detail" if detail else ""}.pdf"'
    return res


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def blocks(request):
    """The parts of the dashboard that can be put on a page as a block (system objects): which are on, and switching them on or off."""
    from apps.sysobjects.models import SystemObject

    from . import aiblocks

    if request.method == "POST":
        key, on = str(request.data.get("key") or ""), bool(request.data.get("on"))
        if key not in aiblocks.BLOCKS:
            return Response({"detail": "Onbekend blok."}, status=status.HTTP_400_BAD_REQUEST)
        if on:
            SystemObject.objects.get_or_create(kind="ai", ref_id=1, ref_key=key, defaults={"slug": f"ai-{key}"})
        else:
            SystemObject.objects.filter(kind="ai", ref_key=key).delete()
    have = set(SystemObject.objects.filter(kind="ai").values_list("ref_key", flat=True))
    return Response([{"key": k, "label": b["label"], "desc": b["desc"], "on": k in have, "slug": f"ai-{k}"} for k, b in aiblocks.BLOCKS.items()])


# ── the credit: what a user bought, what is used, and what the superadmin manages ──
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """The AI of the user himself: credit, use and the proposal to buy credit (the popup with the slider)."""
    from apps import commerce
    from apps.core import license_stripe

    st = AiSettings.load()
    u = request.user
    aiusage.reconcile(u)  # a purchase that was paid but not booked yet
    link = aiusage.pay_link(u)
    stripe_on = bool(link)
    cfg = aiusage.Cfg(st, u)
    acc = AiAccount.objects.filter(user=u).first()
    bal = float(acc.balance) if acc else 0.0
    sub = aiusage.subject(u)
    qs = AiUsage.objects.filter(user=u, created_at__gte=aiusage.since("month"))
    t = qs.aggregate(calls=Count("id"), tin=Sum("tokens_in"), tout=Sum("tokens_out"), charged=Sum("charged", filter=Q(billable=True)))
    from apps.core import modules

    return Response({"module": modules.enabled("ai"), "credit_required": bool(cfg.credit_required and sub), "exempt": not sub, "own_system": cfg.tenant, "welcome": bool(aiusage.group_of(u) in ("super", "admin") and not (acc and acc.welcomed)), "is_staff": bool(u.is_staff), "balance": F(bal), "currency": st.currency, "low": bool(cfg.credit_required and sub and bal < max(1.0, float(cfg.topup_min) / 5)),
                     "proposal": aiusage.proposal(st, u), "can_pay": stripe_on or commerce.can_pay_online(), "pay_via": "stripe" if stripe_on else "sandbox", "pay_name": (link["name"] if link else "") if u.is_staff else "", "month": {"calls": t["calls"], "tokens_in": t["tin"] or 0, "tokens_out": t["tout"] or 0, "charged": F(t["charged"])},
                     "ledger": [{"at": r.created_at.isoformat(), "kind": r.kind, "amount": F(r.amount), "balance": F(r.balance_after), "note": r.note} for r in AiLedger.objects.filter(user=u)[:30]],
                     "recent": [{"at": r.created_at.isoformat(), "source": r.source, "model": r.model, "tokens_in": r.tokens_in, "tokens_out": r.tokens_out, "ok": r.ok, "charged": F(r.charged if r.billable else 0)} for r in qs[:20]]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def welcome_done(request):
    """The explanation of the AI credit was shown to this admin (first login): it does not come back."""
    acc, _ = AiAccount.objects.get_or_create(user=request.user)
    acc.welcomed = True
    acc.save(update_fields=["welcomed"])
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def topup(request):
    """Buy AI credit: a payment is started; the credit is added when it is paid. Returns where to pay."""
    from apps import commerce

    st = AiSettings.load()
    try:
        amount = Decimal(str(request.data.get("amount"))).quantize(Decimal("0.01"))
    except Exception:  # noqa: BLE001
        return Response({"detail": "Kies een bedrag."}, status=status.HTTP_400_BAD_REQUEST)
    prop = aiusage.proposal(st, request.user)
    top = float(aiusage.Cfg(st, request.user).topup_max)
    if not (Decimal(str(prop["min"])) <= amount <= Decimal(str(max(prop["max"], top)))):
        return Response({"detail": f"Kies een bedrag tussen {prop['min']:g} en {max(prop['max'], top):g}."}, status=status.HTTP_400_BAD_REQUEST)
    from apps.core import license_stripe

    link = aiusage.pay_link(request.user)
    if link:  # always through Stripe, with an Easy2edit link of the superadmin (never the shop's own Stripe), when that is switched on
        import uuid

        ref = "ai_" + uuid.uuid4().hex[:20]
        try:
            url, sid = license_stripe.ai_checkout(request.user, amount, st.currency, ref, key=link["key"])
        except license_stripe.StripeError as e:
            msg = str(e)
            if "cannot currently make live charges" in msg:
                msg = "Het Stripe-account achter deze koppeling mag nog geen echte betalingen ontvangen. Rond de activering van het account in Stripe af, of gebruik tijdelijk een testsleutel (sk_test…) of de sandbox."
            return Response({"detail": f"Stripe: {msg}"}, status=status.HTTP_400_BAD_REQUEST)
        AiTopup.objects.create(user=request.user, amount=amount, currency=st.currency, payment_ref=ref, session_id=sid, via="stripe")
        return Response({"url": url, "ref": ref, "via": "stripe"})
    pay = commerce.payments()
    if not (pay and pay.available()):
        return Response({"detail": "Betalen is nu niet mogelijk: de Stripe-koppeling van het systeem staat niet aan (Super admin → Licentie) en ook de sandbox niet."}, status=status.HTTP_400_BAD_REQUEST)
    back = "/dashboard/ai?paid=1"
    try:
        payment = pay.create(amount, st.currency, f"AI-tegoed {request.user.email}", back)
    except Exception as e:  # noqa: BLE001
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    AiTopup.objects.create(user=request.user, amount=amount, currency=st.currency, payment_ref=payment.ref, via="sandbox")
    done = pay.settle(payment, back)
    return Response({"url": done or pay.checkout_path(payment), "ref": payment.ref, "via": "sandbox"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def topup_confirm(request):
    """The customer comes back from Stripe: ask Stripe whether the session is paid and add the credit (once). Does not depend on the webhook."""
    from apps.core import license_stripe

    t = AiTopup.objects.filter(user=request.user, payment_ref=str(request.data.get("ref") or "")).first()
    if not t:
        return Response({"detail": "Betaling niet gevonden."}, status=status.HTTP_404_NOT_FOUND)
    link = aiusage.pay_link(request.user)
    if t.status == "open" and t.via == "stripe" and t.session_id and link:
        try:
            paid, _ = license_stripe.session_paid(t.session_id, key=link["key"])
        except license_stripe.StripeError as e:
            return Response({"detail": f"Stripe: {e}"}, status=status.HTTP_400_BAD_REQUEST)
        if paid:
            aiusage.settle_topup(t.payment_ref, True, "Stripe")
            t.refresh_from_db()
    return Response({"status": t.status, "amount": F(t.amount)})


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def credit(request):
    """Superadmin: the credit of every user (and the settings of the credit); POST {user_id, amount, note} puts money on a credit or takes it off."""
    from apps.accounts.models import User

    st = AiSettings.load()
    if request.method == "POST":
        d = request.data or {}
        if "credit_required" in d or "topup_min" in d:
            try:
                if "credit_required" in d:
                    st.credit_required = bool(d["credit_required"])
                for k in ("topup_min", "topup_max", "topup_step"):
                    if k in d:
                        v = Decimal(str(d[k]))
                        if v <= 0 or v > 100000:
                            raise ValueError
                        setattr(st, k, v)
                if st.topup_max < st.topup_min:
                    raise ValueError
            except (ValueError, ArithmeticError):
                return Response({"detail": "Controleer de bedragen (het maximum is minstens het minimum)."}, status=status.HTTP_400_BAD_REQUEST)
            st.save()
        elif d.get("user_id"):
            u = User.objects.filter(pk=d["user_id"]).first()
            try:
                amount = Decimal(str(d.get("amount"))).quantize(Decimal("0.01"))
            except Exception:  # noqa: BLE001
                amount = Decimal(0)
            if not u or amount == 0 or abs(amount) > 100000:
                return Response({"detail": "Kies een gebruiker en een bedrag."}, status=status.HTTP_400_BAD_REQUEST)
            aiusage.credit(u, amount, "adjust", str(d.get("note") or ("Opgewaardeerd door de superadmin" if amount > 0 else "Afgeboekt door de superadmin")), by=request.user.email)
    bal = dict(AiAccount.objects.values_list("user_id", "balance"))
    used = {r["user_id"]: r for r in AiUsage.objects.filter(created_at__gte=aiusage.since("month"), user__isnull=False).values("user_id").annotate(n=Count("id"), c=Sum("charged", filter=Q(billable=True)))}
    users = []
    for u in User.objects.filter(is_active=True).order_by("email"):
        g = aiusage.group_of(u)
        users.append({"id": u.id, "user": u.email, "group": g, "balance": F(bal.get(u.id)), "month_calls": used.get(u.id, {}).get("n", 0), "month_charged": F(used.get(u.id, {}).get("c")), "subject": g in ("user", "admin")})
    return Response({"credit_required": st.credit_required, "topup_min": F(st.topup_min), "topup_max": F(st.topup_max), "topup_step": F(st.topup_step), "currency": st.currency, "users": users,
                     "ledger": [{"at": r.created_at.isoformat(), "user": r.user.email, "kind": r.kind, "amount": F(r.amount), "balance": F(r.balance_after), "note": r.note, "by": r.by} for r in AiLedger.objects.exclude(kind="usage").select_related("user")[:50]]})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def pay_status(request):
    """Superadmin: through which link AI credit is paid now."""
    from apps.sandbox import service as sandbox

    link = aiusage.pay_link()
    return Response({"via": link["via"] if link else "sandbox", "name": link["name"] if link else "", "mode": link["mode"] if link else "", "simulated": bool(sandbox.active("payments"))})


# ── the own credit system of an admin (his own AI link and his own Stripe link, not marked as superadmin links) ──
@api_view(["GET", "POST"])
@permission_classes([AiAdmin])
def tenant_view(request):
    """An admin makes a credit system for his users when he has his own AI link (Anthropic) and his own Stripe link that are NOT superadmin links. GET = state, POST = settings or {user_id, amount, note}.
    Only a superadmin changes the AI of the system itself (this does not touch that)."""
    from apps.accounts.models import User

    t = aiusage.tenant()
    own_ai, own_stripe = aiusage.tenant_links()
    ready = bool(own_ai and own_stripe)
    if request.method == "POST":
        d = request.data or {}
        if d.get("user_id"):
            u = User.objects.filter(pk=d["user_id"], is_active=True, is_staff=False).first()
            try:
                amount = Decimal(str(d.get("amount"))).quantize(Decimal("0.01"))
            except Exception:  # noqa: BLE001
                amount = Decimal(0)
            if not u or amount == 0 or abs(amount) > 100000:
                return Response({"detail": "Kies een gebruiker en een bedrag."}, status=status.HTTP_400_BAD_REQUEST)
            aiusage.credit(u, amount, "adjust", str(d.get("note") or ("Opgewaardeerd door de beheerder" if amount > 0 else "Afgeboekt door de beheerder")), by=request.user.email)
        else:
            try:
                if "enabled" in d:
                    if d["enabled"] and not ready:
                        return Response({"detail": "Stel eerst je eigen AI-koppeling (Anthropic) en je eigen Stripe-koppeling in bij API keys. Een koppeling die als Superadmin-koppeling is gemarkeerd, telt niet mee."}, status=status.HTTP_400_BAD_REQUEST)
                    t.enabled = bool(d["enabled"])
                if "credit_required" in d:
                    t.credit_required = bool(d["credit_required"])
                for k in ("topup_min", "topup_max", "topup_step", "margin_in", "margin_out"):
                    if k in d:
                        v = Decimal(str(d[k] if d[k] != "" else 0))
                        if v < (-100 if k.startswith("margin") else 0) or v > 100000 or (v == 0 and k.startswith("topup")):
                            raise ValueError
                        setattr(t, k, v)
                if t.topup_max < t.topup_min:
                    raise ValueError
            except (ValueError, ArithmeticError):
                return Response({"detail": "Controleer de bedragen (het grootste bedrag is minstens het kleinste)."}, status=status.HTTP_400_BAD_REQUEST)
            t.save()
    bal = dict(AiAccount.objects.values_list("user_id", "balance"))
    used = {r["user_id"]: r for r in AiUsage.objects.filter(owner="tenant", created_at__gte=aiusage.since("month")).values("user_id").annotate(n=Count("id"), c=Sum("charged", filter=Q(billable=True)))}
    users = [{"id": u.id, "user": u.email, "balance": F(bal.get(u.id)), "month_calls": used.get(u.id, {}).get("n", 0), "month_charged": F(used.get(u.id, {}).get("c"))}
             for u in User.objects.filter(is_active=True, is_staff=False).order_by("email") if aiusage.group_of(u) == "user"]
    return Response({"ready": ready, "active": aiusage.tenant_active(), "enabled": t.enabled, "ai_link": own_ai.name if own_ai else "", "stripe_link": own_stripe.name if own_stripe else "",
                     "credit_required": t.credit_required, "topup_min": F(t.topup_min), "topup_max": F(t.topup_max), "topup_step": F(t.topup_step), "margin_in": F(t.margin_in), "margin_out": F(t.margin_out),
                     "currency": AiSettings.load().currency, "users": users})
