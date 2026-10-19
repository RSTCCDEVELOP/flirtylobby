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
HALIGN, VALIGN, GAPS, TYPES = ("left", "center", "right"), ("top", "center", "bottom"), ("sm", "md", "lg"), ("text", "image", "object")
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
    return {"type": bg["type"], "media": item.id, "overlay": round(overlay, 2)}


def with_urls(data):
    """The layout for the page: every background gets its address (from the media library)."""
    from django.core.files.storage import default_storage

    from apps.medialib.models import MediaItem

    def one(bg):
        item = MediaItem.objects.filter(pk=(bg or {}).get("media")).first() if bg else None
        return {**bg, "url": default_storage.url(item.key)} if item else {}

    out = {**data, "rows": [{**r, "bg": one(r.get("bg"))} for r in data.get("rows", [])]}
    out["bg"] = one(data.get("bg"))
    return out


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
                items.append({"id": uid(it.get("id")), "type": t, "ref": str(it.get("ref") or "")[:80]})
            cells.append({"id": uid(c.get("id")), "width": _pct(c.get("width"), 5, 100, "auto"), "halign": c.get("halign") if c.get("halign") in HALIGN else "left", "valign": c.get("valign") if c.get("valign") in VALIGN else "top", "items": items})
        while len(cells) < cols:
            cells.append({"id": new_id(), "width": "auto", "halign": "left", "valign": "top", "items": []})
        out.append({"bg": clean_bg(r.get("bg")), "id": uid(r.get("id")), "cols": cols, "width": _pct(r.get("width"), 30, 100, "default"), "gap": r.get("gap") if r.get("gap") in GAPS else "md", "cells": cells, **({"hero": str(r["hero"])[:20]} if r.get("hero") else {})})
    if n_items > MAX_ITEMS:
        raise ValueError("Te veel onderdelen op één pagina.")
    return {"rows": out, "bg": clean_bg((data or {}).get("bg")), "preset": (data or {}).get("preset") if (data or {}).get("preset") in PRESETS else "", **({"hero_off": True} if (data or {}).get("hero_off") else {}), **_list((data or {}).get("list")), **({"page_width": "full"} if (data or {}).get("page_width") == "full" else {}), **({"page_size": str((data or {}).get("page_size"))} if str((data or {}).get("page_size")) in ("5", "10", "25", "100") else {})}


PRESETS = ("auto", "single", "two", "three", "four", "hero", "split")  # the layouts ("Opmaak") a page can be given; "auto" = the layout of the community theme (standard pages only)


def reflow(data, preset):
    """The same items (text, pictures, system objects) in another grid. The ids of the items stay (so their texts stay); rows and cells are new."""
    old = (data or {}).get("rows", [])
    hero = next((r for r in old if r.get("hero")), None)  # the hero stays at the top of every layout
    items = [it for r in old if r is not hero for c in r.get("cells", []) for it in c.get("items", [])]
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
        rows = [r for r in old if r is not hero]
    rows = ([hero] if hero else []) + rows
    return {"rows": rows, "bg": (data or {}).get("bg", {}), **({"hero_off": True} if (data or {}).get("hero_off") else {}), **_list((data or {}).get("list")), **({"page_width": "full"} if (data or {}).get("page_width") == "full" else {}), **({"page_size": str((data or {}).get("page_size"))} if str((data or {}).get("page_size")) in ("5", "10", "25", "100") else {})}


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
        from apps.social import service as social

        theme = social.get()["profiles"]["theme"]
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
    from apps.social import service as social

    try:
        theme = social.get()["profiles"]["theme"]
    except Exception:  # noqa: BLE001
        theme = "normal"
    return Response({**(with_urls(obj.data) if obj else {"rows": [], "bg": {}}), "theme": theme})
