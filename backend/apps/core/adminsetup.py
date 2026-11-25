# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""easy2edit admin setup: the settings of the admin and the dashboards, for the whole website (kept in the system settings under "admin_setup").
Every person can still choose for himself (tiles or list, page size, sidebar): that choice wins; these are the starting values of the website."""
import re

from .models import SystemSettings

VIEWS = ("tiles", "list")
SIZES = ("5", "10", "25", "100", "all")
SIDEBARS = ("open", "collapsed", "remember")
WIDTHS = ("full", "wide", "normal", "site")  # the width of the content of the admin: the whole screen, wide (1500px), normal (1200px) or the same as the pages of the website (theme: content width)
DENSITIES = ("compact", "normal", "roomy")
TILE_SIZES = ("small", "normal", "large")
FONTS = ("normal", "large")
FRAMES = ("dark", "login", "light", "none")  # the colour of the sides left and right of the page (only with a limited width): darker, as the login screen, a light shade or the page colour
SIDEBAR_WIDTHS = ("narrow", "normal", "wide")
HEADER_HEIGHTS = ("compact", "normal", "large")
HEADER_ITEMS = ("homepage", "shortcuts", "notifications", "chat", "language", "help", "theme")  # what stands in the header of the dashboard (the edit button and the user menu always stay)
BLOCKS = ("ai", "presets", "backup", "about")  # the blocks under the tiles of the admin dashboard
CHOICES = {"width": (WIDTHS, "Kies een breedte uit de lijst."), "density": (DENSITIES, "Kies een dichtheid uit de lijst."), "tile_size": (TILE_SIZES, "Kies een tegelgrootte uit de lijst."),
           "frame": (FRAMES, "Kies een kleur voor de zijkanten uit de lijst."), "font": (FONTS, "Kies een lettergrootte uit de lijst."), "sidebar_width": (SIDEBAR_WIDTHS, "Kies een breedte van de zijbalk uit de lijst."),
           "header_height": (HEADER_HEIGHTS, "Kies een hoogte van de header uit de lijst.")}
HREF_RE = re.compile(r"^/dashboard/[a-z0-9/_-]{1,80}$")
DEFAULTS = {
    "view": "tiles", "page_size": "all", "hidden_tiles": [],  # tab Tegels
    "blocks": {k: True for k in BLOCKS},  # tab Dashboards
    "sidebar": "remember", "menu_search": True, "sidebar_width": "normal",  # tab Menu
    "width": "full", "density": "normal", "tile_size": "normal", "font": "normal", "frame": "dark", "reduce_motion": False,  # tab Uiterlijk
    "header_height": "normal", "header_items": {k: True for k in HEADER_ITEMS}, "footer_credit": True,  # tab Header en footer
}


def get():
    stored = (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get("admin_setup")
    return {**DEFAULTS, **{k: v for k, v in (stored if isinstance(stored, dict) else {}).items() if k in DEFAULTS}, "blocks": {**DEFAULTS["blocks"], **((stored or {}).get("blocks") if isinstance((stored or {}).get("blocks"), dict) else {})}, "header_items": {**DEFAULTS["header_items"], **((stored or {}).get("header_items") if isinstance((stored or {}).get("header_items"), dict) else {})}}


def validate(values):
    """(clean, errors) of the values that were sent; unknown keys are an error."""
    clean, errors = {}, {}
    for k, v in (values or {}).items():
        if k == "view":
            clean[k] = v if v in VIEWS else errors.setdefault(k, "Kies tegels of lijst.") and None
        elif k == "page_size":
            clean[k] = str(v) if str(v) in SIZES else errors.setdefault(k, "Kies een aantal per pagina uit de lijst.") and None
        elif k == "sidebar":
            clean[k] = v if v in SIDEBARS else errors.setdefault(k, "Kies open, dicht of onthouden.") and None
        elif k in ("menu_search", "reduce_motion", "footer_credit"):
            clean[k] = bool(v)
        elif k in CHOICES:
            clean[k] = v if v in CHOICES[k][0] else errors.setdefault(k, CHOICES[k][1]) and None
        elif k == "hidden_tiles":
            items = [str(x) for x in v] if isinstance(v, list) else None
            if items is None or any(not HREF_RE.match(x) for x in items) or "/dashboard/admin/admin-setup" in items:
                errors[k] = "De lijst met verborgen tegels klopt niet (de tegel easy2edit admin setup kun je niet verbergen)."
            else:
                clean[k] = list(dict.fromkeys(items))[:100]
        elif k == "header_items":
            if isinstance(v, dict) and set(v) <= set(HEADER_ITEMS):
                clean[k] = {b: bool(v.get(b, True)) for b in HEADER_ITEMS}
            else:
                errors[k] = "De onderdelen van de header kloppen niet."
        elif k == "blocks":
            if isinstance(v, dict) and set(v) <= set(BLOCKS):
                clean[k] = {b: bool(v.get(b, True)) for b in BLOCKS}
            else:
                errors[k] = "De blokken van het dashboard kloppen niet."
        else:
            errors[k] = "Onbekende instelling."
    return {k: v for k, v in clean.items() if v is not None}, errors


def save(clean):
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    data = dict(obj.data or {})
    data["admin_setup"] = {**get(), **clean, "blocks": {**get()["blocks"], **clean.get("blocks", {})}, "header_items": {**get()["header_items"], **clean.get("header_items", {})}}
    obj.data = data
    obj.save()
    return get()


def reset():
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    data = dict(obj.data or {})
    data.pop("admin_setup", None)
    obj.data = data
    obj.save()
    return get()
