# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Standaard instellingen: de instellingen van deze site (beveiliging, vormgeving, community, talen, dashboard en de vernieuwsnelheid) vastgelegd als de standaard.

`capture()` schrijft ze naar backend/apps/core/site_defaults.json (dat bestand hoort bij de code: neem het mee in git, dan is het de standaard voor elke nieuwe installatie).
`apply()` zet ze terug: bij een nieuwe installatie (eerste start), na "Systeem resetten", of met de knop. Geen wachtwoorden, adressen, IP-lijsten of teksten van de site. De standaard en globale instellingen (basisdomein en adressen van de easy2edit-server) gaan ook mee. Alleen de API-koppelingen die een superadmin heeft gemarkeerd als 'in elke installatie meenemen' gaan mee (met hun sleutel), en staan aan: zie apps/integrations/default_links.py."""
import json
import logging
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from . import settings_backup, system

logger = logging.getLogger(__name__)

SECTIONS = ["theme", "security", "community", "languages", "dashboard"]  # of the settings backup (see Admin -> Instellingen back-up)
SYSTEM_KEYS = ["refresh_seconds", "signal_seconds", "max_image_mb", "max_video_mb", "max_photo_mb", "show_credit", "timezone"]  # of the system settings: no names, addresses or contact data
PATH = Path(settings.BASE_DIR) / "apps" / "core" / "site_defaults.json"


TABS = {  # the tabs of Standaard en globale instellingen and the settings that belong to each (twofa: the two-step verification and blocking of the security settings)
    "server": ("base_domain", "api_url", "site_url"), "settings": ("source_mode",), "licence": ("grace_1", "grace_2", "grace_3", "grace_4", "grace_reminder"),
    "mails": ("notify_rstcc", "notify_reseller", "notify_invoicing", "notify_support"),
    "reseller": ("reseller_company", "reseller_contact", "reseller_email", "reseller_phone", "reseller_mobile", "reseller_street", "reseller_house_number", "reseller_postal_code", "reseller_city", "reseller_country", "reseller_website"),
    "twofa": (),
}
TWOFA_KEYS = {"twofa": ("enabled", "required_for", "allow_email", "allow_sms", "allow_app", "app_issuer", "code_minutes", "max_attempts"), "basic": ("login_max_attempts", "lockout_minutes")}


def kept_tabs():
    """The tabs that are marked "do not overwrite" on THIS installation: they are carried with new installations, but an update leaves them alone (unless it is forced)."""
    from . import global_settings

    g = global_settings.get()
    return {t for t in TABS if g.get(f"keep_{t}") == "1"}


def _shared_global():
    """The global settings that are carried (all of them: "do not overwrite" only counts when an update is put on an installation); not the flags themselves."""
    return {k: v for k, v in dict(_global_get()).items() if not k.startswith("keep_")}


def _twofa_subset():
    from apps.security import service

    raw = service.raw()
    return {sec: {k: raw[sec][k] for k in keys if k in raw[sec]} for sec, keys in TWOFA_KEYS.items()}


def _global_get():
    from . import global_settings

    return global_settings.get()  # the default and global settings (the data of the default easy2edit server) go with every installation


def info():
    if not PATH.is_file():
        return {"exists": False, "captured_at": None, "sections": []}
    try:
        data = json.loads(PATH.read_text(encoding="utf-8"))
        return {"exists": True, "captured_at": data.get("captured_at"), "sections": sorted(data.get("bundle", {}).get("sections", {})), "system": sorted(data.get("system", {}))}
    except (OSError, ValueError):
        return {"exists": False, "captured_at": None, "sections": []}


def _clean(bundle):
    """Nothing personal in the defaults: no list of IP addresses."""
    sec = (bundle["sections"].get("security") or {}).get("data")
    if isinstance(sec, dict):
        for part in (sec.get("settings") or sec).values() if isinstance(sec.get("settings") or sec, dict) else []:
            if isinstance(part, dict) and "always_allow_ips" in part:
                part["always_allow_ips"] = []
    return bundle


def capture():
    """Save the settings of this site as the defaults. Returns info()."""
    bundle = _clean(settings_backup.export(SECTIONS, include_secrets=False, include_files=False))
    cur = system.get()
    data = {"format": "site-defaults", "version": 1, "captured_at": timezone.now().isoformat(timespec="seconds"), "bundle": bundle, "system": {k: cur[k] for k in SYSTEM_KEYS if k in cur}, "global": _shared_global(), "push": {"twofa": _twofa_subset()}}
    PATH.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    try:
        from apps.integrations import default_links

        default_links.capture()  # the API links that every installation gets (Unsplash)
    except Exception:  # noqa: BLE001
        logger.exception("Default API links could not be saved")
    logger.warning("Site defaults saved (%s parts)", len(bundle["sections"]))
    return info()


def apply():
    """Put the saved defaults back. Returns [{key, ok, message}] (empty when nothing was saved)."""
    links = []
    try:  # the API links that every installation gets, switched on (also when no other defaults were saved)
        from apps.integrations import default_links

        links = default_links.apply(force=True)
    except Exception:  # noqa: BLE001
        logger.exception("Default API links could not be set")
    if not PATH.is_file():
        return links
    data = json.loads(PATH.read_text(encoding="utf-8"))
    results = links + settings_backup.load(data["bundle"], SECTIONS)
    try:  # the logos of a new or reset site are always those of easy2edit; the colours come from the saved look, and without a saved look the whole easy2edit theme is used
        from . import themepacks

        if "theme" in (data["bundle"].get("sections") or {}):
            themepacks.apply_files("easy2edit")
        else:
            themepacks.use("easy2edit", True)
    except Exception:  # noqa: BLE001
        logger.exception("Default theme easy2edit could not be set")
    try:
        from . import global_settings

        mine = kept_tabs()
        keep = {k: v for k, v in (data.get("global") or {}).items() if not any(k in TABS[t] for t in mine)}
        vals, errs = global_settings.clean(keep)
        if vals and not errs:
            global_settings.save(vals)
            results.append({"key": "global", "label": "Standaard en globale instellingen", "ok": True, "message": "Geladen."})
            global_settings.apply_reseller_to_licence()  # the standard reseller is noted in the licence (when it has none)
            try:  # and the logins of the reseller are asked from the easy2edit server (best effort: never stops the installation)
                from . import resellers

                resellers.sync()
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        logger.exception("Global settings could not be set")
    out = {k: str(v) if not isinstance(v, bool) else v for k, v in (data.get("system") or {}).items() if k in SYSTEM_KEYS}
    if out:
        system.save(out)
        results.append({"key": "system", "label": "Vernieuwen en limieten", "ok": True, "message": "Geladen."})
    return results


def shipped():
    """What is carried: the global settings and the two-step/blocking settings of the saved defaults ({} when nothing was saved)."""
    try:
        d = json.loads(PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {"global": d.get("global") or {}, "push": d.get("push") or {}}


def push(data=None, tabs=None, force=False):
    """Put the carried settings of the tabs of Standaard en globale instellingen on this installation (at every start/update, or when the easy2edit server asks for it).
    `data`: what to put (default: the saved defaults); `tabs`: only these tabs (default all); a tab that is marked "do not overwrite" HERE is left alone, unless `force`.
    Only these settings (never the theme, pages or the other defaults). -> {"results": [{key, ok, message}], "applied": [tabs], "kept": [tabs]}"""
    data = data if isinstance(data, dict) and (data.get("global") or data.get("push")) else shipped()
    out = {"results": [], "applied": [], "kept": []}
    if not data:
        return out
    from . import global_settings

    mine = kept_tabs()
    want = [t for t in TABS if not tabs or t in tabs]
    for t in want:
        if t in mine and not force:
            out["kept"].append(t)
            continue
        keys = TABS[t]
        if t == "twofa":
            two = (data.get("push") or {}).get("twofa")
            if not two:
                continue
            from apps.security import service

            try:
                service.save(service.clean(two, []))
                out["applied"].append(t)
                out["results"].append({"key": t, "ok": True, "message": "Bijgewerkt."})
            except Exception as e:  # noqa: BLE001
                out["results"].append({"key": t, "ok": False, "message": str(e)})
            continue
        vals, errs = global_settings.clean({k: v for k, v in (data.get("global") or {}).items() if k in keys})
        if errs:
            out["results"].append({"key": t, "ok": False, "message": " ".join(errs.values())})
        elif vals:
            global_settings.save(vals)
            out["applied"].append(t)
            out["results"].append({"key": t, "ok": True, "message": "Bijgewerkt."})
    return out
