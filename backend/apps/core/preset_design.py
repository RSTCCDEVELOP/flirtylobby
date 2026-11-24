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
    return {"pages": rows, "saved_at": _index(key).get("saved_at"), "count": len(kept), "theme": theme_info(key), "widgets": widget_keys(key), "widgets_chosen": widgets_chosen(key), "widget_library": _widget_library()}


def _widget_library():
    from apps.sysobjects import widgets

    try:
        return [{"key": w["key"], "name": w["name"], "description": w.get("description", ""), "category": w.get("category", ""), "subcategory": w.get("subcategory", "")} for w in widgets.library()]
    except Exception:  # noqa: BLE001
        return []


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
    try:  # the widgets that are installed on the website go with the installation (active)
        capture_widgets(key)
    except Exception:  # noqa: BLE001
        logger.exception("The widgets of %s could not be kept", key)
    try:  # the look of the website goes with the pages: a theme that is kept before stays up to date
        capture_theme(key)
    except Exception:  # noqa: BLE001 - the pages are saved; the theme can be kept with its own button
        logger.exception("The theme of %s could not be kept", key)
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


def _manifest(key, page_key):
    import zipfile

    try:
        with zipfile.ZipFile(folder(key) / f"{page_key}.zip") as z:
            name = next(n for n in z.namelist() if n.endswith("page.json"))
            return json.loads(z.read(name))
    except Exception:  # noqa: BLE001
        return {}


def outdated(key):
    """The design pages that are not on this website as they were kept (the page is gone, its blocks or its texts differ): [{key, title, missing}]."""
    from apps.pages.models import Page, PageLayout

    from . import preset_pages
    from .models import ContentBlock

    out = []
    for k in saved_keys(key):
        man = _manifest(key, k)
        page = Page.objects.filter(key=k).first()
        lay = PageLayout.objects.filter(key=k).first()
        have = (lay.data if lay else {}) or {}
        want = man.get("layout") or {}
        missing = page is None or not have.get("rows")
        differs = missing or preset_pages._sig(have) != preset_pages._sig(want)
        if not differs:  # the same blocks: are the texts the same too?
            for ck, per in (man.get("content") or {}).items():
                for lang, text in per.items():
                    if str(text).startswith("media:") or "data-media" in str(text):
                        continue  # (pictures are stored by their number here: not compared)
                    row = ContentBlock.objects.filter(key=ck, lang=lang).first()
                    if row is None or row.text != text:
                        differs = True
                        break
                if differs:
                    break
        if differs:
            t = man.get("title") or {}
            out.append({"key": k, "title": (t.get("nl") or next(iter(t.values()), k)) if isinstance(t, dict) else k, "missing": bool(missing)})
    return out


# ── the colour theme of the installation: the look of the site (colours, fonts, shapes, logos, home photos) as a theme package, kept next to the pages ──
def theme_file(key):
    return folder(key) / "theme.zip"


def theme_key(key):
    import re

    return re.sub(r"-+$", "", f"inst-{key}"[:38])


def capture_theme(key, name=""):
    """Keep the look of this website as it is now in the installation (theme.zip). Returns the info. Called when the pages are saved and from the button on the tab Design."""
    from . import presets, themepacks

    pk = theme_key(key)
    label = f"Thema van {name or (presets.BY_KEY.get(key) or {}).get('name') or key}"[:60]
    if themepacks.manifest_of(pk):
        themepacks.capture(pk)
    else:
        made = themepacks.create(pk, from_current=True)
        pk = made
    try:
        themepacks.update_meta(pk, {"name": label})
    except Exception:  # noqa: BLE001
        pass
    raw = themepacks.as_zip(pk)
    if raw:
        folder(key).mkdir(parents=True, exist_ok=True)
        theme_file(key).write_bytes(raw)
    return theme_info(key)


def theme_info(key):
    """{name, key, colors, fonts} of the theme that is kept in the installation, else None."""
    import io
    import json
    import zipfile

    from . import theme as th

    f = theme_file(key)
    if not f.is_file():
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(f.read_bytes())) as z:
            man = json.loads(z.read(next(n for n in z.namelist() if n.endswith("theme.json"))))
        v = th.merged(man.get("values") or {})
        return {"name": man.get("name") or "", "key": man.get("key") or "", "colors": {k: v[k] for k in ("primary", "secondary", "light_bg", "light_text", "dark_bg")}, "fonts": [v["font_heading"], v["font_body"]]}
    except Exception:  # noqa: BLE001
        return None


def install_theme(key):
    """Put the theme of the installation in place as the look of the website (with its logos and home photos). Returns True when there was one."""
    from . import themepacks

    f = theme_file(key)
    if not f.is_file():
        return False
    keys = themepacks.install_zip(f.read_bytes())
    themepacks.use(keys[0], with_files=True)
    return True


def remove_theme(key):
    theme_file(key).unlink(missing_ok=True)


# ── the widgets of the installation: the widgets that are installed on this website (Admin > Thema > Widgets) are kept as a list and installed (active) when the installation is set ──
def widgets_file(key):
    return folder(key) / "widgets.json"


def capture_widgets(key):
    """Keep the widgets that are installed now (and on) in the installation. Returns the keys."""
    from apps.sysobjects import widgets

    if widgets_chosen(key):  # the superadmin chose the widgets of this installation by hand: that choice stays
        return widget_keys(key)
    keys = sorted(k for k, w in widgets.installed().items() if w.enabled)
    folder(key).mkdir(parents=True, exist_ok=True)
    widgets_file(key).write_text(json.dumps({"widgets": keys}, indent=1), encoding="utf-8")
    return keys


def widgets_chosen(key):
    try:
        return bool(json.loads(widgets_file(key).read_text(encoding="utf-8")).get("chosen"))
    except (OSError, ValueError):
        return False


def set_widgets(key, wanted):
    """The superadmin chooses which widgets of the library are installed (and active) with this installation. Unknown keys are skipped. Returns the keys."""
    from apps.sysobjects import widgets

    known = {w["key"] for w in widgets.library()}
    keys = sorted({k for k in wanted if isinstance(k, str) and k in known})
    folder(key).mkdir(parents=True, exist_ok=True)
    widgets_file(key).write_text(json.dumps({"widgets": keys, "chosen": True}, indent=1), encoding="utf-8")
    return keys


def widget_keys(key):
    try:
        d = json.loads(widgets_file(key).read_text(encoding="utf-8"))
        return [k for k in d.get("widgets", []) if isinstance(k, str)]
    except (OSError, ValueError):
        return []


def install_widgets(key):
    """Install the widgets of the installation (active). A widget that is not in the library of this website is skipped. Returns the keys that were installed."""
    from apps.sysobjects import widgets

    done = []
    for k in widget_keys(key):
        try:
            widgets.install(k)
            done.append(k)
        except ValueError:
            logger.warning("Preset %s: widget %s is not in the library", key, k)
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
