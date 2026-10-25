# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Pictures for the demo data of the standard installations: fake banners ("Hero …") and illustrations, drawn here (no files needed).
Each installation has its own colours and motifs. The pictures are part of the demo data (source "media-demo"): the banners are the part "heroes",
the illustrations the part "media", so they are removed with the demo data. The pages of an installation (preset_pages.py) use them by name."""
import logging

from django.core.files.base import ContentFile

from . import demo_dating as base

logger = logging.getLogger(__name__)

# preset: palette (top, bottom, accent), banners [(label, motifs)], pictures [(name, motif)]
ART = {
    "standaard-website": {"palette": ((190, 220, 255), (40, 90, 190), (255, 255, 255)), "prefix": "Website",
                          "heroes": [("Blauw", ["browser", "people"]), ("Licht", ["browser", "chart"])],
                          "pictures": [("Ontwerp", "browser"), ("Team", "team"), ("Nieuws", "document"), ("Contact", "chat")]},
    "webshop": {"palette": ((255, 225, 190), (225, 100, 60), (255, 255, 255)), "prefix": "Winkel",
                "heroes": [("Zomer", ["cart", "box"]), ("Uitverkoop", ["tag", "box"])],
                "pictures": [("Mand", "cart"), ("Pakket", "box"), ("Korting", "tag"), ("Service", "chat")]},
    "bedrijfswebsite": {"palette": ((215, 225, 240), (50, 70, 110), (255, 255, 255)), "prefix": "Bedrijf",
                        "heroes": [("Kantoor", ["building", "people"]), ("Groei", ["chart", "building"])],
                        "pictures": [("Kantoor", "building"), ("Team", "team"), ("Diensten", "chart"), ("Contact", "chat")]},
    "zakelijk-netwerk": {"palette": ((205, 225, 250), (30, 80, 120), (255, 200, 90)), "prefix": "Netwerk",
                         "heroes": [("Verbinding", ["network", "people"]), ("Ontmoeting", ["calendar", "people"])],
                         "pictures": [("Verbinding", "network"), ("Handdruk", "people"), ("Evenement", "calendar"), ("Markt", "tag")]},
    "intranet": {"palette": ((220, 230, 245), (35, 55, 100), (120, 200, 255)), "prefix": "Intranet",
                 "heroes": [("Welkom", ["building", "people"]), ("Samen", ["network", "document"])],
                 "pictures": [("Welkom", "building"), ("Team", "team"), ("Documenten", "document"), ("Agenda", "calendar")]},
    "sportclub": {"palette": ((200, 245, 215), (25, 120, 70), (255, 230, 120)), "prefix": "Club",
                  "heroes": [("Veld", ["ball", "people"]), ("Winnaars", ["medal", "people"])],
                  "pictures": [("Sport", "ball"), ("Team", "team"), ("Agenda", "calendar"), ("Medaille", "medal")]},
    "stichting": {"palette": ((255, 215, 210), (190, 70, 90), (255, 255, 255)), "prefix": "Doel",
                  "heroes": [("Hart", ["heart", "people"]), ("Samen", ["heart", "team"])],
                  "pictures": [("Hart", "heart"), ("Gift", "coin"), ("Vrijwilligers", "team"), ("Evenement", "calendar")]},
    "marktplaats": {"palette": ((255, 235, 190), (210, 120, 30), (255, 255, 255)), "prefix": "Markt",
                    "heroes": [("Kraampjes", ["tag", "box"]), ("Handel", ["tag", "people"])],
                    "pictures": [("Aanbod", "tag"), ("Boeken", "calendar"), ("Bieden", "coin"), ("Pakket", "box")]},
    "spelletjessite": {"palette": ((225, 210, 255), (70, 40, 160), (255, 220, 90)), "prefix": "Spel",
                       "heroes": [("Arcade", ["gamepad", "dice"]), ("Toernooi", ["trophy", "people"])],
                       "pictures": [("Controller", "gamepad"), ("Dobbelstenen", "dice"), ("Ranglijst", "trophy"), ("Samen", "team")]},
}


def _motif(d, name, cx, cy, s, accent):
    """One drawn symbol, centred on (cx, cy), about s pixels big."""
    from PIL import Image  # noqa: F401

    white, dark = (255, 255, 255, 240), (40, 50, 80, 255)
    if name == "browser":
        d.rounded_rectangle((cx - s, cy - s * 0.65, cx + s, cy + s * 0.65), radius=s * 0.08, fill=white)
        d.rounded_rectangle((cx - s, cy - s * 0.65, cx + s, cy - s * 0.45), radius=s * 0.08, fill=(*accent[:3], 255))
        for i in range(3):
            d.ellipse((cx - s * 0.92 + i * s * 0.12, cy - s * 0.59, cx - s * 0.85 + i * s * 0.12, cy - s * 0.52), fill=(255, 255, 255, 255))
        d.rectangle((cx - s * 0.85, cy - s * 0.3, cx - s * 0.1, cy + s * 0.5), fill=(*accent[:3], 120))
        for i in range(4):
            d.rounded_rectangle((cx + s * 0.05, cy - s * 0.3 + i * s * 0.22, cx + s * (0.85 - i * 0.1), cy - s * 0.2 + i * s * 0.22), radius=6, fill=(120, 130, 160, 200))
    elif name == "cart":
        d.line([(cx - s * 0.9, cy - s * 0.7), (cx - s * 0.6, cy - s * 0.7), (cx - s * 0.35, cy + s * 0.35), (cx + s * 0.7, cy + s * 0.35), (cx + s * 0.9, cy - s * 0.4), (cx - s * 0.5, cy - s * 0.4)], fill=white, width=int(s * 0.1), joint="curve")
        for x in (-0.25, 0.55):
            d.ellipse((cx + s * x - s * 0.13, cy + s * 0.55 - s * 0.13, cx + s * x + s * 0.13, cy + s * 0.55 + s * 0.13), fill=white)
    elif name == "box":
        d.polygon([(cx - s * 0.7, cy - s * 0.2), (cx, cy - s * 0.6), (cx + s * 0.7, cy - s * 0.2), (cx, cy + s * 0.2)], fill=(255, 240, 215, 255))
        d.polygon([(cx - s * 0.7, cy - s * 0.2), (cx, cy + s * 0.2), (cx, cy + s * 0.8), (cx - s * 0.7, cy + s * 0.4)], fill=(235, 195, 140, 255))
        d.polygon([(cx + s * 0.7, cy - s * 0.2), (cx, cy + s * 0.2), (cx, cy + s * 0.8), (cx + s * 0.7, cy + s * 0.4)], fill=(210, 165, 110, 255))
    elif name == "tag":
        d.polygon([(cx - s * 0.8, cy), (cx - s * 0.1, cy - s * 0.7), (cx + s * 0.8, cy - s * 0.7), (cx + s * 0.8, cy + s * 0.7), (cx - s * 0.1, cy + s * 0.7)], fill=white)
        d.ellipse((cx - s * 0.45, cy - s * 0.12, cx - s * 0.25, cy + s * 0.08), fill=(*accent[:3], 255))
        d.text((cx + s * 0.05, cy - s * 0.2), "%", fill=dark)
        d.rounded_rectangle((cx + s * 0.1, cy - s * 0.3, cx + s * 0.65, cy - s * 0.15), radius=6, fill=(*accent[:3], 255))
        d.rounded_rectangle((cx + s * 0.1, cy, cx + s * 0.5, cy + s * 0.15), radius=6, fill=(150, 160, 190, 255))
    elif name == "building":
        for i, (dx, hh) in enumerate([(-0.7, 0.9), (-0.15, 1.3), (0.4, 1.0)]):
            x0, x1 = cx + s * dx, cx + s * (dx + 0.5)
            d.rectangle((x0, cy + s * 0.7 - s * hh, x1, cy + s * 0.7), fill=white)
            for r in range(int(hh * 4)):
                for c in range(2):
                    d.rectangle((x0 + s * (0.08 + c * 0.2), cy + s * 0.7 - s * hh + s * (0.1 + r * 0.2), x0 + s * (0.18 + c * 0.2), cy + s * 0.7 - s * hh + s * (0.2 + r * 0.2)), fill=(*accent[:3], 255) if (r + c + i) % 3 else (150, 165, 200, 255))
    elif name == "chart":
        for i, hh in enumerate([0.35, 0.55, 0.45, 0.8, 1.05]):
            d.rounded_rectangle((cx - s * 0.8 + i * s * 0.36, cy + s * 0.6 - s * hh, cx - s * 0.55 + i * s * 0.36, cy + s * 0.6), radius=6, fill=white if i % 2 else (*accent[:3], 255))
        d.line([(cx - s * 0.7, cy + s * 0.2), (cx - s * 0.1, cy - s * 0.1), (cx + s * 0.3, cy), (cx + s * 0.9, cy - s * 0.6)], fill=dark, width=int(s * 0.05))
    elif name == "chat":
        d.rounded_rectangle((cx - s * 0.9, cy - s * 0.6, cx + s * 0.3, cy + s * 0.05), radius=s * 0.15, fill=white)
        d.rounded_rectangle((cx - s * 0.2, cy - s * 0.1, cx + s * 0.9, cy + s * 0.55), radius=s * 0.15, fill=(*accent[:3], 245))
        for x in (-0.6, -0.35, -0.1):
            d.ellipse((cx + s * x - 8, cy - s * 0.28 - 8, cx + s * x + 8, cy - s * 0.28 + 8), fill=dark)
    elif name == "document":
        d.rounded_rectangle((cx - s * 0.55, cy - s * 0.8, cx + s * 0.55, cy + s * 0.8), radius=s * 0.08, fill=white)
        d.polygon([(cx + s * 0.25, cy - s * 0.8), (cx + s * 0.55, cy - s * 0.5), (cx + s * 0.25, cy - s * 0.5)], fill=(190, 200, 225, 255))
        for i in range(5):
            d.rounded_rectangle((cx - s * 0.38, cy - s * 0.3 + i * s * 0.2, cx + s * (0.38 - 0.1 * (i % 3)), cy - s * 0.2 + i * s * 0.2), radius=5, fill=(*accent[:3], 200) if i == 0 else (150, 160, 190, 200))
    elif name == "calendar":
        d.rounded_rectangle((cx - s * 0.8, cy - s * 0.7, cx + s * 0.8, cy + s * 0.75), radius=s * 0.1, fill=white)
        d.rounded_rectangle((cx - s * 0.8, cy - s * 0.7, cx + s * 0.8, cy - s * 0.35), radius=s * 0.1, fill=(*accent[:3], 255))
        for r in range(3):
            for c in range(5):
                d.rounded_rectangle((cx - s * 0.65 + c * s * 0.27, cy - s * 0.2 + r * s * 0.3, cx - s * 0.5 + c * s * 0.27, cy - s * 0.05 + r * s * 0.3), radius=4, fill=(*accent[:3], 255) if (r, c) == (1, 2) else (170, 180, 205, 255))
    elif name == "network":
        pts = [(-0.7, -0.3), (0, -0.6), (0.7, -0.2), (-0.3, 0.4), (0.5, 0.5), (0, 0)]
        for a, b in [(0, 1), (1, 2), (0, 5), (1, 5), (2, 5), (3, 5), (4, 5), (3, 4)]:
            d.line([(cx + s * pts[a][0], cy + s * pts[a][1]), (cx + s * pts[b][0], cy + s * pts[b][1])], fill=(255, 255, 255, 200), width=int(s * 0.04))
        for i, (x, y) in enumerate(pts):
            r = s * (0.16 if i == 5 else 0.11)
            d.ellipse((cx + s * x - r, cy + s * y - r, cx + s * x + r, cy + s * y + r), fill=(*accent[:3], 255) if i == 5 else white)
    elif name == "ball":
        d.ellipse((cx - s * 0.7, cy - s * 0.7, cx + s * 0.7, cy + s * 0.7), fill=white)
        d.polygon([(cx, cy - s * 0.25), (cx + s * 0.24, cy - s * 0.08), (cx + s * 0.15, cy + s * 0.2), (cx - s * 0.15, cy + s * 0.2), (cx - s * 0.24, cy - s * 0.08)], fill=dark)
        for x, y in [(0, -0.7), (0.65, -0.2), (0.4, 0.55), (-0.4, 0.55), (-0.65, -0.2)]:
            d.line([(cx, cy), (cx + s * x, cy + s * y)], fill=dark, width=int(s * 0.03))
    elif name == "medal":
        d.polygon([(cx - s * 0.35, cy - s * 0.9), (cx - s * 0.05, cy - s * 0.9), (cx + s * 0.1, cy - s * 0.1), (cx - s * 0.2, cy - s * 0.1)], fill=(*accent[:3], 255))
        d.polygon([(cx + s * 0.35, cy - s * 0.9), (cx + s * 0.05, cy - s * 0.9), (cx - s * 0.1, cy - s * 0.1), (cx + s * 0.2, cy - s * 0.1)], fill=(220, 70, 80, 255))
        d.ellipse((cx - s * 0.5, cy - s * 0.15, cx + s * 0.5, cy + s * 0.85), fill=(255, 215, 90, 255), outline=(220, 170, 40, 255), width=int(s * 0.05))
        d.text((cx - s * 0.05, cy + s * 0.2), "1", fill=(150, 100, 20, 255))
    elif name == "trophy":
        d.polygon([(cx - s * 0.5, cy - s * 0.7), (cx + s * 0.5, cy - s * 0.7), (cx + s * 0.35, cy + s * 0.1), (cx - s * 0.35, cy + s * 0.1)], fill=(255, 215, 90, 255))
        d.arc((cx - s * 0.85, cy - s * 0.6, cx - s * 0.3, cy), 90, 270, fill=(255, 215, 90, 255), width=int(s * 0.09))
        d.arc((cx + s * 0.3, cy - s * 0.6, cx + s * 0.85, cy), -90, 90, fill=(255, 215, 90, 255), width=int(s * 0.09))
        d.rectangle((cx - s * 0.1, cy + s * 0.1, cx + s * 0.1, cy + s * 0.5), fill=(230, 180, 60, 255))
        d.rounded_rectangle((cx - s * 0.4, cy + s * 0.5, cx + s * 0.4, cy + s * 0.7), radius=8, fill=(190, 140, 40, 255))
    elif name == "heart":
        base._heart(d, cx, cy, s * 1.5, (255, 255, 255, 235))
        base._heart(d, cx + s * 0.55, cy - s * 0.6, s * 0.55, (*accent[:3], 255))
    elif name == "coin":
        for i in range(3):
            d.ellipse((cx - s * 0.55 + i * s * 0.15, cy - s * 0.1 - i * s * 0.28, cx + s * 0.55 + i * s * 0.15, cy + s * 0.5 - i * s * 0.28), fill=(255, 215, 90, 255), outline=(220, 170, 40, 255), width=int(s * 0.04))
        base._heart(d, cx - s * 0.65, cy - s * 0.55, s * 0.45, (230, 70, 100, 255))
    elif name == "gamepad":
        d.rounded_rectangle((cx - s * 0.9, cy - s * 0.4, cx + s * 0.9, cy + s * 0.4), radius=s * 0.3, fill=white)
        d.ellipse((cx - s * 0.95, cy - s * 0.05, cx - s * 0.45, cy + s * 0.75), fill=white)
        d.ellipse((cx + s * 0.45, cy - s * 0.05, cx + s * 0.95, cy + s * 0.75), fill=white)
        d.rectangle((cx - s * 0.6, cy - s * 0.07, cx - s * 0.2, cy + s * 0.07), fill=dark)
        d.rectangle((cx - s * 0.47, cy - s * 0.2, cx - s * 0.33, cy + s * 0.2), fill=dark)
        for dx, dy, c in [(0.35, 0, (*accent[:3], 255)), (0.55, -0.12, (230, 80, 100, 255)), (0.55, 0.12, (80, 180, 140, 255)), (0.75, 0, (90, 130, 230, 255))]:
            d.ellipse((cx + s * dx - s * 0.07, cy + s * dy - s * 0.07, cx + s * dx + s * 0.07, cy + s * dy + s * 0.07), fill=c)
    elif name == "dice":
        for ox, oy, n in ((-0.45, 0.1, 5), (0.35, -0.2, 3)):
            x0, y0 = cx + s * ox - s * 0.4, cy + s * oy - s * 0.4
            d.rounded_rectangle((x0, y0, x0 + s * 0.8, y0 + s * 0.8), radius=s * 0.12, fill=white)
            spots = {5: [(0.2, 0.2), (0.6, 0.2), (0.4, 0.4), (0.2, 0.6), (0.6, 0.6)], 3: [(0.2, 0.2), (0.4, 0.4), (0.6, 0.6)]}[n]
            for px, py in spots:
                d.ellipse((x0 + s * px - 9, y0 + s * py - 9, x0 + s * px + 9, y0 + s * py + 9), fill=dark)
    elif name in ("people", "team"):
        k = 2 if name == "people" else 4
        for i in range(k):
            tone = [(240, 200, 170), (205, 155, 125), (180, 130, 100), (245, 215, 190)][i % 4]
            shirt = [(50, 60, 110), (200, 70, 110), (60, 150, 130), (230, 160, 60)][i % 4]
            base._person(d, int(cx + (i - (k - 1) / 2) * s * 0.55), int(cy + s * 0.7), int(s * (0.75 - 0.05 * (i % 2))), tone, (*shirt, 240))


def _picture(spec, motifs, w, h, seed):
    from PIL import ImageDraw, ImageFilter

    top, bottom, accent = spec["palette"]
    im = base._gradient(w, h, top, bottom)
    im = base._bokeh(im, [(255, 255, 255), top, accent], 22 if w > 1500 else 12, seed)
    d = ImageDraw.Draw(im, "RGBA")
    if w > 1500:  # banner: the symbols sit on the right so the text can stay on the left
        positions = [(w * 0.74, h * 0.46, h * 0.5), (w * 0.9, h * 0.62, h * 0.36)]
    else:
        positions = [(w * 0.5, h * 0.48, h * 0.34)]
    for (cx, cy, s), motif in zip(positions, motifs):
        _motif(d, motif, cx, cy, s, accent)
    return base._jpeg(im.filter(ImageFilter.GaussianBlur(0.5)))


def _save(label, data, tags):
    return base._save(label, data, tags)


def make_heroes(key):
    """Banners (1920 x 800) of this installation. Returns the ids that were made."""
    from apps.medialib.models import MediaItem

    spec = ART.get(key)
    if not spec:
        return []
    have = set(MediaItem.objects.filter(source="media-demo").values_list("name", flat=True))
    ids = []
    for n, (label, motifs) in enumerate(spec["heroes"]):
        name = f"Hero {spec['prefix']} {label}"
        if f"{name}.jpg" not in have:
            ids.append(_save(name, _picture(spec, motifs, 1920, 800, 11 + n), ["demo", "hero", "achtergrond", "breed", spec["prefix"].lower()]))
    return ids


def make_images(key):
    """Pictures (1200 x 800) for the pages of this installation: "<Prefix> <Name>"."""
    from apps.medialib.models import MediaItem

    spec = ART.get(key)
    if not spec:
        return []
    have = set(MediaItem.objects.filter(source="media-demo").values_list("name", flat=True))
    ids = []
    for n, (label, motif) in enumerate(spec["pictures"]):
        name = f"{spec['prefix']} {label}"
        if f"{name}.jpg" not in have:
            ids.append(_save(name, _picture(spec, [motif], 1200, 800, 31 + n), ["demo", spec["prefix"].lower(), motif]))
    return ids


def picture_names(key):
    spec = ART.get(key) or {}
    return [f"{spec['prefix']} {label}" for label, _m in spec.get("pictures", [])]
