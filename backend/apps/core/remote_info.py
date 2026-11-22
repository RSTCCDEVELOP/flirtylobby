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

PARTS = ("info", "status", "users", "reseller", "ai", "stats", "energy", "trees", "maintenance")


def _f(v):
    return float(Decimal(v or 0).quantize(Decimal("0.01")))


def status():
    from django.conf import settings

    from . import sitemanager, system

    s = system.get()
    return {"online": not system.maintenance_on(), "maintenance": bool(s["maintenance"]), "maintenance_message": s["maintenance_message"], "site_name": system.site_name(),
            "version": str(settings.SYSTEM_VERSION), "build": sitemanager.build_number(), "url": system.origin(s["frontend_url"])}


def info():
    """The same as the Info pop-up of the website (Beheer -> Info): the licence (number, client, address, valid until, issued), the reseller, the contact data, the version and what is installed."""
    from django.conf import settings

    from apps.plugins.models import Plugin

    from . import modules, sitemanager, system
    from .models import License

    lic = License.objects.filter(pk=1).first()
    li = system.license_info()
    s = system.get()
    on = modules.states()
    plugins = list(Plugin.objects.values_list("enabled", flat=True))
    return {"name": system.site_name(), "version": str(settings.SYSTEM_VERSION), "build": sitemanager.build_number(),
            "license": {"number": lic.number if lic else "", "client": lic.client if lic else "", "client_address": lic.client_address if lic else "", "issued_at": lic.issued_at if lic else None,
                        "valid_until": lic.valid_until.isoformat() if lic and lic.valid_until else None, "has": li["has"], "expired": li["expired"], "state": sitemanager.licence_and_installation()["license"]["state"]},
            "reseller": li["reseller"],
            "site": {k: s.get(k, "") for k in ("site_name", "company_name", "frontend_url", "contact_email", "support_email", "phone", "address", "kvk", "vat_id")},
            "plugins": {"on": sum(1 for e in plugins if e), "total": len(plugins)},
            "modules": {"on": sum(1 for m in modules.MODULES if on.get(m["key"], True)), "total": len(modules.MODULES)},
            "installation": sitemanager.licence_and_installation()["installation"]}


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


def _library_updates():
    """{kind: [names]} of what is installed and has a newer version in the library (the same rule as "update everything")."""
    from . import resources

    out = {}
    try:
        rows = resources.overview(None)
    except resources.ResourceError:
        return out
    for kind in ("plugins", "themas", "languages", "components"):
        names = [r["name"] for r in rows.get(kind, []) if r["state"] == "update" and not (kind == "languages" and not r.get("installed_version"))]
        if names:
            out[kind] = names
    return out


def maintenance():
    """What has to be brought up to date on this website: the database (migrations that have not been done), the plugins, themes, languages and components with a newer version in the library, and the check after a new build."""
    from django.conf import settings
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    from . import sitemanager, sysupdate

    ex = MigrationExecutor(connection)
    pending = [f"{m.app_label}.{m.name}" for m, _backwards in ex.migration_plan(ex.loader.graph.leaf_nodes())]
    lib = _library_updates()
    chk = sysupdate.status(None)
    st = sitemanager._state().get("update") or {}
    return {"version": str(settings.SYSTEM_VERSION), "build": sitemanager.build_number(), "checked_build": chk["checked"], "check_needed": bool(chk["needed"]),
            "pending_migrations": pending[:30], "pending_count": len(pending), "library_updates": lib,
            "needs_update": bool(pending or lib or chk["needed"]), "online": status()["online"], "update": st}


def trees():
    """Tree planting of this website (easy2edit: bomen planten): on or off, the settings, the trees, what was given and the expected costs per part."""
    from apps.ecologi import service

    return service.remote_payload()


def build(part):
    return {"info": info, "status": status, "users": users, "reseller": reseller, "ai": ai, "stats": stats, "energy": energy, "trees": trees, "maintenance": maintenance}[part]()


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
    if kind == "trees":  # the easy2edit server switches tree planting on or off, or changes the contributions of this website
        from apps.ecologi import service as eco

        before = eco.snapshot()
        try:
            out = eco.apply_remote(body.get("settings") if isinstance(body.get("settings"), dict) else {})
        except eco.EcologiError as e:
            raise ValueError(str(e))
        return {"ok": True, "trees": out}
    if kind == "defaults_push":  # the standard settings (the tabs of Standaard en globale instellingen) as the easy2edit server says; a tab that is marked "do not overwrite" here stays, unless forced
        from . import site_defaults

        tabs = [t for t in (body.get("tabs") or []) if t in site_defaults.TABS]
        res = site_defaults.push(data=body.get("data") if isinstance(body.get("data"), dict) else None, tabs=tabs or None, force=bool(body.get("force")))
        return {"ok": True, "applied": res["applied"], "kept": res["kept"], "errors": [r["message"] for r in res["results"] if not r["ok"]]}
    if kind == "update":
        st = sitemanager_state().get("update") or {}
        if st.get("running"):
            raise ValueError("Er wordt al bijgewerkt.")
        _set_update(running=True, started=timezone.now().isoformat(timespec="seconds"), finished="", steps=[], error="")
        offline = bool(body.get("offline"))
        _background(lambda: _do_update(offline))
        return {"ok": True, "started": True}
    raise ValueError("Onbekende actie.")


# ── bringing the website up to date: the database and what comes from the library ──
def sitemanager_state():
    from . import sitemanager

    return sitemanager._state()


def _set_update(**kw):
    from . import sitemanager

    sitemanager._save(update={**(sitemanager._state().get("update") or {}), **kw})


def _do_update(offline=False):
    """The steps of the update after a new build (sysupdate): a copy of the content, the database, plugins, themes, languages, pages. With offline: the website shows the maintenance page meanwhile."""
    from types import SimpleNamespace

    from . import sysupdate

    user = SimpleNamespace(is_authenticated=True, is_staff=True)  # (the update of the system itself: nobody is asking from a browser)
    was_online = status()["online"]
    steps, error = [], ""
    try:
        if offline and was_online:
            set_online(False, "Onderhoud: de website wordt bijgewerkt. Probeer het zo meteen opnieuw.")
        for key, label in sysupdate.STEPS:
            r = sysupdate.run(key, user)
            steps.append({"key": key, "label": label, "ok": bool(r.get("ok")), "message": str(r.get("message") or "")[:300]})
            _set_update(steps=steps)
        error = "; ".join(f"{x['label']}: {x['message']}" for x in steps if not x["ok"])[:400]
    except Exception as e:  # noqa: BLE001
        error = str(e)[:300]
    finally:
        if offline and was_online:
            set_online(True)  # back online (also when a step failed)
        _set_update(running=False, finished=timezone.now().isoformat(timespec="seconds"), steps=steps, error=error)
