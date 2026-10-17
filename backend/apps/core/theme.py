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
    {"value": "San Francisco", "label": "San Francisco (Apple)", "google": None,
     "css": '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif'},
    {"value": "Segoe UI", "label": "Segoe UI (Windows)", "google": None,
     "css": '"Segoe UI Variable", "Segoe UI", system-ui, Roboto, sans-serif'},
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

MODES = [
    {"value": "system", "label": "Volgt het apparaat van de bezoeker", "css": ""},
    {"value": "light", "label": "Licht", "css": ""},
    {"value": "dark", "label": "Donker", "css": ""},
]

POSITIONS = [
    {"value": "center", "label": "Midden", "css": "center"},
    {"value": "right", "label": "Zijpaneel rechts", "css": "stretch end"},
    {"value": "left", "label": "Zijpaneel links", "css": "stretch start"},
    {"value": "bottom", "label": "Onderaan", "css": "end center"},
    {"value": "top", "label": "Bovenaan", "css": "start center"},
]

ANIMS = [
    {"value": "none", "label": "Geen", "css": "none"},
    {"value": "fade", "label": "Infaden", "css": "popFade"},
    {"value": "scale", "label": "Inzoomen", "css": "popScale"},
    {"value": "up", "label": "Omhoog schuiven", "css": "popUp"},
    {"value": "right", "label": "Van rechts schuiven", "css": "popRight"},
    {"value": "left", "label": "Van links schuiven", "css": "popLeft"},
]

LOGOS = [
    {"value": "custom", "label": "Eigen logo (Logo's & beeld)", "css": ""},
    {"value": "rstcc", "label": "RSTCC-logo", "css": ""},
    {"value": "studio2", "label": "Studio2-logo", "css": ""},
]

YESNO = [{"value": "yes", "label": "Ja", "css": ""}, {"value": "no", "label": "Nee", "css": ""}]

SIDEBAR_AUTO = [
    {"value": "never", "label": "Nooit: alleen zelf in- en uitklappen", "css": ""},
    {"value": "after_click", "label": "Na het kiezen van een pagina", "css": ""},
    {"value": "on_leave", "label": "Zodra de muis het menu verlaat", "css": ""},
]

TAB_STYLES = [
    {"value": "pills", "label": "Knoppen (afgeronde knoppen)", "css": ""},
    {"value": "underline", "label": "Onderstreept (lijn onder het actieve tabblad)", "css": ""},
    {"value": "segmented", "label": "Segmenten (aaneengesloten balk)", "css": ""},
    {"value": "folder", "label": "Mappen (tabbladen boven het blok)", "css": ""},
]

SYSTEM_POPUPS = [
    {"value": "clean", "label": "Strak (standaard)", "css": ""},
    {"value": "header", "label": "Kopbalk in de huisstijlkleur", "css": ""},
    {"value": "glass", "label": "Glas (doorzichtig, afgerond)", "css": ""},
    {"value": "minimal", "label": "Minimaal", "css": ""},
    {"value": "bold", "label": "Gedurfd (dikke rand en schaduw)", "css": ""},
]

CHAT_SIDES = [{"value": "right", "label": "Rechtsonder", "css": "flex-end"}, {"value": "left", "label": "Linksonder", "css": "flex-start"}]
CHAT_LABELS = [{"value": "icon", "label": "Alleen een icoon 💬", "css": ""}, {"value": "text", "label": "Icoon met tekst 'Chat'", "css": ""}]

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
    {"key": "devices", "label": "Weergave per apparaat", "fields": [
        choice("device_mobile", "Mobiel (telefoon in de browser)", "yes", None, YESNO),
        choice("device_tablet", "iPad / tablet", "yes", None, YESNO),
        choice("device_desktop", "Website (computer)", "yes", None, YESNO),
        choice("device_app", "App op mobiel (installeerbaar, zonder browserbalk)", "no", None, YESNO),
    ]},
    {"key": "defaults", "label": "Standaardinstellingen", "fields": [
        choice("remember_collapse", "Onthouden of blokken in- of uitgeklapt zijn (alle pagina's)", "yes", None, YESNO),
        choice("sidebar_auto", "Linker menu automatisch inklappen", "never", None, SIDEBAR_AUTO),
        choice("system_popup", "Uiterlijk van systeem-popups, vensters en bijbehorende tabbladen", "clean", None, SYSTEM_POPUPS),
        choice("tab_style", "Uiterlijk van tabbladen (standaard voor de hele website)", "pills", None, TAB_STYLES),
        choice("version_notice", "Melding tonen aan bezoekers als er een nieuwe versie van de website live staat", "yes", None, YESNO),
    ]},
    {"key": "brand", "label": "Merkkleuren", "fields": [
        color("primary", "Primaire kleur (knoppen, links, actief menu)", "#1b97d3", "--blue"),
        color("secondary", "Secundaire kleur (avatar, accenten)", "#f08a35", "--orange"),
        color("gender_m", "Kleur voor mannen", "#3b82f6", "--g-m"),
        color("gender_f", "Kleur voor vrouwen", "#ec4899", "--g-f"),
        color("gender_x", "Kleur voor overig", "#eab308", "--g-x"),
        color("danger", "Gevaar (verwijderen, fouten)", "#dc2626", "--danger"),
        color("ok", "Succes", "#16a34a", "--ok"),
    ]},
    {"key": "popups", "label": "Popups (leeftijd, gokken, cookies)", "fields": [
        number("popup_overlay", "Donkerte van de achtergrond", 0.72, "--popup-overlay", "", 0, 0.95, 0.01),
        number("popup_blur", "Vervaging van de achtergrond", 6, "--popup-blur", "px", 0, 24),
        number("popup_radius", "Afronding", 14, "--popup-radius", "px", 0, 40),
        number("popup_width", "Breedte", 480, "--popup-width", "px", 320, 900, 10),
        number("popup_pad", "Binnenruimte", 2, "--popup-pad", "rem", 0.75, 3.5, 0.25),
        number("popup_bg_opacity", "Doorzichtigheid van het venster", 1, "--popup-bg-opacity", "", 0.4, 1, 0.01),
        number("popup_border_width", "Kader: dikte", 0, "--popup-border-width", "px", 0, 8),
        color("popup_border_color", "Kader: kleur", "#e5e8ef", "--popup-border-color"),
        choice("popup_shadow", "Schaduw", "soft", "--popup-shadow", SHADOWS),
        number("popup_btn_radius", "Afronding van knoppen in popups", 10, "--popup-btn-radius", "px", 0, 30),
        number("popup_image_radius", "Afronding van afbeeldingen in popups", 8, "--popup-image-radius", "px", 0, 40),
        choice("popup_position", "Positie", "center", "--popup-pos", POSITIONS),
        choice("popup_anim", "Animatie", "scale", "--popup-anim", ANIMS),
    ]},
    {"key": "chat_look", "label": "Chat-weergave", "fields": [
        color("chat_color", "Chatkleur (knop en eigen berichten)", "#1b97d3", "--chat-color"),
        choice("chat_position", "Positie van de zwevende knop en popup", "right", "--chat-justify", CHAT_SIDES),
        choice("chat_label", "Knop toont", "icon", None, CHAT_LABELS),
        number("chat_size", "Grootte van de knop", 56, "--chat-size", "px", 40, 96),
        number("chat_radius", "Afronding van de knop", 50, "--chat-radius", "%", 0, 50),
        number("chat_panel_w", "Breedte van de chatpopup", 380, "--chat-panel-w", "px", 300, 560),
        number("chat_panel_h", "Hoogte van de chatpopup", 540, "--chat-panel-h", "px", 360, 800),
        number("chat_bubble_radius", "Afronding van berichten", 14, "--chat-bubble-radius", "px", 0, 28),
    ]},
    {"key": "mode", "label": "Startweergave", "fields": [
        choice("default_mode", "Start in (voor bezoekers die zelf nog niets gekozen hebben)", "system", None, MODES),
    ]},
    {"key": "logo", "label": "Logo bij dit thema", "fields": [
        choice("brand_logo", "Logo (header, login, homepage, favicon)", "custom", None, LOGOS),
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
        if not f["css"]:
            continue  # setting without a CSS variable (read by the frontend)
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


# ── Built-in themes ─────────────────────────────────────────────────────────
# Only the two house styles live in the system. All other themes are theme packages (<root>/themes/<key>/theme.json)
# that are switched on or off in Admin -> Themapakketten (see themepacks.py).
PRESET_DEFS = [
    {"key": "standaard", "name": "RSTCC", "description": "De oorspronkelijke stijl met het RSTCC-logo.", "overrides": {"brand_logo": "rstcc"}, "builtin": True},
]


def _explicit(name, desc, mode, primary, secondary, light, dark, danger, ok, **layout):
    """Theme with hand-picked palettes. light/dark = (page, bg, card, hover, line, text, muted)."""
    names = ["page", "bg", "card", "hover", "line", "text", "muted"]
    overrides = {"primary": primary, "secondary": secondary, "danger": danger, "ok": ok, "default_mode": mode, **layout}
    overrides.update({f"light_{n}": v for n, v in zip(names, light)})
    overrides.update({f"dark_{n}": v for n, v in zip(names, dark)})
    return {"key": name.lower().replace(" ", "-"), "name": name, "description": desc, "overrides": overrides, "mode": mode, "builtin": True}


PRESET_DEFS.append(_explicit(
    "Studio2", "Oranje en grijs, passend bij het Studio2-logo", "light", "#f18745", "#939497",
    ("#ffffff", "#f6f6f6", "#ffffff", "#fafafa", "#e6e6e6", "#373736", "#7c7d80"),
    ("#1c1c1d", "#141414", "#242425", "#2d2d2e", "#3a3a3b", "#f1f1f1", "#a0a1a4"),
    "#dc2626", "#16a34a", font_body="Montserrat", font_heading="Montserrat", radius=6, btn_radius=6,
    shadow="soft", heading_weight="600", brand_logo="studio2"))


def presets():
    """The built-in themes plus the theme packages that are switched on."""
    from . import themepacks

    out = []
    for p in [*PRESET_DEFS, *themepacks.enabled_defs()]:
        values = merged(p["overrides"])
        _, errors = validate(values)
        if errors:
            continue
        out.append({"key": p["key"], "name": p["name"], "description": p["description"], "mode": p.get("mode"), "assets": p.get("assets", 0), "values": values})
    return out
