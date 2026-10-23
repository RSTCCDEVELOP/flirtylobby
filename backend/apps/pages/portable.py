# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Export and import of own pages (pages that were designed with blocks) as zips, to use them in another easy2edit.

    <key>/page.json     the page: name, audience, menu, background, the blocks (layout), ALL linked content (texts per language, picture settings),
                        the system objects it uses and what it needs (modules, plugins)
    <key>/media/…       every picture and video that the page uses (blocks, rows, background, pictures inside texts)

The package holds no colours, fonts or sizes of its own: the page keeps using the theme that is set on the website where it is imported.
Every exported package is kept as <SITE_DIR>/pages/<key>.zip, and so is every imported one. When a package is imported, the modules, plugins and
system objects that it needs are checked and the administrator is warned about what has to be switched on or installed."""
import io
import json
import re
import shutil
import uuid
import zipfile
from datetime import date

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename

from apps.core import richtext
from apps.core.models import ContentBlock, Language
from apps.core.system import limit_mb
from apps.medialib import areas
from apps.medialib.models import IMAGE_EXT, VIDEO_EXT, MediaItem, kind_of

from . import layout as page_layout
from . import service
from .models import Page, PageLayout

FORMAT = "easy2edit-page"
VERSION = 1
MAX_ZIP = 200 * 1024 * 1024
MAX_FILES = 300
MARK = "@"  # in page.json a picture is written as "@media/<file>"; on import it becomes the id of the new library item


class PortableError(ValueError):
    pass


def pages_dir():
    d = settings.SITE_DIR / "pages"
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── export ──────────────────────────────────────────────────────────────────
def _read(item):
    with default_storage.open(item.key) as f:
        return f.read()


def build(page, menus=False):
    """The package of an own page: {path: bytes} (page.json and media/…)."""
    if page.kind != "content":
        raise PortableError("Alleen eigen pagina's kunnen worden geëxporteerd.")
    files, names = {}, {}

    def media(item_id):
        """Add a library file to the package; returns its path in the package ('' when it is gone)."""
        item = MediaItem.objects.filter(pk=item_id).first() if item_id else None
        if not item:
            return ""
        if item.id not in names:
            try:
                raw = _read(item)
            except Exception:  # noqa: BLE001 - a missing file must not stop the export
                return ""
            names[item.id] = f"media/{len(names) + 1:03d}-{get_valid_filename(item.name) or 'bestand'}"
            files[names[item.id]] = raw
        return names[item.id]

    def bg(b):
        path = media((b or {}).get("media")) if (b or {}).get("type") in ("image", "video") else ""
        return {"type": b["type"], "file": path, "overlay": b.get("overlay", 0.35)} if path else {}

    layout = PageLayout.objects.filter(key=page.key).first()
    data = json.loads(json.dumps(layout.data if layout else {"rows": []}))
    data["bg"] = bg(data.get("bg"))
    for r in data.get("rows", []):
        r["bg"] = bg(r.get("bg"))
    slugs = {it["ref"] for r in data.get("rows", []) for c in r.get("cells", []) for it in c.get("items", []) if it.get("type") == "object" and it.get("ref")}

    content = {}
    for b in ContentBlock.objects.filter(key__startswith=f"layout.{page.key}.") | ContentBlock.objects.filter(key__startswith=f"page.{page.key}."):
        text = b.text
        if text.startswith("media:"):
            path = media(int(text[6:] or 0)) if text[6:].isdigit() else ""
            text = f"media:{MARK}{path}" if path else ""
        elif text.startswith(richtext.PREFIX):
            text = re.sub(r'data-media="(\d+)"', lambda m: f'data-media="{MARK}{media(int(m.group(1)))}"', text)
        slugs.update(SYSOBJ_RE.findall(b.text))  # system objects inside the texts (a donation button, a subscription, a game ...)
        content.setdefault(b.key, {})[b.lang] = text

    manifest = {"format": FORMAT, "version": VERSION, "key": page.key, "scope": page.scope, "kind": "content", "title": page.title,
                "audience": page.audience, "in_menu": page.in_menu, "new_tab": page.new_tab, "cta": page.cta, "label_link": page.label_link, "devices": page.devices or {},
                "background": bg(page.background), "layout": data, "content": content, "objects": sorted(slugs), "requires": requirements(sorted(slugs), bool(files)),
                "media": {p: {"kind": kind_of(p)} for p in files}}
    if menus:
        manifest["menu"] = menu_row(page, with_parent=True)
    files["page.json"] = json.dumps(manifest, indent=2, ensure_ascii=False).encode()
    return files


def as_zip(page, keep=True):
    """The package as zip bytes; keep: also leave a copy in <SITE_DIR>/pages/<key>.zip."""
    files = build(page)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for path, raw in files.items():
            z.writestr(f"{page.key}/{path}", raw)
    data = buf.getvalue()
    if keep:
        (pages_dir() / f"{page.key}.zip").write_bytes(data)
    return data


BUNDLE = "selected_pages.zip"
MENU_FILE = "menu.json"
MENU_FIELDS = ("key", "kind", "title", "url", "in_menu", "new_tab", "audience", "devices", "cta", "label_link", "slugs", "order", "enabled")


def menu_row(page, with_parent=False):
    """One page / menu item as it sits in the menu: its flags, order and parent (by key). With with_parent the parent item is described too, so it can be made elsewhere."""
    row = {f: getattr(page, f) for f in MENU_FIELDS}
    row["parent"] = page.parent.key if page.parent_id else None
    if with_parent and page.parent_id:
        row["parent_item"] = {f: getattr(page.parent, f) for f in MENU_FIELDS} | {"parent": None}
    return row


def menu_file(pages):
    """The menu around the selected pages: the pages themselves, their parents (dropdowns) and the other items of the same dropdowns."""
    keys = {p.key for p in pages}
    items = {}
    for p in Page.objects.select_related("parent").filter(scope="public"):
        if p.key in keys or (p.parent_id and p.parent.key in keys) or any(c.key in keys for c in p.children.all()):
            items[p.key] = menu_row(p)
    return {"format": "easy2edit-menu", "version": 1, "items": sorted(items.values(), key=lambda r: (r["order"], r["key"]))}


def export_many(pages, bundle=False, menus=False):
    """A zip per page in <SITE_DIR>/pages/<key>.zip; with bundle also ONE zip with all of them (selected_pages.zip, a folder per page). With menus the menu items
    (place, order, dropdown) go along: in every page package, and as menu.json in the bundle. Returns ({key: filename}, {key: problem}, bundle filename or '')."""
    done, failed, parts = {}, {}, {}
    for p in pages:
        try:
            files = build(p, menus)
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
                for path, raw in files.items():
                    z.writestr(f"{p.key}/{path}", raw)
            (pages_dir() / f"{p.key}.zip").write_bytes(buf.getvalue())
            parts[p.key] = files
            done[p.key] = f"{p.key}.zip"
        except PortableError as e:
            failed[p.key] = str(e)
    name = ""
    if bundle and parts:
        with zipfile.ZipFile(pages_dir() / BUNDLE, "w", zipfile.ZIP_DEFLATED) as z:
            for key, files in parts.items():
                for path, raw in files.items():
                    z.writestr(f"{key}/{path}", raw)
            if menus:
                z.writestr(MENU_FILE, json.dumps(menu_file([p for p in pages if p.key in parts]), indent=2, ensure_ascii=False))
        name = BUNDLE
    return done, failed, name


SYSOBJ_RE = re.compile(r'data-sysobject="([a-z0-9_-]{1,80})"')
OBJECT_MODULE = {"donation": "donations", "plan": "subscriptions"}  # the module a system object of this kind belongs to; the others belong to a plugin


def requirements(slugs, has_media):
    """What a page needs on the website where it is used: modules, plugins and the system objects themselves (with their kind and name)."""
    from apps.core.modules import MODULES
    from apps.sysobjects import service as sysobj
    from apps.sysobjects.models import SystemObject

    labels = {m["key"]: m["label"] for m in MODULES}
    modules, plugins, objects = set(["media"] if has_media else []), {}, []
    for obj in SystemObject.objects.filter(slug__in=slugs):
        src = sysobj.source_of(obj)
        info = {"slug": obj.slug, "kind": obj.kind, "part": obj.ref_key}
        if obj.kind in OBJECT_MODULE:
            modules.add(OBJECT_MODULE[obj.kind])
            if src:
                info["label"] = src.name
        elif src:
            plugins[src.name] = {"name": src.name, "title": src.title, "version": src.version}
            info["plugin"], info["label"] = src.name, src.title
        objects.append(info)
    known = {o["slug"] for o in objects}
    objects += [{"slug": s, "unknown": True} for s in sorted(set(slugs) - known)]
    return {"modules": [{"key": k, "label": labels.get(k, k)} for k in sorted(modules)], "plugins": sorted(plugins.values(), key=lambda x: x["name"]), "objects": objects}


def check_requirements(req):
    """What of the requirements is missing here: modules that are off, plugins that are not installed (or off), system objects that do not exist."""
    from apps.core import modules
    from apps.plugins.models import Plugin
    from apps.sysobjects.models import SystemObject

    req = req if isinstance(req, dict) else {}
    out = {"modules": [], "plugins": [], "objects": []}
    for m in req.get("modules") or []:
        if isinstance(m, dict) and re.fullmatch(r"[a-z_]{1,40}", str(m.get("key") or "")) and not modules.enabled(m["key"]):
            out["modules"].append({"key": m["key"], "label": str(m.get("label") or m["key"])[:80]})
    for pl in req.get("plugins") or []:
        if not isinstance(pl, dict) or not re.fullmatch(r"[a-z0-9_-]{1,40}", str(pl.get("name") or "")):
            continue
        row = Plugin.objects.filter(name=pl["name"]).first()
        state = "missing" if not row else "off" if not row.enabled else ""
        if state:
            out["plugins"].append({"name": pl["name"], "title": str(pl.get("title") or pl["name"])[:80], "version": str(pl.get("version") or "")[:20], "state": state})
    for o in req.get("objects") or []:
        if isinstance(o, dict) and re.fullmatch(r"[a-z0-9_-]{1,80}", str(o.get("slug") or "")) and not SystemObject.objects.filter(slug=o["slug"]).exists():
            out["objects"].append({"slug": o["slug"], "kind": str(o.get("kind") or "")[:20], "label": str(o.get("label") or "")[:80]})
    return out


# ── import ──────────────────────────────────────────────────────────────────
def _unzip(data):
    if len(data) > MAX_ZIP:
        raise PortableError("Het zipbestand is te groot.")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise PortableError("Dit is geen geldig zipbestand.")
    infos = [i for i in zf.infolist() if not i.is_dir() and not i.filename.startswith("__MACOSX") and ".." not in i.filename.split("/")]
    hit = next((i.filename for i in infos if i.filename == "page.json" or (i.filename.count("/") == 1 and i.filename.endswith("/page.json"))), None)
    if not hit:
        raise PortableError("page.json ontbreekt in het zipbestand.")
    if len(infos) > MAX_FILES or sum(i.file_size for i in infos) > MAX_ZIP * 2:
        raise PortableError("Het pakket bevat te veel of te grote bestanden.")
    base = hit[: -len("page.json")]
    files = {i.filename[len(base):]: zf.read(i) for i in infos if i.filename.startswith(base)}
    try:
        man = json.loads(files["page.json"].decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise PortableError("page.json is geen geldige JSON.")
    if not isinstance(man, dict) or man.get("format") != FORMAT:
        raise PortableError("Dit is geen easy2edit-pagina.")
    if int(man.get("version") or 0) > VERSION:
        raise PortableError("Dit pakket komt van een nieuwere versie van easy2edit.")
    return man, files


def _store(path, raw, key, user):
    """One file of the package into the media library; returns the new MediaItem."""
    name = path.rsplit("/", 1)[-1]
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    kind = "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else None
    if not kind:
        raise PortableError(f"{name}: bestandstype niet toegestaan.")
    if len(raw) > limit_mb("max_image_mb" if kind == "image" else "max_video_mb") * 2**20:
        raise PortableError(f"{name}: te groot.")
    if kind == "image" and ext != "ico":
        try:
            from PIL import Image

            Image.open(io.BytesIO(raw)).verify()
        except Exception:  # noqa: BLE001
            raise PortableError(f"{name}: geen geldige afbeelding.")
    clean_name = re.sub(r"^\d{3}-", "", name)  # the number in front is only the order in the package
    stored = default_storage.save(areas.site_path("library", f"{date.today():%Y/%m}/{uuid.uuid4().hex[:8]}-{get_valid_filename(clean_name)}"), ContentFile(raw))
    item = MediaItem.objects.get(key=stored)
    item.name, item.uploaded_by, item.source = clean_name[:255], user, f"page:{key}"[:40]
    item.save(update_fields=["name", "uploaded_by", "source"])
    return item


def import_zip(data, user, scope=None, mode="copy", menus=False):
    """Make a page of a package. Returns {"page": Page, "notes": [...]}. mode: what to do when a page with this address already exists:
    copy (default) = the new page gets a free address, replace = the existing own page is replaced by the package, skip = leave it as it is."""
    from django.db import transaction

    with transaction.atomic():
        return _import_zip(data, user, scope, mode, menus)


def _import_zip(data, user, scope=None, mode="copy", menus=False):
    from apps.security.words import find_forbidden

    man, files = _unzip(data)
    scope = scope if scope in ("public", "private") else ("private" if man.get("scope") == "private" else "public")
    title = {str(k)[:5]: str(v).strip()[:80] for k, v in (man.get("title") or {}).items() if re.fullmatch(r"[a-z]{2,5}", str(k)) and str(v).strip()} if isinstance(man.get("title"), dict) else {}
    if not title:
        raise PortableError("De pagina in het pakket heeft geen naam.")
    if (w := find_forbidden(" ".join(title.values()))):
        raise PortableError(f"Bevat niet toegestane woorden: {', '.join(w)}.")
    from .views import KEY_RE, PRIVATE_RESERVED, RESERVED

    old = str(man.get("key") or "").strip().lower()
    if not KEY_RE.fullmatch(old):
        raise PortableError("Het adres van de pagina in het pakket is ongeldig.")
    existing = Page.objects.filter(key=old).first()
    prev = None
    if existing and mode == "skip":
        return {"page": existing, "skipped": True, "replaced": False, "key": old, "old": old, "notes": [f"'{old}' bestond al en is overgeslagen."], "warnings": {"modules": [], "plugins": [], "objects": []}, "media": 0, "blocks": 0}
    if existing and mode == "replace" and existing.kind == "content":  # the package takes the place of the page: its blocks and texts go, its place in the menu stays
        prev = {"parent_id": existing.parent_id, "order": existing.order, "in_menu": existing.in_menu}
        PageLayout.objects.filter(key=old).delete()
        ContentBlock.objects.filter(key__startswith=f"layout.{old}.").delete()
        ContentBlock.objects.filter(key__startswith=f"page.{old}.").delete()
        existing.delete()
    key, n = old, 2
    while Page.objects.filter(key=key).exists() or key in RESERVED or (scope == "private" and key in PRIVATE_RESERVED):
        key, n = f"{old}-{n}", n + 1
    notes = []

    # 1. the files: only those that the page uses, into the media library
    ids = {}
    used = {p for p in files if p.startswith("media/")}
    for path in sorted(used):
        ids[path] = _store(path, files[path], key, user).id

    def media_id(path):
        return ids.get(str(path or "").lstrip(MARK))

    def bg(b):
        mid = media_id((b or {}).get("file"))
        return {"type": b["type"], "media": mid, "overlay": b.get("overlay", 0.35)} if mid and b.get("type") in ("image", "video") else {}

    # 2. the blocks; the keys of the content carry the page key, so they are renamed to the new key
    def rename(k):
        k = str(k or "")
        for pre in ("layout", "page"):
            if k.startswith(f"{pre}.{old}."):
                return f"{pre}.{key}." + k[len(f"{pre}.{old}."):]
        return k

    raw_layout = man.get("layout") if isinstance(man.get("layout"), dict) else {}
    raw_layout = json.loads(json.dumps(raw_layout))
    raw_layout["bg"] = bg(raw_layout.get("bg"))
    for r in raw_layout.get("rows", []) or []:
        r["bg"] = bg(r.get("bg"))
        for c in r.get("cells", []) or []:
            for it in c.get("items", []) or []:
                if it.get("type") != "object":
                    it["ref"] = rename(it.get("ref"))
    raw_layout["moved"] = [rename(k) for k in raw_layout.get("moved") or []]
    try:
        layout = page_layout.clean(raw_layout)
    except (ValueError, TypeError, AttributeError) as e:
        raise PortableError(f"De indeling in het pakket klopt niet: {e}")

    # 3. the linked content (only the keys of this page, only languages that this website has)
    langs = set(Language.objects.values_list("code", flat=True))
    blocks = 0
    for k, per in (man.get("content") or {}).items():
        nk = rename(k)
        if not (nk.startswith(f"layout.{key}.") or nk.startswith(f"page.{key}.")) or not re.fullmatch(r"[a-z0-9._-]{1,100}", nk) or not isinstance(per, dict):
            continue
        for lang, text in per.items():
            if lang not in langs and lang != "*":
                continue
            text = str(text or "")
            if text.startswith("media:"):
                mid = media_id(text[6:])
                text = f"media:{mid}" if mid else ""
            elif text.startswith(richtext.PREFIX):
                text = richtext.PREFIX + richtext.clean(re.sub(r'data-media="@?([^"]*)"', lambda m: f'data-media="{media_id(m.group(1)) or ""}"', text[len(richtext.PREFIX):]))
                if len(text) > richtext.MAX:
                    continue
            elif len(text) > 5000:
                continue
            ContentBlock.objects.update_or_create(key=nk, lang=lang, defaults={"text": text})
            blocks += 1

    # 4. the page itself
    last = Page.objects.order_by("-order").first()
    devices = man.get("devices") if isinstance(man.get("devices"), dict) else {}
    p = Page.objects.create(key=key, kind="content", scope=scope, title=title, audience="members" if scope == "private" else (man.get("audience") if man.get("audience") in ("all", "members", "guests") else "all"),
                            in_menu=bool(man.get("in_menu")), new_tab=bool(man.get("new_tab")), cta=bool(man.get("cta")), label_link=bool(man.get("label_link")),
                            devices={k: bool(devices.get(k, True)) for k in service.DEVICES}, background=bg(man.get("background")), order=(last.order + 1) if last else 0)
    service.fill_slugs(p)
    if prev:
        p.parent_id, p.order, p.in_menu = prev["parent_id"], prev["order"], prev["in_menu"]
    p.save()
    PageLayout.objects.update_or_create(key=key, defaults={"data": layout})

    # 5. a copy of the package in <site>/pages/<key>.zip
    (pages_dir() / f"{key}.zip").write_bytes(data)

    warnings = check_requirements(man.get("requires") or {"objects": [{"slug": s} for s in man.get("objects") or []]})
    if warnings["modules"]:
        notes.append("Zet deze modules aan: " + ", ".join(m["label"] for m in warnings["modules"]) + ".")
    if warnings["plugins"]:
        notes.append("Installeer of zet deze plugins aan: " + ", ".join(f"{x['title']} ({'niet geïnstalleerd' if x['state'] == 'missing' else 'staat uit'})" for x in warnings["plugins"]) + ".")
    if warnings["objects"]:
        notes.append("Deze systeemobjecten bestaan op deze website niet: " + ", ".join(o["label"] or o["slug"] for o in warnings["objects"]) + ".")
    if key != old:
        notes.append(f"Het adres '{old}' bestond al, de pagina heet nu '{key}'.")
    return {"page": p, "notes": notes, "warnings": warnings, "media": len(ids), "blocks": blocks, "key": key, "old": old, "replaced": bool(prev), "skipped": False, "menu_row": man.get("menu") if menus else None}


def apply_menu(rows, mapping):
    """The menu of the package: missing menu items and links (dropdowns) are made, then the imported pages and those items are put at their place (dropdown, order, in the menu).
    mapping: {address in the package: address here}. Returns how many items were placed."""
    from .views import KEY_RE

    local = lambda k: mapping.get(k, k)  # noqa: E731
    made, flat = set(), []
    for r in rows:
        if r.get("parent_item"):
            flat.append(r["parent_item"])
        flat.append(r)
    for it in flat:
        k = local(str(it.get("key") or ""))
        if KEY_RE.fullmatch(k) and it.get("kind") in ("menu", "link") and not Page.objects.filter(key=k).exists():
            dev = it.get("devices") if isinstance(it.get("devices"), dict) else {}
            Page.objects.create(key=k, kind=it["kind"], title=it.get("title") if isinstance(it.get("title"), dict) else {"nl": k}, url=str(it.get("url") or "")[:300], scope="public",
                                in_menu=bool(it.get("in_menu")), new_tab=bool(it.get("new_tab")), audience=it.get("audience") if it.get("audience") in ("all", "members", "guests") else "all",
                                devices={x: bool(dev.get(x, True)) for x in service.DEVICES}, cta=bool(it.get("cta")), label_link=bool(it.get("label_link")), order=int(it.get("order") or 0))
            made.add(k)
    placed = 0
    touch = {local(k) for k in mapping} | set(mapping.values()) | made
    for r in rows:
        page = Page.objects.filter(key=local(str(r.get("key") or ""))).first()
        if not page or page.key not in touch:
            continue
        parent = r.get("parent") or (r.get("parent_item") or {}).get("key")
        page.parent = Page.objects.filter(key=local(parent)).exclude(pk=page.pk).first() if parent else None
        page.in_menu, page.order = bool(r.get("in_menu")), int(r.get("order") or 0)
        page.save(update_fields=["parent", "in_menu", "order"])
        placed += 1
    return placed


def inspect(data):
    """What is in a package, before it is imported: the pages (and whether they exist here already) and whether a menu is in it."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise PortableError("Dit is geen geldig zipbestand.")
    names = [n for n in zf.namelist() if not n.endswith("/") and not n.startswith("__MACOSX") and ".." not in n.split("/")]
    hits = sorted(n for n in names if n == "page.json" or (n.count("/") == 1 and n.endswith("/page.json")))
    if not hits:
        raise PortableError("page.json ontbreekt in het zipbestand.")
    pages, menu = [], MENU_FILE in names
    for h in hits:
        try:
            man = json.loads(zf.read(h).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise PortableError(f"{h} is geen geldige JSON.")
        if not isinstance(man, dict) or man.get("format") != FORMAT:
            raise PortableError("Dit is geen easy2edit-pagina.")
        key = str(man.get("key") or "")
        ex = Page.objects.filter(key=key).first()
        t = man.get("title") if isinstance(man.get("title"), dict) else {}
        pages.append({"key": key, "title": next((v for v in t.values() if v), key), "exists": bool(ex), "kind": ex.kind if ex else "", "replaceable": bool(ex and ex.kind == "content")})
        menu = menu or bool(man.get("menu"))
    return {"pages": pages, "menu": menu, "bundle": len(pages) > 1}


def import_any(data, user, scope=None, mode="copy", menus=False):
    """One page, or a package with several pages (selected_pages.zip: a folder per page, maybe with menu.json). Returns the same as import_zip, summed up, plus "pages"."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise PortableError("Dit is geen geldig zipbestand.")
    names = [n for n in zf.namelist() if not n.endswith("/") and not n.startswith("__MACOSX") and ".." not in n.split("/")]
    folders = sorted({n.split("/", 1)[0] for n in names if n.count("/") == 1 and n.endswith("/page.json")})
    mode = mode if mode in ("copy", "replace", "skip") else "copy"
    total = {"page": None, "notes": [], "media": 0, "blocks": 0, "pages": 0, "replaced": [], "skipped": [], "menu_items": 0, "warnings": {"modules": [], "plugins": [], "objects": []}}
    mapping, rows = {}, []

    def merge(out, label=""):
        total["page"] = total["page"] or out["page"]
        if out.get("skipped"):
            total["skipped"].append(out["old"])
        else:
            total["pages"] += 1
            mapping[out["old"]] = out["key"]
            if out.get("replaced"):
                total["replaced"].append(out["key"])
        total["media"] += out["media"]
        total["blocks"] += out["blocks"]
        total["notes"] += [f"{label}{n}" for n in out["notes"]]
        if out.get("menu_row"):
            rows.append(out["menu_row"])
        for k in ("modules", "plugins", "objects"):  # what is missing, each thing once
            have = {x.get("key") or x.get("name") or x.get("slug") for x in total["warnings"][k]}
            total["warnings"][k] += [x for x in out["warnings"][k] if (x.get("key") or x.get("name") or x.get("slug")) not in have]

    if len(folders) < 2:
        merge(import_zip(data, user, scope, mode, menus))
    else:
        for f in folders:
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
                for n in names:
                    if n.startswith(f + "/"):
                        z.writestr(n, zf.read(n))
            merge(import_zip(buf.getvalue(), user, scope, mode, menus), f"{f}: ")
        if menus and MENU_FILE in names:
            try:
                rows = [r for r in (json.loads(zf.read(MENU_FILE)).get("items") or []) if isinstance(r, dict)]
            except ValueError:
                rows = rows
    if menus and rows:
        total["menu_items"] = apply_menu(rows, mapping)
    if not total["page"] and total["skipped"]:
        total["page"] = Page.objects.filter(key=total["skipped"][0]).first()
    total["pages"] = max(total["pages"], 1) if total["pages"] else (0 if total["skipped"] else 1)
    return total
