"""
Single source of truth for the configurable design ("Vormgeving").

SCHEMA drives: validation, defaults, the generated CSS and the admin form.
To make something configurable: add a field here and use its CSS variable in the frontend.
"""
import re

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

_SYSTEM = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'


def _font(name, google=True, serif=False):
    fallback = "Georgia, serif" if serif else "system-ui, sans-serif"
    return {"value": name, "label": name, "css": f'"{name}", {fallback}', "google": name if google else None}


FONTS = [
    {"value": "System", "label": "Systeemlettertype", "css": _SYSTEM, "google": None},
    _font("Inter"), _font("Poppins"), _font("Roboto"), _font("Open Sans"), _font("Montserrat"),
    _font("Lato"), _font("Nunito"), _font("Playfair Display", serif=True), _font("Merriweather", serif=True),
]

SHADOWS = [
    {"value": "none", "label": "Geen", "css": "none"},
    {"value": "soft", "label": "Zacht",
     "css": "0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.05)",
     "dark": "0 1px 2px rgba(0,0,0,.4), 0 4px 16px rgba(0,0,0,.3)"},
    {"value": "strong", "label": "Sterk",
     "css": "0 2px 4px rgba(16,24,40,.08), 0 12px 32px rgba(16,24,40,.14)",
     "dark": "0 2px 4px rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.5)"},
]

WEIGHTS = [{"value": str(w), "label": str(w), "css": str(w)} for w in (500, 600, 700, 800)]


def color(key, label, default, css, mode="both"):
    return {"key": key, "label": label, "type": "color", "default": default, "css": css, "mode": mode}


def number(key, label, default, css, unit, lo, hi, step=1):
    return {"key": key, "label": label, "type": "number", "default": default, "css": css, "unit": unit,
            "min": lo, "max": hi, "step": step, "mode": "both"}


def choice(key, label, default, css, choices):
    return {"key": key, "label": label, "type": "choice", "default": default, "css": css,
            "choices": choices, "mode": "both"}


def _mode_colors(prefix, mode, d):
    return [
        color(f"{prefix}_page", "Pagina-achtergrond (website)", d[0], "--page", mode),
        color(f"{prefix}_bg", "Achtergrond beheer", d[1], "--bg", mode),
        color(f"{prefix}_card", "Kaarten, menu's en header", d[2], "--card", mode),
        color(f"{prefix}_hover", "Hover-achtergrond", d[3], "--hover", mode),
        color(f"{prefix}_line", "Lijnen en randen", d[4], "--line", mode),
        color(f"{prefix}_text", "Tekstkleur", d[5], "--text", mode),
        color(f"{prefix}_muted", "Gedempte tekst", d[6], "--muted", mode),
    ]


SCHEMA = [
    {"key": "brand", "label": "Merkkleuren", "fields": [
        color("primary", "Primaire kleur (knoppen, links, actief menu)", "#1b97d3", "--blue"),
        color("secondary", "Secundaire kleur (avatar, accenten)", "#f08a35", "--orange"),
        color("danger", "Gevaar (verwijderen, fouten)", "#dc2626", "--danger"),
        color("ok", "Succes", "#16a34a", "--ok"),
    ]},
    {"key": "light", "label": "Kleuren: lichte modus", "fields": _mode_colors(
        "light", "light", ["#ffffff", "#f4f6fa", "#ffffff", "#f9fafc", "#e5e8ef", "#1f2937", "#6b7280"])},
    {"key": "dark", "label": "Kleuren: donkere modus", "fields": _mode_colors(
        "dark", "dark", ["#0f1420", "#0b0f19", "#151b2b", "#1c2438", "#263049", "#e5e9f2", "#94a0b8"])},
    {"key": "typography", "label": "Lettertypen en groottes", "fields": [
        choice("font_body", "Lettertype (tekst)", "System", "--font-body", FONTS),
        choice("font_heading", "Lettertype (koppen)", "System", "--font-heading", FONTS),
        number("font_size_base", "Basis lettergrootte (schaalt alles)", 16, "--fs-base", "px", 12, 22),
        number("font_size_h1", "Grootte kop 1", 1.6, "--fs-h1", "rem", 1.2, 3.5, 0.05),
        number("font_size_h2", "Grootte kop 2", 1.05, "--fs-h2", "rem", 0.9, 2.2, 0.05),
        number("line_height", "Regelafstand", 1.5, "--lh", "", 1.2, 2, 0.05),
        choice("heading_weight", "Dikte koppen", "700", "--fw-heading", WEIGHTS),
    ]},
    {"key": "layout", "label": "Vorm en ruimte", "fields": [
        number("radius", "Afronding kaarten", 14, "--radius", "px", 0, 28),
        number("btn_radius", "Afronding knoppen en velden", 10, "--btn-radius", "px", 0, 30),
        choice("shadow", "Schaduw", "soft", "--shadow", SHADOWS),
        number("header_h", "Hoogte beheer-header", 64, "--header-h", "px", 48, 96),
        number("sidebar_w", "Breedte zijmenu", 240, "--sidebar-w", "px", 180, 320),
        number("content_pad", "Ruimte rond inhoud (beheer)", 2, "--pad", "rem", 0.75, 3.5, 0.25),
        number("site_header_h", "Hoogte website-header", 72, "--site-header-h", "px", 56, 110),
        number("logo_h", "Logohoogte beheer-header", 46, "--logo-h", "px", 24, 80),
        number("site_logo_h", "Logohoogte website-header", 52, "--site-logo-h", "px", 24, 90),
    ]},
]

FIELDS = {f["key"]: f for g in SCHEMA for f in g["fields"]}
DEFAULTS = {k: f["default"] for k, f in FIELDS.items()}


def merged(stored):
    return {**DEFAULTS, **{k: v for k, v in (stored or {}).items() if k in FIELDS}}


def validate(values):
    """Return (clean_dict, errors). Only known keys with safe values survive (the CSS is injected into pages)."""
    clean, errors = {}, {}
    for key, value in (values or {}).items():
        f = FIELDS.get(key)
        if not f:
            errors[key] = "Onbekend veld."
        elif f["type"] == "color":
            if isinstance(value, str) and COLOR_RE.match(value):
                clean[key] = value.lower()
            else:
                errors[key] = "Ongeldige kleur (gebruik #rrggbb)."
        elif f["type"] == "number":
            if isinstance(value, (int, float)) and not isinstance(value, bool) and f["min"] <= value <= f["max"]:
                clean[key] = value
            else:
                errors[key] = f"Waarde moet tussen {f['min']} en {f['max']} liggen."
        else:
            if value in [c["value"] for c in f["choices"]]:
                clean[key] = value
            else:
                errors[key] = "Ongeldige keuze."
    return clean, errors


def build(values):
    """Return (css, fonts_url) for the given (merged) values."""
    root, light, dark = [], [], []
    families = set()
    for key, f in FIELDS.items():
        v = values[key]
        if f["type"] == "choice":
            c = next(c for c in f["choices"] if c["value"] == v)
            css_val, dark_val = c["css"], c.get("dark")
            if c.get("google"):
                families.add(c["google"])
        elif f["type"] == "number":
            css_val, dark_val = f"{v}{f['unit']}", None
        else:
            css_val, dark_val = v, None
        decl = f"{f['css']}:{css_val};"
        {"light": light, "dark": dark}.get(f["mode"], root).append(decl)
        if dark_val:
            dark.append(f"{f['css']}:{dark_val};")
    css = (
        f"html:root{{{''.join(root)}}}"
        f'html:root,html:root[data-theme="light"]{{{"".join(light)}}}'
        f'html:root[data-theme="dark"]{{{"".join(dark)}}}'
    )
    fonts_url = None
    if families:
        fam = "&".join(f"family={n.replace(' ', '+')}:wght@400;500;600;700;800" for n in sorted(families))
        fonts_url = f"https://fonts.googleapis.com/css2?{fam}&display=swap"
    return css, fonts_url
