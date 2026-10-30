# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
    {"value": "easy2edit", "label": "Easy2edit-logo", "css": ""},
    {"value": "rstcc", "label": "RSTCC-logo", "css": ""},
    {"value": "studio2", "label": "Studio2-logo", "css": ""},
]

LOADER_STYLES = [{"value": v, "label": l, "css": ""} for v, l in (
    ("ring", "Ring"), ("dots", "Stippen"), ("bar", "Voortgangsbalk"), ("pulse", "Pulserende bol"), ("orbit", "Baantjes"), ("squares", "Blokjes"),
    ("wave", "Golf"), ("skeleton", "Pagina-schets"), ("logo", "Logo"), ("image", "Eigen afbeelding"))]
LOADER_ANIM = [{"value": v, "label": l, "css": ""} for v, l in (("pulse", "Pulseren"), ("spin", "Draaien"), ("bounce", "Springen"), ("none", "Stilstaand"))]
LOADER_WHEN = [{"value": "first", "label": "Alleen bij het eerste laden van de site", "css": ""}, {"value": "always", "label": "Ook tussen pagina's", "css": ""}]
LOADER_BACKDROP = [{"value": "page", "label": "Achtergrond van de pagina", "css": ""}, {"value": "glass", "label": "Glas (vervaagd)", "css": ""}, {"value": "dim", "label": "Donker gedimd", "css": ""}]
def _opts(*pairs):
    return [{"value": v, "label": l, "css": ""} for v, l in pairs]


TRANSITIONS = _opts(("none", "Geen"), ("fade", "Vervagen"), ("slide", "Schuiven"), ("zoom", "Inzoomen"), ("blur", "Scherp worden"))
REVEALS = _opts(("none", "Geen"), ("fade", "Vervagen"), ("up", "Omhoog schuiven"), ("zoom", "Inzoomen"), ("left", "Van links"))
YESNO = [{"value": "yes", "label": "Ja", "css": ""}, {"value": "no", "label": "Nee", "css": ""}]

NAV_DEFAULT = [
    {"value": "tiles", "label": "Tegels: per menugroep een pagina met tegels", "css": ""},
    {"value": "menu", "label": "Menu: de pagina's staan in het menu links", "css": ""},
]
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

# ── Page layout templates: the most common variants of header, menu, footer and blocks (read by the frontend as data attributes) ──
HEADER_LAYOUTS = [
    {"value": "classic", "label": "Klassiek: logo links, menu en knoppen rechts", "css": ""},
    {"value": "centered", "label": "Gecentreerd: logo in het midden, menu eronder", "css": ""},
    {"value": "split", "label": "Verdeeld: menu links, logo midden, knoppen rechts", "css": ""},
    {"value": "minimal", "label": "Minimaal: logo en een menuknop", "css": ""},
    {"value": "editorial", "label": "Editorial: menuknop links (zijmenu), logo midden, knoppen rechts", "css": ""},
]
HEADER_STYLES = [
    {"value": "solid", "label": "Vlak met lijn eronder", "css": ""},
    {"value": "shadow", "label": "Met schaduw", "css": ""},
    {"value": "glass", "label": "Glas (doorzichtig)", "css": ""},
    {"value": "plain", "label": "Zonder achtergrond", "css": ""},
]
MENU_STYLES = [
    {"value": "text", "label": "Tekst", "css": ""},
    {"value": "underline", "label": "Onderstreept", "css": ""},
    {"value": "pills", "label": "Knoppen (afgerond)", "css": ""},
    {"value": "boxed", "label": "Omkaderd", "css": ""},
]
FOOTER_LAYOUTS = [
    {"value": "simple", "label": "Eenvoudig: alles gecentreerd onder elkaar", "css": ""},
    {"value": "columns", "label": "Kolommen: links, sociaal en gegevens", "css": ""},
    {"value": "split", "label": "Verdeeld: gegevens links, links rechts", "css": ""},
    {"value": "minimal", "label": "Minimaal: één regel", "css": ""},
    {"value": "brand", "label": "Merk links: logo en tekst, de rest in kolommen", "css": ""},
    {"value": "stack", "label": "Gecentreerd met merk bovenaan", "css": ""},
    {"value": "bar", "label": "Twee lagen: kolommen en een balk onderaan", "css": ""},
    {"value": "mega", "label": "Groot: merk en tekst breed, daaronder drie kolommen", "css": ""},
]
FOOTER_BRANDS = [
    {"value": "none", "label": "Geen (alleen waar de indeling het vraagt)", "css": ""},
    {"value": "name", "label": "Naam van de website", "css": ""},
    {"value": "logo", "label": "Logo", "css": ""},
    {"value": "both", "label": "Logo en naam", "css": ""},
]
FOOTER_SIZES = [
    {"value": "compact", "label": "Compact", "css": ""},
    {"value": "normal", "label": "Normaal", "css": ""},
    {"value": "roomy", "label": "Ruim", "css": ""},
]
SHOWHIDE = [{"value": "show", "label": "Tonen", "css": ""}, {"value": "hide", "label": "Verbergen", "css": ""}]
FOOTER_TONES = [
    {"value": "page", "label": "Zelfde als de pagina", "css": ""},
    {"value": "card", "label": "Vlak met lijn erboven", "css": ""},
    {"value": "dark", "label": "Donker", "css": ""},
    {"value": "brand", "label": "In de huisstijlkleur", "css": ""},
]
BLOCK_STYLES = [
    {"value": "card", "label": "Kaart (rand en schaduw)", "css": ""},
    {"value": "flat", "label": "Vlak (zonder rand)", "css": ""},
    {"value": "outline", "label": "Alleen rand", "css": ""},
    {"value": "elevated", "label": "Verhoogd (sterke schaduw)", "css": ""},
]

CHAT_SIDES = [{"value": "right", "label": "Rechtsonder", "css": "flex-end"}, {"value": "left", "label": "Linksonder", "css": "flex-start"}]
CHAT_LABELS = [{"value": "icon", "label": "Alleen een icoon 💬", "css": ""}, {"value": "text", "label": "Icoon met tekst 'Chat'", "css": ""}]

WEIGHTS = [{"value": str(w), "label": str(w), "css": str(w)} for w in (500, 600, 700, 800)]


TEXT_WEIGHTS = [{"value": str(w), "label": str(w), "css": str(w)} for w in (400, 500, 600, 700, 800)]
TEXT_COLORS = [{"value": v, "label": l, "css": c} for v, l, c in (("text", "Tekstkleur", "var(--text)"), ("primary", "Primaire kleur", "var(--blue)"), ("secondary", "Secundaire kleur", "var(--orange)"), ("muted", "Gedempt", "var(--muted)"))]
TEXT_FONTS = [{"value": "body", "label": "Lettertype van de tekst", "css": "var(--font-body)"}, {"value": "heading", "label": "Lettertype van de koppen", "css": "var(--font-heading)"}]
TRACKING = [{"value": v, "label": l, "css": c} for v, l, c in (("tight", "Smal", "-.02em"), ("normal", "Normaal", "0"), ("wide", "Ruim", ".04em"), ("wider", "Extra ruim", ".1em"))]
# text styles used in blocks and pages (the editor offers them: Kop 1, Kop 2, Kop 3, Alinea): size, weight, colour, font, line height and letter spacing, per theme
TEXT_STYLES = [("k1", "Kop 1", 1.9, "700", "heading", 1.2), ("k2", "Kop 2", 1.4, "700", "heading", 1.25), ("k3", "Kop 3", 1.15, "600", "heading", 1.3), ("k4", "Kop 4", 1.0, "600", "heading", 1.35), ("p", "Alinea", 1.0, "400", "body", 1.65)]


def _text_style_fields():
    out = []
    for k, label, size, weight, font, lh in TEXT_STYLES:
        out += [
            number(f"ts_{k}_size", f"{label}: grootte", size, f"--ts-{k}-size", "rem", 0.75, 4, 0.05),
            choice(f"ts_{k}_weight", f"{label}: dikte", weight, f"--ts-{k}-weight", TEXT_WEIGHTS),
            choice(f"ts_{k}_color", f"{label}: kleur", "text", f"--ts-{k}-color", TEXT_COLORS),
            choice(f"ts_{k}_font", f"{label}: lettertype", font, f"--ts-{k}-font", TEXT_FONTS),
            number(f"ts_{k}_lh", f"{label}: regelafstand", lh, f"--ts-{k}-lh", "", 1, 2.2, 0.05),
            choice(f"ts_{k}_track", f"{label}: letterafstand", "normal", f"--ts-{k}-track", TRACKING),
        ]
    return out


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
        choice("nav_default", "Hoe werkt het linker menu (standaard; iedereen kan zelf wisselen)", "tiles", None, NAV_DEFAULT),
        choice("sidebar_auto", "Linker menu automatisch inklappen", "never", None, SIDEBAR_AUTO),
        choice("version_notice", "Melding tonen aan bezoekers als er een nieuwe versie van de website live staat", "yes", None, YESNO),
    ]},
    {"key": "interface_look", "label": "Tabbladen en vensters", "fields": [  # part of a theme: edited in Thema -> Layout
        choice("system_popup", "Uiterlijk van systeem-popups, vensters en bijbehorende tabbladen", "clean", None, SYSTEM_POPUPS),
        choice("tab_style", "Uiterlijk van tabbladen (standaard voor de hele website)", "pills", None, TAB_STYLES),
    ]},
    {"key": "page_layout", "label": "Pagina-indeling", "fields": [  # part of a theme: edited in Thema -> Layout
        choice("header_layout", "Header: indeling", "classic", None, HEADER_LAYOUTS),
        choice("header_style", "Header: uiterlijk", "solid", None, HEADER_STYLES),
        choice("header_sticky", "Header blijft bovenaan staan bij scrollen", "yes", None, YESNO),
        choice("menu_style", "Menu: uiterlijk van de links", "text", None, MENU_STYLES),
        choice("footer_layout", "Footer: indeling", "brand", None, FOOTER_LAYOUTS),
        choice("footer_tone", "Footer: kleur", "card", None, FOOTER_TONES),
        choice("footer_brand", "Footer: logo en naam", "logo", None, FOOTER_BRANDS),
        choice("footer_social", "Footer: sociale media", "show", None, SHOWHIDE),
        choice("footer_meta", "Footer: bedrijfsgegevens", "show", None, SHOWHIDE),
        choice("footer_size", "Footer: ruimte", "normal", None, FOOTER_SIZES),
        choice("page_header", "Header op pagina's (standaard)", "show", None, SHOWHIDE),
        choice("page_footer", "Footer op pagina's (standaard)", "show", None, SHOWHIDE),
        choice("mode_switch", "Schakelaar licht/donker op de website", "show", None, SHOWHIDE),
        choice("block_style", "Blokken en kaarten op de website", "card", None, BLOCK_STYLES),
        number("block_gap", "Ruimte tussen blokken", 1.25, "--block-gap", "rem", 0.5, 3, 0.25),
        number("content_w", "Breedte van de inhoud van pagina's", 1100, "--content-w", "px", 720, 1600, 20),
    ]},
    {"key": "brand", "label": "Merkkleuren", "fields": [
        color("primary", "Primaire kleur (knoppen, links, actief menu)", "#f2823f", "--blue"),
        color("secondary", "Secundaire kleur (avatar, accenten)", "#939497", "--orange"),
        color("gender_m", "Kleur voor mannen", "#3b82f6", "--g-m"),
        color("gender_f", "Kleur voor vrouwen", "#ec4899", "--g-f"),
        color("gender_x", "Kleur voor overig", "#eab308", "--g-x"),
        color("danger", "Gevaar (verwijderen, fouten)", "#dc2626", "--danger"),
        color("ok", "Succes", "#16a34a", "--ok"),
    ]},
    {"key": "loader", "label": "Paginaloader", "fields": [
        choice("loader_on", "Paginaloader tonen", "no", None, YESNO),
        choice("loader_style", "Soort loader", "ring", None, LOADER_STYLES),
        choice("loader_when", "Wanneer", "first", None, LOADER_WHEN),
        choice("loader_backdrop", "Achtergrond", "page", None, LOADER_BACKDROP),
        number("loader_size", "Grootte", 56, None, "px", 24, 120),
        number("loader_min", "Minimaal zichtbaar", 400, None, "ms", 0, 3000, 50),
        choice("loader_percent", "Percentage tonen onder de loader", "no", None, YESNO),
        number("loader_image_id", "Eigen afbeelding voor de loader (nummer uit de media)", 0, None, "", 0, 100000000),
        number("loader_image_size", "Grootte van de eigen afbeelding", 80, None, "px", 24, 500),
        number("loader_image_opacity", "Doorzichtigheid van de eigen afbeelding", 100, None, "%", 5, 100, 5),
        number("loader_image_bg_opacity", "Doorzichtigheid van de achtergrondkleur", 100, None, "%", 0, 100, 5),
        number("loader_image_radius", "Ronde hoeken van de eigen afbeelding", 0, None, "px", 0, 250),
        number("loader_image_border", "Rand om de eigen afbeelding (dikte)", 0, None, "px", 0, 24),
        color("loader_image_border_color", "Kleur van de rand", "#f2823f", None),
        choice("loader_image_bg_on", "Achtergrondkleur achter de eigen afbeelding", "no", None, YESNO),
        color("loader_image_bg", "Achtergrondkleur", "#ffffff", None),
        number("loader_image_pad", "Ruimte tussen rand en afbeelding", 0, None, "px", 0, 60),
        choice("loader_image_anim", "Beweging van de eigen afbeelding", "pulse", None, LOADER_ANIM),
        number("loader_opacity", "Doorzichtigheid van de laag achter de loader", 100, None, "%", 10, 100, 5),
        choice("loader_lazy", "Lazy load: afbeeldingen laden pas als je ze nodig hebt", "yes", None, YESNO),
        choice("page_transition", "Pagina-overgang", "none", None, TRANSITIONS),
        number("page_transition_ms", "Duur van de overgang", 350, None, "ms", 100, 1000, 50),
        choice("scroll_reveal", "Scrolleffect: onderdelen verschijnen in beeld", "none", None, REVEALS),
        number("scroll_reveal_ms", "Duur van het scrolleffect", 600, None, "ms", 200, 1500, 50),
        choice("scroll_parallax", "Parallax: achtergronden bewegen trager mee", "no", None, YESNO),
        choice("scroll_progress", "Voortgangsbalk bovenaan bij scrollen", "no", None, YESNO),
        choice("scroll_top", "Knop om terug naar boven te gaan", "no", None, YESNO),
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
        choice("brand_logo", "Logo (header, login, homepage, favicon)", "easy2edit", None, LOGOS),
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
    {"key": "textstyles", "label": "Tekststijlen (koppen en alinea's)", "fields": _text_style_fields()},
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
        number("site_header_h", "Hoogte van de website-header", 72, "--site-header-h", "px", 48, 160, 2),
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


# ── Helpers for making themes (also used by Site importeren and the theme import) ──
import colorsys  # noqa: E402


def _hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(b * 255))


def _neutrals(hue, tint):
    """Light + dark neutral colors tinted with `hue`; `tint` (0-1) is how colorful the greys are."""
    c = lambda mode, name, s, l: (f"{mode}_{name}", _hex(hue, s, l))  # noqa: E731
    return dict([
        ("light_page", _hex(hue, tint * 0.8, 0.995 - tint * 0.04)),
        c("light", "bg", tint, 0.965), c("light", "card", tint * 0.3, 1.0), c("light", "hover", tint, 0.985),
        c("light", "line", tint * 0.8, 0.91), c("light", "text", tint * 0.9, 0.15), c("light", "muted", tint * 0.3, 0.42),
        c("dark", "page", tint, 0.09), c("dark", "bg", tint, 0.06), c("dark", "card", tint, 0.13),
        c("dark", "hover", tint, 0.17), c("dark", "line", tint, 0.23), c("dark", "text", tint * 0.5, 0.93),
        c("dark", "muted", tint * 0.5, 0.66),
    ])


# ── Built-in themes ─────────────────────────────────────────────────────────
# Only the two house styles live in the system. All other themes are theme packages (<root>/themes/<key>/theme.json)
# that are switched on or off in Admin -> Themapakketten (see themepacks.py).
PRESET_DEFS = [
    {"key": "easy2edit", "name": "Easy2edit", "description": "Het standaardthema van Easy2edit: oranje en grijs, met het Easy2edit-logo.", "overrides": {"brand_logo": "easy2edit", "primary": "#f2823f", "secondary": "#939497"}, "builtin": True},
    {"key": "standaard", "name": "RSTCC", "description": "De oorspronkelijke stijl met het RSTCC-logo.", "overrides": {"brand_logo": "rstcc", "primary": "#1b97d3", "secondary": "#f08a35"}, "builtin": True},
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
    shadow="soft", heading_weight="600", brand_logo="studio2", header_layout="classic", header_style="solid", menu_style="underline", footer_layout="brand", footer_tone="card", footer_brand="logo", block_style="card"))


def presets():
    """The built-in themes plus the theme packages that are switched on."""
    from . import themepacks

    out = []
    builtin = [{"key": m["key"], "name": m["name"], "description": m["description"], "mode": m.get("mode"), "overrides": m["values"], "assets": len(m.get("assets", {})) + len(m.get("home", []))} for m in themepacks.builtin_manifests()]
    for p in [*builtin, *themepacks.enabled_defs()]:
        values = merged(p["overrides"])
        _, errors = validate(values)
        if errors:
            continue
        out.append({"key": p["key"], "name": p["name"], "description": p["description"], "mode": p.get("mode"), "assets": p.get("assets", 0), "values": values})
    return out
