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
SEALED = Path(settings.BASE_DIR) / "apps" / "integrations" / "default_links.enc"  # the links WITH their keys, locked with a password (PBKDF2 + Fernet): it goes with the installation, the password does not
PASSPHRASE_ENV = "EASY2EDIT_LINKS_PASSPHRASE"  # the password of that file on the destination (a secret of the server or of Coolify)


def _read():
    try:
        data = json.loads(PATH.read_text(encoding="utf-8"))
        rows = data.get("links") if isinstance(data, dict) else None
        return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []
    except (OSError, ValueError):
        return []


def secret_fields(provider):
    from .providers import PROVIDERS

    return {fl["key"] for fl in PROVIDERS.get(provider, {}).get("fields", []) if fl.get("secret")}


def seal_file(password):
    """Write the installation file: every link marked "in every installation", with all its settings and keys, locked with `password`. -> the slugs. The password is never stored."""
    from . import transfer
    from .models import Integration

    if len(str(password or "")) < 12:
        raise ValueError("Kies een wachtwoord van minstens 12 tekens.")
    rows = [{"slug": o.slug, "provider": o.provider, "name": o.name, "superadmin_only": o.superadmin_only, "always_on": o.always_on, "config": {k: v for k, v in (o.config or {}).items() if isinstance(v, str) and v.strip()}}
            for o in Integration.objects.filter(in_installation=True).order_by("id")]
    if not rows:
        raise ValueError("Er zijn geen koppelingen gemarkeerd met 'In elke installatie meenemen'.")
    SEALED.write_text(json.dumps(transfer.pack(rows, str(password)), indent=1), encoding="utf-8")
    return [r["slug"] for r in rows]


def sealed_links(password=None):
    """{slug: row} from the installation file, opened with the password (or the one of the environment); {} when there is no file or no password. Raises ValueError for a wrong password."""
    import os

    from . import transfer

    pw = password or os.environ.get(PASSPHRASE_ENV, "")
    if not pw or not SEALED.is_file():
        return {}
    rows = transfer.unpack(json.loads(SEALED.read_text(encoding="utf-8")), pw)
    return {str(r["slug"]): r for r in rows if isinstance(r, dict) and r.get("slug")}


def _remote(strict=False):
    """{slug: row} of the links of the easy2edit server, with their keys; {} when this installation is the server itself, when the server does not give them (not approved) or cannot be reached."""
    from apps.core import resources, sitemanager

    if sitemanager.disabled() or sitemanager.server_enabled():
        return {}
    try:
        data = json.loads(resources._remote_call("", {}, prefix="default-links/").decode("utf-8"))
    except (resources.ResourceError, ValueError) as e:
        if strict:
            raise
        return {}
    from apps.core import sitemanager

    from . import linkcrypt

    th = linkcrypt.hash_of(sitemanager._state().get("token") or "")  # the keys come sealed: they are opened here, at the installation
    out = {}
    for r in (data.get("links") or []):
        if not (isinstance(r, dict) and r.get("slug")):
            continue
        r = dict(r)
        opened = linkcrypt.unseal(r.pop("secret_enc", ""), th)
        r["config"] = {**(r.get("config") or {}), **opened}  # (an older server that sends the keys in the clear still works)
        out[str(r["slug"])] = r
    return out


def apply(force=False, refresh_keys=False, password=None):
    """Make the default links. force=True also switches them on. refresh_keys=True (an update): the keys of the links of the easy2edit server (the superadmin+ links) are brought up to date
    when they are different there. Returns [{key, label, ok, message}]."""
    from .models import Integration
    from .providers import PROVIDERS

    rows = {str(r.get("slug") or ""): r for r in _read()}
    existing = {o.slug: o for o in Integration.objects.filter(slug__in=[x for x in rows if x])}
    try:
        bundle = sealed_links(password)  # the installation file: opened here, at the destination
    except ValueError as e:
        logger.warning("Installation file of the API links: %s", e)
        bundle = {}
    for slug, r in bundle.items():
        rows.setdefault(slug, {k: r.get(k) for k in ("slug", "provider", "name", "superadmin_only", "always_on")})
    existing = {o.slug: o for o in Integration.objects.filter(slug__in=[x for x in rows if x])}
    remote = {}
    if force or refresh_keys or any(slug not in existing or any(not str((existing[slug].config or {}).get(k) or "").strip() for k in secret_fields(str(r.get("provider") or ""))) for slug, r in rows.items()):
        remote = _remote()  # the keys: only asked when a link is missing or has a key that is still empty
    remote = {**remote, **bundle}  # what the installation file says goes before what the server says
    for slug, r in remote.items():
        rows.setdefault(slug, {k: r.get(k) for k in ("slug", "provider", "name", "superadmin_only", "always_on")})
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
            refresh = bool(refresh_keys and obj and remote.get(slug) and (remote[slug].get("superadmin_only") or obj.superadmin_only))  # a link of the server: its keys follow the server
            fields = {k: v for k, v in {**(row.get("config") or {}), **((remote.get(slug) or {}).get("config") or {})}.items() if isinstance(v, str) and v.strip()}
            new = obj is None
            if new:
                obj = Integration(slug=slug, provider=prov, name=str(row.get("name") or slug)[:100], superadmin_only=bool(row.get("superadmin_only")), enabled=True)
            cfg, changed = dict(obj.config or {}), new
            for k, v in fields.items():
                if not str(cfg.get(k) or "").strip():
                    cfg[k], changed = v, True
                elif refresh and cfg.get(k) != v:  # the setting (a key, an account, a model) changed on the server: it is taken along here (only when it is different)
                    cfg[k], changed = v, True
            if refresh:  # the shape too (name, who may see it, always on) when the server says something else
                rem = remote.get(slug) or {}
                for attr in ("name", "superadmin_only", "always_on"):
                    if attr in rem and rem[attr] is not None and getattr(obj, attr) != (str(rem[attr])[:100] if attr == "name" else bool(rem[attr])):
                        setattr(obj, attr, str(rem[attr])[:100] if attr == "name" else bool(rem[attr]))
                        changed = True
            if not changed and not force:
                continue
            obj.config, obj.in_installation = cfg, True
            if row.get("always_on"):
                obj.always_on, obj.enabled = True, True  # needed to finish the installation: on, without a password
            if force:
                obj.enabled = True
            obj.save()
            out.append({"key": f"api_{slug}", "label": label, "ok": True, "message": "Aan." if force or new else ("Sleutel vernieuwd." if refresh else "Aangevuld.")})
        except Exception as e:  # noqa: BLE001
            logger.exception("Default link %s could not be set", slug)
            out.append({"key": f"api_{slug}", "label": label, "ok": False, "message": str(e)[:200]})
    return out


def capture():
    """Write the SHAPE of the links that are marked "in every installation" to default_links.json: slug, kind, name. Nothing else: no keys, no secrets and no other settings
    (an account name, a bucket): all of that comes from the easy2edit server. Returns the slugs."""
    from .models import Integration

    rows = [{"slug": o.slug, "provider": o.provider, "name": o.name, "superadmin_only": o.superadmin_only, **({"always_on": True} if o.always_on else {})} for o in Integration.objects.filter(in_installation=True).order_by("id")]  # (always_on only when it is on)
    PATH.write_text(json.dumps({"format": "default-links", "version": 2, "note": "Only the shape of the links. No keys and no settings in here: they come from the easy2edit server (Site manager).", "links": rows}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return [r["slug"] for r in rows]



def check(password=None):
    """Look at the API links of the easy2edit server and compare them with this installation, without changing anything (the keys are never shown, only that they differ).
    -> {ok, error, links: [{slug, name, provider, state: ok | update | missing | local, fields: [{field, secret, differs}]}]}"""
    from apps.core import resources, sitemanager

    from .models import Integration

    if sitemanager.server_enabled() and not SEALED.is_file():
        return {"ok": False, "server": True, "error": "Deze installatie is zelf de easy2edit-server: de koppelingen staan hier al.", "links": []}
    if sitemanager.disabled():
        return {"ok": False, "error": "Het melden bij de easy2edit-server staat uit.", "links": []}
    try:
        bundle = sealed_links(password)
    except ValueError as e:
        return {"ok": False, "error": str(e), "links": []}
    try:
        remote = {**_remote(strict=True), **bundle}
    except (resources.ResourceError, ValueError) as e:
        if not bundle:
            return {"ok": False, "error": str(e)[:200] or "De easy2edit-server geeft de koppelingen niet (is de website goedgekeurd?).", "links": []}
        remote = dict(bundle)  # (the installation file is enough)
    local = {o.slug: o for o in Integration.objects.filter(in_installation=True) | Integration.objects.filter(slug__in=list(remote))}
    out = []
    for slug, r in remote.items():
        prov = str(r.get("provider") or "")
        secrets_ = secret_fields(prov)
        obj = local.get(slug)
        fields = []
        for k, v in (r.get("config") or {}).items():
            if isinstance(v, str) and v.strip():
                fields.append({"field": k, "secret": k in secrets_, "differs": (obj is None) or str((obj.config or {}).get(k) or "") != v})
        shape = obj is not None and any(getattr(obj, a) != (str(r[a])[:100] if a == "name" else bool(r[a])) for a in ("name", "superadmin_only", "always_on") if r.get(a) is not None)
        state = "missing" if obj is None else "update" if shape or any(f["differs"] for f in fields) else "ok"
        out.append({"slug": slug, "name": str(r.get("name") or slug), "provider": prov, "state": state, "fields": fields})
    for slug, o in local.items():
        if slug not in remote and o.in_installation:
            out.append({"slug": slug, "name": o.name, "provider": o.provider, "state": "local", "fields": []})
    return {"ok": True, "error": "", "links": out, "need_update": any(x["state"] in ("update", "missing") for x in out)}
