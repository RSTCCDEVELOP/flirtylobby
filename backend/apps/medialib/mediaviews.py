"""Media system objects: photo book, image carousel, photo wall and slideshow. Settings and effects per type, and the pictures they show."""
from django.core.files.storage import default_storage
from django.utils.text import slugify

from .models import MediaItem, MediaView

RATIOS = ("1/1", "4/3", "3/2", "16/9", "3/4")
COMMON = {"ratio": "4/3", "gap": 12, "radius": 8, "shadow": False, "hover": "zoom", "plane_opacity": 45, "captions": "none", "lightbox": True}
DEFAULTS = {
    "album": {**COMMON, "columns": 4, "frame": "none", "tilt": False},
    "carousel": {**COMMON, "visible": 3, "autoplay": True, "interval": 4, "arrows": True, "dots": True, "loop": True},
    "wall": {**COMMON, "columns": 4, "ratio": "auto"},
    "slideshow": {"transition": "fade", "interval": 5, "autoplay": True, "height": 480, "arrows": True, "dots": True, "caption_overlay": True, "captions": "below", "lightbox": False, "radius": 8, "shadow": False},
}
CHOICES = {"ratio": RATIOS + ("auto",), "hover": ("none", "zoom", "lift", "dim", "plane", "caption"), "captions": ("none", "below", "hover"), "frame": ("none", "polaroid", "border", "shadow"), "transition": ("fade", "slide", "zoom")}
RANGES = {"gap": (0, 40), "radius": (0, 40), "plane_opacity": (0, 100), "columns": (2, 6), "visible": (1, 5), "interval": (2, 12), "height": (200, 900)}
LABEL = dict(MediaView.TYPES)


def clean_settings(kind, raw):
    """The settings of a type, complete and safe: unknown or wrong values become the default."""
    base, raw = DEFAULTS[kind], raw if isinstance(raw, dict) else {}
    out = {}
    for k, dflt in base.items():
        v = raw.get(k, dflt)
        if k in CHOICES:
            out[k] = v if v in CHOICES[k] else dflt
        elif isinstance(dflt, bool):
            out[k] = bool(v)
        else:
            lo, hi = RANGES.get(k, (0, 100))
            try:
                out[k] = min(hi, max(lo, int(v)))
            except (TypeError, ValueError):
                out[k] = dflt
    return out


def clean_source(raw):
    raw = raw if isinstance(raw, dict) else {}
    mode = raw.get("mode") if raw.get("mode") in ("ids", "tags", "all") else "all"
    try:
        limit = min(60, max(1, int(raw.get("limit") or 24)))
    except (TypeError, ValueError):
        limit = 24
    ids = [int(i) for i in (raw.get("ids") or []) if str(i).isdigit()][:60]
    tags = [str(t).strip().lower()[:30] for t in (raw.get("tags") or []) if str(t).strip()][:10]
    return {"mode": mode, "ids": ids, "tags": tags, "limit": limit}


def items(view):
    """The pictures of a view: [{url, name, alt}]."""
    src, qs = clean_source(view.source), MediaItem.objects.filter(kind="image")
    from . import areas

    for p in areas.user_prefixes():  # the files of members are never shown
        qs = qs.exclude(key__startswith=p)
    if src["mode"] == "ids":
        found = {i.id: i for i in qs.filter(id__in=src["ids"])}
        rows = [found[i] for i in src["ids"] if i in found]
    elif src["mode"] == "tags":
        rows = [i for i in qs if set(src["tags"]) & set(i.tags or [])]
    else:
        rows = list(qs.order_by("-created_at"))
    return [{"url": default_storage.url(i.key), "name": i.name.rsplit(".", 1)[0], "alt": i.name.rsplit(".", 1)[0]} for i in rows[:src["limit"]]]


def out(view):
    return {"id": view.id, "name": view.name, "slug": view.slug, "type": view.type, "type_label": LABEL[view.type], "source": clean_source(view.source), "settings": clean_settings(view.type, view.settings),
            "items": items(view)}


def apply(view, d):
    if "name" in d or not view.pk:
        name = str(d.get("name") or "").strip()[:100]
        if not name:
            raise ValueError("Geef het onderdeel een naam.")
        view.name = name
    if not view.pk:
        if d.get("type") not in DEFAULTS:
            raise ValueError("Kies een soort.")
        view.type = d["type"]
        base, n = slugify(view.name)[:60] or "media", 2
        slug = base
        while MediaView.objects.filter(slug=slug).exists():
            slug, n = f"{base}-{n}", n + 1
        view.slug = slug
    if "source" in d or not view.pk:
        view.source = clean_source(d.get("source"))
    if "settings" in d or not view.pk:
        view.settings = clean_settings(view.type, d.get("settings"))
    view.save()
    return view


SCENES = [  # name, sky (top, bottom), ground colour, kind of drawing, width x height
    ("Zonsondergang", ("#f6a04d", "#7a3b8f"), "#2c1b3a", "sun", (1200, 800)), ("Bergen", ("#9ec9ee", "#e8f1fa"), "#3c5a78", "mountains", (900, 1200)), ("Strand", ("#7cc6ee", "#d9f0fb"), "#e8d29a", "beach", (1200, 800)),
    ("Bos", ("#bfe3c0", "#eaf6e6"), "#2f6b3a", "trees", (1200, 900)), ("Stad", ("#243b55", "#4b6584"), "#141e2b", "city", (900, 1200)), ("Sterrennacht", ("#0b1530", "#1f2f5a"), "#0a0f1f", "stars", (1200, 800)),
    ("Heuvels", ("#ffe9a8", "#fff6d6"), "#9bb94f", "hills", (1200, 700)), ("Zee", ("#5aa9d6", "#cbe9f7"), "#1f5f8b", "waves", (1200, 800)), ("Herfst", ("#f3c98b", "#f9e3c4"), "#a4552a", "trees", (900, 1200)),
    ("Ochtend", ("#ffd1dc", "#fff1f4"), "#b98aa6", "sun", (1200, 900)), ("IJsvlakte", ("#dff1ff", "#ffffff"), "#9cc3dd", "mountains", (1200, 800)), ("Woestijn", ("#f4c27a", "#fbe6bd"), "#c98b3d", "hills", (1200, 700)),
    ("Haven", ("#8fb8d8", "#e1eef8"), "#37506b", "city", (1200, 900)), ("Lente", ("#cde8ff", "#f2fbe9"), "#72b84f", "hills", (900, 1200)), ("Regenbui", ("#8c9db0", "#c9d3de"), "#4c5b6b", "waves", (1200, 800)), ("Wintermorgen", ("#cfd8ff", "#f6f7ff"), "#7f8fb8", "trees", (1200, 800)),
]


def _scene_png(name, sky, ground, kind, size, shift=0):
    """A drawn picture (no files or internet needed): sky gradient, sun, hills, trees ... with the name in it."""
    import io
    import random

    from PIL import Image, ImageDraw, ImageFont

    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    top, bot = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in sky]
    for y in range(h):
        k = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * k) for i in range(3)))
    g = tuple(int(ground[i:i + 2], 16) for i in (1, 3, 5))
    lite = tuple(min(255, c + 40) for c in g)
    rnd = random.Random(name)
    if kind == "sun":
        d.ellipse([w * .55, h * .2, w * .55 + h * .3, h * .2 + h * .3], fill=(255, 240, 190))
        d.polygon([(0, h * .75), (w * .3, h * .62), (w * .6, h * .74), (w, h * .66), (w, h), (0, h)], fill=g)
    elif kind == "mountains":
        d.polygon([(0, h), (w * .2, h * .45), (w * .38, h * .75), (w * .6, h * .35), (w * .85, h * .72), (w, h * .55), (w, h)], fill=g)
        d.polygon([(w * .6, h * .35), (w * .52, h * .5), (w * .68, h * .5)], fill=(250, 250, 255))
        d.polygon([(0, h), (0, h * .85), (w * .3, h * .8), (w * .7, h * .88), (w, h * .82), (w, h)], fill=lite)
    elif kind == "beach":
        d.rectangle([0, h * .55, w, h * .75], fill=(70, 150, 200))
        d.rectangle([0, h * .75, w, h], fill=g)
        d.ellipse([w * .15, h * .15, w * .15 + h * .2, h * .15 + h * .2], fill=(255, 244, 200))
    elif kind == "trees":
        d.rectangle([0, h * .8, w, h], fill=g)
        for _ in range(14):
            x, base, th = rnd.randint(0, w), rnd.randint(int(h * .7), int(h * .92)), rnd.randint(int(h * .18), int(h * .38))
            d.polygon([(x, base - th), (x - th * .3, base), (x + th * .3, base)], fill=tuple(max(0, c - rnd.randint(0, 30)) for c in g))
    elif kind == "city":
        x = 0
        while x < w:
            bw, bh = rnd.randint(int(w * .05), int(w * .12)), rnd.randint(int(h * .2), int(h * .6))
            d.rectangle([x, h - bh, x + bw, h], fill=tuple(max(0, c + rnd.randint(-10, 25)) for c in g))
            for wy in range(int(h - bh + 14), h - 10, 26):
                for wx in range(x + 8, x + bw - 8, 20):
                    if rnd.random() > .45:
                        d.rectangle([wx, wy, wx + 8, wy + 12], fill=(255, 226, 140))
            x += bw + 4
    elif kind == "stars":
        for _ in range(140):
            x, y, r = rnd.randint(0, w), rnd.randint(0, int(h * .7)), rnd.choice([1, 1, 2, 3])
            d.ellipse([x, y, x + r, y + r], fill=(255, 255, 230))
        d.polygon([(0, h * .8), (w * .4, h * .7), (w, h * .82), (w, h), (0, h)], fill=g)
    elif kind == "hills":
        d.ellipse([w * .65, h * .12, w * .65 + h * .18, h * .12 + h * .18], fill=(255, 250, 220))
        for k, c in enumerate((lite, g)):
            d.ellipse([-w * .2 + k * w * .5, h * (.6 + k * .1), w * (.7 + k * .5), h * 1.6], fill=c)
    else:  # waves
        for k in range(6):
            y = h * (.55 + k * .08)
            d.rectangle([0, y, w, h], fill=tuple(max(0, c - k * 8) for c in g))
            for x in range(0, w, 60):
                d.arc([x, y - 16, x + 60, y + 16], 200, 340, fill=(235, 245, 255), width=3)
    try:
        font = ImageFont.load_default(size=max(28, w // 22))
    except TypeError:
        font = ImageFont.load_default()
    lum = .299 * top[0] + .587 * top[1] + .114 * top[2]
    d.text((w / 2, h * .09), name, fill=(20, 20, 20) if lum > 150 else (255, 255, 255), font=font, anchor="mm")
    if shift:  # another colour of the same scene: the hue turns
        h_, s_, v_ = img.convert("HSV").split()
        h_ = h_.point(lambda x: (x + shift) % 256)
        from PIL import Image as _Image

        img = _Image.merge("HSV", (h_, s_, v_)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=84)
    return buf.getvalue()


def demo_images(count=16):
    """The example pictures (16 scenes, portrait, landscape and wide): made once, found again by their source "media-demo". Returns their ids."""
    from django.core.files.base import ContentFile

    from . import areas

    have = {i.name: i.id for i in MediaItem.objects.filter(source="media-demo")}
    ids = []
    for n in range(max(1, min(48, count))):  # the 16 scenes, then the same scenes in another colour
        name, sky, ground, kind, size = SCENES[n % len(SCENES)]
        rnd = n // len(SCENES)
        label = name if not rnd else f"{name} {rnd + 1}"
        fname = f"{label}.jpg"
        if fname in have:
            ids.append(have[fname])
            continue
        key = default_storage.save(areas.site_path("library", f"media-demo/{slugify(label)}.jpg"), ContentFile(_scene_png(label, sky, ground, kind, size, shift=rnd * 53)))
        item = MediaItem.objects.get(key=key)
        item.name, item.source, item.tags = fname, "media-demo", ["demo", "voorbeeld"]
        item.save(update_fields=["name", "source", "tags"])
        ids.append(item.id)
    return ids


def demo_counts():
    return {"views": MediaView.objects.filter(slug__startswith="demo-").count(), "images": MediaItem.objects.filter(source="media-demo").count()}


def remove_demo(what=None):
    """Remove what the demo made: `what` = "views" (the objects) and/or "images" (the example pictures); default both."""
    what, done = set(what or ("views", "images")), {}
    if "views" in what:
        done["views"] = MediaView.objects.filter(slug__startswith="demo-").count()
        MediaView.objects.filter(slug__startswith="demo-").delete()
    if "images" in what:
        n = 0
        for item in MediaItem.objects.filter(source="media-demo"):
            try:
                default_storage.delete(item.key)
            except Exception:  # noqa: BLE001
                pass
            MediaItem.objects.filter(pk=item.pk).delete()
            n += 1
        done["images"] = n
    return done


def demo(replace=False, count=16):
    """Four examples (photo book, image carousel, photo wall, slideshow), each with its own effects, with example pictures that are made for it."""
    pics = demo_images(count)
    pad = lambda lo, hi: (pics[lo:hi] or pics[:max(1, hi - lo)])  # noqa: E731  (a small count: the same pictures again)
    if replace:
        MediaView.objects.filter(slug__startswith="demo-").delete()
    sets = [
        ("Demo: fotoboek", "album", {"columns": 4, "frame": "polaroid", "tilt": True, "hover": "lift", "captions": "below", "radius": 4, "shadow": True, "gap": 18, "ratio": "1/1"}, pad(0, 8)),
        ("Demo: beeldcarrousel", "carousel", {"visible": 3, "autoplay": True, "interval": 4, "hover": "zoom", "ratio": "4/3", "radius": 12, "dots": True, "arrows": True}, pad(4, 16)),
        ("Demo: fotomuur", "wall", {"columns": 4, "hover": "plane", "plane_opacity": 40, "captions": "hover", "gap": 8, "radius": 6, "ratio": "auto"}, pics[:30]),
        ("Demo: diavoorstelling", "slideshow", {"transition": "fade", "interval": 5, "height": 460, "caption_overlay": True, "dots": True, "arrows": True, "radius": 10}, [pics[i % len(pics)] for i in (0, 2, 7, 3, 9)]),
    ]
    made = 0
    for name, kind, settings, ids in sets:
        v = MediaView(name=name, type=kind)
        apply(v, {"name": name, "type": kind, "source": {"mode": "ids", "ids": ids, "limit": 40 if kind == "wall" else 24}, "settings": settings})
        if not v.slug.startswith("demo-"):
            v.slug = ("demo-" + v.slug)[:70]
            v.save(update_fields=["slug"])
        made += 1
    return made
