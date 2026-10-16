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
        choice("tab_style", "Uiterlijk van tabbladen (standaard voor de hele website)", "pills", None, TAB_STYLES),
        choice("version_notice", "Melding tonen aan bezoekers als er een nieuwe versie van de website live staat", "yes", None, YESNO),
    ]},
    {"key": "brand", "label": "Merkkleuren", "fields": [
        color("primary", "Primaire kleur (knoppen, links, actief menu)", "#1b97d3", "--blue"),
        color("secondary", "Secundaire kleur (avatar, accenten)", "#f08a35", "--orange"),
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


# ── Presets ("thema's") ─────────────────────────────────────────────────────
import colorsys  # noqa: E402


def _hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(b * 255))


def _neutrals(hue, tint):
    """Light + dark neutral colors tinted with `hue`; `tint` (0-1) is how colorful the greys are."""
    c = lambda mode, name, s, l: (f"{mode}_{name}", _hex(hue, s, l))
    return dict([
        ("light_page", _hex(hue, tint * 0.8, 0.995 - tint * 0.04)),
        c("light", "bg", tint, 0.965), c("light", "card", tint * 0.3, 1.0), c("light", "hover", tint, 0.985),
        c("light", "line", tint * 0.8, 0.91), c("light", "text", tint * 0.9, 0.15), c("light", "muted", tint * 0.3, 0.42),
        c("dark", "page", tint, 0.09), c("dark", "bg", tint, 0.06), c("dark", "card", tint, 0.13),
        c("dark", "hover", tint, 0.17), c("dark", "line", tint, 0.23), c("dark", "text", tint * 0.5, 0.93),
        c("dark", "muted", tint * 0.5, 0.66),
    ])


def _preset(name, desc, primary, secondary, hue, tint=0.25, body="System", heading=None, **layout):
    overrides = {"primary": primary, "secondary": secondary, **_neutrals(hue, tint),
                 "font_body": body, "font_heading": heading or body, **layout}
    return {"key": name.lower().replace(" ", "-").replace("&", "en"), "name": name, "description": desc, "overrides": overrides}


PRESET_DEFS = [
    {"key": "standaard", "name": "Standaard (RSTCC)", "description": "De oorspronkelijke stijl met het RSTCC-logo.", "overrides": {"brand_logo": "rstcc"}},
    _preset("Oceaan", "Frisse blauwtinten", "#0ea5e9", "#14b8a6", 200, 0.3, "Inter", radius=14),
    _preset("Bosgroen", "Rustig en natuurlijk", "#16a34a", "#ca8a04", 140, 0.2, "Nunito", radius=16),
    _preset("Zonsondergang", "Warm oranje en rood", "#f97316", "#e11d48", 20, 0.3, "Poppins", radius=18),
    _preset("Lavendel", "Zacht paars", "#8b5cf6", "#ec4899", 260, 0.3, "Poppins", radius=20, btn_radius=14),
    _preset("Roze suiker", "Speels en rond", "#ec4899", "#f59e0b", 330, 0.35, "Nunito", radius=24, btn_radius=24),
    _preset("Nacht indigo", "Diep indigo", "#6366f1", "#22d3ee", 235, 0.35, "Inter", radius=12),
    _preset("Minimal zwart", "Strak, scherp, zonder schaduw", "#111827", "#6b7280", 220, 0.05, "Inter",
            radius=4, btn_radius=4, shadow="none"),
    _preset("Koffie", "Warme aardetinten met serif koppen", "#92400e", "#d97706", 30, 0.3, "Lato", "Merriweather", radius=10),
    _preset("Roest", "Terracotta en teal", "#c2410c", "#0d9488", 15, 0.25, "Montserrat", radius=8),
    _preset("Smaragd", "Helder groen met indigo", "#059669", "#6366f1", 160, 0.25, "Open Sans", radius=12),
    _preset("Koraal", "Levendig koraalrood", "#f43f5e", "#fb923c", 350, 0.3, "Montserrat", radius=16),
    _preset("Staal", "Zakelijk grijsblauw", "#475569", "#0ea5e9", 215, 0.15, "Roboto", radius=6, btn_radius=6),
    _preset("Goud luxe", "Elegant met serif koppen", "#b45309", "#1f2937", 40, 0.2, "Lato", "Playfair Display",
            radius=2, btn_radius=2, heading_weight="600", shadow="strong"),
    _preset("Mint", "Fris mint en roze", "#14b8a6", "#f472b6", 175, 0.3, "Nunito", radius=20),
    _preset("Cyber", "Scherp neon op donker-blauw", "#06b6d4", "#a3e635", 195, 0.4, "Roboto",
            radius=0, btn_radius=0, heading_weight="800"),
    _preset("Rood klassiek", "Krachtig rood", "#dc2626", "#1f2937", 0, 0.15, "Roboto", radius=6),
    _preset("Marine", "Klassiek marineblauw met goud", "#1e40af", "#f59e0b", 225, 0.3, "Open Sans", radius=8),
    _preset("Pastel perzik", "Zacht en vriendelijk", "#fb7185", "#fbbf24", 15, 0.4, "Nunito", radius=28, btn_radius=28),
    _preset("Olijf", "Aards groen", "#65a30d", "#a16207", 85, 0.25, "Lato", radius=12),
    _preset("Royal paars", "Koninklijk paars en goud", "#7e22ce", "#eab308", 280, 0.3, "Inter", "Playfair Display", radius=14),
    _preset("Terra", "Klei en zand", "#b45f3c", "#4d7c6f", 20, 0.22, "Open Sans", "Merriweather", radius=10),
    _preset("Arctic", "IJsblauw, ruim en groot", "#38bdf8", "#818cf8", 205, 0.3, "Inter", radius=16, font_size_base=17),
    _preset("Compact zakelijk", "Dicht op elkaar, veel op één scherm", "#2563eb", "#64748b", 220, 0.2, "Inter",
            radius=6, btn_radius=6, font_size_base=14, content_pad=1.25, header_h=56, sidebar_w=210,
            site_header_h=60, logo_h=38, site_logo_h=42),
    _preset("Groot en luchtig", "Grote tekst en veel ruimte", "#0d9488", "#f97316", 170, 0.25, "Poppins",
            radius=22, font_size_base=18, content_pad=3, sidebar_w=280, line_height=1.7, header_h=72),
]


def _explicit(name, desc, mode, primary, secondary, light, dark, danger, ok, **layout):
    """Preset with hand-picked palettes. light/dark = (page, bg, card, hover, line, text, muted)."""
    names = ["page", "bg", "card", "hover", "line", "text", "muted"]
    overrides = {"primary": primary, "secondary": secondary, "danger": danger, "ok": ok, "default_mode": mode, **layout}
    overrides.update({f"light_{n}": v for n, v in zip(names, light)})
    overrides.update({f"dark_{n}": v for n, v in zip(names, dark)})
    return {"key": name.lower().replace(" ", "-"), "name": name, "description": desc, "overrides": overrides, "mode": mode}


PRESET_DEFS += [
    _explicit("Romantisch", "Zacht roze, goud en serif koppen", "light", "#d6336c", "#b8860b",
              ("#fff8f8", "#fdf2f4", "#ffffff", "#fff1f3", "#f5d5db", "#4a1d2b", "#9a6b78"),
              ("#1f1218", "#170d12", "#2a1820", "#34202a", "#4a2d3a", "#fbe8ee", "#c79aab"),
              "#be123c", "#2f855a", font_body="Nunito", font_heading="Playfair Display", radius=20,
              btn_radius=24, shadow="soft", heading_weight="600"),
    _explicit("Zwart (OLED)", "Echt zwart met scherpe randen", "dark", "#3b82f6", "#a3a3a3",
              ("#ffffff", "#f5f5f5", "#ffffff", "#fafafa", "#e5e5e5", "#0a0a0a", "#737373"),
              ("#000000", "#000000", "#0a0a0a", "#141414", "#262626", "#fafafa", "#8a8a8a"),
              "#ef4444", "#22c55e", font_body="Inter", font_heading="Inter", radius=10, btn_radius=8, shadow="none"),
    _explicit("Apple licht", "macOS/iOS look, licht", "light", "#0071e3", "#ff9500",
              ("#ffffff", "#f5f5f7", "#ffffff", "#f5f5f7", "#d2d2d7", "#1d1d1f", "#86868b"),
              ("#000000", "#000000", "#1c1c1e", "#2c2c2e", "#38383a", "#f5f5f7", "#98989d"),
              "#ff3b30", "#34c759", font_body="San Francisco", font_heading="San Francisco", radius=14,
              btn_radius=12, shadow="soft", heading_weight="600"),
    _explicit("Apple donker", "macOS/iOS look, donker", "dark", "#0a84ff", "#ff9f0a",
              ("#ffffff", "#f2f2f7", "#ffffff", "#f2f2f7", "#d1d1d6", "#000000", "#8e8e93"),
              ("#000000", "#000000", "#1c1c1e", "#2c2c2e", "#38383a", "#ffffff", "#98989d"),
              "#ff453a", "#30d158", font_body="San Francisco", font_heading="San Francisco", radius=14,
              btn_radius=12, shadow="none", heading_weight="600"),
    _explicit("Windows", "Windows 11 (Fluent) look", "light", "#0067c0", "#6b69d6",
              ("#ffffff", "#f3f3f3", "#ffffff", "#f9f9f9", "#e5e5e5", "#1b1b1b", "#5d5d5d"),
              ("#1c1c1c", "#202020", "#2b2b2b", "#323232", "#3a3a3a", "#ffffff", "#9d9d9d"),
              "#c42b1c", "#0f7b0f", font_body="Segoe UI", font_heading="Segoe UI", radius=8, btn_radius=4,
              shadow="soft", heading_weight="600"),
]


def presets():
    out = []
    for p in PRESET_DEFS:
        values = merged(p["overrides"])
        _, errors = validate(values)
        assert not errors, (p["key"], errors)
        out.append({"key": p["key"], "name": p["name"], "description": p["description"],
                    "mode": p.get("mode"), "values": values})
    return out


PRESET_DEFS.insert(1, _explicit(
    "Studio2", "Oranje en grijs, passend bij het Studio2-logo", "light", "#f18745", "#939497",
    ("#ffffff", "#f6f6f6", "#ffffff", "#fafafa", "#e6e6e6", "#373736", "#7c7d80"),
    ("#1c1c1d", "#141414", "#242425", "#2d2d2e", "#3a3a3b", "#f1f1f1", "#a0a1a4"),
    "#dc2626", "#16a34a", font_body="Montserrat", font_heading="Montserrat", radius=6, btn_radius=6,
    shadow="soft", heading_weight="600", brand_logo="studio2"))
