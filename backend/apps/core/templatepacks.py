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
import logging
import re
import zipfile
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)
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
        system = str(d.get("system") or "")  # a full template: the settings of the system (system.json) and the pages (site.json with media/)
        pages = str(d.get("pages") or ("" if system else "pages.zip"))
        if pages and pages not in names:
            raise TemplateError("pages.zip ontbreekt in de template.")
        if system and (system not in names or "site.json" not in names):
            raise TemplateError("system.json of site.json ontbreekt in de template.")
        if not pages and not system:
            raise TemplateError("De template heeft geen pagina's en geen systeemgegevens.")
        theme = str(d.get("theme") or "")
        if theme and theme not in names:
            raise TemplateError("Het themapakket van de template ontbreekt.")
        previews = [p for p in (d.get("previews") or []) if isinstance(p, str) and p in names and p.lower().endswith(IMG_EXT)][:12]
        for p in previews:
            if zf.getinfo(p).file_size > MAX_PREVIEW:
                raise TemplateError(f"De voorbeeldafbeelding {p} is te groot (max 3 MB).")
        return {"key": key, "name": str(d.get("name") or key)[:80], "description": str(d.get("description") or "")[:600], "version": str(d.get("version") or "1.0.0"),
                "author": str(d.get("author") or "")[:80], "previews": previews, "pages": pages, "theme": theme, "components": str(d.get("components") or "")[:60],
                "system": system, "requires": d.get("requires") if isinstance(d.get("requires"), dict) else {}}


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
                     "previews": len(m["previews"]), "has_theme": bool(m["theme"]), "components": m["components"], "system": bool(m["system"]), "has_pages": bool(m["pages"]),
                     "built_for": str((m["requires"] or {}).get("system_version") or "")})
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
    return _store(data, read(data))


def _store(data, m):
    """Keep a checked template zip as <key>-<version>.zip in the library (resource/templates), or in the site folder when the library cannot be written to; older versions of it go."""
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


def apply(key, user, mode="copy", scope="pages"):
    """Put the template in this website: its theme (when it brings one) and component set, then its pages with pictures and menu. Returns what was done."""
    from apps.pages import portable

    from . import componentpacks, themepacks

    t = all_templates().get(key)
    if not t:
        raise TemplateError("Deze template bestaat niet.")
    if scope == "system":
        return apply_system(key, user)
    if not t[1]["pages"]:
        raise TemplateError("Deze template bevat alleen een volledig systeem: zet het hele systeem terug.")
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


# ── a template from the current design: the settings of the system and the pages, without the data of users ──
SYSTEM_SECTIONS = ("branding", "theme", "themepacks", "installations", "modules", "languages", "dashboard", "plugins")  # no users, no secrets, no e-mail identities, no licence, no security keys


def _pages_zip(keys=None):
    """The own public pages as a page-export package (the old, small way to use a template), b"" when there are none."""
    from apps.pages import portable
    from apps.pages.models import Page

    ps = list(Page.objects.filter(kind="content", scope="public").order_by("order", "id"))
    if keys is not None:
        ps = [p for p in ps if p.key in keys]
    if not ps:
        return b""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in ps:
            for path, raw in portable.build(p, True).items():
                z.writestr(f"{p.key}/{path}", raw)
        z.writestr(portable.MENU_FILE, json.dumps(portable.menu_file(ps), indent=2, ensure_ascii=False))
    return buf.getvalue()


def _drawn_preview(colors):
    """An example picture drawn in the colours of the theme (when no screenshots were made)."""
    from PIL import Image, ImageDraw

    im = Image.new("RGB", (1200, 750), colors[0])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 1200, 70], fill=colors[1])
    d.rectangle([80, 170, 700, 230], fill=colors[1])
    d.rectangle([80, 260, 600, 285], fill=colors[3])
    d.rectangle([80, 305, 540, 330], fill=colors[3])
    d.rounded_rectangle([80, 380, 300, 440], 14, fill=colors[2])
    d.rounded_rectangle([760, 150, 1120, 560], 18, fill=colors[4])
    for i in range(3):
        d.rounded_rectangle([80 + i * 340, 600, 380 + i * 340, 710], 14, fill=colors[4])
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def site_pages():
    """The pages that can go in a template: the home page and the own public pages. Each with whether it belongs to the current design (default), and if not why: a module that is off (the page gives a 404),
    a page of a standard website that was put on the site earlier, or a page that is switched off. Pages of an earlier design or demo must not end up in a template by accident."""
    from apps.pages import service as pages_service
    from apps.pages.models import Page

    def name(p):  # the title is a text per language: {"nl": "...", "en": "..."}
        t = p.title
        return str(t.get("nl") or t.get("en") or next(iter(t.values()), "") or p.key) if isinstance(t, dict) else str(t or p.key)

    out = []
    qs = Page.objects.filter(scope="public").filter(models_q_pages()).order_by("order", "id")
    for p in qs:
        reason = ""
        if not p.enabled:
            reason = "Staat uit"
        elif not pages_service.available(p):
            reason = "De module van deze pagina staat uit"
        elif str(p.source or "").startswith("preset:") or p.source == "demo":
            reason = "Uit een standaardwebsite of demo, niet van dit ontwerp"
        out.append({"key": p.key, "title": name(p), "path": "/" if p.key == "home" else (p.path or f"/p/{p.key}"), "default": not reason, "reason": reason})
    out.sort(key=lambda r: (r["key"] != "home", not r["default"]))
    return out


def models_q_pages():
    from django.db.models import Q

    return Q(key="home") | Q(kind="content")


def _menu_keys():
    """The menu items (links) of an imported design: they go with the template as soon as a page does."""
    from apps.pages.models import Page

    return set(Page.objects.filter(scope="public", enabled=True, kind__in=("link", "menu"), source__startswith="import:").values_list("key", flat=True))


def suggest_details(lang=""):
    """The details of a template, from this website itself: its name and tagline (settings of the site), its own pages and their texts, the theme, the modules and plugins that are on and the languages.
    The AI (when it is linked) words them nicely in the chosen language; without the AI, or when it gives no usable answer, they are made of the same facts. Returns {name, key, description, version, source}."""
    from apps.integrations import ai
    from apps.plugins.models import Plugin

    from .models import ContentBlock, Language, ModuleState, SiteSettings, SystemSettings

    row = Language.objects.filter(code=str(lang or "")).first() or Language.objects.filter(is_default=True).first()
    code, lang_name = (row.code, row.native_name or row.name) if row else ("nl", "Nederlands")
    sd = (SystemSettings.objects.filter(pk=1).first().data if SystemSettings.objects.filter(pk=1).exists() else {}) or {}
    site_name = next((str(sd.get(k)).strip() for k in ("installation_name", "site_name", "company_name") if str(sd.get(k) or "").strip()), "")
    tagline = str(sd.get("tagline") or "").strip()
    pages = [p for p in site_pages() if p["default"]]
    texts = []
    for p in pages[:8]:
        qs = ContentBlock.objects.filter(key__startswith=f"layout.{p['key']}.", lang=code) or ContentBlock.objects.filter(key__startswith=f"layout.{p['key']}.", lang="nl")
        snippet = " ".join(dict.fromkeys(richtext_plain(b.text) for b in qs.order_by("key")[:12] if richtext_plain(b.text).strip()))[:400]
        texts.append(f"- {p['title']}" + (f": {snippet}" if snippet else ""))
    th = SiteSettings.load().theme or {}
    mods = sorted(ModuleState.objects.filter(enabled=True).values_list("key", flat=True))
    plugins = [p.title or p.name for p in Plugin.objects.filter(enabled=True)]
    langs = list(Language.objects.filter(enabled=True).values_list("code", flat=True))
    existing = {r["key"] for r in listing()}
    # what the site itself gives
    own_name = site_name or (pages[0]["title"] if pages else "")
    own_desc = " ".join(x for x in (tagline, ("Met de pagina's " + ", ".join(p["title"] for p in pages[:8]) + ".") if pages else "", ("Plugins: " + ", ".join(plugins[:6]) + ".") if plugins else "") if x)[:600]
    name, desc, source = own_name, own_desc, "site"
    if ai.available():
        prompt = (f"This is a website that becomes a ready-made template for other websites.\nName of the site: {site_name or '-'}\nTagline: {tagline or '-'}\nOwn pages and their texts:\n" + "\n".join(texts or ["(no own pages yet)"]) +
                  f"\n\nTheme colours: primary {th.get('primary', '-')}, secondary {th.get('secondary', '-')}; modules on: {', '.join(mods) or '-'}; plugins on: {', '.join(plugins) or '-'}; languages: {', '.join(langs) or '-'}.\n\n"
                  f"Write in {lang_name}: a short fitting name for the template (2 to 4 words; use the name of the site when it has a good one) and a description of 2 to 3 sentences: for whom it is, what is in it (pages, functions) and the look. "
                  "Use only what is given above; do not invent facts. " 'Answer ONLY with JSON: {"name": "...", "description": "..."}')
        try:
            out = ai.claude("You name and describe website templates. Reply with ONLY a JSON object.", prompt, max_tokens=500, timeout=60)
            m = re.search(r"\{.*\}", out or "", re.S)
            d = json.loads(m.group(0)) if m else {}
            if str(d.get("name") or "").strip():
                name, source = str(d["name"]).strip()[:80], "ai"
                desc = str(d.get("description") or "").strip()[:1500] or own_desc
        except ValueError as e:
            if "Koppel Claude" in str(e) or "tegoed" in str(e).lower():
                raise TemplateError(str(e))
        except Exception:  # noqa: BLE001
            logger.warning("template details by the AI failed", exc_info=True)
    if not name:
        raise TemplateError("Er is geen naam te vinden op deze website: vul zelf een naam in.")
    key = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]
    version = "1.0.0"
    if key in existing:  # a template with this name exists: the next patch version
        a, b, c = (list(map(int, str(_old_version(key)).split("."))) + [0, 0, 0])[:3]
        version = f"{a}.{b}.{c + 1}"
    return {"name": name, "key": key, "description": desc, "version": version, "source": source}


def richtext_plain(t):
    from . import richtext

    return richtext.plain(str(t or "").replace("html:", "", 1))


def _old_version(key):
    t = all_templates().get(key)
    return (t[1]["version"] if t else "1.0.0") if re.fullmatch(r"\d+\.\d+\.\d+", str(t[1]["version"] if t else "1.0.0")) else "1.0.0"


def build_from_site(key, name, description="", author="", version="1.0.0", previews=(), pages=None):
    """Make a template of this website as it is now and put it in the library (resource/templates/<key>-<version>.zip):
      system.json   the settings of the system (theme, modules, languages, plugins with their settings, standard dashboard, branding), no data of users, no secrets
      site.json     the pages, menu, layouts and texts that are not standard, with media/ (the pictures that they use)
      pages.zip     the own pages as a package of the page export (for the old way of using a template: only the pages)
      previews/     example pictures for the choice screen and the demo
      requires      what the template was made on (version of the system, plugins, component set, languages, modules), to check it after it was read in
    previews: [(file name, bytes)]. pages: the keys of the pages that go in (default: the pages that belong to the current design, see site_pages). Returns the manifest."""
    from django.conf import settings

    from apps.backups import service as bs
    from apps.plugins.models import Plugin

    from . import componentpacks, richtext, settings_backup as sb
    from .models import Language, ModuleState, SiteSettings

    key = str(key or "").strip().lower()
    if not KEY_RE.match(key):
        raise TemplateError("De key van de template is ongeldig (2-60 tekens: a-z, 0-9, - en _).")
    name = str(name or "").strip()[:80] or key
    version = str(version or "1.0.0").strip()
    if not re.fullmatch(r"\d{1,4}\.\d{1,4}\.\d{1,4}", version):
        raise TemplateError("De versie moet er zo uitzien: 1.0.0.")
    description = richtext.plain(richtext.clean_small(description, 1500)) if description else ""
    bundle = sb.export(list(SYSTEM_SECTIONS), False, True, {"include_data": False})  # (no secrets, and no rows of the tables of plugins: those are data of users)
    chosen = set(pages) if pages else {p["key"] for p in site_pages() if p["default"]}
    only = chosen | (_menu_keys() if chosen else set())
    site, files, skipped = bs.collect_site(only)
    pages_zip = _pages_zip(chosen)
    try:
        comp = componentpacks.active_key() or ""
    except Exception:  # noqa: BLE001
        comp = ""
    requires = {"system_version": settings.SYSTEM_VERSION, "plugins": {p.name: {"version": p.version, "enabled": bool(p.enabled)} for p in Plugin.objects.all()}, "components": comp,
                "languages": list(Language.objects.values_list("code", flat=True)), "modules": sorted(ModuleState.objects.filter(enabled=True).values_list("key", flat=True)),
                "pages": [r["key"] for r in site["pages"]]}
    good = [(n, b) for n, b in previews if n.lower().endswith(IMG_EXT) and 0 < len(b) <= MAX_PREVIEW][:12]
    if not good:
        th = SiteSettings.load().theme or {}
        good = [("home.jpg", _drawn_preview([th.get("light_page") or "#f7f5f2", th.get("primary") or "#1f2a37", th.get("secondary") or "#f0833a", th.get("light_line") or "#d9d6d1", th.get("light_card") or "#ffffff"]))]
    man = {"format": FORMAT, "version": 1, "key": key, "name": name, "description": description, "version": version, "author": str(author or "")[:80], "system": "system.json", "previews": [],
           "requires": requires}
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for i, (n, raw) in enumerate(good):
            ext = Path(n).suffix.lower() or ".jpg"
            z.writestr(f"previews/{i + 1}{ext}", raw)
            man["previews"].append(f"previews/{i + 1}{ext}")
        if pages_zip:
            z.writestr("pages.zip", pages_zip)
            man["pages"] = "pages.zip"
        z.writestr("system.json", json.dumps(bundle, ensure_ascii=False))
        z.writestr("site.json", json.dumps(site, ensure_ascii=False))
        for path, raw in files.items():
            z.writestr(path, raw)
        z.writestr("template.json", json.dumps(man, indent=2, ensure_ascii=False))
    data = out.getvalue()
    if len(data) > MAX_ZIP:
        raise TemplateError("De template is te groot (meer dan 120 MB).")
    m = read(data)  # it must pass its own check
    _store(data, m)
    return {**m, "skipped": skipped, "errors": bundle.get("errors") or {}}


def _prune_site(site):
    """Remove what is not in the template: the own pages (content, links, menus) with their layouts and texts that the template does not have. The standard pages and texts of the system stay."""
    from apps.backups import service as bs
    from apps.pages.models import Page, PageLayout

    from .models import ContentBlock

    keep = {r["key"] for r in site.get("pages", []) if r.get("key")}
    gone = list(Page.objects.filter(kind__in=("content", "link", "menu")).exclude(key__in=keep).values_list("key", flat=True))
    Page.objects.filter(key__in=gone).delete()
    n_layouts = 0
    for l in PageLayout.objects.exclude(key__in=list((site.get("layouts") or {}).keys())):
        if not bs._standard_layout(l.key, l.data):
            l.delete()
            n_layouts += 1
    std = bs._standard_texts()
    have = {(b["key"], b["lang"]) for b in site.get("content", []) if b.get("key")}
    n_texts = 0
    for b in ContentBlock.objects.all():
        if std.get((b.key, b.lang)) != b.text and (b.key, b.lang) not in have:
            b.delete()
            n_texts += 1
    return f"Verwijderd wat niet in de template zit: {len(gone)} pagina('s), {n_layouts} indeling(en) en {n_texts} tekst(en)."


def apply_system(key, user):
    """Put the whole template in this system: first a back-up of everything (so it can be undone), then the settings (theme, modules, languages, plugins, dashboard, branding), the component set
    and the pages with their pictures; at last a check whether everything is as the template says (and what can be repaired is repaired). Returns what was done and the check."""
    from apps.backups import service as bs

    from . import componentpacks, modules, resources, settings_backup as sb

    t = all_templates().get(key)
    if not t:
        raise TemplateError("Deze template bestaat niet.")
    m = t[1]
    if not m["system"]:
        raise TemplateError("Deze template bevat geen systeemgegevens (alleen pagina's).")
    safety = bs.create("restore", user, f"Automatisch, vlak voor het gebruiken van de template {key}")
    notes = []
    req = m["requires"] or {}
    with zipfile.ZipFile(t[0]) as zf:
        bundle = json.loads(zf.read(m["system"]))
        for name in (req.get("plugins") or {}):  # a plugin that the template needs and that is not here: from the library of the product (the settings file may bring it too)
            from apps.plugins.models import Plugin

            if not Plugin.objects.filter(name=name).exists() and not any(i.get("name") == name and i.get("zip_b64") for i in ((bundle.get("sections") or {}).get("plugins") or {}).get("data", {}).get("plugins", [])):
                try:
                    resources.install("plugins", name, user)
                    notes.append(f"Plugin {name} is uit de bibliotheek geïnstalleerd.")
                except Exception as e:  # noqa: BLE001
                    notes.append(f"Plugin {name} kon niet worden geïnstalleerd: {e}")
        results = sb.load(bundle, list(bundle.get("sections", {}).keys()), mode="overwrite")
        try:
            from django.db import transaction

            site_doc = json.loads(zf.read("site.json"))
            with transaction.atomic():
                notes.append(_prune_site(site_doc))  # first away with the pages and texts of the website as it was: the site becomes what the template says
                notes.append(bs._restore_site(zf))
        except Exception as e:  # noqa: BLE001
            notes.append(f"De pagina's konden niet worden teruggezet: {e}")
    if req.get("components"):
        try:
            if req["components"] not in componentpacks.installed_map():
                componentpacks.install(req["components"])
            componentpacks.activate(req["components"])
            notes.append(f"Componentenset {req['components']} is in gebruik.")
        except componentpacks.ComponentError as e:
            notes.append(f"De componentenset kon niet worden gebruikt: {e}")
    modules.invalidate()
    return {"template": key, "scope": "system", "safety_backup": safety.file, "results": results, "notes": notes, "check": verify(key, user=user)}


def verify(key, fix=True, user=None):
    """Check a system after a template was read in: the modules, plugins, component set, theme, languages, pages and pictures as the template says, and the database (migrations, the checks of Django).
    With fix, what is wrong and can be repaired (a module that is off, a plugin or component set that is missing, the theme) is repaired once. Returns {"ok", "items": [{key, label, ok, detail, fixed}]}."""
    from django.conf import settings
    from django.core.files.storage import default_storage

    from apps.plugins.models import Plugin

    from . import componentpacks, modules, resources, settings_backup as sb
    from .models import Language, ModuleState, SiteSettings

    t = all_templates().get(key)
    if not t:
        raise TemplateError("Deze template bestaat niet.")
    m = t[1]
    req = m["requires"] or {}
    items = []

    def add(k, label, ok, detail="", fixed=False):
        items.append({"key": k, "label": label, "ok": bool(ok), "detail": detail, "fixed": bool(fixed)})

    built = str(req.get("system_version") or "")
    if built and _ver(built) > _ver(settings.SYSTEM_VERSION):
        add("version", "Versie van het systeem", False, f"De template is gemaakt op een nieuwere versie ({built}) dan deze ({settings.SYSTEM_VERSION}): werk het systeem eerst bij.")
    else:
        add("version", "Versie van het systeem", True, f"Template gemaakt op {built or '?'}, dit systeem is {settings.SYSTEM_VERSION}." + (" Een paar updates kunnen ontbreken: zie de lijst." if built and built != settings.SYSTEM_VERSION else ""))

    want = set(req.get("modules") or [])
    off = {k for k in want if not ModuleState.objects.filter(key=k, enabled=True).exists() and k in modules.BY_KEY}
    unknown = sorted(k for k in want if k not in modules.BY_KEY)
    if off and fix:
        for k in off:
            ModuleState.objects.update_or_create(key=k, defaults={"enabled": True})
        modules.invalidate()
    left = {k for k in want if k in modules.BY_KEY and not ModuleState.objects.filter(key=k, enabled=True).exists()}
    add("modules", "Modules", not left, (f"{len(want)} module(s) staan aan zoals in de template" if not left else f"Staan nog uit: {', '.join(sorted(left))}") + (f"; hersteld: {', '.join(sorted(off - left))}" if off - left else "") + (f"; onbekend in dit systeem: {', '.join(unknown)}" if unknown else ""), fixed=bool(off - left))

    for name, info in (req.get("plugins") or {}).items():
        row = Plugin.objects.filter(name=name).first()
        fixed = False
        if not row and fix and user is not None:
            try:
                resources.install("plugins", name, user)
                fixed = True
                row = Plugin.objects.filter(name=name).first()
            except Exception:  # noqa: BLE001
                row = None
        if not row:
            add(f"plugin:{name}", f"Plugin {name}", False, "Niet geïnstalleerd en niet in de bibliotheek gevonden.")
            continue
        old = _ver(row.version) < _ver(str(info.get("version") or "0.0.0"))
        lib = next((e for e in resources.catalog("plugins") if e["name"] == name), None)
        newer = bool(lib and _ver(lib["version"]) > _ver(row.version))
        problem = (not row.enabled and bool(info.get("enabled"))) or bool(row.error)
        add(f"plugin:{name}", f"Plugin {name}", not problem and not old, f"Versie {row.version}" + (" (nieuwer in de bibliotheek: een update ligt klaar)" if newer else "") + (f"; staat uit of heeft een fout: {row.error or 'uit'}" if problem else "") + ("; ouder dan de template" if old else ""), fixed)

    comp = req.get("components") or ""
    if comp:
        fixed = False
        if componentpacks.active_key() != comp and fix:
            try:
                if comp not in componentpacks.installed_map():
                    componentpacks.install(comp)
                componentpacks.activate(comp)
                fixed = True
            except componentpacks.ComponentError:
                pass
        add("components", "Componentenset", componentpacks.active_key() == comp, f"{comp} is in gebruik" if componentpacks.active_key() == comp else f"In gebruik is {componentpacks.active_key()}, de template wil {comp}", fixed)

    with zipfile.ZipFile(t[0]) as zf:
        bundle = json.loads(zf.read(m["system"])) if m["system"] else {"sections": {}}
        site = json.loads(zf.read("site.json")) if "site.json" in zf.namelist() else {}
    want_theme = (((bundle.get("sections") or {}).get("theme") or {}).get("data")) or {}
    if want_theme:
        now = SiteSettings.load().theme or {}
        same = all(now.get(k) == v for k, v in want_theme.items())
        fixed = False
        if not same and fix:
            sb.load(bundle, ["theme"], mode="overwrite")
            now = SiteSettings.load().theme or {}
            same = all(now.get(k) == v for k, v in want_theme.items())
            fixed = same
        add("theme", "Vormgeving (thema)", same, "Kleuren, lettertypen en hoeken zijn zoals in de template." if same else "De vormgeving wijkt af van de template.", fixed)

    codes = req.get("languages") or []
    missing = [c for c in codes if not Language.objects.filter(code=c).exists()]
    add("languages", "Talen", not missing, f"{len(codes)} taal/talen aanwezig" if not missing else f"Ontbreken: {', '.join(missing)}")

    from apps.pages.models import Page

    keys = [r.get("key") for r in site.get("pages", []) if r.get("key")]
    gone = [k for k in keys if not Page.objects.filter(key=k).exists()]
    add("pages", "Pagina's en menu", not gone, f"{len(keys)} pagina('s) aanwezig" if not gone else f"Ontbreken: {', '.join(gone)}")

    from apps.medialib.models import MediaItem

    bad = []
    for old_id, it in (site.get("media") or {}).items():
        k = it.get("key")
        row = MediaItem.objects.filter(key=k).first()
        if not row or not default_storage.exists(row.key):
            bad.append(it.get("name") or k)
    add("media", "Afbeeldingen en video's", not bad, f"{len(site.get('media') or {})} bestand(en) aanwezig" if not bad else f"Ontbreken: {', '.join(bad[:8])}")

    try:
        from django.core.checks import run_checks
        from django.db import connection
        from django.db.migrations.executor import MigrationExecutor

        ex = MigrationExecutor(connection)
        plan = ex.migration_plan(ex.loader.graph.leaf_nodes())
        add("migrations", "Database: updates (migraties)", not plan, "Alle database-updates zijn uitgevoerd." if not plan else f"{len(plan)} update(s) van de database zijn nog niet uitgevoerd: draai 'manage.py migrate'.")
        errs = [e for e in run_checks() if e.level >= 40]
        add("django", "Database en instellingen (controle van Django)", not errs, "Geen fouten gevonden." if not errs else "; ".join(f"{e.id}: {e.msg}"[:140] for e in errs[:5]))
        if connection.vendor == "sqlite":
            with connection.cursor() as c:
                c.execute("PRAGMA foreign_key_check")
                broken = c.fetchall()
            add("integrity", "Database: koppelingen tussen tabellen", not broken, "Alle koppelingen kloppen." if not broken else f"{len(broken)} koppeling(en) wijzen naar iets dat er niet is.")
    except Exception as e:  # noqa: BLE001
        add("django", "Database", False, f"De controle kon niet draaien: {e}")
    return {"ok": all(i["ok"] for i in items), "items": items}
