# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""What a website tells the easy2edit server when a superadmin+ asks for it (Super admin+ -> Site manager -> view), and the switch offline/online.

Everything is counted here, on the website itself; the easy2edit server only shows it. No personal data of end users: numbers, and the administrator accounts (e-mail, level, last login)."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

PARTS = ("status", "users", "reseller", "ai", "stats", "energy")


def _f(v):
    return float(Decimal(v or 0).quantize(Decimal("0.01")))


def status():
    from django.conf import settings

    from . import sitemanager, system

    s = system.get()
    return {"online": not system.maintenance_on(), "maintenance": bool(s["maintenance"]), "maintenance_message": s["maintenance_message"], "site_name": system.site_name(),
            "version": str(settings.SYSTEM_VERSION), "build": sitemanager.build_number(), "url": system.origin(s["frontend_url"])}


def users():
    from apps.accounts.models import User

    now = timezone.now()
    month = now - timedelta(days=30)
    t = User.objects.aggregate(total=Count("id"), active=Count("id", filter=Q(is_active=True)), blocked=Count("id", filter=Q(is_active=False)), admins=Count("id", filter=Q(is_staff=True)),
                               plus=Count("id", filter=Q(is_staff=True, is_superadmin_plus=True)), new=Count("id", filter=Q(date_joined__gte=month)), seen=Count("id", filter=Q(last_login__gte=month)))
    admins = [{"email": u.email, "level": "superadmin+" if u.is_superadmin_plus else "superadmin", "active": u.is_active, "last_login": u.last_login}
              for u in User.objects.filter(is_staff=True).order_by("-last_login")[:50]]
    return {"total": t["total"], "active": t["active"], "blocked": t["blocked"], "admins": t["admins"], "superadmin_plus": t["plus"], "new_30_days": t["new"], "logged_in_30_days": t["seen"], "admin_accounts": admins}


def reseller():
    from . import system

    lic = system.license_info()
    return {"reseller": lic["reseller"], "licence": {"client": lic["client"], "has": lic["has"], "expired": lic["expired"], "valid_until": lic["valid_until"], "number": ("••••" + lic["number"][-4:]) if lic["number"] else ""}}


def ai():
    from apps.integrations.models import AiSettings, AiUsage

    now = timezone.localtime()
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month = day.replace(day=1)
    spans = {"month": (month, None), "last_30_days": (day - timedelta(days=29), None), "total": (None, None)}
    qs = AiUsage.objects.filter(owner="system")
    out = {}
    for k, (a, _b) in spans.items():
        q = qs.filter(created_at__gte=a) if a else qs
        t = q.aggregate(n=Count("id"), bad=Count("id", filter=Q(ok=False)), charged=Sum("charged", filter=Q(billable=True)), tin=Sum("tokens_in"), tout=Sum("tokens_out"))
        out[k] = {"calls": t["n"] or 0, "errors": t["bad"] or 0, "end_user_price": _f(t["charged"]), "tokens": (t["tin"] or 0) + (t["tout"] or 0)}  # what is charged to the end user (margin included): never the purchase price
    groups = qs.filter(created_at__gte=month, billable=True).values("group").annotate(calls=Count("id"), charged=Sum("charged")).order_by("-charged")
    out["by_group_month"] = [{"group": g["group"], "calls": g["calls"], "end_user_price": _f(g["charged"])} for g in groups]
    out["currency"] = AiSettings.load().currency
    return out


def stats(days=30):
    """The page statistics of the website (the plugin Statistics): visitors, page views, clicks from search and AI, bots, where visitors come from and the most visited pages, per day and in total.
    {"available": False} when that plugin is not on."""
    from apps.plugins import facade

    st = facade.mod("statistics", "service")
    if st is None:
        return {"available": False}
    names = {"visitors": "visitor", "page_views": "page_view", "search_clicks": "search_click", "ai_clicks": "ai_click", "bot_search": "bot_search", "bot_ai": "bot_ai", "bot_other": "bot_other"}
    raw = {k: st.series("seo", ev, days) for k, ev in names.items()}
    kinds = {}
    for r in st.top("seo", "referral", days, 12):
        kind, _, _name = r["label"].partition(":")
        kinds[kind] = kinds.get(kind, 0) + r["value"]
    return {"available": True, "days": days, "dates": [p["x"] for p in raw["visitors"]],
            "series": {k: [p["y"] for p in v] for k, v in raw.items()}, "totals": {k: sum(p["y"] for p in v) for k, v in raw.items()},
            "referrers": [{"label": k, "value": v} for k, v in sorted(kinds.items(), key=lambda kv: -kv[1])],
            "bots": [{"label": r["label"].split(":", 1)[-1], "ai": r["label"].startswith("ai:"), "value": r["value"]} for r in st.top("seo", "bot_visit", days, 10)],
            "pages": st.top("seo", "page_view", days, 10), "landing": st.top("seo", "landing", days, 8)}


def energy(days=30):
    """The energy use of the website (the module Energy): the score, the course per day, the comparison with an average page and the advice with what it is expected to give."""
    from apps.energy import advice, service

    sm = service.summary(days)
    adv = advice.analyse()
    return {"period_days": days, "source": sm["source"], "summary": sm["summary"],
            "benchmark": {k: sm["benchmark"].get(k) for k in ("page_bytes", "requests", "co2_g", "vs_pct")},
            "series": [{"date": s["date"], "views": s["views"], "avg_co2_g": s["avg_co2_g"], "co2_g": s.get("co2_g"), "avg_bytes": s["avg_bytes"]} for s in sm["series"]],
            "pages": [{"path": p["path"], "views": p["views"], "avg_bytes": p["avg_bytes"], "avg_co2_g": p["avg_co2_g"]} for p in sm["pages"][:8]],
            "advice": {"has_scan": bool(adv.get("has_scan")), "current": adv["current"], "after_apply": adv["after_apply"], "after_all": adv["after_all"], "saving_apply": adv["saving_apply"], "saving_manual": adv["saving_manual"],
                       "items": [{"key": i["key"], "status": i["status"], "saving": i.get("saving", 0), "applicable": i.get("applicable", False)} for i in adv["items"]]}}


def build(part):
    return {"status": status, "users": users, "reseller": reseller, "ai": ai, "stats": stats, "energy": energy}[part]()


def set_online(online, message=""):
    """Take the website offline (the maintenance page; administrators can still log in) or put it online again."""
    from . import system

    system.save({"maintenance": not online, **({"maintenance_message": str(message)[:500]} if message else {})})
    return status()


# ── what the easy2edit server may ask a website to do ─────────────────────────
REMOTE_PLUGINS = ("statistics",)  # the plugins that can be switched on and off from the Site manager


def _background(fn):
    """Run in the background (a measurement of the pages takes a while); inline in the tests."""
    import threading

    from . import sitemanager

    if sitemanager.disabled():
        return fn()
    threading.Thread(target=fn, daemon=True, name="remote-action").start()


def action(body):
    """{action: "plugin", name, enabled} | {action: "energy_scan"}. Raises ValueError with a message that can be shown."""
    from . import system

    kind = str(body.get("action") or "")
    if kind == "plugin":
        from apps.plugins import installer, switch
        from apps.plugins.models import Plugin

        name, want = str(body.get("name") or ""), bool(body.get("enabled"))
        if name not in REMOTE_PLUGINS:
            raise ValueError("Deze plugin kan niet vanuit de Site manager worden geschakeld.")
        p = Plugin.objects.filter(name=name).first()
        if not p and want:
            installer.install_from_library(name)  # not installed yet: it comes from the library of the product
            p = Plugin.objects.filter(name=name).first()
        if not p:
            raise ValueError("Plugin niet gevonden.")
        try:
            p = switch.set_enabled(p, want, with_requires=True)
        except switch.SwitchError as e:
            raise ValueError(str(e))
        return {"ok": True, "enabled": bool(p.enabled)}
    if kind == "energy_scan":
        from apps.energy import service

        base = system.origin(system.get()["frontend_url"])
        if not base:
            raise ValueError("Er is geen website-adres ingesteld (Admin → Basisgegevens): zonder dat kan de website zichzelf niet meten.")
        _background(lambda: service.scan(base))
        return {"ok": True, "started": True}
    raise ValueError("Onbekende actie.")
