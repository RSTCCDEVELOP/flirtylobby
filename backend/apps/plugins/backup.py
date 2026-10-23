# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Plugins in the settings backup: which plugins, their settings, on/off and placement, and (optionally) the signed plugin itself."""
import base64
import io
import zipfile

from django.db import transaction

from apps.core.backup_files import Budget
from apps.core.settings_backup import register

from . import installer, runtime
from .models import Plugin

PLACEMENT = ("_menu_group", "_page_object")


def _zip(name):
    """The plugin folder as a zip (hidden folders such as .data are not part of a plugin)."""
    base = installer.plugin_dir(name)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(base.rglob("*")):
            rel = f.relative_to(base)
            if f.is_file() and not any(part.startswith(".") and part != ".sig" for part in rel.parts):
                zf.write(f, rel.as_posix())
    return buf.getvalue()


def _export(opts):
    names = opts.get("plugins")  # None = all
    b, items = Budget(), []
    for p in Plugin.objects.all():
        if names is not None and p.name not in names:
            continue
        secret = {c["key"] for c in p.manifest.get("config", []) if c["type"] == "secret"}
        cfg = {k: v for k, v in (p.config or {}).items() if opts.get("include_secrets") or k not in secret}
        it = {"name": p.name, "title": p.title, "version": p.version, "enabled": p.enabled, "config": cfg}
        if opts.get("include_files", True):
            raw = _zip(p.name) if installer.plugin_dir(p.name).is_dir() else b""
            if raw and b.take(p.name, len(raw)):
                it["zip_b64"] = base64.b64encode(raw).decode()
        items.append(it)
    return {"plugins": items, "skipped": b.skipped}


def _start(p):
    err = runtime.load(p)
    Plugin.objects.filter(pk=p.pk).update(enabled=not err, error=err or "")


def _apply(data, ctx):
    done, notes = 0, []
    for it in (data or {}).get("plugins", []):
        name = it.get("name")
        try:
            if it.get("zip_b64"):
                installer.install_zip(base64.b64decode(it["zip_b64"]))
            p = Plugin.objects.filter(name=name).first()
            if not p:
                notes.append(f"{name}: niet geïnstalleerd (geen bestanden in de back-up)")
                continue
            allowed = {c["key"] for c in p.manifest.get("config", [])} | set(PLACEMENT)
            cfg = dict(p.config or {})
            cfg.update({k: v for k, v in (it.get("config") or {}).items() if k in allowed})
            p.config = cfg
            p.save(update_fields=["config", "updated_at"])
            if it.get("enabled"):
                transaction.on_commit(lambda p=p: _start(p))  # creating its tables needs to happen outside the transaction of the backup
            done += 1
        except Exception as e:  # noqa: BLE001
            notes.append(f"{name}: {e}")
    return f"{done} plugin(s) geladen." + (" " + "; ".join(notes) if notes else "")


def _add(data, ctx):
    have = set(Plugin.objects.values_list("name", flat=True))
    return _apply({**(data or {}), "plugins": [it for it in (data or {}).get("plugins", []) if it.get("name") not in have]}, ctx)


register("plugins", "Plugins", _export, _apply, description="Welke plugins, hun instellingen, aan/uit, plaatsing en de ondertekende plugin zelf (zonder hun gegevens).", order=90, add=_add)
