# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API links that go with every installation and are available at once, without setting them up.

A superadmin marks a link ("In elke installatie meenemen", Admin -> API keys). The code (git) holds only the SHAPE of such a link in default_links.json: its name and kind. Keys and all other
settings are never in git: an installation gets them from the easy2edit server, when that server has approved the website
(Super admin+ -> Site manager). `capture()` writes the file, `apply()` makes the links:
- on a new installation, after "Systeem resetten" and with the button for the standard settings (force=True): the link is made and switched on;
- at every start (command `default_links apply`): a link that is missing is made; a link that the site already has is left as it is (an own key stays, a link that was switched off
  stays off), only a field that is still empty is filled in."""
import json
import logging
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

PATH = Path(settings.BASE_DIR) / "apps" / "integrations" / "default_links.json"


def _read():
    try:
        data = json.loads(PATH.read_text(encoding="utf-8"))
        rows = data.get("links") if isinstance(data, dict) else None
        return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []
    except (OSError, ValueError):
        return []


def _secret_fields(provider):
    from .providers import PROVIDERS

    return {fl["key"] for fl in PROVIDERS.get(provider, {}).get("fields", []) if fl.get("secret")}


def _remote():
    """{slug: row} of the links of the easy2edit server, with their keys; {} when this installation is the server itself, when the server does not give them (not approved) or cannot be reached."""
    from apps.core import resources, sitemanager

    if sitemanager.disabled() or sitemanager.server_enabled():
        return {}
    try:
        data = json.loads(resources._remote_call("", {}, prefix="default-links/").decode("utf-8"))
    except (resources.ResourceError, ValueError):
        return {}
    return {str(r.get("slug")): r for r in (data.get("links") or []) if isinstance(r, dict) and r.get("slug")}


def apply(force=False):
    """Make the default links. force=True also switches them on. Returns [{key, label, ok, message}]."""
    from .models import Integration
    from .providers import PROVIDERS

    rows = {str(r.get("slug") or ""): r for r in _read()}
    existing = {o.slug: o for o in Integration.objects.filter(slug__in=[x for x in rows if x])}
    remote = {}
    if force or any(slug not in existing or any(not str((existing[slug].config or {}).get(k) or "").strip() for k in _secret_fields(str(r.get("provider") or ""))) for slug, r in rows.items()):
        remote = _remote()  # the keys: only asked when a link is missing or has a key that is still empty
    for slug, r in remote.items():
        rows.setdefault(slug, {k: r.get(k) for k in ("slug", "provider", "name", "superadmin_only")})
    out = []
    for slug, row in rows.items():
        prov = str(row.get("provider") or "")
        if not slug or prov not in PROVIDERS:
            continue
        label = f"API-koppeling {row.get('name') or slug}"
        try:
            obj = existing.get(slug) or Integration.objects.filter(slug=slug).first()
            if obj and not force and not remote.get(slug):
                continue
            fields = {k: v for k, v in {**(row.get("config") or {}), **((remote.get(slug) or {}).get("config") or {})}.items() if isinstance(v, str) and v.strip()}
            new = obj is None
            if new:
                obj = Integration(slug=slug, provider=prov, name=str(row.get("name") or slug)[:100], superadmin_only=bool(row.get("superadmin_only")), enabled=True)
            cfg, changed = dict(obj.config or {}), new
            for k, v in fields.items():
                if not str(cfg.get(k) or "").strip():
                    cfg[k], changed = v, True
            if not changed and not force:
                continue
            obj.config, obj.in_installation = cfg, True
            if force:
                obj.enabled = True
            obj.save()
            out.append({"key": f"api_{slug}", "label": label, "ok": True, "message": "Aan." if force or new else "Aangevuld."})
        except Exception as e:  # noqa: BLE001
            logger.exception("Default link %s could not be set", slug)
            out.append({"key": f"api_{slug}", "label": label, "ok": False, "message": str(e)[:200]})
    return out


def capture():
    """Write the SHAPE of the links that are marked "in every installation" to default_links.json: slug, kind, name. Nothing else: no keys, no secrets and no other settings
    (an account name, a bucket): all of that comes from the easy2edit server. Returns the slugs."""
    from .models import Integration

    rows = [{"slug": o.slug, "provider": o.provider, "name": o.name, "superadmin_only": o.superadmin_only} for o in Integration.objects.filter(in_installation=True).order_by("id")]
    PATH.write_text(json.dumps({"format": "default-links", "version": 2, "note": "Only the shape of the links. No keys and no settings in here: they come from the easy2edit server (Site manager).", "links": rows}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return [r["slug"] for r in rows]
