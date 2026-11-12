# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The advice of the module Energie: what makes the pages heavy, what can be improved with a setting (and applied here, and put back), what has to be done outside the system, and the score that is expected afterwards."""
import io
import logging
import os
import shutil

from django.conf import settings as dj
from django.utils import timezone

from . import service as E
from .models import EnergySettings

logger = logging.getLogger(__name__)

FONT_BYTES = 18_000  # one weight of one Google font (woff2, latin): an estimate
IMG_DEFAULTS = {"threshold_kb": 300, "max_edge": 2000, "quality": 82, "keep_originals": True}
IMG_LIMIT_MB = 2
GZIP_SAVES = 0.7  # compressing text (scripts, styles, html) saves about 70%
DEV_SAVES = 0.8  # a production build of the scripts is about 80% smaller than a development build (after compression)


def _rating_of(avg):
    g = E.co2_g(avg)
    return {"avg_bytes": round(avg), "co2_g": round(g, 4), "rating": E.rating(g) if avg else ""}


def _applied(st):
    return (st.advice or {}).get("applied", {})


# ── what is found ──
def _fonts(st):
    from apps.core import theme as T
    from apps.core.models import SiteSettings

    vals = T.merged(SiteSettings.load().theme)
    fam, keys = {}, []
    for key, f in T.FIELDS.items():
        if f["type"] == "choice" and "font" in key:
            c = next((c for c in f["choices"] if c["value"] == vals[key]), None)
            if c and c.get("google"):
                fam[c["google"]] = c.get("wght", T._W)
                keys.append(key)
    saving = sum(len(w.split(";")) for w in fam.values()) * FONT_BYTES
    return fam, keys, saving


def _images(params):
    """The pictures of the library that are heavier than they need to be, with the expected saving."""
    from PIL import Image

    from apps.medialib.models import MediaItem, is_user_content

    thr = int(params["threshold_kb"]) * 1000
    edge = int(params["max_edge"])
    rows, saving = [], 0
    for it in MediaItem.objects.filter(kind="image", storage="local", encrypted=False, size__gt=thr).order_by("-size")[:300]:
        ext = it.key.rsplit(".", 1)[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp") or is_user_content(it.key) or it.key.startswith("originals/"):
            continue
        try:
            with Image.open(it.local_path) as im:
                w, h = im.size
        except Exception:  # noqa: BLE001
            continue
        scale = min(1.0, edge / max(w, h)) ** 2
        new = it.size * scale * (0.75 if ext in ("jpg", "jpeg", "webp") else 0.85)
        if new < it.size * 0.9:
            rows.append({"id": it.pk, "name": it.name, "size": it.size, "w": w, "h": h, "after": int(new)})
            saving += it.size - new
    return rows, int(saving)


def analyse(params=None):
    """{"current", "items", "after_apply", "after_all"}: the score now, the advice and the score that is expected after applying it."""
    from apps.core import system

    st = EnergySettings.load()
    sm = E.summary(30, st)
    avg = sm["summary"]["avg_page_bytes"]
    done = _applied(st)
    p = {**IMG_DEFAULTS, **(params or {})}
    scans = [s for s in sm["scans"]]
    items, apply_save, manual_save = [], 0, 0

    # 1. fonts from Google
    fam, keys, fsave = _fonts(st)
    if "fonts" in done:
        items.append({"key": "fonts", "status": "applied", "applicable": True, "saving": 0, "estimate": True, "applied": done["fonts"], "detail": []})
    elif fam:
        items.append({"key": "fonts", "status": "todo", "applicable": True, "saving": fsave, "estimate": True, "detail": [f"{n}: {w.replace(';', ', ')}" for n, w in fam.items()], "not_in_scan": sm["source"] != "visitors"})
        if sm["source"] == "visitors":  # a scan does not count fonts of another address, so then they are not in the score that is shown
            apply_save += fsave
    else:
        items.append({"key": "fonts", "status": "ok", "applicable": True, "saving": 0, "detail": []})

    # 2. heavy pictures in the library
    if "images" in done:
        items.append({"key": "images", "status": "applied", "applicable": True, "saving": 0, "estimate": True, "applied": done["images"], "params": p, "detail": []})
    else:
        rows, isave = _images(p)
        page_img = (sum(sc["breakdown"].get("image", 0) for sc in scans) / len(scans)) if scans else avg * 0.4  # the pictures that the measured pages really load
        page_save = int(min(isave, page_img * 0.4))  # what a page gains: not more than a part of its own pictures
        items.append({"key": "images", "status": "todo" if rows else "ok", "applicable": True, "saving": page_save, "library_saving": isave, "estimate": True, "params": p,
                      "detail": [f"{r['name']}: {r['w']}×{r['h']}, {E_kb(r['size'])} → ca. {E_kb(r['after'])}" for r in rows[:6]] + ([f"+ {len(rows) - 6} {'meer'}"] if len(rows) > 6 else []), "count": len(rows)})
        apply_save += page_save if rows else 0

    # 3. upload limit
    cur = system.limit_mb("max_image_mb")
    if "image_limit" in done:
        items.append({"key": "image_limit", "status": "applied", "applicable": True, "saving": 0, "applied": done["image_limit"], "params": {"mb": IMG_LIMIT_MB}, "detail": []})
    else:
        items.append({"key": "image_limit", "status": "todo" if cur > 5 else "ok", "applicable": True, "saving": 0, "params": {"mb": IMG_LIMIT_MB}, "detail": [f"{cur} MB"]})

    # 4. compression and 5. a production build (outside the system)
    plain = [s["breakdown"].get("plain_text", 0) for s in scans]
    script = [s["breakdown"].get("script", 0) for s in scans]
    avg_plain = sum(plain) / len(plain) if plain else 0
    avg_script = sum(script) / len(script) if script else 0
    dev = system.get().get("environment") != "production" or (avg_script > 1_500_000 and avg_plain > 1_000_000)
    if not scans:
        items.append({"key": "compression", "status": "unknown", "applicable": False, "saving": 0, "detail": []})
    elif avg_plain > 50_000:
        gz = int(avg_plain * GZIP_SAVES)
        items.append({"key": "compression", "status": "manual", "applicable": False, "saving": gz, "estimate": True, "detail": [f"{E_kb(avg_plain)}"]})
        manual_save = max(manual_save, gz)
    else:
        items.append({"key": "compression", "status": "ok", "applicable": False, "saving": 0, "detail": []})
    if dev:
        ds = int(avg_script * DEV_SAVES) if avg_script > 500_000 else 0
        items.append({"key": "production", "status": "manual", "applicable": False, "saving": ds, "estimate": True, "detail": [f"{E_kb(avg_script)}"] if avg_script else []})
        manual_save = max(manual_save, ds)
    else:
        items.append({"key": "production", "status": "ok", "applicable": False, "saving": 0, "detail": []})

    # 6. the heaviest pages
    pages = sorted([{"path": x["path"], "bytes": x["avg_bytes"]} for x in sm["pages"]] + [{"path": x["path"], "bytes": x["bytes"]} for x in sm["scans"]], key=lambda r: -r["bytes"])
    heavy = [r for r in pages if r["bytes"] > E.BENCH_BYTES * 0.8][:4]
    items.append({"key": "heavy", "status": "info" if heavy else "ok", "applicable": False, "saving": 0, "detail": [f"{r['path']}: {E_kb(r['bytes'])}" for r in heavy]})

    cur_score = _rating_of(avg)
    return {"current": cur_score, "items": items, "after_apply": _rating_of(max(avg - apply_save, avg * 0.1)) if avg else cur_score, "after_all": _rating_of(max(avg - apply_save - manual_save, avg * 0.08)) if avg else cur_score,
            "saving_apply": int(apply_save), "saving_manual": int(manual_save), "source": sm["source"], "has_scan": bool(scans), "environment": system.get().get("environment")}


def E_kb(n):
    return f"{n / 1e6:.2f} MB" if n >= 1e6 else f"{n / 1e3:.0f} KB"


# ── applying (and putting back) ──
def _save_applied(st, key, rec):
    a = dict(st.advice or {})
    ap = dict(a.get("applied", {}))
    if rec is None:
        ap.pop(key, None)
    else:
        ap[key] = rec
    a["applied"] = ap
    st.advice = a
    st.save(update_fields=["advice"])


def apply_fonts(st):
    from apps.core import theme as T
    from apps.core.models import SiteSettings

    cur = SiteSettings.load()
    vals = T.merged(cur.theme)
    fam, keys, saving = _fonts(st)
    if not keys:
        return {"changed": 0}
    before = {k: vals[k] for k in keys}
    new = {**vals, **{k: "System" for k in keys}}
    cur.theme = {k: v for k, v in new.items() if v != T.DEFAULTS[k]}
    cur.save()
    _save_applied(st, "fonts", {"at": timezone.now().isoformat(), "before": before, "saving": saving})
    return {"changed": len(keys), "families": list(fam)}


def apply_limit(st, mb):
    from apps.core import system

    cur = system.limit_mb("max_image_mb")
    mb = max(1, min(50, int(mb or IMG_LIMIT_MB)))
    clean, errors = system.clean({"max_image_mb": str(mb)})
    if errors:
        raise ValueError(list(errors.values())[0])
    system.save(clean)
    _save_applied(st, "image_limit", {"at": timezone.now().isoformat(), "before": cur, "after": mb})
    return {"from": cur, "to": mb}


def apply_images(st, params, limit=80):
    """Makes the heavy pictures of the library lighter: at most `max_edge` px on the long side and a lighter file. The original is kept (originals/…) so it can be put back."""
    from PIL import Image

    from apps.medialib.models import MediaItem

    p = {**IMG_DEFAULTS, **(params or {})}
    rows, _ = _images(p)
    done, saved = [], 0
    root = str(dj.MEDIA_ROOT)
    for r in rows[:limit]:
        it = MediaItem.objects.filter(pk=r["id"]).first()
        if not it or not os.path.exists(it.local_path):
            continue
        ext = it.key.rsplit(".", 1)[-1].lower()
        try:
            with Image.open(it.local_path) as im:
                im.load()
                img = im.copy()
                fmt = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}[ext]
            w, h = img.size
            if max(w, h) > int(p["max_edge"]):
                k = int(p["max_edge"]) / max(w, h)
                img = img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
            buf = io.BytesIO()
            if fmt == "JPEG":
                img.convert("RGB").save(buf, "JPEG", quality=int(p["quality"]), optimize=True, progressive=True)
            elif fmt == "WEBP":
                img.save(buf, "WEBP", quality=int(p["quality"]), method=6)
            else:
                img.save(buf, "PNG", optimize=True)
            data = buf.getvalue()
            if len(data) >= it.size * 0.9:
                continue
            if p["keep_originals"]:
                dest = os.path.join(root, "originals", it.key)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                if not os.path.exists(dest):
                    shutil.copy2(it.local_path, dest)
            with open(it.local_path, "wb") as fh:
                fh.write(data)
            saved += it.size - len(data)
            done.append({"id": it.pk, "key": it.key, "before": it.size, "after": len(data)})
            it.size = len(data)
            it.save(update_fields=["size"])
        except Exception:  # noqa: BLE001
            logger.exception("optimise %s", it.key)
    _save_applied(st, "images", {"at": timezone.now().isoformat(), "files": done, "saved": saved, "params": p, "originals": bool(p["keep_originals"]), "remaining": max(0, len(rows) - limit)})
    return {"files": len(done), "saved": saved, "remaining": max(0, len(rows) - limit)}


def apply(selection):
    """selection: {"fonts": true, "image_limit": {"mb": 2}, "images": {…params}}. Returns what was done per advice."""
    st = EnergySettings.load()
    out = {}
    if selection.get("fonts"):
        out["fonts"] = apply_fonts(st)
    if selection.get("image_limit"):
        out["image_limit"] = apply_limit(st, (selection["image_limit"] or {}).get("mb") if isinstance(selection["image_limit"], dict) else None)
    if selection.get("images"):
        out["images"] = apply_images(st, selection["images"] if isinstance(selection["images"], dict) else {})
    return out


def revert(key):
    st = EnergySettings.load()
    rec = _applied(st).get(key)
    if not rec:
        raise ValueError("Dit advies is niet toegepast.")
    if key == "fonts":
        from apps.core import theme as T
        from apps.core.models import SiteSettings

        cur = SiteSettings.load()
        new = {**T.merged(cur.theme), **rec["before"]}
        cur.theme = {k: v for k, v in new.items() if v != T.DEFAULTS[k]}
        cur.save()
    elif key == "image_limit":
        from apps.core import system

        clean, _ = system.clean({"max_image_mb": str(rec["before"])})
        system.save(clean)
    elif key == "images":
        from apps.medialib.models import MediaItem

        root = str(dj.MEDIA_ROOT)
        back = 0
        for f in rec.get("files", []):
            src = os.path.join(root, "originals", f["key"])
            it = MediaItem.objects.filter(pk=f["id"]).first()
            if it and os.path.exists(src):
                shutil.copy2(src, it.local_path)
                it.size = f["before"]
                it.save(update_fields=["size"])
                back += 1
        if not back and rec.get("files"):
            raise ValueError("De originelen zijn niet meer aanwezig.")
    else:
        raise ValueError("Onbekend advies.")
    _save_applied(st, key, None)
    return {"reverted": key}
