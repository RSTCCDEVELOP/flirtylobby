# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Backups of the website: one zip per backup in <BACKUPS_DIR>/.

    backup.json      what it is: format, date, version of the system, the parts in it
    settings.json    the settings of every module and plugin (theme, modules, languages, security, plugins, …), made by apps.core.settings_backup
    site.json        the pages and menu, the block layouts and the edited texts: only what is NOT standard (see below)
    media/…          every picture and video that these pages and texts use

The standard data of easy2edit itself is never in a backup, so that a restore can not disturb the engine: standard pages (home, login, …), their standard
layouts and texts, the built-in themes and the languages that come with the system are only in it when an administrator changed them."""
import io
import json
import logging
import re
import shutil
import zipfile
from datetime import timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from django.utils.text import get_valid_filename

from apps.core import richtext
from apps.core import settings_backup as sb
from apps.core.models import ContentBlock
from apps.medialib.models import MediaItem, kind_of
from apps.pages import defaults as page_defaults
from apps.pages import service as page_service
from apps.pages.models import Page, PageLayout

from .models import Backup, BackupJob, BackupSettings

logger = logging.getLogger(__name__)
FORMAT = "easy2edit-backup"
VERSION = 1
SKIP_SECTIONS = {"pages", "content", "media_files"}  # replaced by site.json and media/ (they know what is standard)
MAX_MEDIA_TOTAL = 1024 * 1024 * 1024
MAX_MEDIA_FILE = 200 * 1024 * 1024
PAGE_FIELDS = ("key", "kind", "title", "url", "module", "enabled", "in_menu", "new_tab", "audience", "devices", "cta", "label_link", "slugs", "scope", "access", "order", "source")


class BackupError(ValueError):
    pass


def backups_dir():
    d = settings.BACKUPS_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── what is standard: see apps/pages/standard.py ────────────────────────────
from apps.pages.standard import _standard_keys, _standard_layout, _standard_texts, page_changed  # noqa: E402,F401


# ── media ids inside the data ───────────────────────────────────────────────
_DM = re.compile(r'data-media="(\d+)"')


def _ids_in_text(text):
    if text.startswith("media:") and text[6:].isdigit():
        return {int(text[6:])}
    return {int(i) for i in _DM.findall(text)}


def _bg_ids(bg):
    return {int(bg["media"])} if isinstance(bg, dict) and str(bg.get("media") or "").isdigit() else set()


def _layout_ids(data):
    ids = _bg_ids((data or {}).get("bg"))
    for r in (data or {}).get("rows", []) or []:
        ids |= _bg_ids(r.get("bg"))
    return ids


def _remap_text(text, m):
    if text.startswith("media:") and text[6:].isdigit():
        return f"media:{m[int(text[6:])]}" if int(text[6:]) in m else ""
    return _DM.sub(lambda x: f'data-media="{m.get(int(x.group(1)), "")}"', text)


def _remap_bg(bg, m):
    if not isinstance(bg, dict) or not bg.get("media"):
        return bg
    new = m.get(int(bg["media"]))
    return {**bg, "media": new} if new else {}


def _remap_layout(data, m):
    data = json.loads(json.dumps(data))
    data["bg"] = _remap_bg(data.get("bg"), m)
    for r in data.get("rows", []) or []:
        r["bg"] = _remap_bg(r.get("bg"), m)
    return data


# ── collect ─────────────────────────────────────────────────────────────────
def collect_site():
    """(site dict, {zip path: bytes}, skipped file names)."""
    used = set()
    pages = []
    for p in Page.objects.select_related("parent"):
        if not page_changed(p):
            continue
        row = {f: getattr(p, f) for f in PAGE_FIELDS}
        row["parent"] = p.parent.key if p.parent_id else None
        row["background"] = p.background or {}
        used |= _bg_ids(p.background)
        pages.append(row)
    menu = [{"key": p.key, "order": p.order, "parent": p.parent.key if p.parent_id else None, "in_menu": p.in_menu, "enabled": p.enabled} for p in Page.objects.select_related("parent")]

    layouts = {}
    for l in PageLayout.objects.all():
        if not _standard_layout(l.key, l.data):
            layouts[l.key] = l.data
            used |= _layout_ids(l.data)

    std = _standard_texts()
    content = []
    for b in ContentBlock.objects.all():
        if std.get((b.key, b.lang)) == b.text:
            continue
        content.append({"key": b.key, "lang": b.lang, "text": b.text})
        used |= _ids_in_text(b.text)
    try:
        from apps.seo.models import SeoPage

        used |= {i for i in SeoPage.objects.exclude(og_media=None).values_list("og_media_id", flat=True) if i}
    except Exception:  # noqa: BLE001
        pass

    files, index, skipped, total = {}, {}, [], 0
    for item in MediaItem.objects.filter(id__in=used):
        try:
            with default_storage.open(item.key, "rb") as fh:
                raw = fh.read(MAX_MEDIA_FILE + 1)
        except Exception:  # noqa: BLE001 - a missing file must not stop the backup
            skipped.append(item.name)
            continue
        if len(raw) > MAX_MEDIA_FILE or total + len(raw) > MAX_MEDIA_TOTAL:
            skipped.append(item.name)
            continue
        total += len(raw)
        path = f"media/{item.id}-{get_valid_filename(item.name) or 'bestand'}"
        files[path] = raw
        index[str(item.id)] = {"key": item.key, "name": item.name, "mime": item.mime, "tags": item.tags or [], "file": path}
    return {"pages": pages, "menu": menu, "layouts": layouts, "content": content, "media": index}, files, skipped


# ── create ──────────────────────────────────────────────────────────────────
def parts_of(bundle_sections, site):
    parts = [{"key": "site", "label": "Pagina's, menu's, indelingen, teksten en afbeeldingen"}]
    parts += [{"key": f"settings:{k}", "label": v.get("label") or k} for k, v in bundle_sections.items()]
    return parts


def create(frequency, user=None, note=""):
    """Make a backup now (frequency: daily | weekly | monthly | manual | restore). Old ones of the same kind beyond the limit are removed."""
    cfg = BackupSettings.load()
    keys = [s["key"] for s in sb.listing() if s["key"] not in SKIP_SECTIONS]
    bundle = sb.export(keys, cfg.include_secrets, True)
    site, files, skipped = collect_site()
    parts = parts_of(bundle["sections"], site)
    stats = {"pages": len(site["pages"]), "layouts": len(site["layouts"]), "texts": len(site["content"]), "files": len(files), "skipped": skipped, "errors": bundle.get("errors") or {},
             "secrets": cfg.include_secrets}
    now = timezone.now()
    base, n = f"backup-{timezone.localtime(now):%Y%m%d-%H%M%S}-{frequency}", 1
    name = f"{base}.zip"
    while (backups_dir() / name).exists() or Backup.objects.filter(file=name).exists():  # two backups within one second
        n += 1
        name = f"{base}-{n}.zip"
    target = backups_dir() / name
    manifest = {"format": FORMAT, "version": VERSION, "created_at": now.isoformat(timespec="seconds"), "system_version": settings.SYSTEM_VERSION, "frequency": frequency,
                "secrets_included": cfg.include_secrets, "parts": parts, "stats": stats}
    tmp = target.with_suffix(".part")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("backup.json", json.dumps(manifest, indent=1, ensure_ascii=False))
        z.writestr("settings.json", json.dumps(bundle, ensure_ascii=False))
        z.writestr("site.json", json.dumps(site, ensure_ascii=False))
        for path, raw in files.items():
            z.writestr(path, raw)
    tmp.replace(target)
    row = Backup.objects.create(frequency=frequency, file=name, size=target.stat().st_size, created_by=user if getattr(user, "pk", None) else None, note=note[:200], parts=parts, stats=stats,
                                system_version=settings.SYSTEM_VERSION)
    enforce_retention(frequency)
    logger.info("Backup %s made (%s bytes)", name, row.size)
    return row


def keep_for(frequency):
    cfg = BackupSettings.load()
    limit = cfg.limit(frequency)
    job = BackupJob.objects.filter(frequency=frequency).first()
    return max(1, min(job.keep, limit)) if job else max(1, limit)


def enforce_retention(frequency=None):
    """The oldest backups of a kind go when there are more than may be kept."""
    kinds = [frequency] if frequency else ["daily", "weekly", "monthly", "manual", "restore"]
    for kind in kinds:
        keep = keep_for(kind)
        for b in Backup.objects.filter(frequency=kind).order_by("-created_at", "-id")[keep:]:
            remove(b)


def remove(b):
    (backups_dir() / b.file).unlink(missing_ok=True)
    b.delete()


def path_of(b):
    p = backups_dir() / b.file
    if not p.is_file():
        raise BackupError("Het bestand van deze backup bestaat niet meer.")
    return p


# ── restore ─────────────────────────────────────────────────────────────────
def _open(path):
    try:
        zf = zipfile.ZipFile(path)
        man = json.loads(zf.read("backup.json"))
    except (zipfile.BadZipFile, KeyError, ValueError):
        raise BackupError("Dit is geen geldig backupbestand.")
    if man.get("format") != FORMAT:
        raise BackupError("Dit is geen backup van easy2edit.")
    if int(man.get("version") or 0) > VERSION:
        raise BackupError("Deze backup komt van een nieuwere versie van easy2edit.")
    return zf, man


def read_manifest(path):
    zf, man = _open(path)
    zf.close()
    return man


def _restore_media(zf, index):
    """Put the pictures and videos back into the library; returns {old id: id here}."""
    from apps.core.backup_files import write

    mapping = {}
    for old, it in (index or {}).items():
        key = it.get("key")
        if not str(old).isdigit() or not key or kind_of(key) == "other":
            continue
        item = MediaItem.objects.filter(key=key).first()
        if not item and it.get("file") in zf.namelist():
            stored = default_storage.save(key, ContentFile(zf.read(it["file"]))) if not default_storage.exists(key) else key
            item, _ = MediaItem.objects.get_or_create(key=stored, defaults={"name": it.get("name") or key, "kind": kind_of(stored), "mime": it.get("mime") or "", "tags": it.get("tags") or []})
        if item:
            mapping[int(old)] = item.id
    return mapping


def _restore_site(zf):
    site = json.loads(zf.read("site.json"))
    m = _restore_media(zf, site.get("media"))
    n_pages = 0
    for r in site.get("pages", []):
        if not r.get("key") or r.get("kind") not in ("system", "content", "link", "menu"):
            continue
        defaults = {f: r[f] for f in PAGE_FIELDS if f != "key" and f in r}
        defaults["background"] = _remap_bg(r.get("background"), m) or {}
        Page.objects.update_or_create(key=r["key"], defaults=defaults)
        n_pages += 1
    for r in site.get("pages", []) + site.get("menu", []):  # parents last: they may come later in the file
        if r.get("key") and r.get("parent"):
            Page.objects.filter(key=r["key"]).update(parent=Page.objects.filter(key=r["parent"]).first())
    for r in site.get("menu", []):
        if r.get("key"):
            Page.objects.filter(key=r["key"]).update(order=int(r.get("order") or 0), in_menu=bool(r.get("in_menu")), enabled=bool(r.get("enabled", True)),
                                                     **({} if r.get("parent") else {"parent": None}))
    for key, data in (site.get("layouts") or {}).items():
        PageLayout.objects.update_or_create(key=key, defaults={"data": _remap_layout(data, m)})
    n_text = 0
    for b in site.get("content", []):
        if b.get("key") and b.get("lang"):
            ContentBlock.objects.update_or_create(key=b["key"], lang=b["lang"], defaults={"text": _remap_text(str(b.get("text") or ""), m)})
            n_text += 1
    return f"{n_pages} pagina(s), {len(site.get('layouts') or {})} indeling(en), {n_text} tekst(en) en {len(m)} bestand(en) teruggezet."


def restore(b, parts=None, user=None):
    """Put a backup back (everything, or only the chosen parts). A backup of the current state is made first. Returns [{key, label, ok, message}]."""
    zf, man = _open(path_of(b))
    safety = create("restore", user, f"Automatisch, vlak voor het terugzetten van {b.file}")
    results = []
    try:
        want = set(parts) if parts else None
        if want is None or "site" in want:
            try:
                with transaction.atomic():
                    msg = _restore_site(zf)
                results.append({"key": "site", "label": "Pagina's, menu's, indelingen, teksten en afbeeldingen", "ok": True, "message": msg})
            except Exception as e:  # noqa: BLE001
                logger.exception("restore of the site part failed")
                results.append({"key": "site", "label": "Pagina's, menu's, indelingen, teksten en afbeeldingen", "ok": False, "message": f"Niet teruggezet: {e}"})
        keys = [p.split(":", 1)[1] for p in (want or {f"settings:{x['key'].split(':', 1)[1]}" for x in man.get("parts", []) if x["key"].startswith("settings:")})
                if p.startswith("settings:")]
        if keys:
            bundle = json.loads(zf.read("settings.json"))
            results += [{**r, "key": f"settings:{r['key']}"} for r in sb.load(bundle, keys)]
    finally:
        zf.close()
    from apps.core import modules

    modules.invalidate()
    return results, safety


def import_file(data, user=None):
    """An uploaded backup file (from another website or a download) into the backups folder."""
    tmp = backups_dir() / "upload.part"
    tmp.write_bytes(data)
    try:
        man = read_manifest(tmp)
    except BackupError:
        tmp.unlink(missing_ok=True)
        raise
    name, n = f"backup-{timezone.localtime(timezone.now()):%Y%m%d-%H%M%S}-upload.zip", 1
    while (backups_dir() / name).exists() or Backup.objects.filter(file=name).exists():
        n += 1
        name = f"backup-{timezone.localtime(timezone.now()):%Y%m%d-%H%M%S}-upload-{n}.zip"
    tmp.replace(backups_dir() / name)
    return Backup.objects.create(frequency="manual", file=name, size=len(data), created_by=user if getattr(user, "pk", None) else None, note="Geüpload", parts=man.get("parts") or [],
                                 stats=man.get("stats") or {}, system_version=str(man.get("system_version") or ""))
