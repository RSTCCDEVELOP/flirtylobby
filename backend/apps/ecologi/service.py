# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Ecologi (https://ecologi.com): plant trees from the system with their Impact API and show the result with their Reporting API.

- Two hosts: keys from the NEW Ecologi app (x.app.ecologi.com) work on https://x.api.ecologi.com, keys from the legacy app on https://public.ecologi.com. Both are tried (the one that works is remembered).
- Impact API (needs the API key of the link "Ecologi" in Admin -> API keys): POST /impact/trees (standard planting) and POST /impact/local-trees (a country: UK, US, AU, BR). `test: true` makes an
  order that is answered like a real one but nothing is bought. An Idempotency-Key makes a retry safe.
- Reporting API (public, no key): GET /users/<username>/trees -> {"total", "pending"}; the figures refresh every ten minutes.
The prices below are only an indication (EUR, Ecologi's list); Ecologi bills the real amount itself, monthly."""
import json
import logging
import math
import re
import urllib.error
import urllib.request
import uuid
from datetime import date
from decimal import Decimal

from django.core.cache import cache
from django.utils import timezone

from .models import EcologiSettings, TreeOrder

logger = logging.getLogger(__name__)

HOSTS = ["https://x.api.ecologi.com", "https://public.ecologi.com"]  # the new Ecologi app (x.app.ecologi.com) first, then the legacy one (app.ecologi.com): a key only works on the host of the app it was made in
PROVIDER = "ecologi"
COUNTRIES = {"UK": "Verenigd Koninkrijk", "US": "Verenigde Staten", "AU": "Australië", "BR": "Brazilië"}
PRICE_TREE = Decimal("0.80")  # EUR per tree, standard planting
PRICE_LOCAL = {"UK": Decimal("6.95"), "US": Decimal("2.33"), "AU": Decimal("6.00"), "BR": Decimal("6.60")}  # EUR per tree, local planting
USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{2,60}$")


class EcologiError(ValueError):
    """Something a person can read: the link is off, the key is wrong, Ecologi refused the order."""


def integration():
    """The link "Ecologi" (Admin -> API keys) when it is switched on, else None. This is "the API is on"."""
    from apps.integrations.models import Integration

    return Integration.objects.filter(provider=PROVIDER, enabled=True).first()


def api_on():
    return integration() is not None


def _config():
    obj = integration()
    if not obj:
        raise EcologiError("De koppeling met Ecologi staat uit (Admin → API keys → Ecologi).")
    c = obj.config
    if not str(c.get("api_key") or "").strip():
        raise EcologiError("De API-sleutel van Ecologi ontbreekt (Admin → API keys → Ecologi).")
    return c


def estimate(number, local=False, country="UK"):
    """The indication of the price in EUR: {amount, per_tree, currency}."""
    per = PRICE_LOCAL.get(country, PRICE_LOCAL["UK"]) if local else PRICE_TREE
    return {"per_tree": float(per), "amount": float(per * int(number or 0)), "currency": "EUR"}


def _request(method, path, body=None, key="", idem="", host=None):
    headers = {"User-Agent": "easy2edit", "Accept": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    if idem:
        headers["Idempotency-Key"] = idem
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request((host or HOSTS[0]) + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read(500_000).decode("utf-8", "ignore")
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read(5000).decode("utf-8", "ignore") or "{}")
        except (ValueError, OSError):
            payload = {}
        return e.code, payload if isinstance(payload, dict) else {}
    except Exception as e:  # noqa: BLE001
        raise EcologiError(f"Geen verbinding met Ecologi: {e}")


def _host_key(key):
    import hashlib

    return "ecologi:host:" + hashlib.sha256(key.encode()).hexdigest()[:16]


def _call(method, path, body=None, key="", idem=""):
    """A call to the Impact API on the host that accepts the key: the one that worked last time first, a refused key (401) is tried on the other host. -> (status, payload)"""
    hosts = list(HOSTS)
    if key:
        known = cache.get(_host_key(key))
        if known in hosts:
            hosts.remove(known)
            hosts.insert(0, known)
    out = (401, {})
    for h in hosts:
        out = _request(method, path, body, key=key, idem=idem, host=h)
        if out[0] != 401:
            if key and out[0] in (200, 201):
                cache.set(_host_key(key), h, 86400)
            return out
    return out


def _why(code, payload):
    detail = str(payload.get("message") or payload.get("error") or payload.get("detail") or "")[:200]
    if code in (401, 403):
        return "Ecologi weigert de API-sleutel (controleer de sleutel)." + (f" {detail}" if detail else "")
    if code == 429:
        return "Ecologi vraagt om even te wachten (te veel aanvragen)."
    return f"Ecologi gaf een fout (HTTP {code})." + (f" {detail}" if detail else "")


def check_key(key):
    """For the connection test of the link: a test order of one tree (nothing is bought). -> (ok, message)"""
    try:
        code, payload = _call("POST", "/impact/trees", {"number": 1, "test": True}, key=key)
    except EcologiError as e:
        return False, str(e)
    if code in (200, 201):
        return True, "Verbinding gelukt (met een testbestelling: er is niets gekocht)."
    return False, _why(code, payload)


def resolve_name(v):
    """The name on the trees: the name of the website (standard) or easy2edit."""
    if str(v or "").strip().lower() == "easy2edit":
        return "easy2edit"
    from apps.energy.service import own_name

    return (own_name() or "easy2edit")[:120]


def buy(number, *, name="", local=None, country=None, test=None, user=None, source="hand"):
    """Plant trees. The order is always logged. -> the TreeOrder. Raises EcologiError (also when Ecologi refuses; the refused order is logged too)."""
    st = EcologiSettings.load()
    c = _config()
    try:
        number = int(number)
    except (TypeError, ValueError):
        raise EcologiError("Vul een aantal bomen in.")
    if number < 1:
        raise EcologiError("Plant minstens 1 boom.")
    if number > st.max_per_order:
        raise EcologiError(f"Meer dan {st.max_per_order} bomen in één bestelling is niet toegestaan (de veiligheidsgrens bij Instellingen).")
    local = st.local if local is None else bool(local)
    country = str(country or st.country or "UK").upper()
    if local and country not in COUNTRIES:
        raise EcologiError("Kies een land voor lokaal planten.")
    test = st.test_mode if test is None else bool(test)
    name = resolve_name(name or st.name)
    key = uuid.uuid4().hex
    body = {"number": number, "test": test, **({"name": name} if name else {}), **({"country": country} if local else {})}
    order = TreeOrder(user=user if getattr(user, "pk", None) else None, number=number, local=local, country=country if local else "", name=name, test=test, source=source, key=key)
    try:
        code, payload = _call("POST", "/impact/local-trees" if local else "/impact/trees", body, key=str(c["api_key"]).strip(), idem=key)
    except EcologiError as e:
        order.status, order.error = "failed", str(e)[:300]
        order.save()
        raise
    if code in (200, 201):
        order.status = "ok"
        order.response = payload
        order.tree_url = str(payload.get("treeUrl") or "")[:300]
        try:
            order.amount = Decimal(str(payload.get("amount"))) if payload.get("amount") is not None else None
        except Exception:  # noqa: BLE001
            order.amount = None
        order.currency = str(payload.get("currency") or "")[:5]
        order.save()
        cache.delete(_report_key(c))
        return order
    order.status, order.error, order.response = "failed", _why(code, payload)[:300], payload
    order.save()
    raise EcologiError(order.error)


# ── the Reporting API (public) ─────────────────────────────────────────────────
def _report_key(c):
    return f"ecologi:report:{(c.get('username') or '').strip().lower()}"


def _report_request(username):
    """The public figures: the new app's host knows the profiles of the new app, the legacy host those of the legacy app."""
    out = (404, {})
    for h in HOSTS:
        out = _request("GET", f"/users/{username}/trees", host=h)
        if out[0] == 200:
            return out
    return out


def report():
    """The planted trees of the Ecologi profile ({trees, pending}), kept for ten minutes (that is how often Ecologi refreshes). None when there is no username or Ecologi cannot be reached."""
    obj = integration()
    if not obj:
        return None
    c = obj.config
    username = str(c.get("username") or "").strip()
    if not username or not USERNAME_RE.match(username):
        return None
    k = _report_key(c)
    hit = cache.get(k)
    if hit is not None:
        return hit or None
    try:
        code, payload = _report_request(username)
    except EcologiError:
        cache.set(k, {}, 120)
        return None
    if code != 200:
        cache.set(k, {}, 120)
        return None
    out = {"trees": int(payload.get("total") or 0), "pending": int(payload.get("pending") or 0), "username": username}
    cache.set(k, out, 600)
    return out


def totals():
    """What was planted from this system (real orders only): {orders, trees, amount}."""
    rows = TreeOrder.objects.filter(status="ok", test=False)
    trees = sum(r.number for r in rows)
    amount = sum((r.amount or 0) for r in rows)
    return {"orders": rows.count(), "trees": trees, "amount": float(amount), "tests": TreeOrder.objects.filter(status="ok", test=True).count()}


# ── the contributions: once a month the previous month is settled ─────────────────
SOURCES = ("visitors", "machine", "user")  # planted by this website's own Ecologi link (in this order, under the monthly maximum); "easy2edit" is planted by easy2edit itself and only shown


def _bounds(ym):
    y, m = int(ym[:4]), int(ym[5:7])
    return date(y, m, 1), (date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1))


def this_month(today=None):
    return (today or timezone.localdate()).strftime("%Y-%m")


def prev_month(today=None):
    t = today or timezone.localdate()
    y, m = (t.year - 1, 12) if t.month == 1 else (t.year, t.month - 1)
    return f"{y}-{m:02d}"


def months_back(n, today=None):
    """The last n months, oldest first: ["2026-07", ..., "2026-11"]."""
    t = today or timezone.localdate()
    y, m, out = t.year, t.month, []
    for _ in range(n):
        out.append(f"{y}-{m:02d}")
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    return out[::-1]


def usage(ym):
    """The use of the website in a month (module Energie): page views, data, the estimated energy and CO2."""
    from django.db.models import Sum

    from apps.energy import service as es
    from apps.energy.models import EnergyDay

    s, e = _bounds(ym)
    agg = EnergyDay.objects.filter(day__gte=s, day__lt=e).aggregate(v=Sum("views"), b=Sum("bytes_total"))
    views, nbytes = int(agg["v"] or 0), int(agg["b"] or 0)
    return {"month": ym, "views": views, "bytes": nbytes, "kwh": round(es.kwh(nbytes), 3), "co2_kg": round(es.co2_g(nbytes) / 1000, 3)}


# The functions of easy2edit the administrator can plant trees for himself: key -> (name, unit, standard "per")
ADMIN_FUNCS = {
    "visitors": ("Bezoekers van de website", "paginabezoeken", 1000),
    "members": ("Nieuwe gebruikers", "nieuwe gebruikers", 10),
    "ai": ("AI-gebruik (Claude)", "AI-verzoeken", 100),
    "energy": ("Energiegebruik van de website", "kg CO2", 22),
}


def func_count(key, ym):
    """The use of one function in a month (the metric a tree is planted for)."""
    s, e = _bounds(ym)
    if key == "visitors":
        return usage(ym)["views"]
    if key == "energy":
        return usage(ym)["co2_kg"]
    if key == "members":
        from apps.accounts.models import User

        return User.objects.filter(date_joined__date__gte=s, date_joined__date__lt=e).count()
    if key == "ai":
        from apps.integrations.models import AiUsage

        return AiUsage.objects.filter(created_at__date__gte=s, created_at__date__lt=e).count()
    return 0


def admin_plan(ym, st=None):
    """What the own choices of the administrator plant in a month: per function the use, the trees, and the maximum amount (he sets) that cuts it.
    -> {rows, funcs_trees, fixed, trees, cap_trees, cut, amount, per_tree}"""
    st = st or EcologiSettings.load()
    per_tree = estimate(1, st.local, st.country)["per_tree"]
    rows = []
    for key, (name, unit, std) in ADMIN_FUNCS.items():
        c = (st.admin_funcs or {}).get(key) or {}
        per = max(1, int(c.get("per") or std))
        on = bool(c.get("on"))
        n = func_count(key, ym)
        trees = int(math.ceil(n / per)) if on and n > 0 else 0
        rows.append({"key": key, "name": name, "unit": unit, "on": on, "per": per, "count": n, "trees": trees})
    funcs = sum(r["trees"] for r in rows)
    wanted = funcs + st.admin_trees
    cap = int(Decimal(str(st.admin_max_eur)) // Decimal(str(per_tree))) if float(st.admin_max_eur or 0) > 0 else None
    total = wanted if cap is None else min(wanted, cap)
    return {"rows": rows, "funcs_trees": funcs, "fixed": st.admin_trees, "wanted": wanted, "trees": total, "cap_trees": cap, "cut": wanted - total, "amount": round(total * per_tree, 2), "per_tree": per_tree}


def plan(ym):
    """What the contributions plant for a month: per source the trees it asks for and what the monthly maximum leaves. -> {month, usage, rows, cap, own_total, planted_total, easy2edit}"""
    st = EcologiSettings.load()
    u = usage(ym)
    asked = {
        "visitors": (u["views"] // max(1, st.visitors_per)) if st.visitors_on else 0,
        "machine": int(math.ceil(u["co2_kg"] / max(1, st.machine_kg))) if st.machine_on and u["co2_kg"] > 0 else 0,
        "user": st.monthly_trees + admin_plan(ym, st)["trees"],
    }
    left = st.cap_trees_month if st.cap_trees_month else None
    rows = []
    for key in SOURCES:
        want = asked[key]
        give = want if left is None else min(want, left)
        if left is not None:
            left -= give
        rows.append({"key": key, "asked": want, "trees": give, "cut": want - give, "on": want > 0 or {"visitors": st.visitors_on, "machine": st.machine_on, "user": False}[key]})
    own = sum(r["trees"] for r in rows)
    return {"month": ym, "usage": u, "rows": rows, "cap": st.cap_trees_month, "own_total": own, "easy2edit": st.e2e_trees, "user_parts": {"owner": st.monthly_trees, "admin": st.admin_trees}}


def settle(ym, user=None):
    """Plant what the contributions of a month ask for (under the maximum), one order per source. -> [{source, trees, ok, error}]"""
    out = []
    for r in plan(ym)["rows"]:
        if r["trees"] < 1:
            continue
        try:
            o = buy(r["trees"], source=r["key"], user=user)
            out.append({"source": r["key"], "trees": r["trees"], "ok": True, "test": o.test})
        except EcologiError as e:
            out.append({"source": r["key"], "trees": r["trees"], "ok": False, "error": str(e)})
    return out


def run_auto():
    """The monthly settlement of the PREVIOUS month (when it is on, the link is on and that month was not settled yet). Never raises."""
    try:
        st = EcologiSettings.load()
        month = prev_month()
        if not st.auto_on or st.last_auto_month == month or not api_on():
            return False
        EcologiSettings.objects.filter(pk=st.pk).update(last_auto_month=month)  # first: a failure is not repeated every hour
        settle(month)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Ecologi: the monthly contributions failed")
        return False


def stats(n=12):
    """Graphs and figures for the management screens: per month the use of the website and the planted trees per source; the plan of this month; the totals. Real orders and test orders apart."""
    months = months_back(n)
    first, _ = _bounds(months[0])
    orders = list(TreeOrder.objects.filter(status="ok", created_at__date__gte=first))
    by = {m: {"visitors": 0, "machine": 0, "user": 0, "admin_gift": 0, "hand": 0, "auto": 0, "test": 0} for m in months}
    cost = {m: 0.0 for m in months}
    for o in orders:
        ym = timezone.localtime(o.created_at).strftime("%Y-%m")
        if ym not in by:
            continue
        if o.test:
            by[ym]["test"] += o.number
        else:
            key = o.source if o.source in by[ym] else "hand"
            by[ym][key] += o.number
            cost[ym] += float(o.amount) if o.amount is not None else estimate(o.number, o.local, o.country)["amount"]
    series = []
    for m in months:
        u = usage(m)
        t = by[m]
        series.append({**u, "trees": {k: v for k, v in t.items() if k != "test"}, "trees_total": sum(v for k, v in t.items() if k != "test"), "test": t["test"], "cost": round(cost[m], 2)})
    real = TreeOrder.objects.filter(status="ok", test=False)
    all_by = {}
    for src, number in real.values_list("source", "number"):
        all_by[src] = all_by.get(src, 0) + number
    user_part = all_by.get("admin_gift", 0) + all_by.get("user", 0)
    st = EcologiSettings.load()
    cur = plan(this_month())
    per = estimate(1, st.local, st.country)["per_tree"]
    month_est = round(per * cur["own_total"], 2)
    last3 = [m["cost"] for m in series[-4:-1]] or [0]
    ap = admin_plan(this_month(), st)
    rw = {r["key"]: r for r in cur["rows"]}
    parts = [{"key": "visitors", "name": "Bezoekers van de website", "group": "auto", "trees": rw["visitors"]["trees"], "on": rw["visitors"]["on"]},
             {"key": "machine", "name": "Energiegebruik (machine)", "group": "auto", "trees": rw["machine"]["trees"], "on": rw["machine"]["on"]},
             {"key": "owner", "name": "Vaste bijdrage (eigenaar)", "group": "user", "trees": st.monthly_trees, "on": st.monthly_trees > 0},
             {"key": "admin_fixed", "name": "Vaste bijdrage (beheerder)", "group": "user", "trees": ap["fixed"], "on": ap["fixed"] > 0}]
    parts += [{"key": f"admin_{r['key']}", "name": f"Beheerder: {r['name']}", "group": "user", "trees": r["trees"], "on": r["on"]} for r in ap["rows"]]
    cut_admin = ap["cut"] + rw["user"]["cut"] + rw["visitors"]["cut"] + rw["machine"]["cut"]
    for x in parts:
        x["amount"] = round(per * x["trees"], 2)
    costs = {"parts": parts, "cut_trees": cut_admin, "per_tree": per, "currency": "EUR", "local": st.local, "month_estimate": month_est,
             "by_source": {r["key"]: round(per * r["trees"], 2) for r in cur["rows"]},
             "cut_saved": round(per * sum(r["cut"] for r in cur["rows"]), 2),
             "e2e_month": round(per * st.e2e_trees, 2), "this_month_paid": series[-1]["cost"],
             "year_estimate": round(month_est * 12, 2), "avg3": round(sum(last3) / len(last3), 2),
             "total_12": round(sum(m["cost"] for m in series), 2), "max_month": round(per * st.cap_trees_month, 2) if st.cap_trees_month else None}
    return {"months": series, "costs": costs, "totals": {"trees": sum(all_by.values()), "by_source": all_by, "user_trees": user_part, "tests": TreeOrder.objects.filter(status="ok", test=True).count()},
            "now": cur, "next_settlement": _bounds(this_month())[1].isoformat(), "auto_on": st.auto_on, "last_settled": st.last_auto_month, "cap": st.cap_trees_month, "e2e_trees_month": st.e2e_trees,
            "user_contributes": bool(st.admin_trees or all_by.get("admin_gift", 0))}


def admin_stats(n=12):
    """The own costs and results of the administrator: what his choices cost per month (paid, real orders of the sources user and admin_gift), the forecast per part for this month, the trees planted."""
    st = EcologiSettings.load()
    months = months_back(n)
    first, _ = _bounds(months[0])
    by = {m: {"trees": 0, "cost": 0.0} for m in months}
    for o in TreeOrder.objects.filter(status="ok", test=False, source__in=["user", "admin_gift"], created_at__date__gte=first):
        ym = timezone.localtime(o.created_at).strftime("%Y-%m")
        if ym in by:
            by[ym]["trees"] += o.number
            by[ym]["cost"] += float(o.amount) if o.amount is not None else estimate(o.number, o.local, o.country)["amount"]
    ap = admin_plan(this_month(), st)
    parts = [{"key": "admin_fixed", "name": "Vaste bijdrage (beheerder)", "trees": ap["fixed"], "on": ap["fixed"] > 0}]
    parts += [{"key": r["key"], "name": r["name"], "trees": r["trees"], "on": r["on"], "count": r["count"], "unit": r["unit"], "per": r["per"]} for r in ap["rows"]]
    for x in parts:
        x["amount"] = round(ap["per_tree"] * x["trees"], 2)
    series = [{"month": m, "trees": by[m]["trees"], "cost": round(by[m]["cost"], 2)} for m in months]
    return {"currency": "EUR", "per_tree": ap["per_tree"], "parts": parts, "month_estimate": ap["amount"], "year_estimate": round(ap["amount"] * 12, 2), "cut_trees": ap["cut"],
            "max_eur": float(st.admin_max_eur or 0), "months": series, "total_12": round(sum(m["cost"] for m in series), 2), "trees_12": sum(m["trees"] for m in series),
            "this_month_paid": series[-1]["cost"]}


def gift(number, user):
    """The administrator gives trees himself (Admin -> Systeem -> Bomen en giften): within his own maximum. -> the TreeOrder"""
    st = EcologiSettings.load()
    try:
        n = int(number)
    except (TypeError, ValueError):
        raise EcologiError("Vul een aantal bomen in.")
    if n < 1 or n > st.admin_max_trees:
        raise EcologiError(f"Je kunt 1 tot {st.admin_max_trees} bomen tegelijk geven.")
    return buy(n, source="admin_gift", user=user, name=st.admin_name or "")


def public(n=12):
    """What a visitor may see in the energy window (nothing personal): trees planted and donated per source and per month, this month, the donated amount. Kept for ten minutes. None when the API is off."""
    from django.core.cache import cache

    if not api_on():
        return None
    got = cache.get("ecologi:public")
    if got is not None:
        return got
    st = stats(n)
    c = st["costs"]
    srcs = {k: st["totals"]["by_source"].get(k, 0) for k in ("visitors", "machine", "user", "admin_gift", "hand", "auto")}
    real = TreeOrder.objects.filter(status="ok", test=False)
    donated = sum(float(o.amount) if o.amount is not None else estimate(o.number, o.local, o.country)["amount"] for o in real)
    now = st["now"]
    out = {"trees": st["totals"]["trees"], "by_source": srcs, "donated": round(donated, 2), "currency": "EUR", "orders": real.count(),
           "months": [{"month": m["month"], "trees": m["trees"], "total": m["trees_total"], "cost": m["cost"]} for m in st["months"]],
           "this_month": {"planned": now["own_total"], "cap": now["cap"], "estimate": c["month_estimate"]},
           "easy2edit_month": st["e2e_trees_month"], "profile": (report() or {}).get("trees"), "test_mode": EcologiSettings.load().test_mode,
           "sources_on": {"visitors": bool(EcologiSettings.load().visitors_on), "machine": bool(EcologiSettings.load().machine_on)}}
    cache.set("ecologi:public", out, 600)
    return out


REMOTE_KEYS = {"auto_on": bool, "visitors_on": bool, "machine_on": bool, "admin_enabled": bool, "show_on_site": bool, "test_mode": bool, "local": bool,
               "cap_trees_month": int, "visitors_per": int, "machine_kg": int, "e2e_trees": int, "monthly_trees": int}


def remote_payload():
    """What this website tells the easy2edit server about tree planting (Site manager -> Bomen): on or off, the settings, the trees, what was given, the expected costs per part."""
    st = EcologiSettings.load()
    on = api_on()
    out = {"linked": on, "chosen": bool(_onboarding_choice()), "settings": {k: getattr(st, k) for k in REMOTE_KEYS}, "name": st.name or "site", "currency": "EUR"}
    if not on:
        return {**out, "enabled": False, "totals": {"trees": 0, "donated": 0, "orders": 0}, "costs": {}, "months": []}
    s = stats(12)
    pub = public(12) or {}
    enabled = bool(st.auto_on or st.visitors_on or st.machine_on or st.admin_enabled or st.monthly_trees or st.e2e_trees)
    return {**out, "enabled": enabled, "totals": {"trees": s["totals"]["trees"], "donated": pub.get("donated", 0), "orders": pub.get("orders", 0), "tests": s["totals"]["tests"]},
            "costs": {k: s["costs"][k] for k in ("per_tree", "month_estimate", "year_estimate", "avg3", "total_12", "this_month_paid", "e2e_month", "max_month", "cut_saved", "parts")},
            "months": [{"month": m["month"], "trees": m["trees_total"], "cost": m["cost"], "views": m["views"]} for m in s["months"]], "by_source": s["totals"]["by_source"],
            "cap": s["cap"], "next_settlement": s["next_settlement"]}


def apply_remote(settings):
    """The easy2edit server changes tree planting of this website: only the keys of REMOTE_KEYS, with the right kind of value. -> the payload"""
    st = EcologiSettings.load()
    for k, v in (settings or {}).items():
        kind = REMOTE_KEYS.get(k)
        if not kind:
            continue
        try:
            setattr(st, k, bool(v) if kind is bool else max(0, min(250000, int(v))))
        except (TypeError, ValueError):
            raise EcologiError("Ongeldige waarde.")
    st.save()
    return remote_payload()


def _onboarding_choice():
    from apps.core.models import SystemSettings

    return (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get("trees_choice", "")


def link_to_server(reason="trees"):
    """Tree planting is switched on (by the owner in the onboarding or in the settings): the website is linked with the easy2edit server (registered, reported), so the server can manage and sum it up."""
    try:
        from apps.core import sitemanager

        sitemanager.report_async(reason)
    except Exception:  # noqa: BLE001 - never breaks a setting
        logger.exception("Ecologi: linking to the easy2edit server failed")


def turned_on(before, st):
    """Did one of the switches go from off to on? (then the website is linked with the easy2edit server)"""
    keys = ("auto_on", "visitors_on", "machine_on", "admin_enabled")
    return any(not before.get(k) and getattr(st, k) for k in keys)


def snapshot():
    st = EcologiSettings.load()
    return {k: getattr(st, k) for k in ("auto_on", "visitors_on", "machine_on", "admin_enabled")}


def onboarding_answer(choice, user=None):
    """The onboarding step "bomen planten": yes = the standard contributions on (still in test mode until the owner switches that off), and linked with the easy2edit server; no = nothing. -> payload"""
    from apps.core.models import SystemSettings

    choice = "yes" if choice == "yes" else "no"
    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**(row.data or {}), "trees_asked": True, "trees_choice": choice}
    row.save()
    if choice == "yes":
        st = EcologiSettings.load()
        st.auto_on, st.visitors_on, st.machine_on, st.admin_enabled, st.show_on_site = True, True, True, True, True
        if not st.cap_trees_month:
            st.cap_trees_month = 20
        st.save()
        link_to_server("trees")
    return remote_payload()
