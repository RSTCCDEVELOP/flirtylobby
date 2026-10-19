"""plugin.json: what a plugin tells the system about itself."""
import json
import re

NAME_RE = re.compile(r"^[a-z][a-z0-9-]{1,38}[a-z0-9]$")
CONFIG_TYPES = ("text", "textarea", "number", "bool", "select", "secret")
ACCESS = ("admin", "members")
MENU_GROUPS = ("mine", "contact", "other")  # where in the member dashboard a plugin page sits: Mijn community, Contact, or loose in the menu
SECTIONS = ("users", "website", "community", "shop", "subscription", "system")  # the parts of the admin menu a plugin can belong to
VER_RE = re.compile(r"^\d{1,4}\.\d{1,4}\.\d{1,4}$")


class ManifestError(ValueError):
    pass


def parse(raw):
    """Validate a plugin.json (bytes or str). Returns a clean dict."""
    try:
        d = json.loads(raw)
    except (TypeError, ValueError):
        raise ManifestError("plugin.json is geen geldige JSON.")
    if not isinstance(d, dict):
        raise ManifestError("plugin.json moet een object zijn.")
    name = str(d.get("name") or "").strip()
    if not NAME_RE.match(name):
        raise ManifestError("De naam in plugin.json is ongeldig (3-40 tekens: a-z, 0-9 en -, begint met een letter).")
    out = {
        "name": name, "title": str(d.get("title") or name)[:100], "version": _ver(d.get("version"), "version"), "system_version": _ver(d.get("system_version") or "0.0.0", "system_version"),
        "schema": max(0, int(d.get("schema") or 0)) if str(d.get("schema") or 0).isdigit() else 0,
        "description": str(d.get("description") or "")[:2000], "author": str(d.get("author") or "")[:100],
        "python": _file(d.get("python"), ".py"), "web": _file(d.get("web"), ".html"), "admin_web": _file(d.get("admin_web"), ".html"), "settings_web": _file(d.get("settings_web"), ".html"), "blocks_page": str(d.get("blocks_page") or "") if re.fullmatch(r"[a-z][a-z0-9-]{1,40}", str(d.get("blocks_page") or "")) else "", "admin_links": _admin_links(d.get("admin_links")),
        "permissions": [str(x)[:60] for x in (d.get("permissions") or []) if isinstance(x, str)][:30],
        "events": [str(x)[:40] for x in (d.get("events") or []) if isinstance(x, str)][:30],
        "section": _section(d.get("section")), "menu": None, "public_pages": _public_pages(d.get("public_pages")), "site_link": _site_link(d.get("site_link")), "provides": [x for x in (d.get("provides") or []) if x in PROVIDES],
        "content_dirs": [x for x in (d.get("content_dirs") or []) if isinstance(x, str) and re.fullmatch(r"[a-z][a-z0-9_-]{0,30}", x)][:5], "admin_label": str(d.get("admin_label") or "")[:30], "content_label": str(d.get("content_label") or "")[:30], "content_sdk": str(d.get("content_sdk") or "") if re.fullmatch(r"web/[A-Za-z0-9_.-]{1,60}\.js", str(d.get("content_sdk") or "")) else "", "content_item": str(d.get("content_item") or "")[:40] if re.fullmatch(r"[A-Za-z0-9_.-]{3,40}\.json", str(d.get("content_item") or "")) else "", "public_path": str(d.get("public_path") or "") if re.fullmatch(r"[a-z][a-z0-9-]{1,30}", str(d.get("public_path") or "")) and str(d.get("public_path")) not in RESERVED else "", "page_object": bool(d.get("page_object")) and bool(_file(d.get("web"), ".html")), "config": [], "parts": _parts(d.get("parts")),
    }
    m = d.get("menu")
    if isinstance(m, dict) and out["web"]:
        out["menu"] = {"label": str(m.get("label") or out["title"])[:40], "access": m.get("access") if m.get("access") in ACCESS else "admin", "group": m.get("group") if m.get("group") in MENU_GROUPS else ("contact" if out["section"] == "community" else "other")}
    seen = set()
    for c in d.get("config") or []:
        if not isinstance(c, dict) or not re.fullmatch(r"[a-z][a-z0-9_]{0,30}", str(c.get("key") or "")) or c["key"] in seen:
            raise ManifestError("Een configuratieveld in plugin.json is ongeldig (sleutel: a-z, 0-9, _).")
        t = c.get("type", "text")
        if t not in CONFIG_TYPES:
            raise ManifestError(f"Configuratieveld {c['key']}: onbekend type.")
        seen.add(c["key"])
        out["config"].append({"key": c["key"], "label": str(c.get("label") or c["key"])[:80], "type": t, "default": c.get("default", False if t == "bool" else ""),
                              "options": [str(o)[:60] for o in (c.get("options") or [])][:40] if t == "select" else [], "hint": str(c.get("hint") or "")[:200]})
    return out


PROVIDES = ("catalog",)  # what a plugin may offer the system: catalog = the products that subscriptions can grant and the stock the dashboard shows


def _public_pages(v):
    """Pages for visitors, at an address of the website: [{"path": "producten/<slug>", "file": "web/x.html", "title": "..."}]."""
    out = []
    for x in v or []:
        if not isinstance(x, dict):
            continue
        path = str(x.get("path") or "").strip("/")
        if not re.fullmatch(r"[a-z0-9-]+(/(<[a-z]+>|[a-z0-9-]+))*", path) or path.split("/")[0] in RESERVED:
            raise ManifestError(f"Ongeldig of gereserveerd adres in public_pages: {path or '?'}")
        out.append({"path": path, "file": _file(x.get("file"), ".html"), "title": str(x.get("title") or "")[:80], "noindex": bool(x.get("noindex")), "page": str(x.get("page") or "") if re.fullmatch(r"[a-z][a-z0-9-]{1,40}", str(x.get("page") or "")) else "", "description": str(x.get("description") or "")[:200]})
    return out[:20]


def _admin_links(v):
    """Links to other admin screens that belong to the plugin: [{"href": "/dashboard/admin/orders", "title": "...", "description": "..."}]."""
    out = []
    for x in v or []:
        if isinstance(x, dict) and re.fullmatch(r"/dashboard/[a-z0-9/_-]{1,80}", str(x.get("href") or "")):
            out.append({"href": x["href"], "title": str(x.get("title") or x["href"])[:80], "description": str(x.get("description") or "")[:200]})
    return out[:10]


def _parts(v):
    """Parts of the plugin that can be put on a page in edit mode and moved around (a product overview, the cart ...): [{"key": "products", "title": "...", "file": "web/products.html"}]."""
    out = []
    for x in v or []:
        if isinstance(x, dict) and re.fullmatch(r"[a-z][a-z0-9-]{1,30}", str(x.get("key") or "")) and _file(x.get("file"), ".html"):
            out.append({"key": x["key"], "title": str(x.get("title") or x["key"])[:80], "file": _file(x.get("file"), ".html")})
    return out[:20]


def _site_link(v):
    """A link in the header of the website, optionally with a counter from the plugin's own storage (e.g. the cart)."""
    if not isinstance(v, dict) or not v.get("path"):
        return None
    return {"label": str(v.get("label") or "")[:40], "path": "/" + str(v["path"]).strip("/"), "icon": str(v.get("icon") or "")[:20], "count_store": str(v.get("count_store") or "")[:40]}


RESERVED = {"api", "dashboard", "login", "registreren", "direct", "directconnect", "sandbox", "leden", "p", "abonnementen", "doneren", "privacy", "cookies", "status", "geo-blocked", "404", "sitemap.xml", "robots.txt"}


def match_public(pages, path):
    """(page, params) for a website path like "producten/schoen", or None."""
    parts = path.strip("/").split("/")
    for pg in pages:
        segs = pg["path"].split("/")
        if len(segs) != len(parts):
            continue
        params = {}
        for seg, part in zip(segs, parts):
            if seg.startswith("<"):
                params[seg[1:-1]] = part
            elif seg != part:
                break
        else:
            return pg, params
    return None


def _section(v):
    v = str(v or "system").strip()
    if v not in SECTIONS:
        raise ManifestError(f"Onbekende sectie in plugin.json: {v}. Kies uit {', '.join(SECTIONS)}.")
    return v


def _ver(v, field):
    v = str(v or "").strip()
    if not VER_RE.match(v):
        raise ManifestError(f"Ongeldig versienummer in plugin.json ({field}): gebruik 1.2.3.")
    return v


def ver(v):
    """'1.2.3' -> (1, 2, 3)"""
    try:
        return tuple(int(x) for x in str(v).split(".")[:3]) + (0,) * (3 - len(str(v).split(".")[:3]))
    except ValueError:
        return (0, 0, 0)


def compatibility(built_for, system):
    """How a plugin built for `built_for` stands with the system version `system`:
    current | outdated (older minor version: update the plugin) | incompatible (older major version: does not start) | newer (built for a newer system: update the system)."""
    b, s = ver(built_for), ver(system)
    if b[0] < s[0]:
        return "incompatible"
    if b[0] > s[0]:
        return "newer"
    if b[1] < s[1]:
        return "outdated"
    if b[1] > s[1]:
        return "newer"
    return "current"


def _file(v, ext):
    v = str(v or "").strip()
    if not v:
        return ""
    if v.startswith("/") or ".." in v.split("/") or "\\" in v or not v.endswith(ext):
        raise ManifestError(f"Ongeldig bestandspad in plugin.json: {v}")
    return v
