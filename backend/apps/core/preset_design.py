# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The design of a standard installation: the pages that a superadmin chose on the tab Design, kept as packages (resource/presets/<key>/design/<page>.zip).
A package holds the whole page: its blocks, ALL linked texts and every picture or video that it uses. With the installation the pages come back exactly like that.

listing(key)        the pages of this website that can be chosen, and which are kept now
save(key, pages)    make the packages of the chosen pages (the other packages are removed)
install(key, skip)  put the pages in place (a page that has content of its own stays as it is when it is in `skip`)
remove(key)         the pages that this installation made go away again (pages of the system keep their standard design)"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)
TAG = "design:"  # the source of the pictures that come with an installation (so they are not stored twice)


def folder(key):
    return Path(settings.RESOURCE_DIR) / "presets" / key / "design"


def _index(key):
    f = folder(key) / "index.json"
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def saved_keys(key):
    return [k for k in _index(key).get("pages", []) if (folder(key) / f"{k}.zip").is_file()]


def _title(p):
    t = p.title if isinstance(p.title, dict) else {}
    return t.get("nl") or next(iter(t.values()), "") or p.key


def listing(key):
    """The pages that can be chosen: public pages that have blocks. {pages: [...], saved_at}"""
    from apps.pages.models import Page, PageLayout

    have = {k for k, d in PageLayout.objects.values_list("key", "data") if (d or {}).get("rows")}
    kept = set(saved_keys(key))
    rows = []
    for p in Page.objects.filter(scope="public").order_by("order", "id"):
        if p.key not in have and p.key not in kept:
            continue
        rows.append({"key": p.key, "title": _title(p), "kind": p.kind, "path": p.path, "in_menu": p.in_menu, "saved": p.key in kept, "has_blocks": p.key in have})
    return {"pages": rows, "saved_at": _index(key).get("saved_at"), "count": len(kept)}


def save(key, page_keys):
    """Make the packages of the chosen pages. Returns the listing."""
    from apps.pages import portable
    from apps.pages.models import Page

    d = folder(key)
    d.mkdir(parents=True, exist_ok=True)
    chosen = []
    for k in page_keys:
        p = Page.objects.filter(key=k, scope="public").first()
        if not p or k in chosen:
            continue
        (d / f"{k}.zip").write_bytes(portable.as_zip(p, keep=False, system=True))
        chosen.append(k)
    for f in d.glob("*.zip"):  # what is not chosen any more goes
        if f.stem not in chosen:
            f.unlink()
    (d / "index.json").write_text(json.dumps({"pages": chosen, "saved_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}, indent=1), encoding="utf-8")
    return listing(key)


def install(key, skip=(), user=None):
    """Put the saved pages in place, exactly as they were saved. A page in `skip` stays as it is. Returns the keys that were put in."""
    from apps.pages import portable
    from apps.pages.models import Page

    from . import presets

    done, made = [], []
    for k in saved_keys(key):
        if k in skip:
            continue
        before = Page.objects.filter(key=k).values_list("source", flat=True).first()  # None = the page is not there yet
        try:
            r = portable.import_zip((folder(key) / f"{k}.zip").read_bytes(), user, mode="apply", source=TAG + key)
        except Exception:  # noqa: BLE001 - one page that cannot be put in must not stop the installation
            logger.exception("Preset %s: the design page %s could not be installed", key, k)
            continue
        p = r["page"]
        if p.kind == "content" and (before is None or before == f"preset:{key}"):  # (a page that somebody else made stays theirs)
            Page.objects.filter(pk=p.pk).update(source=f"preset:{key}")
            made.append(p.key)
        done.append(p.key)
    if made or done:
        data = presets._data()
        owned = dict(data.get("preset_design") or {})
        owned[key] = {"pages": sorted(set((owned.get(key) or {}).get("pages", [])) | set(made)), "layouts": sorted(set((owned.get(key) or {}).get("layouts", [])) | set(done))}
        data["preset_design"] = owned
        presets._save_data(data)
    return done


def keys(key):
    """The pages that this installation designs (they count when the site asks what an installation would replace)."""
    return saved_keys(key)


def remove(key):
    """The pages that the design made go; the standard pages lose the design (they get their standard layout again)."""
    from apps.core.models import ContentBlock
    from apps.pages.models import Page, PageLayout

    from . import presets

    data = presets._data()
    owned = dict(data.get("preset_design") or {})
    mine = owned.pop(key, None)
    if not mine:
        return
    for k in mine.get("layouts", []):
        PageLayout.objects.filter(key=k).delete()
        if k in mine.get("pages", []):
            ContentBlock.objects.filter(key__startswith=f"layout.{k}.").delete()
            ContentBlock.objects.filter(key__startswith=f"page.{k}.").delete()
    Page.objects.filter(key__in=mine.get("pages", []), source=f"preset:{key}").delete()
    data["preset_design"] = owned
    presets._save_data(data)
    try:
        from apps.pages import defaults as page_defaults

        page_defaults.apply_theme(page_defaults._theme())
    except Exception:  # noqa: BLE001
        logger.exception("Standard pages could not be put back after removing the design of %s", key)
