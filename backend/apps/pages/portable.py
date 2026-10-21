"""Export and import of one own page (a page that was designed with blocks) as a zip, to use it in another easy2edit.

    <key>/page.json     the page: name, audience, menu, background, the blocks (layout) and ALL linked content (texts per language, picture settings)
    <key>/media/…       every picture and video that the page uses (blocks, rows, background, pictures inside texts)

The package holds no colours, fonts or sizes of its own: the page keeps using the theme that is set on the website where it is imported.
A copy of every exported or imported package is kept in <SITE_DIR>/public/<key>/ (website pages) or <SITE_DIR>/private/<key>/ (pages behind the login)."""
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


def folder(scope, key):
    return settings.SITE_DIR / ("private" if scope == "private" else "public") / key


# ── export ──────────────────────────────────────────────────────────────────
def _read(item):
    with default_storage.open(item.key) as f:
        return f.read()


def build(page):
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
    objects = sorted({it["ref"] for r in data.get("rows", []) for c in r.get("cells", []) for it in c.get("items", []) if it.get("type") == "object" and it.get("ref")})

    content = {}
    for b in ContentBlock.objects.filter(key__startswith=f"layout.{page.key}.") | ContentBlock.objects.filter(key__startswith=f"page.{page.key}."):
        text = b.text
        if text.startswith("media:"):
            path = media(int(text[6:] or 0)) if text[6:].isdigit() else ""
            text = f"media:{MARK}{path}" if path else ""
        elif text.startswith(richtext.PREFIX):
            text = re.sub(r'data-media="(\d+)"', lambda m: f'data-media="{MARK}{media(int(m.group(1)))}"', text)
        content.setdefault(b.key, {})[b.lang] = text

    manifest = {"format": FORMAT, "version": VERSION, "key": page.key, "scope": page.scope, "kind": "content", "title": page.title,
                "audience": page.audience, "in_menu": page.in_menu, "new_tab": page.new_tab, "cta": page.cta, "label_link": page.label_link, "devices": page.devices or {},
                "background": bg(page.background), "layout": data, "content": content, "objects": objects,
                "media": {p: {"kind": kind_of(p)} for p in files}}
    files["page.json"] = json.dumps(manifest, indent=2, ensure_ascii=False).encode()
    return files


def save_folder(page_scope, key, files):
    """A copy of the package on disk: <SITE_DIR>/public|private/<key>/."""
    target = folder(page_scope, key)
    shutil.rmtree(target, ignore_errors=True)
    for path, raw in files.items():
        out = target / path
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(raw)


def as_zip(page):
    files = build(page)
    save_folder(page.scope, page.key, files)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for path, raw in files.items():
            z.writestr(f"{page.key}/{path}", raw)
    return buf.getvalue()


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


def import_zip(data, user, scope=None):
    """Make a page of a package. Returns {"page": Page, "notes": [...]}. The page gets a free address when its key is taken."""
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
    p.save()
    PageLayout.objects.update_or_create(key=key, defaults={"data": layout})

    # 5. a copy of the package in <site>/public|private/<key>/
    save_folder(scope, key, {**{pth: files[pth] for pth in used}, "page.json": files["page.json"]})

    missing = [s for s in man.get("objects") or [] if not _object_exists(s)]
    if missing:
        notes.append("Deze systeemobjecten bestaan op deze website niet (meer): " + ", ".join(missing) + ".")
    if key != old:
        notes.append(f"Het adres '{old}' bestond al, de pagina heet nu '{key}'.")
    return {"page": p, "notes": notes, "media": len(ids), "blocks": blocks}


def _object_exists(slug):
    try:
        from apps.sysobjects.models import SystemObject

        return SystemObject.objects.filter(slug=slug).exists()
    except Exception:  # noqa: BLE001
        return True
