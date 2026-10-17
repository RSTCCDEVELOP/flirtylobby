import json
import re
from urllib.parse import urlparse

from apps.core import modules
from apps.medialib.models import MediaItem

from . import defaults as d
from .models import SeoPage, SeoSettings


class Invalid(Exception):
    pass


def _merge(base, over):
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in base.items()}
    for k, v in (over or {}).items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k].update(v)
        elif k in out:
            out[k] = v
    return out


def _with_site_name(cfg):
    """The website name from Systeem -> Basisgegevens wins; titles stay as the admin typed them unless they still are the default."""
    try:
        from apps.core import system

        name = system.get()["site_name"]
    except Exception:  # noqa: BLE001
        return cfg
    if name:
        site = cfg["site"]
        site["name"] = name
        if site.get("default_title") in ("", "Studio2"):
            site["default_title"] = name
        tab = system.get().get("tab_title")
        if tab:  # set at Systeem -> Basisgegevens: what the browser tab shows on the home page
            site["default_title"] = tab
        if site.get("title_template") in ("", "%s | Studio2"):
            site["title_template"] = f"%s | {name}"
        if not site.get("default_description"):
            site["default_description"] = system.get()["tagline"]
    return cfg


def get():
    """Effective settings. With the SEO module off, the defaults apply (no custom bot rules, no overrides)."""
    stored = SeoSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    return _with_site_name(_merge(d.DEFAULTS, stored if modules.enabled("seo") else {}))


def raw():
    stored = SeoSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    return _with_site_name(_merge(d.DEFAULTS, stored))


URL_RE = re.compile(r"^https?://[^\s]{3,300}$")


def clean(incoming):
    out = {}
    for section, body in (incoming or {}).items():
        if section not in d.DEFAULTS or not isinstance(body, dict):
            continue
        base = d.DEFAULTS[section]
        sec = {}
        for key, val in body.items():
            if key not in base:
                continue
            kind = type(base[key])
            if section == "bots":
                sec[key] = bool(val)
            elif key == "default_og_media":
                sec[key] = int(val) if val and MediaItem.objects.filter(pk=val, kind="image").exists() else None
            elif key in ("site_url",):
                v = str(val or "").strip().rstrip("/")
                if v and not URL_RE.match(v):
                    raise Invalid("Website-adres moet beginnen met https://")
                sec[key] = v
            elif key == "disallow":
                paths = [str(p).strip() for p in (val or []) if str(p).strip()]
                if any(not p.startswith("/") or len(p) > 200 for p in paths):
                    raise Invalid("Paden beginnen met een / (bv. /intern).")
                sec[key] = paths[:100]
            elif key == "same_as":
                urls = [str(u).strip() for u in (val or []) if str(u).strip()]
                if any(not URL_RE.match(u) for u in urls):
                    raise Invalid("Sociale profielen moeten volledige URL's zijn (https://…).")
                sec[key] = urls[:20]
            elif key == "changefreq":
                if val not in d.FREQ:
                    raise Invalid("Ongeldige frequentie.")
                sec[key] = val
            elif key == "type":
                if val not in d.SCHEMA_TYPES:
                    raise Invalid("Ongeldig type.")
                sec[key] = val
            elif key == "ai_meta":
                if val not in ("allow", "noai"):
                    raise Invalid("Ongeldige keuze.")
                sec[key] = val
            elif key == "crawl_delay":
                if not isinstance(val, int) or isinstance(val, bool) or not 0 <= val <= 60:
                    raise Invalid("Crawl-delay: 0 tot 60 seconden.")
                sec[key] = val
            elif key == "priority":
                if not isinstance(val, (int, float)) or isinstance(val, bool) or not 0 <= val <= 1:
                    raise Invalid("Prioriteit: tussen 0 en 1.")
                sec[key] = val
            elif kind is bool:
                sec[key] = bool(val)
            elif kind is str:
                sec[key] = str(val or "")[:2000 if key in ("extra", "summary", "description", "default_description") else 300]
        out[section] = sec
    return out


def save(cleaned):
    obj, _ = SeoSettings.objects.get_or_create(pk=1)
    stored = obj.data or {}
    for sec, vals in cleaned.items():
        stored.setdefault(sec, {}).update(vals)
    obj.data = stored
    obj.save()
    return raw()


# ── helpers for output ──────────────────────────────────────────────────────
def pages():
    """[(path, label)] of all pages that exist: built-ins (when their module is on) plus custom paths."""
    out = [(p, label) for p, label, mod in d.KNOWN_PAGES if not mod or modules.enabled(mod)]
    known = {p for p, _ in out}
    for p in SeoPage.objects.values_list("path", flat=True).distinct():
        if p not in known:
            out.append((p, p))
    return out


def sitemap_urls():
    """[(path, label)] for sitemap.xml and llms.txt: the pages above plus products and public member profiles."""
    out = list(pages())
    if modules.enabled("products"):
        from apps.shop.models import Product

        out += [(f"/producten/{slug}", name) for slug, name in Product.objects.filter(active=True).values_list("slug", "name")]
    if modules.enabled("profiles"):
        from apps.social.models import Profile

        out += [(f"/leden/{slug}", name or slug) for slug, name in
                Profile.objects.filter(enabled=True, visibility="public", searchable_public=True, user__is_active=True).values_list("slug", "headline")]
    return out


def base_url(request_base=None):
    s = get()["site"]["site_url"] or (request_base or "").rstrip("/")
    return s


def public_url(path, base):
    return f"{base}{path if path != '/' else '/'}" if base else path


def og_image_url(item_id, base=None):
    from django.core.files.storage import default_storage

    item = MediaItem.objects.filter(pk=item_id).first() if item_id else None
    if not item:
        return None
    url = default_storage.url(item.key)
    return url
