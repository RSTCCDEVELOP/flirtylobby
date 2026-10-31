# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API links. Secrets (keys) are only in the file when asked for, and never loaded into a link that is not already set up."""
from apps.core.settings_backup import register

from . import providers
from .models import Integration


def _secret_keys(provider):
    return {f["key"] for f in providers.PROVIDERS.get(provider, {}).get("fields", []) if f.get("secret")}


def _export(opts):
    rows = []
    for i in Integration.objects.filter(**({"superadmin_only": False} if opts.get("hide_superadmin") else {})):  # a link of the superadmins is not in an export that a non-superadmin makes
        sec = _secret_keys(i.provider)
        cfg = i.config
        rows.append({"slug": i.slug, "name": i.name, "provider": i.provider, "enabled": i.enabled, "superadmin_only": i.superadmin_only,
                     "config": {k: v for k, v in cfg.items() if opts.get("include_secrets") or k not in sec}})
    return rows


def _apply(data, ctx):
    created = updated = 0
    for r in data or []:
        if not r.get("slug") or r.get("provider") not in providers.PROVIDERS:
            continue  # a system that is not supported here
        sec = _secret_keys(r["provider"])
        incoming = dict(r.get("config") or {})
        obj = Integration.objects.filter(slug=r["slug"]).first()
        if obj:
            cfg = obj.config
            cfg.update({k: v for k, v in incoming.items() if k not in sec or v})  # an empty secret never wipes the current one
            obj.name, obj.provider = r.get("name", obj.name), r["provider"]
            if "superadmin_only" in r:
                obj.superadmin_only = bool(r["superadmin_only"])
            obj.config = cfg
            if all(k in cfg for k in sec):
                obj.enabled = bool(r.get("enabled"))
            obj.save()
            updated += 1
        else:
            complete = all(incoming.get(k) for k in sec)
            obj = Integration(slug=r["slug"], name=r.get("name") or r["slug"], provider=r["provider"], enabled=bool(r.get("enabled")) and complete)
            obj.config = incoming
            obj.superadmin_only = bool(r.get("superadmin_only"))
            obj.save()
            created += 1
    return f"{created} koppeling(en) nieuw, {updated} bijgewerkt. Sleutels ontbreken? Vul ze in bij API keys."


def _add(data, ctx):
    have = set(Integration.objects.values_list("slug", flat=True))
    return _apply([r for r in data or [] if r.get("slug") not in have], ctx)


register("integrations", "API-koppelingen", _export, _apply, description="Welke systemen gekoppeld zijn. Sleutels alleen als je dat aanvinkt.", sensitive=True, order=70, add=_add)
