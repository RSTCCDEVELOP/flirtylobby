# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Blocks / grid of a page (edit mode): validation and the two endpoints."""
import re
import secrets

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import has_level
from apps.core.modules import module_required

from .models import PageLayout

ID_RE = re.compile(r"^[a-z0-9]{4,16}$")
KEY_RE = re.compile(r"^[a-z0-9_-]{1,80}$")
HALIGN, VALIGN, GAPS, TYPES = ("left", "center", "right"), ("top", "center", "bottom"), ("sm", "md", "lg"), ("text", "image", "object", "heading")
MAX_ROWS, MAX_ITEMS = 40, 300


def _pct(v, lo, hi, default):
    """A width: the default word, or a whole percentage between lo and hi."""
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return str(max(lo, min(hi, n)))


def clean_bg(bg):
    """The background of a row or hero: {type: image|video, media: id of the media library, overlay 0-0.9}; {} = none."""
    from apps.medialib.models import MediaItem

    if not isinstance(bg, dict) or bg.get("type") not in ("image", "video"):
        return {}
    item = MediaItem.objects.filter(pk=bg.get("media")).first()
    if not item or item.kind != bg["type"]:
        return {}
    try:
        overlay = min(max(float(bg.get("overlay", 0.35)), 0), 0.9)
    except (TypeError, ValueError):
        overlay = 0.35
    out = {"type": bg["type"], "media": item.id, "overlay": round(overlay, 2)}
    hv = bg.get("hover")
    if isinstance(hv, dict) and hv.get("mode") in ("opacity", "swap"):
        try:
            op = int(min(max(float(hv.get("opacity", 60)), 0), 100))
        except (TypeError, ValueError):
            op = 60
        h = {"mode": hv["mode"], "opacity": op}
        if hv["mode"] == "swap":
            other = MediaItem.objects.filter(pk=hv.get("media"), kind__in=("image", "video")).first()
            if not other:
                h = None
            else:
                h.update({"type": other.kind, "media": other.id})
        if h:
            out["hover"] = h
    return out


def with_urls(data):
    """The layout for the page: every background gets its address (from the media library)."""
    from django.core.files.storage import default_storage

    from apps.medialib.models import MediaItem

    def one(bg):
        item = MediaItem.objects.filter(pk=(bg or {}).get("media")).first() if bg else None
        if not item:
            return {}
        out_bg = {**bg, "url": default_storage.url(item.key)}
        hv = bg.get("hover")
        other = MediaItem.objects.filter(pk=hv.get("media")).first() if isinstance(hv, dict) and hv.get("media") else None
        if other:
            out_bg["hover"] = {**hv, "url": default_storage.url(other.key)}
        return out_bg

    out = {**data, "rows": [{**r, "bg": one(r.get("bg"))} for r in data.get("rows", [])]}
    out["bg"] = one(data.get("bg"))
    return out


PADS = ("none", "sm", "md", "lg", "xl")
HEIGHTS = ("px", "pct", "full")


TOKENS = ("primary", "secondary", "card", "page", "text", "muted", "ok", "danger", "white", "black")
FONTS = ("body", "heading", "serif", "mono")
HEX = re.compile(r"#[0-9a-fA-F]{6}")


def _col(v):
    v = str(v or "")
    return v if v in TOKENS or HEX.fullmatch(v) else ""


def _style(st):
    """Look of a block or hero: background colour (a colour of the theme or an own colour) with transparency, text colour and font. Empty = what the theme says."""
    if not isinstance(st, dict):
        return {}
    out = {}
    if _col(st.get("bg")):
        out["bg"] = _col(st["bg"])
        try:
            out["bg_a"] = min(max(int(st.get("bg_a", 100)), 0), 100)
        except (TypeError, ValueError):
            out["bg_a"] = 100
    if _col(st.get("color")):
        out["color"] = _col(st["color"])
    if st.get("font") in FONTS:
        out["font"] = st["font"]
    if st.get("radius") not in (None, ""):
        try:
            out["radius"] = min(max(int(st["radius"]), 0), 200)
        except (TypeError, ValueError):
            pass
    return out


TAGS = ("k1", "k2", "k3", "k4", "p")


def _item_style(st):
    """Look of one text: a text style of the theme (Kop 1-4, Alinea) and/or an own size, colour and font."""
    if not isinstance(st, dict):
        return {}
    out = {}
    if st.get("tag") in TAGS:
        out["tag"] = st["tag"]
    try:
        if st.get("size") not in (None, "", 0):
            out["size"] = round(min(max(float(st["size"]), 0.6), 6), 2)
    except (TypeError, ValueError):
        pass
    if _col(st.get("color")):
        out["color"] = _col(st["color"])
    if st.get("font") in FONTS:
        out["font"] = st["font"]
    if st.get("align") in ("left", "center", "right"):
        out["align"] = st["align"]
    if str(st.get("weight") or "") in ("400", "500", "600", "700", "800"):
        out["weight"] = str(st["weight"])  # a heading: how bold
    try:
        if st.get("mb") not in (None, ""):
            out["mb"] = round(min(max(float(st["mb"]), 0), 6), 2)  # a heading: space below it (rem)
    except (TypeError, ValueError):
        pass
    if re.fullmatch(r"[1-9][0-9]{0,3}(px|%)", str(st.get("w") or "")):
        out["w"] = str(st["w"])
    for key, lo, hi in (("opacity", 0, 100), ("radius", 0, 200)):
        if st.get(key) not in (None, ""):
            try:
                out[key] = min(max(int(st[key]), lo), hi)
            except (TypeError, ValueError):
                pass
    return out


def _row_extra(r):
    """Extra settings of a row: a hero (a banner: its name or "custom"), the height of a hero (px, % of the screen or the full screen) and the space (padding) above and below."""
    out = {}
    if r.get("hero"):
        out["hero"] = str(r["hero"])[:20]
    if r.get("h_mode") in HEIGHTS:  # the height: any block can have one (not only a hero)
        out["h_mode"] = r["h_mode"]
        try:
            out["h"] = min(max(int(r.get("h") or 0), 10 if r["h_mode"] == "pct" else 80), 100 if r["h_mode"] == "pct" else 1600) if r["h_mode"] != "full" else 100
        except (TypeError, ValueError):
            out["h"] = 50 if r["h_mode"] == "pct" else 400
    pd = r.get("padding")
    if isinstance(pd, dict):  # the space inside the block per side, in pixels: top (t), right (r), bottom (b), left (l)
        clean = {}
        for k in ("t", "r", "b", "l"):
            try:
                if pd.get(k) is not None and pd.get(k) != "":
                    clean[k] = min(max(int(pd[k]), 0), 400)
            except (TypeError, ValueError):
                pass
        if clean:
            out["padding"] = clean
    if r.get("pad") in PADS:
        out["pad"] = r["pad"]
    if r.get("fx") in ("none", "fade", "up", "down", "zoom", "left", "right", "blur"):
        out["fx"] = r["fx"]  # the scroll effect of this block ("" = what the theme says)
    if r.get("screen"):
        out["screen"] = True  # the width is a share of the whole browser window, not of the page column
    if r.get("top") in ("touch", "prev"):
        out["top"] = r["top"]  # touch: directly against the header (no space above it); prev: directly against the block above it
    try:
        if r.get("mt") not in (None, ""):
            out["mt"] = min(max(int(r["mt"]), 0), 300)  # the space between this block and the one above it, in pixels
    except (TypeError, ValueError):
        pass
    title = str(r.get("title") or "").strip()[:80]
    if title:
        out["title"] = title  # the name of the block (shown in edit mode and usable as a link)
    anchor = re.sub(r"[^a-z0-9-]+", "-", str(r.get("anchor") or "").lower()).strip("-")[:40]
    if anchor:
        out["anchor"] = anchor  # the block can be opened with page-address#anchor
    if r.get("sq_mobile"):
        out["sq_mobile"] = True  # no rounded corners on a phone (the corners are square there)
    if r.get("v") in ("top", "center", "bottom"):
        out["v"] = r["v"]
    if _style(r.get("style")):
        out["style"] = _style(r["style"])
    return out


def _moved(data):
    """The fixed elements of a page (logo, title, intro) that were dragged into a block: their content keys (they are hidden at their old place)."""
    m = [str(k) for k in ((data or {}).get("moved") or []) if re.fullmatch(r"[a-z0-9._-]{1,80}", str(k))][:30]
    return {"moved": m} if m else {}


def _list(v):
    """How the lists on a page (games, products, subscriptions ...) are shown: as a grid or in rows, centred or not."""
    if not isinstance(v, dict):
        return {}
    out = {"view": "rows" if v.get("view") == "rows" else "grid", "center": bool(v.get("center"))}
    return {"list": out} if out != {"view": "grid", "center": False} else {}


def clean(data):
    """Returns the cleaned layout or raises ValueError with a readable message."""
    rows, out, n_items, seen = (data or {}).get("rows") or [], [], 0, set()

    def uid(v):
        v = str(v or "")
        if not ID_RE.match(v) or v in seen:
            raise ValueError("Ongeldig of dubbel nummer in de indeling.")
        seen.add(v)
        return v

    def new_id():
        while True:
            v = secrets.token_hex(4)
            if v not in seen:
                seen.add(v)
                return v

    if len(rows) > MAX_ROWS:
        raise ValueError("Te veel rijen op één pagina.")
    for r in rows:
        cols = int(r.get("cols") or 1)
        if not 1 <= cols <= 4:
            raise ValueError("Een rij heeft 1 tot 4 kolommen.")
        cells = []
        for c in (r.get("cells") or [])[:cols]:
            items = []
            for it in c.get("items") or []:
                t = it.get("type")
                if t not in TYPES:
                    raise ValueError("Onbekend soort onderdeel.")
                n_items += 1
                items.append({"id": uid(it.get("id")), "type": t, "ref": (str(it.get("ref") or "")[:80] if t == "object" or re.fullmatch(r"[a-z0-9._-]{1,80}", str(it.get("ref") or "")) else ""), **({"style": _item_style(it.get("style"))} if t in ("text", "image", "heading") and _item_style(it.get("style")) else {}), **({"layout": str(it.get("layout"))} if t == "object" and str(it.get("layout")) in ("2", "3", "4") else {})})
            cells.append({"id": uid(c.get("id")), "width": _pct(c.get("width"), 5, 100, "auto"), "halign": c.get("halign") if c.get("halign") in HALIGN else "left", "valign": c.get("valign") if c.get("valign") in VALIGN else "top", "items": items})
        while len(cells) < cols:
            cells.append({"id": new_id(), "width": "auto", "halign": "left", "valign": "top", "items": []})
        out.append({"bg": clean_bg(r.get("bg")), "id": uid(r.get("id")), "cols": cols, "width": _pct(r.get("width"), 30, 100, "default"), "gap": r.get("gap") if r.get("gap") in GAPS else "md", "cells": cells, **_row_extra(r)})
    if n_items > MAX_ITEMS:
        raise ValueError("Te veel onderdelen op één pagina.")
    seen = set()
    for row in out:  # an anchor is used once on a page
        a = row.get("anchor")
        if a:
            base, n = a, 2
            while a in seen:
                a, n = f"{base}-{n}", n + 1
            seen.add(a)
            row["anchor"] = a
    return {"rows": out, "bg": clean_bg((data or {}).get("bg")), "preset": (data or {}).get("preset") if (data or {}).get("preset") in PRESETS else "", **({"hero_off": True} if (data or {}).get("hero_off") else {}), **_list((data or {}).get("list")), **_moved(data), **({"pad": (data or {}).get("pad")} if (data or {}).get("pad") in PADS else {}), **({"page_width": "full"} if (data or {}).get("page_width") == "full" else {}), **({"page_size": str((data or {}).get("page_size"))} if str((data or {}).get("page_size")) in ("5", "10", "25", "100") else {})}


PRESETS = ("auto", "single", "two", "three", "four", "hero", "split")  # the layouts ("Opmaak") a page can be given; "auto" = the layout of the community theme (standard pages only)


def reflow(data, preset):
    """The same items (text, pictures, system objects) in another grid. The ids of the items stay (so their texts stay); rows and cells are new."""
    old = (data or {}).get("rows", [])
    heroes = [r for r in old if r.get("hero")]  # the heroes stay at the top of every layout
    items = [it for r in old if not r.get("hero") for c in r.get("cells", []) for it in c.get("items", [])]
    n = [0]

    def cell(its, halign="left", width="auto"):
        n[0] += 1
        return {"id": secrets.token_hex(4), "width": width, "halign": halign, "valign": "top", "items": its}

    def row(cells, gap="md"):
        return {"id": secrets.token_hex(4), "cols": len(cells), "width": "default", "gap": gap, "cells": cells, "bg": {}}

    def grid(its, cols, gap="md"):
        return [row([cell([x]) for x in its[i:i + cols]] + [cell([]) for _ in range(cols - len(its[i:i + cols]))], gap) for i in range(0, len(its), cols)]

    if preset == "single":
        rows = [row([cell([x])]) for x in items]
    elif preset in ("two", "three", "four"):
        rows = grid(items, {"two": 2, "three": 3, "four": 4}[preset], "md")
    elif preset == "hero":  # the first item across the whole width, the rest in three columns
        rows = ([row([cell([items[0]], "center")], "lg")] if items else []) + grid(items[1:], 3, "lg")
    elif preset == "split":  # a wide column and a narrow one
        half = (len(items) + 1) // 2
        rows = [row([cell(items[:half], "left", "66"), cell(items[half:], "left", "33")], "lg")] if items else []
    else:
        rows = [r for r in old if not r.get("hero")]
    rows = heroes + rows
    return {"rows": rows, "bg": (data or {}).get("bg", {}), **({"hero_off": True} if (data or {}).get("hero_off") else {}), **_list((data or {}).get("list")), **_moved(data), **({"pad": (data or {}).get("pad")} if (data or {}).get("pad") in PADS else {}),  **({"page_width": "full"} if (data or {}).get("page_width") == "full" else {}), **({"page_size": str((data or {}).get("page_size"))} if str((data or {}).get("page_size")) in ("5", "10", "25", "100") else {})}


@api_view(["POST"])
@permission_classes([AllowAny])
def preset(request, key):
    """Edit mode: give a page another layout ("Opmaak"). The items stay, only their grid changes."""
    from apps.accounts.access import level
    from apps.core import modules

    if not KEY_RE.match(key):
        return Response(status=status.HTTP_404_NOT_FOUND)
    if not (request.user.is_authenticated and modules.enabled("edit_mode") and level(request.user, "edit_mode") >= 2):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
    name = request.data.get("preset")
    if name not in PRESETS:
        return Response({"detail": "Onbekende opmaak."}, status=status.HTTP_400_BAD_REQUEST)
    if name == "auto":  # the layout of the community theme (the standard pages have one)
        from . import defaults
        from apps.plugins import facade

        try:
            theme = facade.community.get()["profiles"]["theme"]
        except Exception:  # noqa: BLE001 - without the plugin Community: the normal theme
            theme = "normal"
        if key in defaults.SHOP_PAGES:
            data = defaults.shop_layout(key, theme)
        elif key in {k for k, *_ in defaults.CONTENT} | set(defaults.SCREEN_BLOCKS):
            data = defaults.layout_for(key, theme)
        else:
            return Response({"detail": "Automatisch geldt alleen voor de standaardpagina's."}, status=status.HTTP_400_BAD_REQUEST)
        defaults._seed_blocks(key, theme)
    else:
        obj = PageLayout.objects.filter(key=key).first()
        data = {**reflow(obj.data if obj else {}, name), "preset": name}
    PageLayout.objects.update_or_create(key=key, defaults={"data": data})
    return Response(with_urls(data))


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def layout(request, key):
    if not KEY_RE.match(key):
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "PUT":
        from apps.accounts.access import level
        from apps.core import modules

        if not (request.user.is_authenticated and modules.enabled("edit_mode") and level(request.user, "edit_mode") >= 2):
            return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
        try:
            data = clean(request.data)
        except (ValueError, TypeError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        PageLayout.objects.update_or_create(key=key, defaults={"data": data})
        return Response(with_urls(data))
    obj = PageLayout.objects.filter(key=key).first()
    from apps.plugins import facade

    from . import service as page_service
    from .models import Page

    pg = Page.objects.filter(key=key).first()
    if pg and not page_service.can_see(request.user, pg):
        obj = None  # a page for chosen users / groups: the blocks stay on the server
    try:
        theme = facade.community.get()["profiles"]["theme"]
    except Exception:  # noqa: BLE001
        theme = "normal"
    return Response({**(with_urls(obj.data) if obj else {"rows": [], "bg": {}}), "theme": theme})
