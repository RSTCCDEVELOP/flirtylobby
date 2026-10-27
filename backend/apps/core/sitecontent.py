# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The content of the website (pages, their designs and their texts) as a file in the SITE folder (<site>/content/site-content.json).

An update of the system never touches the site folder, so what the owner made stays, also when the database is lost or replaced. The file is kept up to date by itself
(a moment after every change); a database without pages and texts gets it back at the start of the server (`manage.py site_content restore --if-empty`)."""
import json
import logging
import os
import threading
import time
from pathlib import Path

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

PAGE_FIELDS = ("key", "kind", "title", "url", "scope", "in_menu", "enabled", "order", "audience", "new_tab", "module", "slugs", "setup", "devices", "cta", "label_link", "access")
DELAY = 20  # seconds: changes that follow each other become one write
_state = {"timer": None, "last": 0.0}


def folder():
    d = Path(settings.SITE_DIR) / "content"
    d.mkdir(parents=True, exist_ok=True)
    return d


def path():
    return folder() / "site-content.json"


def _models():
    from apps.core.models import ContentBlock
    from apps.pages.models import Page, PageLayout

    return Page, PageLayout, ContentBlock


def collect():
    Page, PageLayout, ContentBlock = _models()
    pages = []
    for p in Page.objects.all().order_by("order", "id"):
        row = {f: getattr(p, f, None) for f in PAGE_FIELDS if hasattr(p, f)}
        row["parent"] = p.parent.key if getattr(p, "parent_id", None) else None
        pages.append(row)
    return {"format": "site-content", "version": 1, "saved_at": timezone.now().isoformat(timespec="seconds"), "build": getattr(settings, "SYSTEM_BUILD", 0),
            "pages": pages,
            "layouts": [{"key": x.key, "data": x.data} for x in PageLayout.objects.all()],
            "blocks": [{"key": b.key, "lang": b.lang, "text": b.text} for b in ContentBlock.objects.all()]}


def snapshot(keep_copy=False):
    """Write the file now. keep_copy: also a dated copy (the last 5 stay), made before an update. Returns the counts."""
    data = collect()
    if not data["layouts"] and not data["blocks"] and path().is_file():
        return {"pages": 0, "layouts": 0, "blocks": 0, "skipped": True}  # an empty database must not replace a file that still holds the content
    text = json.dumps(data, ensure_ascii=False, indent=1, default=str)
    tmp = path().with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path())  # (a file that is written is never half there)
    if keep_copy:
        d = folder() / "backups"
        d.mkdir(exist_ok=True)
        (d / f"site-content-build{data['build']}-{time.strftime('%Y%m%d-%H%M%S')}.json").write_text(text, encoding="utf-8")
        for old in sorted(d.glob("site-content-*.json"))[:-5]:
            old.unlink()
    _state["last"] = time.time()
    return {"pages": len(data["pages"]), "layouts": len(data["layouts"]), "blocks": len(data["blocks"])}


def _flush():
    _state["timer"] = None
    try:
        snapshot()
    except Exception:  # noqa: BLE001 - a file that cannot be written must never stop the website
        logger.exception("Site content could not be saved")


def touch(**_):
    """Called after a change of a page, a design or a text: the file follows a moment later."""
    if _state["timer"] is None:
        t = threading.Timer(DELAY, _flush)
        t.daemon = True
        _state["timer"] = t
        t.start()


def connect():
    from django.db.models.signals import post_delete, post_save

    for m in _models():
        post_save.connect(touch, sender=m, weak=False, dispatch_uid=f"sitecontent-save-{m.__name__}")
        post_delete.connect(touch, sender=m, weak=False, dispatch_uid=f"sitecontent-del-{m.__name__}")


def restore(if_empty=True):
    """Put the file back in the database. if_empty: only when the database holds no designs and no texts (a new or replaced database). Returns the counts or None."""
    if not path().is_file():
        return None
    Page, PageLayout, ContentBlock = _models()
    if if_empty and (PageLayout.objects.exists() or ContentBlock.objects.exists()):
        return None
    data = json.loads(path().read_text(encoding="utf-8"))
    n = {"pages": 0, "layouts": 0, "blocks": 0}
    for row in data.get("pages") or []:
        if row.get("key") and not Page.objects.filter(key=row["key"]).exists():
            Page.objects.create(**{k: v for k, v in row.items() if k not in ("parent",) and hasattr(Page, k)})
            n["pages"] += 1
    for row in data.get("layouts") or []:
        PageLayout.objects.update_or_create(key=row["key"], defaults={"data": row.get("data") or {}})
        n["layouts"] += 1
    for row in data.get("blocks") or []:
        ContentBlock.objects.update_or_create(key=row["key"], lang=row["lang"], defaults={"text": row.get("text") or ""})
        n["blocks"] += 1
    logger.warning("Site content put back from %s: %s", path(), n)
    return n
