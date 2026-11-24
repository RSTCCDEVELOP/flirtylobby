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
import threading
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


def _missing(key, page_key):
    """The pictures that the page points to but that were not on this website when the page was kept: they cannot come back with the installation."""
    import io
    import zipfile

    try:
        with zipfile.ZipFile(folder(key) / f"{page_key}.zip") as z:
            name = next(n for n in z.namelist() if n.endswith("page.json"))
            return list(json.loads(z.read(name)).get("missing_files") or [])
    except Exception:  # noqa: BLE001
        return []


def listing(key):
    """The pages that can be chosen: public pages that have blocks. {pages: [...], saved_at}"""
    from apps.pages.models import Page, PageLayout

    have = {k for k, d in PageLayout.objects.values_list("key", "data") if (d or {}).get("rows")}
    kept = set(saved_keys(key))
    rows = []
    for p in Page.objects.filter(scope="public").order_by("order", "id"):
        if p.key not in have and p.key not in kept:
            continue
        rows.append({"key": p.key, "title": _title(p), "kind": p.kind, "path": p.path, "in_menu": p.in_menu, "saved": p.key in kept, "has_blocks": p.key in have, "sample": sample_state(key, p.key) if p.key in kept else "none", "missing": _missing(key, p.key) if p.key in kept else []})
    return {"pages": rows, "saved_at": _index(key).get("saved_at"), "count": len(kept)}


# ── samples: a picture of the whole page, made when a page is switched on and removed when it is switched off; they present the installation ──
_JOBS = {}  # (installation, page) -> "busy" | "error: text"


def sample_file(key, page_key):
    return folder(key) / "samples" / f"{page_key}.jpg"


def sample_state(key, page_key):
    job = _JOBS.get((key, page_key))
    if job == "busy":
        return "busy"
    if sample_file(key, page_key).is_file():
        return "ready"
    return job or "none"


def samples_of(key):
    """The pages with a picture, for the presentation of the installation: [{key, title}] (the start page first)."""
    titles = _index(key).get("titles") or {}
    keys = [k for k in saved_keys(key) if sample_file(key, k).is_file()]
    keys.sort(key=lambda k: (k != "home", k))
    return [{"key": k, "title": titles.get(k) or k} for k in keys]


def own_origin(request=None):
    """The address of this website as the browser has it (for the picture of a page). Only an address that the server knows as its own website is used."""
    allowed = list(getattr(settings, "CORS_ALLOWED_ORIGINS", []) or [])
    regexes = list(getattr(settings, "CORS_ALLOWED_ORIGIN_REGEXES", []) or [])
    import re

    origin = (request.META.get("HTTP_ORIGIN") or "").rstrip("/") if request is not None else ""
    if origin and (origin in allowed or any(re.match(r, origin) for r in regexes)):
        return origin
    return allowed[0] if allowed else ""


def _make_sample(key, page_key, url):
    from . import siteshots

    try:
        raw = siteshots.capture(url, allow_private=True)
        f = sample_file(key, page_key)
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(raw)
        _JOBS.pop((key, page_key), None)
    except Exception as e:  # noqa: BLE001 - shown on the tab Samples
        logger.warning("Sample of %s/%s could not be made: %s", key, page_key, e)
        _JOBS[(key, page_key)] = f"error: {e}"


def start_sample(key, page_key, origin, wait=False):
    """Make the picture of one page (in the background). Returns False when there is no address or it is being made already."""
    from apps.pages.models import Page

    p = Page.objects.filter(key=page_key, scope="public").first()
    if not p or not origin or _JOBS.get((key, page_key)) == "busy":
        return False
    url = origin.rstrip("/") + (p.path or f"/{page_key}")
    _JOBS[(key, page_key)] = "busy"
    t = threading.Thread(target=_make_sample, args=(key, page_key, url), daemon=True)
    t.start()
    if wait:
        t.join()
    return True


def save(key, page_keys, origin="", wait=False):
    """Make the packages of the chosen pages (a picture of each new page is made, the pictures of the pages that go are removed). Returns the listing."""
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
    for f in (d / "samples").glob("*.jpg") if (d / "samples").is_dir() else []:  # and so do its pictures
        if f.stem not in chosen:
            f.unlink()
    titles = {p.key: _title(p) for p in Page.objects.filter(key__in=chosen)}
    (d / "index.json").write_text(json.dumps({"pages": chosen, "titles": titles, "saved_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}, indent=1, ensure_ascii=False), encoding="utf-8")
    for k in chosen:  # a page that is switched on gets its picture
        if not sample_file(key, k).is_file():
            start_sample(key, k, origin, wait=wait)
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
