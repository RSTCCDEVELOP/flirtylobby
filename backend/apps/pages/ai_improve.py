# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""AI in the editor: improve the PAGE itself (a derivative of the page creator): the layout and the look of the blocks (space, sizes, alignment, widths, colours, hero height),
plus suggestions for new pictures and videos (with stock search). Claude only proposes `ops`; every change goes through `layout.clean`, so a page can never break. Nothing is saved
by `suggest`; `apply` saves and gives the previous layout back so the editor can undo it in one step."""
import copy
import json
import re
import urllib.request
import uuid
from datetime import date

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename

from apps.core import themeimport
from apps.core.models import ContentBlock
from apps.integrations import ai

from . import layout as L
from .models import PageLayout


class ImproveError(ValueError):
    pass


ROW_KEYS = {"width", "gap", "padding", "pad", "mt", "balign", "h_mode", "h", "fx", "top", "v", "style", "inner"}
CELL_KEYS = {"width", "halign", "valign", "style"}
ITEM_KEYS = {"style"}
DICT_KEYS = {"style", "padding"}
LABELS = {"width": "Breedte", "gap": "Ruimte tussen kolommen", "padding": "Ruimte binnen het blok", "pad": "Ruimte binnen het blok", "mt": "Ruimte boven het blok", "balign": "Positie van het blok",
          "h_mode": "Hoogte (soort)", "h": "Hoogte", "fx": "Scroll-effect", "top": "Aansluiting boven", "v": "Uitlijning boven/onder", "style": "Uiterlijk", "inner": "Inhoudsbreedte",
          "halign": "Uitlijning (links/rechts)", "valign": "Uitlijning (boven/onder)"}

SYSTEM = """You are the layout editor of the page creator of easy2edit. You improve ONE web page: its structure and look, NOT its words. The page is a list of rows; a row has cells (columns); a cell has items (text, heading, image, button, spacer, line, widget).
Improve what a good web designer would improve: clear visual hierarchy (headings clearly bigger than text), consistent and generous spacing (padding above and below blocks of 40-90 px, no cramped or empty blocks), calm alignment (one alignment per block, text left or centre, not mixed), readable column widths, balanced two-column blocks (45/55 or 50/50), a hero that is tall enough, good contrast between text and background colour, an image that fills its cell with rounded corners (radius 12-20), and a button that stands out. Keep what is already good. Never change, add or remove content; never touch a text.
Answer with ONE JSON object only: {"ops":[{"id":"<row, cell or item id>","set":{...},"why":"<one short sentence in the language of the instruction (Dutch when empty)>"}],"media":[{"id":"<id of an image item, or of a row whose background should be a picture or video>","kind":"image"|"video","query":"<2-5 english stock search words>","why":"<one short sentence>"}]}.
Allowed `set` keys:
- row: width (30-100 as a number, or "default"), gap ("sm","md","lg"), padding {"t","b","l","r"} in px 0-400, mt (px 0-300), balign ("left","center","right"), h_mode ("px","pct","full") with h (px 80-1600, or percent 10-100), v ("top","center","bottom"), style {"bg": "#rrggbb" or a theme colour (primary, secondary, card, page, text, muted, white, black), "bg_a": 0-100, "color": same colours, "radius": 0-60}.
- cell: width (5-100 as a number, or "auto"), halign ("left","center","right"), valign ("top","center","bottom"), style {"pad": 0-80, "radius": 0-60, "shadow": true, "bg": "#rrggbb", "border": "#rrggbb"}.
- item: style {"size": 0.6-6 (rem), "align": "left"|"center"|"right", "weight": "400".."800" (headings), "mb": 0-6, "mt": 0-6, "color": colour, "radius": 0-999 (images), "w": e.g. "100%" or "320px", "opacity": 0-100}.
Rules: at most 14 ops; only ids that exist; only ops that make a real difference; follow the INSTRUCTION of the owner first. "media": at most 6 suggestions, only where a new picture or video would clearly improve the page (a hero or banner row may get a background video); queries are English stock-photo search words (concrete: "open water swimmers sunrise"); do not suggest a video for an item.
Everything you answer must be valid JSON."""


def _text_of(ref, cache):
    if not ref:
        return ""
    if ref not in cache:
        t = ContentBlock.objects.filter(key=ref).exclude(text__startswith="media:").values_list("text", flat=True).first() or ""
        from apps.core import richtext

        t = richtext.plain(t[len(richtext.PREFIX):]) if t.startswith(richtext.PREFIX) else t
        cache[ref] = re.sub(r"\s+", " ", t).strip()[:70]
    return cache[ref]


def summary(data):
    """The layout for Claude: structure, settings and a short preview of each text (so it knows what a block is about)."""
    cache = {}
    rows = []
    for r in data.get("rows", []):
        row = {k: r[k] for k in ("id", "title", "anchor", "cols", "width", "gap", "padding", "pad", "mt", "h_mode", "h", "balign", "v", "style", "top", "fx", "inner") if r.get(k) not in (None, "", {})}
        if r.get("bg"):
            row["background"] = r["bg"].get("type")
        row["cells"] = []
        for c in r.get("cells", []):
            cell = {k: c[k] for k in ("id", "width", "halign", "valign", "style") if c.get(k) not in (None, "", {})}
            cell["items"] = []
            for it in c.get("items", []):
                x = {"id": it["id"], "type": it["type"]}
                if it.get("style"):
                    x["style"] = it["style"]
                txt = _text_of(it.get("ref"), cache) if it["type"] in ("text", "heading") else ""
                if txt:
                    x["text"] = txt
                if it["type"] == "button":
                    x["text"] = " / ".join(str(v) for v in ((it.get("btn") or {}).get("labels") or {}).values())[:40]
                cell["items"].append(x)
            row["cells"].append(cell)
        rows.append(row)
    return rows


def _index(data):
    idx = {}
    for n, r in enumerate(data.get("rows", []), 1):
        r.setdefault("_n", n)
        idx[r["id"]] = ("row", r)
        for ci, c in enumerate(r.get("cells", []), 1):
            idx[c["id"]] = ("cell", c)
            c["_row"], c["_n"] = r["id"], ci
            for it in c.get("items", []):
                idx[it["id"]] = ("item", it)
                it["_row"] = r["id"]
    return idx


def _apply_op(node, kind, setv):
    allowed = {"row": ROW_KEYS, "cell": CELL_KEYS, "item": ITEM_KEYS}[kind]
    for k, v in (setv or {}).items():
        if k not in allowed:
            continue
        if k in DICT_KEYS:
            if isinstance(v, dict):
                node[k] = {**(node.get(k) if isinstance(node.get(k), dict) else {}), **v}
        else:
            node[k] = v


def apply_ops(data, ops):
    """Apply ops to a copy of the layout and clean it. -> (cleaned layout, [{id, kind, keys}]) with only the ops that really changed something."""
    new = copy.deepcopy(data)
    idx = _index(new)
    for op in ops:
        got = idx.get(str(op.get("id")))
        if got:
            _apply_op(got[1], got[0], op.get("set"))
    cleaned = L.clean(new)
    return cleaned


def _label(kind, node):
    if kind == "row":
        return node.get("title") or node.get("anchor") or "Blok"
    if kind == "cell":
        return "Kolom"
    return {"heading": "Kop", "text": "Tekst", "image": "Afbeelding", "button": "Knop", "spacer": "Witruimte", "line": "Lijn", "widget": "Onderdeel", "object": "Onderdeel"}.get(node.get("type"), "Onderdeel")


def _diff(old, new):
    out = []
    for k in sorted(set(old) | set(new)):
        a, b = old.get(k), new.get(k)
        if a == b:
            continue
        if k in DICT_KEYS and isinstance(b, dict):
            for kk in sorted(set(a or {}) | set(b)):
                if (a or {}).get(kk) != b.get(kk):
                    out.append({"key": f"{k}.{kk}", "old": (a or {}).get(kk), "new": b.get(kk)})
        else:
            out.append({"key": k, "old": a, "new": b})
    return out


def suggest(key, instruction=""):
    if not ai.available():
        raise ImproveError("Claude is niet gekoppeld. Koppel Claude bij Admin → API keys.")
    obj = PageLayout.objects.filter(key=key).first()
    data = L.clean(obj.data) if obj and obj.data.get("rows") else None
    if not data:
        raise ImproveError("Deze pagina heeft nog geen blokken om te verbeteren. Voeg eerst blokken toe.")
    instruction = re.sub(r"\s+", " ", str(instruction or "")).strip()[:500]
    payload = {"instruction": instruction or "Improve the page in general.", "page": key, "rows": summary(data)}
    got = None
    for _ in range(3):
        try:
            got = themeimport._parse_json(ai.claude(SYSTEM, json.dumps(payload, ensure_ascii=False), max_tokens=6000, timeout=180), need=("ops", "media"))
            break
        except ValueError:
            continue
    if got is None:
        raise ImproveError("Claude gaf geen bruikbaar antwoord. Probeer het nog eens.")
    idx = _index(data)
    changes = []
    for op in (got.get("ops") or [])[:14]:
        if not isinstance(op, dict) or str(op.get("id")) not in idx or not isinstance(op.get("set"), dict):
            continue
        kind, node = idx[str(op["id"])]
        try:
            cleaned = apply_ops(data, [op])
        except ValueError:
            continue
        new_node = _index(cleaned)[str(op["id"])][1]
        d = _diff({k: node.get(k) for k in node if k != "cells" and k != "items"}, {k: new_node.get(k) for k in new_node if k != "cells" and k != "items"})
        d = [x for x in d if x["key"].split(".")[0] in {"row": ROW_KEYS, "cell": CELL_KEYS, "item": ITEM_KEYS}[kind]]
        if d:
            rown = next((r for r in data["rows"] if r["id"] == (node.get("_row") if kind != "row" else node["id"])), {})
            where = (rown.get("title") or rown.get("anchor") or f"blok {rown.get('_n', '')}").strip() if kind != "row" else ""
            changes.append({"id": str(op["id"]), "kind": kind, "label": _label(kind, node), "where": where, "tag": node.get("type", "") if kind == "item" else "", "text": _text_of(node.get("ref"), {}) if kind == "item" else "", "why": str(op.get("why") or "")[:200],
                            "set": op["set"], "diff": d, "title": [LABELS.get(x["key"].split(".")[0], x["key"]) for x in d][:4]})
    media = []
    for m in (got.get("media") or [])[:6]:
        if not isinstance(m, dict) or str(m.get("id")) not in idx:
            continue
        kind, node = idx[str(m["id"])]
        mk = "video" if m.get("kind") == "video" and kind == "row" else "image"
        if kind == "item" and node.get("type") != "image":
            continue
        q = re.sub(r"[^a-z0-9 ]+", " ", str(m.get("query") or "").lower()).strip()[:60]
        if q and kind in ("row", "item"):
            media.append({"id": str(m["id"]), "target": kind, "label": _label(kind, node), "kind": mk, "query": q, "why": str(m.get("why") or "")[:200]})
    return {"changes": changes, "media": media}


def apply(key, ops):
    """Save the chosen ops. -> {before: the layout as it was (the editor puts it back with undo), after}."""
    obj = PageLayout.objects.filter(key=key).first()
    if not obj:
        raise ImproveError("Pagina niet gevonden.")
    before = copy.deepcopy(obj.data)
    ops = [o for o in (ops or []) if isinstance(o, dict)][:30]
    try:
        cleaned = apply_ops(L.clean(before), ops)
    except ValueError as e:
        raise ImproveError(str(e))
    PageLayout.objects.filter(pk=obj.pk).update(data=cleaned)
    return {"before": before, "after": L.with_urls(cleaned)}


def stock(query, kind="image"):
    """Free stock photos (Pexels, Unsplash) or videos (Pexels) for a search: [{source, id, preview, full, video, title, url}]. Needs the link of Pexels or Unsplash (Admin -> API keys)."""
    from apps.core import sitecreator as sc

    out, errors = [], []
    for fn, video in ((sc.search_pexels, kind == "video"), (sc.search_unsplash, False)):
        if kind == "video" and fn is sc.search_unsplash:
            continue
        try:
            out += fn(query, video=video)
        except ValueError as e:
            errors.append(str(e))
    if not out and errors:
        raise ImproveError(errors[0])
    return out[:18]


ALLOWED_HOSTS = {"images.pexels.com", "videos.pexels.com", "images.unsplash.com"}
MAX_BYTES = {"image": 15 * 2**20, "video": 60 * 2**20}


def _download(url, kind):
    m = re.match(r"^https://([a-z0-9.-]+)/", str(url or ""))
    if not m or m.group(1) not in ALLOWED_HOSTS:
        raise ImproveError("Dit bestand komt niet van een toegestane bron.")
    req = urllib.request.Request(url, headers={"User-Agent": "easy2edit"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read(MAX_BYTES[kind] + 1)
    except Exception:  # noqa: BLE001
        raise ImproveError("Downloaden is niet gelukt. Probeer het nog eens.")
    if len(data) > MAX_BYTES[kind]:
        raise ImproveError("Het bestand is te groot.")
    return data


def use_stock(key, target_id, item, user):
    """Download a stock photo or video into the media library and put it in the page: a picture in an image, or as the background of a row. -> {before layout, block: {key, prev}, media}"""
    from apps.medialib.models import MediaItem

    obj = PageLayout.objects.filter(key=key).first()
    if not obj:
        raise ImproveError("Pagina niet gevonden.")
    data = L.clean(obj.data)
    got = _index(data).get(str(target_id))
    if not got:
        raise ImproveError("Dit onderdeel staat niet meer op de pagina.")
    kind_t, node = got
    is_video = bool(item.get("video")) and kind_t == "row"
    url = item.get("video") if is_video else item.get("full")
    blob = _download(url, "video" if is_video else "image")
    ext = "mp4" if is_video else "jpg"
    name = get_valid_filename(f"{item.get('source', 'stock')}-{item.get('id', uuid.uuid4().hex[:6])}.{ext}")
    from apps.medialib import areas

    stored = default_storage.save(areas.site_path("library", f"{date.today():%Y/%m}/{uuid.uuid4().hex[:8]}-{name}"), ContentFile(blob))
    media = MediaItem.objects.get(key=stored)
    media.name, media.uploaded_by = name[:255], user
    media.save(update_fields=["name", "uploaded_by"])
    before, block = copy.deepcopy(obj.data), None
    if kind_t == "row":
        node["bg"] = {"type": "video" if is_video else "image", "media": media.id, "overlay": 0.35}
        PageLayout.objects.filter(pk=obj.pk).update(data=L.clean(data))
    elif kind_t == "item" and node.get("type") == "image":
        ref = node.get("ref") or f"layout.{key}.{node['id']}"
        prev = ContentBlock.objects.filter(key=ref, lang="*").values_list("text", flat=True).first() or ""
        ContentBlock.objects.update_or_create(key=ref, lang="*", defaults={"text": f"media:{media.id}"})
        if not node.get("ref"):
            node["ref"] = ref
            PageLayout.objects.filter(pk=obj.pk).update(data=L.clean(data))
        block = {"key": ref, "prev": prev[6:] if prev.startswith("media:") else ""}
    else:
        raise ImproveError("Hier kan geen afbeelding of video in.")
    return {"before": before, "block": block, "media": media.id, "after": L.with_urls(L.clean(PageLayout.objects.get(pk=obj.pk).data))}


# ── a job in the background with a progress bar and a counter of what the AI costs (like the page creator) ──
import sys
import threading
import time

from django.core.cache import cache

STEPS = {"read": ("Pagina lezen", 8), "ai": ("Claude beoordeelt de opbouw van de pagina", 15), "check": ("Voorstellen controleren", 92), "done": ("Klaar", 100)}


def _jobkey(job_id):
    return f"aiimp:{job_id}"


def _set(job_id, **kw):
    job = cache.get(_jobkey(job_id)) or {}
    job.update(kw)
    cache.set(_jobkey(job_id), job, 3600)


def start(key, instruction, user):
    """Start the improvement in the background. -> {id}. Poll `status(id)`."""
    if not ai.available():
        raise ImproveError("Claude is niet gekoppeld. Koppel Claude bij Admin → API keys.")
    job_id = uuid.uuid4().hex[:10]
    cache.set(_jobkey(job_id), {"status": "running", "step": STEPS["read"][0], "phase": "read", "progress": STEPS["read"][1], "t": time.time(), "user": getattr(user, "pk", None), "error": "", "result": None}, 3600)

    def work():
        from apps.integrations import aiusage

        try:
            with aiusage.for_ref(f"improve:{job_id}"):
                _set(job_id, phase="ai", step=STEPS["ai"][0], progress=STEPS["ai"][1], t_ai=time.time())
                res = suggest(key, instruction)
            _set(job_id, phase="done", step=STEPS["done"][0], progress=100, status="done", result=res)
        except (ImproveError, ValueError) as e:
            _set(job_id, status="error", error=str(e), step="Mislukt")
        except Exception as e:  # noqa: BLE001
            _set(job_id, status="error", error="Er ging iets mis. Probeer het nog eens.", step="Mislukt")

    runner = lambda: aiusage.run_as(getattr(user, "pk", None), work) if getattr(user, "pk", None) else work()  # noqa: E731
    from apps.integrations import aiusage

    if "pytest" in sys.modules:
        runner()
    else:
        threading.Thread(target=runner, daemon=True, name="ai-improve").start()
    return {"id": job_id}


def usage_of(job_id):
    """What the AI of this improvement costs so far: calls, tokens and the price that is charged (margin included), with the calls that are still busy."""
    from django.db.models import Count, Sum

    from apps.integrations import aiusage
    from apps.integrations.models import AiUsage

    ref = f"improve:{job_id}"
    a = AiUsage.objects.filter(ref=ref).aggregate(n=Count("id"), i=Sum("tokens_in"), o=Sum("tokens_out"), c=Sum("charged"))
    busy = aiusage.running_for(ref)
    return {"calls": int(a["n"] or 0) + len(busy), "tokens": int((a["i"] or 0) + (a["o"] or 0) + sum(b["tokens"] for b in busy)), "charged": round(float(a["c"] or 0) + sum(b["charged"] for b in busy), 4), "busy": len(busy)}


def status(job_id):
    job = cache.get(_jobkey(job_id))
    if not job:
        raise ImproveError("Deze opdracht is niet meer bekend. Start opnieuw.")
    out = {k: job.get(k) for k in ("status", "step", "progress", "error", "result")}
    if job.get("status") == "running" and job.get("phase") == "ai" and job.get("t_ai"):  # the answer of Claude takes a while: the bar moves on slowly (never to the end before it is there)
        out["progress"] = round(min(88, STEPS["ai"][1] + (time.time() - job["t_ai"]) * 2.0), 1)
    out["usage"] = usage_of(job_id)
    out["seconds"] = round(time.time() - (job.get("t") or time.time()), 1)
    return out
