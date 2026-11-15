# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Web templates: a whole starting website as one zip (resource/templates/<key>-<version>.zip, the library of the product; a superadmin can add more).

A template zip holds
  template.json   {"format": "easy2edit-template", "version": 1, "key", "name", "description", "version", "author", "previews": ["previews/home.jpg", ...],
                   "pages": "pages.zip", "theme": "theme.zip" (optional), "components": "<key of a component set>" (optional)}
  pages.zip       the pages with their pictures, blocks and menu: a package of the page export (selected_pages.zip: a folder per page, with menu.json)
  theme.zip       (optional) a theme package; it is installed and put in use
  previews/...    example pictures that the choice screen shows

Using a template puts these pages in the site (as copies, or in place of the pages that exist already); after that everything is the website of the user, who changes it
in the editor like any other page."""
import io
import json
import re
import zipfile
from pathlib import Path

from django.conf import settings

FORMAT = "easy2edit-template"
KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,59}$")
MAX_ZIP = 120 * 2**20
MAX_PREVIEW = 3 * 2**20
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")


class TemplateError(ValueError):
    pass


def library_dir():
    return Path(settings.RESOURCE_DIR) / "templates"


def site_dir():
    d = Path(settings.TEMPLATES_DIR)
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    return d


def _ver(v):
    from apps.plugins import manifest as mf

    return mf.ver(v)


def _names(zf):
    return [n for n in zf.namelist() if not n.endswith("/") and "__MACOSX" not in n and ".." not in n.split("/") and not n.rsplit("/", 1)[-1].startswith("._")]


def read(path_or_bytes):
    """The manifest of a template zip (checked). Raises TemplateError when it is not a template."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(path_or_bytes) if isinstance(path_or_bytes, (bytes, bytearray)) else path_or_bytes)
    except (zipfile.BadZipFile, OSError):
        raise TemplateError("Dit is geen template (geen geldig zipbestand).")
    with zf:
        names = set(_names(zf))
        if "template.json" not in names:
            raise TemplateError("template.json ontbreekt in het zipbestand.")
        try:
            d = json.loads(zf.read("template.json").decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise TemplateError("template.json is geen geldige JSON.")
        if not isinstance(d, dict) or d.get("format") != FORMAT:
            raise TemplateError("Dit is geen easy2edit-template.")
        key = str(d.get("key") or "")
        if not KEY_RE.match(key):
            raise TemplateError("De template heeft geen geldige key (letters, cijfers, - en _).")
        pages = str(d.get("pages") or "pages.zip")
        if pages not in names:
            raise TemplateError("pages.zip ontbreekt in de template.")
        theme = str(d.get("theme") or "")
        if theme and theme not in names:
            raise TemplateError("Het themapakket van de template ontbreekt.")
        previews = [p for p in (d.get("previews") or []) if isinstance(p, str) and p in names and p.lower().endswith(IMG_EXT)][:12]
        for p in previews:
            if zf.getinfo(p).file_size > MAX_PREVIEW:
                raise TemplateError(f"De voorbeeldafbeelding {p} is te groot (max 3 MB).")
        return {"key": key, "name": str(d.get("name") or key)[:80], "description": str(d.get("description") or "")[:600], "version": str(d.get("version") or "1.0.0"),
                "author": str(d.get("author") or "")[:80], "previews": previews, "pages": pages, "theme": theme, "components": str(d.get("components") or "")[:60]}


def _zips(folder):
    out = {}
    for f in sorted(Path(folder).glob("*.zip")):
        try:
            m = read(f)
        except TemplateError:
            continue
        if m["key"] not in out or _ver(m["version"]) > _ver(out[m["key"]][1]["version"]):
            out[m["key"]] = (f, m)
    return out


def all_templates():
    """{key: (path, manifest, origin)}: the library of the product and what a superadmin added on this site (the site wins at an equal or newer version)."""
    out = {k: (f, m, "product") for k, (f, m) in _zips(library_dir()).items()}
    for k, (f, m) in _zips(site_dir()).items():
        if k not in out or _ver(m["version"]) >= _ver(out[k][1]["version"]):
            out[k] = (f, m, "site")
    return out


def listing():
    rows = []
    for k, (f, m, origin) in sorted(all_templates().items(), key=lambda kv: kv[1][1]["name"].lower()):
        rows.append({"key": k, "name": m["name"], "description": m["description"], "version": m["version"], "author": m["author"], "origin": origin, "size": f.stat().st_size,
                     "previews": len(m["previews"]), "has_theme": bool(m["theme"]), "components": m["components"]})
    return rows


def preview(key, n):
    """The bytes and the type of the n-th example picture."""
    t = all_templates().get(key)
    if not t or not (0 <= n < len(t[1]["previews"])):
        raise TemplateError("Niet gevonden.")
    name = t[1]["previews"][n]
    with zipfile.ZipFile(t[0]) as zf:
        return zf.read(name), ("image/png" if name.lower().endswith(".png") else "image/webp" if name.lower().endswith(".webp") else "image/jpeg")


def add_upload(upload):
    """A superadmin adds a template (zip). It is checked, and kept as <key>-<version>.zip in the library (resource/templates); when that folder cannot be written to, in the site folder."""
    if getattr(upload, "size", 0) > MAX_ZIP:
        raise TemplateError("Het zipbestand is te groot.")
    data = b"".join(upload.chunks()) if hasattr(upload, "chunks") else upload.read()
    m = read(data)
    name = f"{m['key']}-{m['version']}.zip"
    for folder in (library_dir(), site_dir()):
        try:
            folder.mkdir(parents=True, exist_ok=True)
            for old in folder.glob("*.zip"):  # only the latest version of a template is kept
                try:
                    if read(old)["key"] == m["key"]:
                        old.unlink()
                except (TemplateError, OSError):
                    pass
            (folder / name).write_bytes(data)
            return m
        except OSError:
            continue
    raise TemplateError("De map voor templates kan niet worden beschreven.")


def remove(key):
    t = all_templates().get(key)
    if not t:
        raise TemplateError("Deze template bestaat niet.")
    for folder in (library_dir(), site_dir()):
        for f in Path(folder).glob("*.zip"):
            try:
                if read(f)["key"] == key:
                    f.unlink()
            except (TemplateError, OSError):
                pass


def apply(key, user, mode="copy"):
    """Put the template in this website: its theme (when it brings one) and component set, then its pages with pictures and menu. Returns what was done."""
    from apps.pages import portable

    from . import componentpacks, themepacks

    t = all_templates().get(key)
    if not t:
        raise TemplateError("Deze template bestaat niet.")
    mode = mode if mode in ("copy", "replace", "skip") else "copy"
    m = t[1]
    notes = []
    with zipfile.ZipFile(t[0]) as zf:
        if m["theme"]:
            try:
                keys = themepacks.install_zip(zf.read(m["theme"]))
                if keys:
                    themepacks.use(keys[0])
                    notes.append(f"Thema {keys[0]} is in gebruik.")
            except themepacks.ThemeError as e:
                notes.append(f"Het thema kon niet worden gebruikt: {e}")
        pages_bytes = zf.read(m["pages"])
    if m["components"]:
        try:
            if m["components"] not in componentpacks.installed_map():
                componentpacks.install(m["components"])
            componentpacks.activate(m["components"])
            notes.append(f"Componentenset {m['components']} is in gebruik.")
        except componentpacks.ComponentError as e:
            notes.append(f"De componentenset kon niet worden gebruikt: {e}")
    try:
        out = portable.import_any(pages_bytes, user, None, mode, True)
    except portable.PortableError as e:
        raise TemplateError(str(e))
    return {"template": key, "pages": out["pages"], "replaced": out["replaced"], "skipped": out["skipped"], "media": out["media"], "blocks": out["blocks"], "menu_items": out["menu_items"],
            "notes": notes + list(out["notes"])[:20], "warnings": out["warnings"]}
