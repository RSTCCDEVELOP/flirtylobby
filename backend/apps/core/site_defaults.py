# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Standaard instellingen: de instellingen van deze site (beveiliging, vormgeving, community, talen, dashboard en de vernieuwsnelheid) vastgelegd als de standaard.

`capture()` schrijft ze naar backend/apps/core/site_defaults.json (dat bestand hoort bij de code: neem het mee in git, dan is het de standaard voor elke nieuwe installatie).
`apply()` zet ze terug: bij een nieuwe installatie (eerste start), na "Systeem resetten", of met de knop. Geen sleutels, wachtwoorden, adressen, IP-lijsten of teksten van de site."""
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
    data = {"format": "site-defaults", "version": 1, "captured_at": timezone.now().isoformat(timespec="seconds"), "bundle": bundle, "system": {k: cur[k] for k in SYSTEM_KEYS if k in cur}}
    PATH.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.warning("Site defaults saved (%s parts)", len(bundle["sections"]))
    return info()


def apply():
    """Put the saved defaults back. Returns [{key, ok, message}] (empty when nothing was saved)."""
    if not PATH.is_file():
        return []
    data = json.loads(PATH.read_text(encoding="utf-8"))
    results = settings_backup.load(data["bundle"], SECTIONS)
    try:  # the logos of a new or reset site are always those of Easy2edit; the colours come from the saved look, and without a saved look the whole Easy2edit theme is used
        from . import themepacks

        if "theme" in (data["bundle"].get("sections") or {}):
            themepacks.apply_files("easy2edit")
        else:
            themepacks.use("easy2edit", True)
    except Exception:  # noqa: BLE001
        logger.exception("Default theme easy2edit could not be set")
    out = {k: str(v) if not isinstance(v, bool) else v for k, v in (data.get("system") or {}).items() if k in SYSTEM_KEYS}
    if out:
        system.save(out)
        results.append({"key": "system", "label": "Vernieuwen en limieten", "ok": True, "message": "Geladen."})
    return results
