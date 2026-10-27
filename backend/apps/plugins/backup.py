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


def _models(name):
    """The models of a plugin that is on (the tables plg_<name>_*), in the order they were made."""
    from django.apps import apps

    return list(apps.all_models.get("plugin_" + name.replace("-", "_"), {}).values())


def _data_export(name, budget):
    """The rows of the tables of a plugin that is on, as JSON per model (Django serializer: relations by id). A plugin that is off has no models here: its data stays in the database but is not in this backup."""
    from django.core import serializers

    out, left_out = {}, []
    for m in _models(name):
        rows = list(m.objects.all())
        if not rows:
            continue
        raw = serializers.serialize("json", rows)
        if budget.take(f"{name}.{m.__name__}", len(raw)):
            out[m.__name__] = raw
        else:
            left_out.append(m.__name__)
    return out, left_out


def _data_apply(p, data, mode):
    """Put the rows back in the tables of the plugin (it is on now). clean: the tables are emptied first; add: only rows that are not there yet. A row that cannot be placed (a person that is not here) is skipped. Returns (placed, skipped)."""
    import json

    from django.db import transaction

    models = {m.__name__: m for m in _models(p.name)}

    known = {}  # the ids that exist here of the models of the system itself (people, library): a link to something that is not here is emptied

    def exists_here(rel, pk):
        if rel not in known:
            known[rel] = set(rel.objects.values_list("pk", flat=True))
        return pk in known[rel]

    def build(model, item):  # (the serializer of Django cannot find the models of a plugin by name: the rows are made here)
        kw = {}
        for f in model._meta.concrete_fields:
            if f.primary_key or f.name not in item["fields"]:
                continue
            v = item["fields"][f.name]
            if f.is_relation:
                if v is not None and not f.related_model._meta.app_label.startswith("plugin_") and not exists_here(f.related_model, v):
                    if not f.null:
                        return None  # it needs a person or a file that is not here: the row cannot be placed
                    v = None
                kw[f.attname] = v
            else:
                kw[f.name] = f.to_python(v)
        return model(pk=item["pk"], **kw)

    if mode == "clean":
        for m in reversed(list(models.values())):
            try:
                with transaction.atomic():
                    m.objects.all().delete()
            except Exception:  # noqa: BLE001
                pass
    todo = []
    for mname, raw in (data or {}).items():
        if mname in models:
            todo += [o for o in (build(models[mname], item) for item in json.loads(raw)) if o is not None]
    placed = skipped = 0
    for _round in range(4):  # a row may need another one that comes later in the list (a photo needs its profile): again for what failed
        left = []
        for obj in todo:
            if mode == "add" and obj.__class__.objects.filter(pk=obj.pk).exists():
                continue
            try:
                with transaction.atomic():
                    obj.save()
                placed += 1
            except Exception:  # noqa: BLE001
                left.append(obj)
        if not left or len(left) == len(todo):
            skipped = len(left)
            break
        todo = left
    return placed, skipped


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
        if opts.get("include_data", True):
            data, left = _data_export(p.name, b)
            if data:
                it["data"] = data
            if left:
                b.skipped += [f"{p.name}.{x} (gegevens)" for x in left]
        items.append(it)
    return {"plugins": items, "skipped": b.skipped}


def _start(p, data=None, mode="clean"):
    err = runtime.load(p)
    Plugin.objects.filter(pk=p.pk).update(enabled=not err, error=err or "")
    if data and not err:  # its tables exist now: the data of the backup goes back in
        try:
            _data_apply(p, data, mode)
        except Exception:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).exception("Data of plugin %s could not be restored", p.name)


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
                transaction.on_commit(lambda p=p, d=it.get("data"), mode=ctx.get("mode", "clean"): _start(p, d, mode))  # creating its tables needs to happen outside the transaction of the backup
            done += 1
        except Exception as e:  # noqa: BLE001
            notes.append(f"{name}: {e}")
    return f"{done} plugin(s) geladen." + (" " + "; ".join(notes) if notes else "")


def _add(data, ctx):
    have = set(Plugin.objects.values_list("name", flat=True))
    return _apply({**(data or {}), "plugins": [it for it in (data or {}).get("plugins", []) if it.get("name") not in have]}, ctx)


register("plugins", "Plugins", _export, _apply, description="Welke plugins, hun instellingen, aan/uit, plaatsing, de ondertekende plugin zelf en de gegevens in hun tabellen (producten, abonnementen, FAQ, agenda …).", order=90, add=_add)
