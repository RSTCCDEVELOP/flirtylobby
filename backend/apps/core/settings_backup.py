# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""
Settings backup: export every setting of the system to one JSON file, and load it again.

Built to grow and shrink without breaking anything:
  * every app describes its own settings in `apps/<app>/backup.py` by calling `register(...)` (found automatically, so a new app
    only adds that file and a removed app just takes its file with it);
  * the file stores each part under its own key with a version; loading skips parts this system does not know (reported as
    "unknown"), leaves parts that are missing in the file untouched, and one failing part never stops the others;
  * importers are tolerant: they `get()` values and ignore what they do not recognise (media files are matched by file name).

To add settings: create `apps/<app>/backup.py`:

    from apps.core.settings_backup import register
    def export(opts): return {...json...}
    def apply(data, ctx): ...; return "3 gegevens geladen"
    register("mypart", "Naam", export, apply, description="...", order=50)

Loading has three modes. "clean": start clean, the part is emptied first (`clear(), optional`) and then filled from the file.
"overwrite": every part is overwritten by the file, nothing is emptied first. "add": only what does not exist yet is added, nothing that
exists is changed (a part that has no `add(data, ctx)`, i.e. settings and no separate items, is skipped).
With phase "clear" or "fill" the two steps of "clean" run apart, so the screen can show progress per part.
"""
import importlib
import logging

from django.apps import apps as django_apps
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)
FORMAT = "easy2edit-settings"
FORMAT_VERSION = 1
SECTIONS = {}
_discovered = False


def register(key, label, export, apply, *, description="", sensitive=False, order=100, version=1, add=None, clear=None):
    """export(opts) -> JSON-able data. apply(data, ctx) -> short message. `sensitive`: contains secrets (only with include_secrets).
    add(data, ctx): only add what does not exist yet (mode "add"). clear(): empty the part before loading (mode "clean")."""
    SECTIONS[key] = {"key": key, "label": label, "description": description, "sensitive": sensitive, "order": order, "version": version, "export": export, "apply": apply, "add": add, "clear": clear}


def discover():
    """Load `<app>.backup` of every installed app (once). A broken or missing file never stops the system."""
    global _discovered
    if _discovered:
        return
    _discovered = True
    for cfg in django_apps.get_app_configs():
        try:
            importlib.import_module(f"{cfg.name}.backup")
        except ModuleNotFoundError as e:
            if e.name != f"{cfg.name}.backup":
                logger.warning("backup of %s not loaded: %s", cfg.name, e)
        except Exception as e:  # noqa: BLE001
            logger.warning("backup of %s not loaded: %s", cfg.name, e)


def listing():
    discover()
    return [{**{k: v for k, v in s.items() if k not in ("export", "apply", "add", "clear")}, "can_add": bool(s["add"])} for s in sorted(SECTIONS.values(), key=lambda s: (s["order"], s["key"]))]


def export(keys=None, include_secrets=False, include_files=True, extra=None):
    """The bundle: {format, version, exported_at, sections: {key: {"v", "data"}}}. A part that fails is left out and listed under `errors`."""
    discover()
    out, errors = {}, {}
    for key, s in sorted(SECTIONS.items(), key=lambda kv: (kv[1]["order"], kv[0])):
        if keys is not None and key not in keys:
            continue
        try:
            out[key] = {"v": s["version"], "label": s["label"], "data": s["export"]({**(extra or {}), "include_secrets": include_secrets, "include_files": include_files})}
        except Exception as e:  # noqa: BLE001
            logger.exception("export of %s failed", key)
            errors[key] = str(e)
    return {"format": FORMAT, "version": FORMAT_VERSION, "exported_at": timezone.now().isoformat(timespec="seconds"),
            "secrets_included": bool(include_secrets), "files_included": bool(include_files), "sections": out, "errors": errors}


def check(bundle):
    """Is this a settings file? Raises ValueError with a readable text."""
    if not isinstance(bundle, dict) or bundle.get("format") != FORMAT or not isinstance(bundle.get("sections"), dict):
        raise ValueError("Dit is geen instellingenbestand van dit systeem.")
    if int(bundle.get("version", 0) or 0) > FORMAT_VERSION:
        raise ValueError("Dit bestand komt uit een nieuwere versie en kan hier niet worden geladen.")


def inspect(bundle):
    """What is in the file: known parts (can be loaded), unknown parts (skipped), parts of this system that the file does not have."""
    discover()
    check(bundle)
    known, unknown = [], []
    for key, part in bundle["sections"].items():
        s = SECTIONS.get(key)
        item = {"key": key, "label": (s or {}).get("label") or (part or {}).get("label") or key, "size": len(str(part.get("data", ""))) if isinstance(part, dict) else 0}
        (known if s else unknown).append(item)
    return {"exported_at": bundle.get("exported_at"), "files_included": bool(bundle.get("files_included", True)), "secrets_included": bool(bundle.get("secrets_included")), "known": known, "unknown": unknown,
            "missing": [s["label"] for s in listing() if s["key"] not in bundle["sections"]]}


def load(bundle, keys=None, mode="clean", phase=None):
    """Apply the chosen parts, mode "clean" (empty first, then fill), "overwrite" or "add" (only add what is new). `phase`: "clear" = only empty, "fill" = only fill, None = both. Each part runs in its own transaction: when one fails the rest still load. Returns [{key, ok, message}]."""
    discover()
    check(bundle)
    mode = mode if mode in ("add", "overwrite") else "clean"
    phase = phase if phase in ("clear", "fill") else None
    ctx = {"exported_at": bundle.get("exported_at"), "mode": mode}
    results = []
    for key, part in bundle["sections"].items():
        if keys is not None and key not in keys:
            continue
        s = SECTIONS.get(key)
        if not s:
            results.append({"key": key, "label": key, "ok": False, "message": "Onbekend onderdeel, overgeslagen."})
            continue
        if phase == "clear":
            try:
                with transaction.atomic():
                    if mode == "clean" and s["clear"]:
                        s["clear"]()
                results.append({"key": key, "label": s["label"], "ok": True, "message": "Geleegd." if mode == "clean" and s["clear"] else "Niets te legen."})
            except Exception as e:  # noqa: BLE001
                logger.warning("clearing of %s failed: %s", key, e)
                results.append({"key": key, "label": s["label"], "ok": False, "message": f"Niet geleegd: {e}"})
            continue
        if mode == "add" and not s["add"]:
            results.append({"key": key, "label": s["label"], "ok": True, "message": "Bevat instellingen, geen losse items: overgeslagen (blijft zoals het is)."})
            continue
        try:
            with transaction.atomic():
                if mode == "clean" and phase is None and s["clear"]:
                    s["clear"]()
                msg = (s["add"] if mode == "add" else s["apply"])((part or {}).get("data"), {**ctx, "v": (part or {}).get("v", 1)})
            results.append({"key": key, "label": s["label"], "ok": True, "message": msg or "Geladen."})
        except Exception as e:  # noqa: BLE001
            logger.warning("load of %s failed: %s", key, e)
            results.append({"key": key, "label": s["label"], "ok": False, "message": f"Niet geladen: {e}"})
    return results
