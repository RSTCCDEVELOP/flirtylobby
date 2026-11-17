# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API links that go with every installation and are available at once, without setting them up.

A superadmin marks a link ("In elke installatie meenemen", Admin -> API keys). `capture()` writes the marked links (with their keys) to
default_links.json, which is part of the code (take it into git). `apply()` makes them on another installation:
- on a new installation, after "Systeem resetten" and with the button for the standard settings (force=True): the link is made and switched on;
- at every start (command `default_links apply`): a link that is missing is made; a link that the site already has is left as it is (an own key stays, a link that was switched off stays off).
Only mark links whose key may be shared by every installation (for example the Access Key of Unsplash): the file holds the keys in plain text."""
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


def apply(force=False):
    """Make the links of default_links.json. force=True also switches them on and fills in empty fields. Returns [{key, label, ok, message}]."""
    from .models import Integration
    from .providers import PROVIDERS

    out = []
    for row in _read():
        slug, prov = str(row.get("slug") or ""), str(row.get("provider") or "")
        if not slug or prov not in PROVIDERS:
            continue
        label = f"API-koppeling {row.get('name') or slug}"
        try:
            obj = Integration.objects.filter(slug=slug).first()
            if obj and not force:
                continue
            fields = {k: v for k, v in (row.get("config") or {}).items() if isinstance(v, str) and v.strip()}
            if not obj:
                obj = Integration(slug=slug, provider=prov, name=str(row.get("name") or slug)[:100], superadmin_only=bool(row.get("superadmin_only")), enabled=True)
            cfg = dict(obj.config or {})
            for k, v in fields.items():
                if not str(cfg.get(k) or "").strip():
                    cfg[k] = v
            obj.config, obj.in_installation = cfg, True
            if force:
                obj.enabled = True
            obj.save()
            out.append({"key": f"api_{slug}", "label": label, "ok": True, "message": "Aan."})
        except Exception as e:  # noqa: BLE001
            logger.exception("Default link %s could not be set", slug)
            out.append({"key": f"api_{slug}", "label": label, "ok": False, "message": str(e)[:200]})
    return out


def capture():
    """Write the links that are marked "in every installation" to default_links.json. Returns the slugs."""
    from .models import Integration

    rows = []
    for obj in Integration.objects.filter(in_installation=True).order_by("id"):
        cfg = {k: v for k, v in (obj.config or {}).items() if isinstance(v, str) and v.strip()}
        rows.append({"slug": obj.slug, "provider": obj.provider, "name": obj.name, "superadmin_only": obj.superadmin_only, "config": cfg})
    PATH.write_text(json.dumps({"format": "default-links", "version": 1, "links": rows}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return [r["slug"] for r in rows]
