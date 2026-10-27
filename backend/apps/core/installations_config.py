# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net


"""De basis van de standaard installaties: welke installaties je aanbiedt bij de eerste installatie, welke de beheerders zien, en wat er in de installaties is aangepast (modules, plugins, pagina's, demo-gegevens).

`capture()` schrijft die keuzes naar backend/apps/core/installations.json (dat bestand hoort bij de code: neem het mee in git, dan hebben alle Easy2edit-sites dezelfde basis).
`apply()` zet ze op een site: bij het starten van de server (entrypoint) en met de knop. Een site krijgt de basis opnieuw zodra het bestand veranderd is (een nieuwe versie uit git); wat op de site zelf is ingesteld blijft tot dat moment staan.
De installatie die nu actief is en de gemaakte demo-gegevens horen er niet bij. De pagina's die in een installatie zijn opgeslagen wel: hun afbeeldingen en objecten worden op de andere site op naam teruggevonden."""
import hashlib
import json
import logging
from pathlib import Path

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

KEYS = ["default_presets", "admin_presets", "preset_edits", "preset_pages"]  # of the system settings (preset_pages: the pages saved in an installation; their pictures are found by name on the other site)
PATH = Path(settings.BASE_DIR) / "apps" / "core" / "installations.json"


def _digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def current():
    """The choices of this site about the standard installations."""
    from . import presets

    d = presets._data()
    return {k: d[k] for k in KEYS if k in d}


def autosave_on():
    """On your own computer (INSTALLATIONS_AUTOSAVE=True in backend/.env, with DEBUG) every change to the standard installations is written to installations.json at once, so it goes into git with the next push."""
    import os

    return bool(settings.DEBUG) and os.getenv("INSTALLATIONS_AUTOSAVE", "").lower() in ("1", "true", "yes")


def sync_file():
    """Write installations.json when the choices of this site differ from the file (and autosave is on). Called after every save of the system settings."""
    if not autosave_on():
        return False
    cur = current()
    try:
        same = json.loads(PATH.read_text(encoding="utf-8")).get("settings") == cur if PATH.is_file() else False
    except (OSError, ValueError):
        same = False
    if same:
        return False
    capture()
    return True


def info():
    from . import presets

    if not PATH.is_file():
        return {"exists": False, "saved_at": None, "keys": [], "applied": False, "same": False}
    try:
        raw = PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, ValueError):
        return {"exists": False, "saved_at": None, "keys": [], "applied": False, "same": False}
    same = (data.get("settings") or {}) == current()
    return {"exists": True, "saved_at": data.get("saved_at"), "keys": sorted(data.get("settings") or {}), "applied": presets._data().get("installations_hash") == _digest(raw), "same": same}


def capture():
    """Save the choices of this site as the basis. Returns info()."""
    from . import presets

    data = {"format": "installations", "version": 1, "saved_at": timezone.now().isoformat(timespec="seconds"), "settings": current()}
    text = json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True) + "\n"
    PATH.write_text(text, encoding="utf-8")
    d = presets._data()
    d["installations_hash"] = _digest(text)  # this site is the source: the file it just wrote counts as applied
    presets._save_data(d)
    logger.warning("Installations basis saved (%s)", ", ".join(data["settings"]) or "empty")
    return info()


def apply(force=False):
    """Put the basis on this site. Without `force` only when the file is new for this site (changed since it was last applied). Returns {"applied": bool, "keys": [...]}."""
    from . import presets

    if not PATH.is_file():
        return {"applied": False, "keys": []}
    raw = PATH.read_text(encoding="utf-8")
    d = presets._data()
    if not force and d.get("installations_hash") == _digest(raw):
        return {"applied": False, "keys": []}
    settings_ = (json.loads(raw).get("settings") or {})
    for k in KEYS:  # what the basis does not mention is empty on the site too: the basis is the same everywhere
        if k in settings_:
            d[k] = settings_[k]
        else:
            d.pop(k, None)
    d["installations_hash"] = _digest(raw)
    presets._save_data(d)
    logger.warning("Installations basis applied (%s)", ", ".join(settings_) or "empty")
    return {"applied": True, "keys": sorted(settings_)}
