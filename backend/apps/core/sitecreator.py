# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Website ontwerpen -> AI-creator: Claude (through the Anthropic link of Admin -> API keys) designs a complete website as plain files (html per page, one style.css,
svg illustrations) in the shape that the html import reads (sections as full-width bands, the blocks of the page editor). The user adjusts it in a chat; the
files then go through the normal html import (proposal, linking, applying as editable blocks). Runs in the background; the screen polls the job.

The job is first a DRAFT (a step plan: start, style, colours, pages, photos, preview): every step is saved on the server so the user can stop and continue later.
The design can start from a ZIP (made with the AI prompt) that is read in and improved instead of designed from nothing."""
import io
import json
import logging
import os
import re
import threading
import time
import uuid
import zipfile
from datetime import date

from django import db
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from django.utils.text import get_valid_filename

from apps.integrations import ai

from apps.medialib import areas
from apps.sysobjects.models import SystemObject

from . import importrules as R
from .models import Language, SiteDesignJob

logger = logging.getLogger(__name__)
FILE_MAX = 400_000  # characters per file
FILES_MAX = 40
NAME_RE = re.compile(r"^(?:img/)?[a-z0-9][a-z0-9_-]{0,%d}\.(?:html|css|svg)$" % (R.NAME_MAX - 1))
MARK = re.compile(r"^=== FILE: (\S+) ===\s*$", re.M)
FENCE = re.compile(r"^```[a-z]*\s*\n|\n```\s*$", re.I)

_RULES = """You are a senior web designer. You design complete, professional websites as plain static files that are imported into the website system Easy2edit.
The importer reads the html and css and rebuilds every page with the blocks of the Easy2edit page editor, so a clean, predictable structure matters more than clever tricks.

FILES
- One html file per page (the start page is index.html), ONE shared style.css, and optional illustrations as svg files in img/ (img/hero.svg). No other file types, no JavaScript, no external fonts/scripts/frameworks, no data: urls, no photos or hotlinks.
- File rules of the importer (they are checked, anything else is skipped): at most @MAX_PAGES@ html pages and at most @MAX_IMAGES@ pictures in total, each picture at most @MAX_IMAGE_MB@ MB; file names only a-z, 0-9, - and _ (at most @NAME_MAX@ characters before the extension); everything in the root of the ZIP plus the folder img/ (no other folders, so never en/index.html).
- Every html file is a complete document (<!doctype html>, <html lang>, <meta charset>, <meta name=viewport>, <title>, <meta name=description>, <link rel="stylesheet" href="style.css">). Links between pages are relative (about.html); "#id" for places on the same page.
- Pictures: svg illustrations in img/ (simple, single or two-colour flat shapes in the palette of the site) or inline <svg>, with <img src="img/x.svg" alt="..." width height>. Photos are added later by the user, so where a photo belongs make a tasteful svg illustration or a gradient shape instead.

STRUCTURE OF EVERY PAGE
- <body> = one <header> (brand, <nav> with 3-6 links, optional button), one <main>, one <footer> (short text, links). Header and footer are identical on every page.
- <main> consists ONLY of full-width <section> elements with an id. The band background goes on the <section> (edge to edge); inside ONE centred <div class="container"> (max-width 1100px, margin 0 auto, padding 0 1.25rem). Never put a card around a whole section. Section padding 4rem 0 (hero 6rem 0), alternate light and tinted/dark bands.
- Allowed content: h1 (once, in the hero), h2 (section title), h3 (card title); p, ul/ol/li, strong, em, a; img/figure; buttons as <a class="btn btn-primary"> or <a class="btn btn-outline">; hr; no <form>, no <button> without a link.
- Columns: a div with display grid/flex, 2-4 columns, one column on mobile (@media (max-width: 760px)). Cards: <div class="card"> with own background, radius, padding, 1px border and/or shadow, only inside the columns, equal height.
- A hero with text on one side and a visual on the other: two columns (50/50), text left (small label, h1, p, buttons), svg visual right.
- FAQ: one section id="faq" with <details><summary>Question?</summary><p>Answer.</p></details> per question. Products with prices: <div class="product"> cards with <p class="price">. Events: <article class="event">.
- Colours as css variables on :root (--primary, --secondary, --bg, --text, --card, --line), used everywhere; contrast at least 4.5:1. Typography in rem (body 1rem/1.6, h1 2.6-3.4rem, h2 1.8-2.2rem, h3 1.2-1.4rem), system font stack. Buttons padding .75rem 1.4rem, radius 10px, weight 600. Works from 360px to 1600px. One h1 per page, alt texts, descriptive link texts. Icons: only single-colour inline svg (stroke="currentColor"), never emoji.
- Write real, convincing copy in the requested language (no lorem ipsum), concrete headings, short paragraphs, clear calls to action. Every page has a unique <title> (max 60 chars) and meta description (max 155).

LIGHT/DARK MODE AND LANGUAGES
- Colours are ALWAYS used through css variables (no hard-coded colours in rules, svg illustrations use currentColor or the variables). The user message says which display the website has: "light" = the colours as given on :root; "dark" = the dark colours as given on :root; "both" = the light colours on :root, and the dark colours twice: in :root[data-theme="dark"] {...} and in @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }. Easy2edit sets data-theme on <html> and shows its own light/dark switch: never build a switch and never use JavaScript for it. Text on pictures and on dark bands stays readable in both modes (contrast at least 4.5:1).
- Languages: write every page in the main language only, one html file per page, never one file per language, no language switcher of your own: the system translates the pages into the other languages and adds the language switch to the header. Leave room for it at the right of the header (the menu must wrap or shrink gracefully), let buttons and menu items grow with longer words (no fixed widths on text, min-width instead of width), and when a right-to-left language is among them (ar, he, fa, ur) use logical css properties (margin-inline, padding-inline, text-align: start, inset-inline) so the layout mirrors correctly.

MODULES AND SYSTEM OBJECTS
- Easy2edit has modules (webshop, FAQ, community, agenda, ...) and system objects: ready-made, live blocks (an overview of products, an agenda, a subscription plan, a donation button, ...). The user message lists the modules the website uses, with what each module needs from the pages, and the system objects to place.
- A system object is placed as an EMPTY element on its own line: <div data-sysobject="SLUG"></div> (SLUG exactly as given), directly inside the <div class="container"> of the section where it belongs, after the section heading and a short intro. Never inside <p>, <a>, <details> or a card, never styled, never imitated, never with content: Easy2edit fills it with the live content. Give such a section an id and make it a full band like every other section.
- Use the links of the system for the module pages (e.g. /producten, /winkelwagen, /faq, /registreren, /login, /dashboard) in menu items and buttons; do not build your own versions of those pages (no forms, no carts).

OUTPUT FORMAT (strict): only files, nothing else before the first file. Every file starts with a line "=== FILE: name ===" (name exactly like img/hero.svg, style.css, about.html) followed by the complete content of the file. No markdown fences, no explanation, no "the rest is the same"."""


CATALOG = [  # the modules that a website design can use: what they give, and what the pages need to do with them (key, label, what it is, instruction for the AI)
    ("faq", "FAQ", "Veelgestelde vragen met antwoorden op een eigen pagina (/faq).", "Put ALL questions in ONE section id=\"faq\" as <details><summary>..</summary><p>..</p></details>; they are moved into the FAQ module. Add a button 'Alle veelgestelde vragen' to /faq."),
    ("webshop", "Webshop", "Producten met prijzen, winkelwagen en afrekenen (/producten, /winkelwagen).", "Show a few featured products as <div class=\"product\"> cards (picture, h3, <p class=\"price\">, button). Buttons and menu: 'Alle producten' -> /producten, 'Winkelwagen' -> /winkelwagen. No cart, checkout or forms yourself; if a system object for the product overview is selected, place that instead of own product cards."),
    ("community", "Community & dating", "Profielen, zoeken en matchen, berichten en chat voor leden.", "Explain the benefits, how it works and safety. Buttons: 'Gratis aanmelden' -> /registreren, 'Inloggen' -> /login, members area -> /dashboard. No login, search or chat forms."),
    ("agenda", "Agenda", "Evenementen, activiteiten en afspraken.", "Use <article class=\"event\"> (h3, date, place, short text) for a few examples; if a system object for the agenda is selected, place that instead."),
    ("documents", "Documenten", "Downloads en documenten voor bezoekers of leden.", "A section 'Downloads' with a short intro and a button 'Naar de documenten' -> /dashboard. No file lists of your own."),
    ("marketplace", "Marktplaats", "Advertenties van gebruikers.", "A section that explains how placing and finding adverts works, with buttons 'Aanmelden' -> /registreren and 'Inloggen' -> /login."),
    ("subscriptions", "Abonnementen", "Betaalde toegang met abonnementen.", "A pricing section (id=\"prijzen\") with the plans; when system objects of kind Abonnement are selected place those (one per plan) instead of own price cards. Buttons -> /registreren."),
    ("donations", "Donaties", "Giften en donatiecampagnes.", "A section that explains what donations are used for; place the selected donation system objects there; no payment forms."),
    ("registration", "Aanmelden", "Bezoekers maken zelf een account aan.", "Menu button 'Aanmelden' -> /registreren and link 'Inloggen' -> /login on every page (header), no forms."),
    ("privacy_pages", "Privacy- en cookiepagina", "De pagina's /privacy en /cookies.", "Link 'Privacy' -> /privacy and 'Cookies' -> /cookies in the footer of every page."),
    ("languages", "Talen", "Een site in meer dan één taal.", "Write the pages in the main language only; the system adds the language switch and the translations. Do not build a language switcher."),
    ("seo", "SEO", "Vindbaarheid in zoekmachines.", "Unique title and meta description per page, one h1, descriptive alt texts."),
    ("cookies", "Cookies", "Cookiebanner en cookiebeleid.", "The system shows the cookie banner itself: do not build one. Link 'Cookies' -> /cookies in the footer."),
    ("age_gate", "Leeftijdscontrole", "Bezoekers bevestigen hun leeftijd (18+) voor ze de site zien.", "The system shows the age check itself: do not build one. Where it fits, state clearly that the website is for adults (18+)."),
    ("geo", "Landcontrole", "Toegang per land.", "The system handles the country check itself: do not build one."),
    ("gambling", "Gokken-popup", "Verantwoord-gokken melding (24+).", "The system shows the notice itself: do not build one. Mention responsible gambling where it fits."),
]
# What is NOT offered to a website design: admin tools and system modules. Everything else (also modules and plugins that are added later) is offered, and is ON by default.
IGNORE_MODULES = {"pages", "edit_mode", "media", "siteimport", "sysobjects", "branding", "theme", "help", "twofa", "word_filter", "stats", "orders", "payments", "integrations", "communication", "plugins", "notifications", "sandbox", "system", "storage", "backups", "roles", "users", "dashboard", "security_basic", "ai", "modules"}
IGNORE_PLUGINS = {"siteimport", "statistics", "finance", "orders", "profile-themes"}
GENERIC_HOW = "Offer '{label}' on the website ({desc}). Mention it where it fits: a short section or a menu item/button; use its system objects when they are selected; never build your own forms, pages or data for it."


def rules():
    """The system rules for the AI with the numbers of importrules.py filled in (the same numbers that the importer and the AI prompt of the screen use)."""
    d = R.as_dict()
    out = _RULES
    for k, v in (("MAX_PAGES", d["max_pages"]), ("MAX_IMAGES", d["max_images"]), ("MAX_IMAGE_MB", f"{d['max_image_mb']:g}"), ("NAME_MAX", d["name_max"])):
        out = out.replace(f"@{k}@", str(v))
    return out


def module_items():
    """The modules and plugins that a website design can use, from the live system: the curated ones with their own instruction, and every other module or plugin (also new ones) with a general instruction."""
    from apps.plugins.models import Plugin

    from . import modules as M

    items, covered = [], set()

    def on(key):
        try:
            return bool(M.enabled(key))
        except Exception:  # noqa: BLE001
            return False

    for key, label, desc, how in CATALOG:
        items.append({"key": key, "label": label, "desc": desc, "how": how, "enabled": on(key), "kind": "module", "auto": False})
        covered.add(key)
        covered.add((M.BY_KEY.get(key) or {}).get("plugin") or "-")
    for m in M.MODULES:
        k = m["key"]
        if k in covered or k in IGNORE_MODULES or m.get("group") in ("Kern", "Systeem") or m.get("core") or (m.get("plugin") and m["plugin"] in {c[0] for c in CATALOG}) or (m.get("plugin") in IGNORE_PLUGINS):
            continue
        items.append({"key": k, "label": m["label"], "desc": m.get("desc", ""), "how": GENERIC_HOW.format(label=m["label"], desc=m.get("desc", "")), "enabled": on(k), "kind": "module", "auto": True})
        covered.add(k)
        covered.add(m.get("plugin") or "-")
    for p in Plugin.objects.order_by("title"):
        if p.name in IGNORE_PLUGINS or p.name in covered:
            continue
        desc = (p.description or p.manifest.get("description") or "")[:200]
        items.append({"key": "plugin:" + p.name, "label": p.title, "desc": desc, "how": GENERIC_HOW.format(label=p.title, desc=desc), "enabled": bool(p.enabled), "kind": "plugin", "auto": True})
    allowed = _installation()
    for it in items:  # a design may only use what the active standard installation has on (without an installation: no limit)
        if allowed is None:
            it["in_installation"] = True
        else:
            mods, plugs = allowed
            own = (M.BY_KEY.get(it["key"]) or {}).get("plugin")
            it["in_installation"] = (it["key"].split(":", 1)[1] in plugs) if it["kind"] == "plugin" else (it["key"] in mods or it["key"] in plugs or bool(own and own in plugs))
    return items


def _installation():
    """(module keys, plugin names) of the active standard installation as it is now (with the superadmin's changes), or None when no installation is active."""
    try:
        from . import presets

        key = presets.active()
        if not key:
            return None
        p = presets.get(key)
        return set(presets._wanted_modules(p)), set(presets.plugins_for(p))
    except Exception:  # noqa: BLE001 - never stop the design screen for this
        logger.exception("sitecreator installation")
        return None


def price_with(extra_keys):
    """The price per month (ex VAT) of the active standard installation, and with these extra modules/plugins (catalog keys outside the installation) switched on:
    {"available", "base", "monthly", "extra", "lines": [{label, price}]}. Without an active installation there is no basis to compare with: available is False."""
    from decimal import Decimal

    from . import modules as M
    from . import presets, pricing

    key = presets.active()
    if not key:
        return {"available": False, "base": "0.00", "monthly": "0.00", "extra": "0.00", "lines": []}
    base = presets.get(key)
    items = {i["key"]: i for i in module_items()}
    mods, plugs = list(base["modules"]), list(base["plugins"])
    for k in extra_keys or []:
        it = items.get(k)
        if not it or it.get("in_installation") is not False:
            continue
        if it["kind"] == "plugin":
            plugs.append(k.split(":", 1)[1])
        else:
            if k in M.BY_KEY:
                mods.append(k)
            own = (M.BY_KEY.get(k) or {}).get("plugin") or (k if k in {x.get("plugin") for x in M.MODULES} or k in {p.name for p in __import__("apps.plugins.models", fromlist=["Plugin"]).Plugin.objects.all()} else None)
            if own:
                plugs.append(own)

    def monthly(m, pl):
        pr = {**base, "modules": list(dict.fromkeys(m)), "plugins": list(dict.fromkeys(pl))}
        total, lines = pricing.price_of(presets._wanted_modules(pr), presets.plugins_for(pr))
        return total, lines

    b_total, b_lines = monthly(base["modules"], base["plugins"])
    t_total, t_lines = monthly(mods, plugs)
    before = {(x["label"], x["price"]) for x in b_lines}
    return {"available": True, "base": str(b_total), "monthly": str(t_total), "extra": str(t_total - b_total), "lines": [x for x in t_lines if (x["label"], x["price"]) not in before]}


def effective_off(b, items=None):
    """The catalog keys this website does NOT use: what the user switched off, and everything outside the active standard installation that the user did not add on purpose (modules_extra)."""
    items = items if items is not None else module_items()
    off, extra = set(b.get("modules_off") or []), set(b.get("modules_extra") or [])
    return off | {i["key"] for i in items if i.get("in_installation") is False and i["key"] not in extra}


def catalog():
    """What the design can use: the modules (with whether they are on in this system) and the system objects that exist now (slug, kind, name)."""
    from apps.sysobjects import service as sos
    from apps.sysobjects import views as sov
    from apps.sysobjects.models import SystemObject

    mods = module_items()
    for it in mods:  # what switching on one that is outside the standard installation adds per month (ex VAT): the warning in the screen
        if it.get("in_installation") is False:
            try:
                it["extra_monthly"] = price_with([it["key"]])["extra"]
            except Exception:  # noqa: BLE001
                logger.exception("sitecreator extra price")
                it["extra_monthly"] = "0.00"
    objs = []
    try:
        sos.sync()
        for o in SystemObject.objects.filter(enabled=True):
            r = sov._row(o, public=True)
            if not r:
                continue
            names = r.get("names") or {}
            name = (names.get("") or next(iter(names.values()), "") or (r.get("data") or {}).get("title") or o.slug)
            objs.append({"slug": o.slug, "kind": o.kind, "kind_label": dict(SystemObject.KINDS).get(o.kind, o.kind), "name": str(name)[:120]})
        allowed = _installation()
        if allowed is not None:  # the system objects of plugins and modules that the active standard installation does not have are not offered either
            from apps.plugins.models import Plugin

            mod_keys, plug_names = allowed
            names_of = {p.pk: p.name for p in Plugin.objects.all()}
            by_slug = {o.slug: o for o in SystemObject.objects.all()}

            def fits(o):
                src = by_slug.get(o["slug"])
                if src is None:
                    return True
                if src.kind in ("plugin", "plugin_item", "plugin_part"):
                    return names_of.get(src.ref_id) in plug_names
                if src.kind in ("donation", "plan"):
                    return "subscriptions" in plug_names
                if src.kind == "energy":
                    return "energy" in mod_keys
                return True

            objs = [o for o in objs if fits(o)]
    except Exception:  # noqa: BLE001
        logger.exception("sitecreator catalog")
    from .models import Language

    langs = [{"code": l.code, "name": l.name, "native": l.native_name, "rtl": l.rtl, "enabled": l.enabled, "default": l.is_default} for l in Language.objects.all()]
    return {"modules": mods, "objects": objs, "languages": langs, "rules": R.as_dict()}


HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
COLOR_KEYS = ("primary", "secondary", "bg", "card", "text", "dark", "dbg", "dcard", "dtext")  # dbg/dcard/dtext: the colours of the dark mode
MODES = ("light", "dark", "both")
FONTS = {"sans": 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', "serif": 'Georgia, "Times New Roman", serif', "round": '"Trebuchet MS", "Segoe UI", system-ui, sans-serif'}
STYLE_TAGS = {"modern", "warm", "zakelijk", "speels", "minimalistisch", "luxe", "natuurlijk", "technisch", "creatief", "klassiek"}
KINDS = {"company", "shop", "community", "agenda", "blog", "portfolio", "club"}
IMG_OK = {e for e in R.IMAGE_EXT if e != "svg"}
MAX_PHOTOS = R.MAX_IMAGES


def slug(page, i):
    s = re.sub(r"[^a-z0-9]+", "-", str(page).lower()).strip("-")[:40]
    return "index.html" if i == 0 else f"{s or 'page' + str(i + 1)}.html"


def pages_of(brief):
    raw = [p.strip() for p in re.split(r"[,\n]", str(brief.get("pages") or "")) if p.strip()] or ["Home", "Over ons", "Diensten", "FAQ", "Contact"]
    out, seen = [], set()
    for i, p in enumerate(raw[:10]):
        f = slug(p, i)
        while f in seen:
            f = f.replace(".html", "-2.html")
        seen.add(f)
        out.append((f, p[:60]))
    return out


def parse(text):
    """{name: content} from the marked output; names are checked, sizes limited."""
    parts = MARK.split(text or "")
    out = {}
    for name, body in zip(parts[1::2], parts[2::2]):
        name = name.strip().lower()
        body = FENCE.sub("", body.strip("\n")).strip() + "\n"
        if NAME_RE.match(name) and len(body) <= FILE_MAX:
            out[name] = body
    return out


# ── the step plan (draft) ──
def themes():
    """The themes of the system (Thema) with their palette: they can be picked as the style of the design."""
    from . import theme as T
    from . import themepacks

    out = []
    for p in themepacks.listing():
        man = themepacks.manifest_of(p["key"]) or {}
        v = T.merged(man.get("values") or {})
        out.append({"key": p["key"], "name": p["name"], "description": p.get("description", ""), "mode": p.get("mode"), "colors": p["colors"], "fonts": p["fonts"], "radius": v.get("radius", 14), "btn_radius": v.get("btn_radius", 10), "active": p.get("active", False)})
    return out


def _clean_colors(c):
    return {k: str(c[k]) for k in COLOR_KEYS if isinstance(c, dict) and HEX.match(str(c.get(k) or ""))}


def photo_file(name, taken):
    base, ext = os.path.splitext(get_valid_filename(str(name or "foto")).lower())
    base = re.sub(r"[^a-z0-9_-]+", "-", base).strip("-_")[:R.NAME_MAX] or "foto"
    ext = ext.lstrip(".") if ext.lstrip(".") in IMG_OK else "jpg"
    f, n = f"{base}.{ext}", 2
    while f in taken:
        f, n = f"{base}-{n}.{ext}", n + 1
    return f


def _clean_photos(raw, old):
    from apps.medialib.models import MediaItem

    have = {p["id"]: p for p in old or []}
    ids = []
    for p in (raw if isinstance(raw, list) else [])[:MAX_PHOTOS]:
        try:
            ids.append((int(p.get("id")), str(p.get("note") or "")[:200]))
        except (TypeError, ValueError, AttributeError):
            continue
    items = {m.id: m for m in MediaItem.objects.filter(id__in=[i for i, _ in ids], kind="image")}
    out, taken = [], set()
    for i, note in ids:
        m = items.get(i)
        if not m or any(x["id"] == i for x in out):
            continue
        f = have.get(i, {}).get("file") or photo_file(m.name, taken)
        taken.add(f)
        out.append({"id": i, "file": f, "name": m.name[:120], "url": default_storage.url(m.key), "note": note})
    return out


def clean_brief(patch, old):
    """The brief with only known keys and safe values; the photos are checked against the media library."""
    b = dict(old or {})
    p = patch if isinstance(patch, dict) else {}
    for k, n in (("name", 120), ("lang", 40), ("pages", 600), ("style", 300), ("extra", 1500), ("theme", 60), ("theme_name", 120)):
        if k in p:
            b[k] = str(p[k] or "")[:n]
    if "kind" in p:
        b["kind"] = p["kind"] if p["kind"] in KINDS else "company"
    if "style_tags" in p:
        b["style_tags"] = [t for t in (p["style_tags"] if isinstance(p["style_tags"], list) else []) if t in STYLE_TAGS][:6]
    if "colors" in p:
        b["colors"] = _clean_colors(p["colors"])
    if "color_mode" in p:
        b["color_mode"] = p["color_mode"] if p["color_mode"] in MODES else "light"
    if "langs" in p:
        known = set(Language.objects.values_list("code", flat=True))
        b["langs"] = [c for c in (p["langs"] if isinstance(p["langs"], list) else []) if isinstance(c, str) and c in known][:15]
    if "lang_switch" in p:
        b["lang_switch"] = bool(p["lang_switch"])
    if "font" in p:
        b["font"] = p["font"] if p["font"] in FONTS else "sans"
    if "radius" in p:
        try:
            b["radius"] = max(0, min(40, int(p["radius"])))
        except (TypeError, ValueError):
            pass
    if "photos" in p:
        b["photos"] = _clean_photos(p["photos"], b.get("photos"))
    if "modules_off" in p:  # the modules and plugins that the user does NOT want (all others are used, also the ones that are added later)
        known = {i["key"] for i in module_items()}
        b["modules_off"] = [k for k in (p["modules_off"] if isinstance(p["modules_off"], list) else []) if k in known][:80]
    if "modules_extra" in p:  # modules and plugins outside the standard installation that the user switched on on purpose (they raise the price per month)
        known = {i["key"] for i in module_items() if i.get("in_installation") is False}
        b["modules_extra"] = [k for k in (p["modules_extra"] if isinstance(p["modules_extra"], list) else []) if k in known][:80]
    if "objects" in p:
        known = set(SystemObject.objects.values_list("slug", flat=True))
        b["objects"] = [x for x in (p["objects"] if isinstance(p["objects"], list) else []) if isinstance(x, str) and x in known][:40]
    if "step" in p:
        try:
            b["step"] = max(0, min(6, int(p["step"])))
        except (TypeError, ValueError):
            pass
    if "mode" in p:
        b["mode"] = "improve" if p["mode"] == "improve" else "new"
    return b


def create(user, name=""):
    if not ai.available():
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    for old in SiteDesignJob.objects.filter(created_at__lt=timezone.now() - timezone.timedelta(days=60)):
        old.delete()
    brief = {"name": str(name or "")[:120], "kind": "company", "lang": "Dutch", "mode": "new", "step": 0, "font": "sans"}
    return SiteDesignJob.objects.create(user=user, status="draft", name=brief["name"] or "Nieuw ontwerp", brief=brief)


def save(job, patch):
    if job.status not in ("draft", "done", "error"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    b = clean_brief(patch, job.brief)
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, name=(b.get("name") or job.name)[:120], updated_at=timezone.now())
    job.brief = b
    return job


def listing(user):
    out = []
    for j in SiteDesignJob.objects.filter(user=user).order_by("-updated_at")[:30]:
        out.append({"id": str(j.pk), "name": j.name, "status": j.status, "step": (j.brief or {}).get("step", 0), "pages": len(j.files or {}) and len([f for f in j.files if f.endswith(".html")]), "updated_at": j.updated_at.isoformat()})
    return out


def read_zip(job, upload, user):
    """A ZIP (made with the AI prompt): read with the rules of importrules.py (ziprules): the html, css and svg files become the files of this design, the raster pictures go to
    the media library (tag design) and into the photo list, vertalingen-<taal>.json is kept for the import. Returns (job, notes)."""
    from apps.medialib.models import MediaItem

    from . import importrules as R
    from . import ziprules

    if job.status not in ("draft", "done", "error"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    if getattr(upload, "size", 0) > R.MAX_TOTAL:
        raise ValueError(f"Het ZIP-bestand is te groot (maximaal {R.mb(R.MAX_TOTAL)} MB).")
    try:
        z = zipfile.ZipFile(upload)  # read from the uploaded file itself: no second copy in memory
    except zipfile.BadZipFile:
        raise ValueError("Dit is geen geldig ZIP-bestand.")
    bundle = ziprules.validate_for_site(ziprules.read_zip(z))
    notes = list(bundle.notes)
    files, photos = {}, list((job.brief or {}).get("photos") or [])
    taken = {p["file"] for p in photos}
    for name, data in sorted(bundle.files.items()):
        ext = name.rsplit(".", 1)[-1]
        if ext in ("html", "css", "svg"):
            files[name] = data.decode("utf-8", "replace")
        elif ext in ("jpg", "jpeg", "png", "webp"):
            if len(photos) >= R.MAX_IMAGES:
                notes.append(f"{name} is overgeslagen: maximaal {R.MAX_IMAGES} afbeeldingen.")
                continue
            base = name.split("/")[-1]
            key = default_storage.save(areas.site_path("library", f"{date.today():%Y/%m}/{uuid.uuid4().hex[:8]}-{get_valid_filename(base)}"), ContentFile(data))
            item = MediaItem.objects.get(key=key)
            item.name, item.uploaded_by, item.tags = base[:255], user, ["design"]
            item.save(update_fields=["name", "uploaded_by", "tags"])
            f = photo_file(base, taken)  # (the name already follows the rule, so it stays as it is)
            taken.add(f)
            photos.append({"id": item.id, "file": f, "name": base[:120], "url": default_storage.url(item.key), "note": "uit het ZIP-bestand"})
    htmls = sorted((n for n in files if n.endswith(".html")), key=lambda n: (n != "index.html", n))
    pages = []
    for n in htmls:
        m = re.search(r"<title>(.*?)</title>", files[n], re.S | re.I)
        pages.append(re.sub(r"\s+", " ", (m.group(1) if m else n[:-5])).split("|")[0].split(" - ")[0].strip()[:60] or n[:-5])
    b = dict(job.brief or {})
    b.update({"mode": "improve", "photos": photos, "pages": ", ".join(pages), "from_zip": [n for n in files]})
    if not (b.get("name") or "").strip() or b.get("name") == "Nieuw ontwerp":  # the name of the website: from the design itself (the title of the start page, without the slogan)
        first = re.search(r"<title>(.*?)</title>", files.get("index.html") or files[htmls[0]], re.S | re.I)
        guess = re.split(r"\s[|–—-]\s|\s[:·]\s", re.sub(r"\s+", " ", first.group(1) if first else "").strip())[0].strip()[:80]
        b["name"] = guess  # no title in the design: the name stays empty and is asked (it is required)
        if guess:
            SiteDesignJob.objects.filter(pk=job.pk).update(name=guess[:120])
    SiteDesignJob.objects.filter(pk=job.pk).update(files=files, brief=b, translations=bundle.translations, updated_at=timezone.now())
    job.files, job.brief, job.translations = files, b, bundle.translations
    try:  # the colours, font and corners of this design become the settings of the step plan
        job, note = apply_palette(job)
        notes.append(note)
    except ValueError:
        pass
    return job, notes


# ── documents with the goals of the website (pdf, word): Claude reads them and makes the settings of the step plan ──
DOC_EXT = {"pdf", "docx", "txt", "md"}
DOC_MAX = 10 * 2**20
DOC_TEXT = 40000  # characters that Claude reads
DOC_SYSTEM = (
    "You read a document (a brief, a plan, a company profile, a list of objectives) about a website and make the settings for the website designer. "
    'Answer with ONE JSON object only: {"summary": 2-3 sentences, in Dutch, about what the document says about the website, '
    '"goals": [at most 8 short Dutch bullets: the objectives of the website, what it must achieve], "name": name of the website or company or "", "kind": one of the kinds, '
    '"lang": code of the main language of the website (from the languages), "langs": [codes of other languages that the document asks for], '
    '"pages": [names of the pages in menu order, at most 8, in the language of the website, the first is the home page], '
    '"extra": audience, offer, tone and key messages for the designer as running text (at most 900 characters, in the language of the document), '
    '"style_tags": [at most 4 of the style words], "style": short free description of the look or "", "theme": key of the theme that fits best or "", '
    '"colors": {"primary": "#rrggbb", "secondary": "#rrggbb"} ONLY when the document names brand colours, else {}, "color_mode": "light" | "dark" | "both" or "" when not mentioned, '
    '"font": "sans" | "serif" | "round" or "", "modules": [keys of the modules that the goals really need, from the modules list]}. '
    "Use only what the document says or clearly implies; leave a field empty when the document does not tell. Never invent facts."
)


def _doc_text(data, ext):
    """(text, number of pages) of a pdf, word (docx) or text file."""
    if ext == "pdf":
        from pypdf import PdfReader

        r = PdfReader(io.BytesIO(data))
        if r.is_encrypted:
            raise ValueError("Dit PDF-bestand is beveiligd met een wachtwoord.")
        parts = [(p.extract_text() or "") for p in r.pages[:80]]
        return "\n".join(parts), len(r.pages)
    if ext == "docx":
        try:
            z = zipfile.ZipFile(io.BytesIO(data))
            xml = z.read("word/document.xml").decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            raise ValueError("Dit Word-bestand kan niet worden gelezen (alleen .docx).")
        xml = re.sub(r"</w:p>", "\n", xml)
        xml = re.sub(r"<w:tab/>|<w:br/>", " ", xml)
        import html as htmllib

        return htmllib.unescape(re.sub(r"<[^>]+>", "", xml)), max(1, xml.count("w:lastRenderedPageBreak") + 1)
    return data.decode("utf-8", "replace"), 1


def _doc_alive(pk, doc_id):
    row = SiteDesignJob.objects.filter(pk=pk).first()
    return bool(row and any(d.get("id") == doc_id for d in row.docs or []))


def _doc_set(pk, doc_id, **kw):
    with transaction.atomic():
        job = SiteDesignJob.objects.select_for_update().filter(pk=pk).first()
        if not job:
            return None
        docs = list(job.docs or [])
        for d in docs:
            if d.get("id") == doc_id:
                d.update(kw)
        SiteDesignJob.objects.filter(pk=pk).update(docs=docs)
        return job


def add_document(job, upload, user):
    ext = os.path.splitext(str(getattr(upload, "name", "")))[1].lower().lstrip(".")
    if ext not in DOC_EXT:
        raise ValueError("Kies een PDF-, Word- (.docx) of tekstbestand.")
    if len(job.docs or []) >= 8:
        raise ValueError("Er staan al 8 documenten bij dit ontwerp. Verwijder er eerst een.")
    data = upload.read(DOC_MAX + 1)
    if len(data) > DOC_MAX:
        raise ValueError("Het document is te groot (maximaal 10 MB).")
    if not data:
        raise ValueError("Het document is leeg.")
    name = os.path.basename(str(upload.name))[:120]
    key = default_storage.save(areas.site_path("designs", f"{job.pk}/{uuid.uuid4().hex[:8]}-{get_valid_filename(name)}"), ContentFile(data))
    doc = {"id": uuid.uuid4().hex[:10], "name": name, "key": key, "ext": ext, "size": len(data), "status": "reading", "percent": 3, "step": "Starten", "summary": "", "goals": [], "applied": [], "result": {}, "error": "", "uploaded_at": timezone.now().isoformat()}
    with transaction.atomic():
        j = SiteDesignJob.objects.select_for_update().get(pk=job.pk)
        SiteDesignJob.objects.filter(pk=job.pk).update(docs=[*(j.docs or []), doc], updated_at=timezone.now())
    threading.Thread(target=_read_document, args=(job.pk, doc["id"]), daemon=True).start()
    return SiteDesignJob.objects.get(pk=job.pk)


def _read_document(pk, doc_id):
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        doc = next(d for d in job.docs if d["id"] == doc_id)
        _doc_set(pk, doc_id, percent=8, step="Het document openen")
        with default_storage.open(doc["key"], "rb") as fh:
            data = fh.read()
        text, pages = _doc_text(data, doc["ext"])
        text = re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()
        if len(text) < 40:
            raise ValueError("Er is geen tekst in het document gevonden (een gescand document kan ik niet lezen).")
        _doc_set(pk, doc_id, percent=20, step=f"De tekst lezen ({pages} {'pagina' if pages == 1 else 'pagina' + chr(39) + 's'}, {len(text):,} tekens)".replace(",", "."))
        cat = catalog()
        context = json.dumps({
            "kinds": sorted(KINDS), "style_words": sorted(STYLE_TAGS), "fonts": sorted(FONTS),
            "themes": [{"key": t["key"], "name": t["name"], "colors": [t["colors"].get("primary"), t["colors"].get("secondary")]} for t in themes()],
            "modules": [{"key": m["key"], "label": m["label"], "what": m["desc"]} for m in cat["modules"]],
            "languages": [{"code": l["code"], "name": l["native"]} for l in cat["languages"] if l["enabled"] or l["default"]],
        }, ensure_ascii=False)
        _doc_set(pk, doc_id, percent=30, step="Easy2edit leest de doelstellingen")
        seen = {"n": 0}

        def on_event(kind, _t=""):
            if kind == "write" and not seen["n"]:
                seen["n"] = 1
                _doc_set(pk, doc_id, percent=60, step="Easy2edit bepaalt de instellingen")

        from . import themeimport as TI

        gone = {"t": 0.0, "v": False}

        def cancel():  # the document was removed (Annuleren) while it is being read: stop at once
            now = time.monotonic()
            if now - gone["t"] > 0.8:
                gone.update(t=now, v=not _doc_alive(pk, doc_id))
            if gone["v"]:
                raise Stopped("Geannuleerd")

        if not _doc_alive(pk, doc_id):
            return
        raw = ai.claude_stream(DOC_SYSTEM, f"SETTINGS THAT YOU CAN CHOOSE FROM:\n{context}\n\nDOCUMENT ({doc['name']}):\n{text[:DOC_TEXT]}", max_tokens=3000, timeout=240, on_event=on_event, cancel=cancel)
        result = TI._parse_json(raw, need=("summary", "goals"))
        if not _doc_alive(pk, doc_id):
            return
        _doc_set(pk, doc_id, percent=82, step="De instellingen toepassen", result=result)
        applied = apply_result(pk, result)
        _doc_set(pk, doc_id, status="done", percent=100, step="Klaar", summary=str(result.get("summary") or "")[:800], goals=[str(g)[:200] for g in (result.get("goals") or [])[:8]], applied=applied, error="")
    except Stopped:
        return  # the document was removed while it was being read
    except Exception as e:  # noqa: BLE001
        logger.exception("sitecreator document")
        _doc_set(pk, doc_id, status="error", percent=100, step="Mislukt", error=str(e) if isinstance(e, ValueError) else "Het document kon niet worden gelezen. Probeer het nog eens.")
    finally:
        db.connections.close_all()


def apply_result(pk, r):
    """The settings that Claude made from a document go into the brief (the step plan); returns what was set, in words."""
    job = SiteDesignJob.objects.get(pk=pk)
    b = dict(job.brief or {})
    cat = catalog()
    langs = {l["code"]: l for l in cat["languages"]}
    patch, said = {}, []
    if str(r.get("name") or "").strip() and (not (b.get("name") or "").strip() or b.get("name") == "Nieuw ontwerp"):
        patch["name"] = str(r["name"]).strip()[:120]; said.append("Naam")
    if r.get("kind") in KINDS:
        patch["kind"] = r["kind"]; said.append("Soort website")
    if r.get("lang") in langs:
        l = langs[r["lang"]]
        patch["lang"] = f"{l['native']} ({l['code']})"; said.append("Hoofdtaal")
    other = [c for c in (r.get("langs") or []) if c in langs and f"({c})" not in (patch.get("lang") or b.get("lang") or "")]
    if other:
        patch["langs"] = other; said.append("Andere talen")
    pages = [re.sub(r"[,\n]", " ", str(p)).strip()[:60] for p in (r.get("pages") or []) if str(p).strip()][:8]
    if pages and b.get("mode") != "improve":
        patch["pages"] = ", ".join(pages); said.append("Pagina's")
    if str(r.get("extra") or "").strip():
        patch["extra"] = str(r["extra"]).strip()[:1500]; said.append("Wat de site vertelt")
    tags = [t for t in (r.get("style_tags") or []) if t in STYLE_TAGS][:4]
    if tags:
        patch["style_tags"] = tags; said.append("Sfeer")
    if str(r.get("style") or "").strip():
        patch["style"] = str(r["style"]).strip()[:300]
    th = next((t for t in themes() if t["key"] == r.get("theme")), None)
    cols = _clean_colors(r.get("colors"))
    if th:
        patch["theme"], patch["theme_name"] = th["key"], th["name"]
        patch["colors"] = {"primary": th["colors"]["primary"], "secondary": th["colors"]["secondary"], "bg": th["colors"]["light_bg"], "card": th["colors"]["light_card"], "text": th["colors"]["light_text"], "dark": th["colors"]["dark_bg"],
                           "dbg": th["colors"]["dark_bg"], "dcard": th["colors"]["dark_card"], "dtext": th["colors"]["dark_text"]}
        patch["radius"] = th["radius"]; said.append("Thema")
    if cols:
        patch["colors"] = {**(patch.get("colors") or b.get("colors") or {}), **cols}; said.append("Kleuren")
    if r.get("color_mode") in MODES:
        patch["color_mode"] = r["color_mode"]; said.append("Weergave (licht/donker)")
    if r.get("font") in FONTS:
        patch["font"] = r["font"]; said.append("Lettertype")
    need = [k for k in (r.get("modules") or []) if k in {m["key"] for m in cat["modules"]}]
    if need:
        patch["modules_off"] = [m["key"] for m in cat["modules"] if m["key"] not in need]; said.append(f"Modules ({len(need)} van {len(cat['modules'])})")
    nb = clean_brief(patch, b)
    SiteDesignJob.objects.filter(pk=pk).update(brief=nb, name=(nb.get("name") or job.name)[:120], updated_at=timezone.now())
    return said


def reapply_document(job, doc_id):
    d = next((x for x in job.docs or [] if x["id"] == doc_id), None)
    if not d or d.get("status") != "done" or not d.get("result"):
        raise ValueError("Dit document is nog niet gelezen.")
    said = apply_result(job.pk, d["result"])
    _doc_set(job.pk, doc_id, applied=said)
    return SiteDesignJob.objects.get(pk=job.pk)


def remove_document(job, doc_id):
    d = next((x for x in job.docs or [] if x["id"] == doc_id), None)
    if not d:
        raise ValueError("Dit document bestaat niet (meer).")
    try:
        default_storage.delete(d["key"])
    except Exception:  # noqa: BLE001
        pass
    SiteDesignJob.objects.filter(pk=job.pk).update(docs=[x for x in job.docs if x["id"] != doc_id], updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def document_file(job, doc_id):
    d = next((x for x in job.docs or [] if x["id"] == doc_id), None)
    if not d:
        raise ValueError("Dit document bestaat niet (meer).")
    return d, default_storage.open(d["key"], "rb")


# ── the colours, font and corners of a design that was read in (ZIP): so that the step plan and the preview show THAT design ──
ROLE_WORDS = [  # (role, name pattern of a css variable), first match wins; the order matters
    ("dark", r"night|inverse|footer|hero|charcoal|navy|deep|dark"),
    ("secondary", r"secondary|accent-?2|second|highlight|[-_]alt|[-_]2$|[-_]two$"),
    ("primary", r"primary|brand|accent|orange|cta|action|main|theme|blue|green|red|purple|pink|teal|yellow"),
    ("card", r"card|surface|panel|tile|elev|paper-?2"),
    ("text", r"^(ink|text|fg|foreground|body|copy|color|c-text)|text|ink"),
    ("bg", r"bg|background|page|paper|cream|canvas|base|sand|ivory"),
]


def _css_of(files):
    parts = [c for n, c in files.items() if n.endswith(".css")]
    for n, c in files.items():
        if n.endswith(".html"):
            parts += re.findall(r"<style[^>]*>(.*?)</style>", c, re.S | re.I)
    return "\n".join(parts)


def palette_from_files(files):
    """What the design looks like: colours (light and dark), font and corner radius, read from its css (also the <style> of the html files). Returns the changes for the brief and a note."""
    from collections import Counter

    from . import themeimport as TI
    from . import webtoolkit as si

    css = _css_of(files)
    if not css.strip():
        return {}, "Geen css gevonden in het ontwerp."
    weight, body_bg, body_fg, fonts = si.analyse_css(css)
    light, dark = {}, {}
    for sel, body, in_dark in TI._blocks(css):
        if not re.search(r":root|^html|^body|data-theme|\.dark|\.light|\[data-", sel):
            continue
        target = dark if (in_dark or re.search(r"dark|night", sel, re.I)) else light
        for name, val in re.findall(r"--([\w-]+)\s*:\s*([^;]+);?", body):
            cols = si.colors_in(val)
            if not cols and "var(" in val:  # a variable that points to another one
                ref = re.search(r"var\(--([\w-]+)", val)
                cols = [target.get("_" + ref.group(1))] if ref and target.get("_" + ref.group(1)) else []
            if cols:
                target.setdefault("_" + name.lower(), cols[0])

    def by_role(vars_):
        out = {}
        for name, col in vars_.items():
            n = name[1:]
            for role, rx in ROLE_WORDS:
                if re.search(rx, n):
                    out.setdefault(role, col)
                    break
        return out

    lr = by_role(light)

    def lightness(c):
        return si._hls(c)[1]

    def vivid(c):
        h, l, s = si._hls(c)
        return s >= 0.35 and 0.18 <= l <= 0.78

    ranked = [c for c, _ in weight.most_common() if vivid(c)]
    primary = lr.get("primary") if lr.get("primary") and vivid(lr["primary"]) else (ranked[0] if ranked else lr.get("primary") or "#2563eb")
    secondary = lr.get("secondary") or next((c for c in ranked[1:] if abs(si._hls(c)[0] - si._hls(primary)[0]) * 360 >= 25), None) or "#f59e0b"
    bg = lr.get("bg") or body_bg or next((c for c, _ in weight.most_common() if lightness(c) > 0.9), "#ffffff")
    text = lr.get("text") or body_fg or next((c for c, _ in weight.most_common() if lightness(c) < 0.25), "#1f2937")
    card = lr.get("card") or ("#ffffff" if lightness(bg) < 0.99 else bg)
    darks = [c for c, _ in weight.most_common() if lightness(c) < 0.22 and c != text]
    band = lr.get("dark") or (darks[0] if darks else text)
    out = {"primary": primary, "secondary": secondary, "bg": bg, "card": card, "text": text, "dark": band}
    # the dark mode of the design (when it has one): its own colours, else derived
    dr = by_role(dark)
    has_dark = bool(dark) or bool(re.search(r"data-theme=[\"']?dark|prefers-color-scheme:\s*dark|\.dark\b", css))
    out["dbg"] = dr.get("bg") or band
    out["dcard"] = dr.get("card") or TI._mix(out["dbg"], "#ffffff", 0.07)
    out["dtext"] = dr.get("text") or next((c for c, _ in weight.most_common() if lightness(c) > 0.88), "#f5f5f5")
    mode = "both" if has_dark else ("dark" if lightness(bg) < 0.3 else "light")
    # font and corners
    body_stack = re.search(r"(?:^|[}\s,])body\s*\{[^}]*?font-family\s*:\s*([^;}]+)", css, re.I) or re.search(r"font-family\s*:\s*([^;}]+)", css, re.I)
    names = [x.strip(" \"'").lower() for x in (body_stack.group(1).split(",") if body_stack else [])] or [f.lower() for f in fonts[:1]]
    head = " ".join(names[:2])
    font = "serif" if re.search(r"georgia|times|playfair|merriweather|lora|garamond|cormorant|libre baskerville|source serif|^serif$", head) or (names and names[0] == "serif") else "round" if re.search(r"trebuchet|nunito|quicksand|poppins|comfortaa|baloo|fredoka", head) else "sans"
    radii = [int(x) for x in re.findall(r"border-radius\s*:\s*(\d{1,2})px", css)]
    radius = sorted(radii)[len(radii) // 2] if radii else None
    patch = {"colors": out, "color_mode": mode, "font": font}
    if radius is not None and 0 <= radius <= 40:
        patch["radius"] = radius
    note = "Kleuren, lettertype en hoeken zijn gelezen uit het ontwerp: " + ", ".join(f"{k} {v}" for k, v in out.items() if k in ("primary", "secondary", "bg", "text"))
    return patch, note


def apply_palette(job):
    """Puts the look of the design that was read in (ZIP) into the step plan: colours, light/dark, font and corners."""
    patch, note = palette_from_files(job.files or {})
    if not patch:
        raise ValueError(note)
    b = dict(job.brief or {})
    b.update({"colors": patch["colors"], "color_mode": patch["color_mode"], "font": patch["font"], "theme": "", "theme_name": "", "palette_from_zip": True, "zip_palette": patch["colors"]})
    if "radius" in patch:
        b["radius"] = patch["radius"]
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    job.brief = b
    return job, note


# ── a theme with the own style of the design (when no theme of the system was chosen): the name of the theme is the name of the website ──
SYSTEM_FONT = {"sans": "System", "serif": "Georgia", "round": "Trebuchet MS"}


def theme_values(b):
    """The settings of a theme from the choices in the step plan: colours (light and dark), font, corners and the starting mode."""
    from . import theme as T
    from . import themeimport as TI

    c = {**{"primary": "#2563eb", "secondary": "#f59e0b", "bg": "#f8fafc", "card": "#ffffff", "text": "#0f172a", "dark": "#0f172a", "dbg": "#0f172a", "dcard": "#1e293b", "dtext": "#e2e8f0"}, **(b.get("colors") or {})}
    mix = TI._mix
    r = int(b.get("radius") if b.get("radius") is not None else 14)
    v = {
        "primary": c["primary"], "secondary": c["secondary"],
        "light_page": c["bg"], "light_bg": c["bg"], "light_card": c["card"], "light_hover": mix(c["bg"], c["card"], 0.5), "light_line": mix(c["text"], c["bg"], 0.86), "light_text": c["text"], "light_muted": mix(c["text"], c["bg"], 0.42),
        "dark_page": c["dbg"], "dark_bg": c["dbg"], "dark_card": c["dcard"], "dark_hover": mix(c["dbg"], c["dcard"], 0.5), "dark_line": mix(c["dbg"], c["dtext"], 0.15), "dark_text": c["dtext"], "dark_muted": mix(c["dtext"], c["dbg"], 0.36),
        "font_body": SYSTEM_FONT.get(b.get("font") or "sans", "System"), "font_heading": SYSTEM_FONT.get(b.get("font") or "sans", "System"),
        "radius": r, "btn_radius": max(0, r - 4), "popup_radius": r,
        "default_mode": {"light": "light", "dark": "dark", "both": "system"}.get(b.get("color_mode") or "light", "light"),
    }
    clean, _errors = T.validate(TI._complete(v))
    return clean


def make_theme(job, use=False):
    """A theme package with the style of this design, named after the website; with use it is also made the look of the website."""
    from . import resources, themepacks

    b = job.brief or {}
    name = (b.get("name") or "").strip()
    if not name:
        raise ValueError("Geef de website een naam (stap 1). De naam van de website is verplicht.")
    if b.get("theme"):
        raise ValueError("Voor dit ontwerp is een thema van het systeem gekozen: dat wordt gebruikt, er wordt geen nieuw thema gemaakt.")
    mode = b.get("color_mode")
    try:
        man = resources.save_theme(name, f"De stijl van {name}, gemaakt met Website ontwerpen.", mode if mode in ("light", "dark") else None, theme_values(b), install=True)
        if use:
            themepacks.use(man["key"])
    except (resources.ResourceError, themepacks.ThemeError) as e:
        raise ValueError(str(e))
    return {"key": man["key"], "name": man["name"], "used": bool(use)}


# ── generating ──
def _brief_text(b):
    pages = pages_of(b)
    c = b.get("colors") or {}
    lines = [
        f"Website name: {str(b.get('name') or 'Mijn website')[:120]}",
        f"Type: {b.get('kind') or 'company'}",
        f"Language of all texts: {str(b.get('lang') or 'Dutch')[:40]}",
        "Pages (file = menu label, in this order): " + "; ".join(f"{f} = {t}" for f, t in pages),
        "Style: " + ", ".join([*(b.get("style_tags") or []), *([b["style"]] if b.get("style") else [])] or ["modern, clean, lots of white space, friendly and professional"]),
    ]
    if b.get("theme_name"):
        lines.append(f"Based on the theme '{b['theme_name']}' of the system: follow its look and colours.")
    if c and b.get("mode") == "improve" and b.get("palette_from_zip") and c == b.get("zip_palette"):
        lines.append("Colours: KEEP the colours of the existing design exactly as they are in its css (keep its own colour variables and values; they were read from it: " + ", ".join(f"{k} {v}" for k, v in c.items() if k in COLOR_KEYS[:6]) + "). Do not replace them with other colours and do not rename its variables.")
    elif c:
        lines.append("Colours (use EXACTLY these as the css variables on :root): " + ", ".join(f"--{ {'bg': 'bg', 'card': 'card', 'dark': 'dark-band'}.get(k, k) }: {v}" for k, v in c.items() if k in COLOR_KEYS[:6]) + ". --dark-band is the background of dark bands (hero/footer); derive --line and the text colour on dark bands from them.")
    else:
        lines.append("Colours: one strong primary colour, one secondary colour, light background, dark text.")
    mode = b.get("color_mode") or "light"
    dark = {"bg": c.get("dbg") or "#0f172a", "card": c.get("dcard") or "#1e293b", "text": c.get("dtext") or "#e2e8f0"}
    lines.append({"light": "Display: light only.", "dark": f"Display: dark only. Use these as the values on :root: --bg: {dark['bg']}; --card: {dark['card']}; --text: {dark['text']} (instead of the light ones).",
                  "both": f"Display: light AND dark. Light colours on :root; dark colours (--bg: {dark['bg']}; --card: {dark['card']}; --text: {dark['text']}) in :root[data-theme=\"dark\"] and in the prefers-color-scheme media query, as explained in the rules. The system adds the light/dark switch."}[mode])
    codes = b.get("langs") or []
    if codes:
        names = {l.code: f"{l.native_name} ({l.code}{', right-to-left' if l.rtl else ''})" for l in Language.objects.filter(code__in=codes)}
        lines.append(f"Other languages of the website (the system translates the pages into them; write only in the main language): {', '.join(names.get(x, x) for x in codes)}." + (" Show a language switch: leave room for it in the header." if b.get("lang_switch", True) else " No language switch in the header."))
    lines.append(f"Font: {FONTS.get(b.get('font') or 'sans')} (system fonts only).")
    if b.get("radius") is not None:
        lines.append(f"Corner radius of cards: {b['radius']}px; buttons: {max(0, b['radius'] - 4)}px.")
    ph = b.get("photos") or []
    if ph:
        lines.append("PHOTOS the user uploaded (use them: reference as img/<file> in <img> tags and url(img/<file>) in css, with fitting alt texts; use each where it fits, hero pictures first; do not output these files, they are added by the system):\n" + "\n".join(f"- {p['file']}: {p.get('note') or 'no description'}" for p in ph))
    mods = [i for i in module_items() if i["key"] not in effective_off(b)]
    if mods:
        lines.append("MODULES and PLUGINS of the system that this website uses (build the pages so that they work with them; mention each where it fits, do not force a section for every one):\n" + "\n".join(f"- {i['label']}: {i['how']}" for i in mods))
    objs = b.get("objects") or []
    if objs:
        info = {o["slug"]: o for o in catalog()["objects"]}
        lines.append("SYSTEM OBJECTS to place (each as <div data-sysobject=\"SLUG\"></div>, see the rules; put each in the section that fits it):\n" + "\n".join(f"- {x}: {info.get(x, {}).get('name', '')} ({info.get(x, {}).get('kind_label', '')})" for x in objs))
    lines.append(f"Extra wishes: {str(b.get('extra') or '-')[:1500]}")
    return "\n".join(lines)


class Stopped(ValueError):
    """The user pressed Stop: the work ends here (a ValueError, so the AI call is ended cleanly)."""


_STOP = {}


def _stop_requested(pk, fresh=False):
    """Was Stop pressed? (asked from the database, at most about once per second while the answer streams in)"""
    now = time.monotonic()
    last = _STOP.get(pk)
    if not fresh and last and now - last[0] < 0.8:
        return last[1]
    v = SiteDesignJob.objects.filter(pk=pk, status="stopping").exists()
    _STOP[pk] = (now, v)
    return v


def _ask(system, prompt, max_tokens=24000, pk=None):
    def cancel():
        if pk and _stop_requested(pk):
            raise Stopped("Gestopt.")

    if pk and _stop_requested(pk, fresh=True):
        raise Stopped("Gestopt.")
    return ai.claude_stream(system, prompt, max_tokens=max_tokens, timeout=600, cancel=cancel if pk else None)


def _set(pk, **kw):
    SiteDesignJob.objects.filter(pk=pk).update(updated_at=timezone.now(), **kw)


def generate(job, improve=False, focus=""):
    if job.status in ("running", "stopping"):
        raise ValueError("Er wordt al gewerkt aan dit ontwerp.")
    if SiteDesignJob.objects.filter(user=job.user, status="running", updated_at__gte=timezone.now() - timezone.timedelta(minutes=12)).exists():
        raise ValueError("Er wordt al een website ontworpen. Wacht tot die klaar is.")
    if not ai.available():
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    b = job.brief or {}
    if not (b.get("name") or "").strip():
        raise ValueError("Geef de website een naam (stap 1). De naam van de website is verplicht.")
    if improve and not str(focus or "").strip():
        raise ValueError("Schrijf eerst wat er verbeterd moet worden: zonder opdracht verandert er niets.")
    if b.get("mode") == "improve" and not improve:
        raise ValueError("Een ingelezen ontwerp verbeter je met een opdracht (knop Verbeteren). Wil je het zoals het is gebruiken, kies dan Toepassen.")
    keep = list(job.messages or []) if improve else []
    if improve:  # improve what is here now (the files of the design as they are), with the points that the user asked attention for
        if not any(n.endswith(".html") for n in (job.files or {})):
            raise ValueError("Er is nog geen ontwerp om te verbeteren.")
        b = dict(b)
        b["improve_now"], b["focus"] = True, str(focus or "").strip()[:500]
        SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, files_prev=dict(job.files or {}))  # the way back
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", progress=3, step="Starten", error="", messages=keep, updated_at=timezone.now())
    threading.Thread(target=_generate, args=(job.pk,), daemon=True).start()


def _generate(pk):
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        improve = (((job.brief or {}).get("mode") == "improve") or bool((job.brief or {}).get("improve_now"))) and any(n.endswith(".html") for n in (job.files or {}))
        old = dict(job.files or {}) if improve else {}
        pages = pages_of(job.brief)
        if improve:  # the pages are the html files of the ZIP (in the order of the brief)
            have = sorted((n for n in old if n.endswith(".html")), key=lambda n: (n != "index.html", n))
            pages = [(f, pages_of(job.brief)[i][1] if i < len(pages_of(job.brief)) else f[:-5]) for i, f in enumerate(have)]
        text = _brief_text(job.brief)
        if (job.brief or {}).get("focus"):
            text += "\nFOCUS of this improvement (pay special attention to this): " + str(job.brief["focus"])
        nav = "; ".join(f"{t} -> {f}" for f, t in pages)
        first = pages[0][0]
        _set(pk, progress=6, step=f"De opmaak en de startpagina {'verbeteren' if improve else 'ontwerpen'} ({pages[0][1]})")
        if improve:
            prompt = (f"Here is an existing website (made by an AI). IMPROVE it: apply the colours, font, style and photos below, fix everything that breaks the structure rules, make the design more polished and consistent, and keep the content and meaning of the texts (you may sharpen them). Output ONLY style.css (complete, shared by ALL pages) and {first} (and img/ svg files for it).\n"
                      f"The menu on every page: {nav}\n\n{text}\n\nCURRENT style.css:\n{old.get('style.css', '(none)')}\n\nCURRENT {first}:\n{old.get(first, '')}")
        else:
            prompt = f"Design this website. Now output ONLY style.css (the complete shared stylesheet for ALL pages: also the classes that the other pages will need: cards, columns, faq, products, events, forms-free contact blocks), {first} and the svg illustrations (img/...) of that page.\nThe menu on every page: {nav}\n\n{text}"
        files = parse(_ask(rules(), prompt, pk=pk))
        if "style.css" not in files or first not in files:
            raise ValueError("De AI gaf geen bruikbaar ontwerp terug. Probeer het nog eens.")
        if improve:
            files = {**old, **files}  # what is not improved yet stays as it was: nothing is lost when a later page fails
        _set(pk, files=files, progress=30)
        rest = pages[1:]
        for n, (f, title) in enumerate(rest):
            _set(pk, progress=30 + int(65 * n / max(1, len(rest))), step=f"Pagina '{title}' {'verbeteren' if improve else 'ontwerpen'}")
            ctx = f"style.css:\n{files['style.css']}\n\n{first} (copy its header and footer exactly, same menu):\n{files[first]}"
            cur = f"\n\nCURRENT {f} (improve this page, keep its content):\n{old.get(f, '')}" if improve else ""
            new = parse(_ask(rules(), f"{'Improve' if improve else 'Design'} ONE more page of the same website, in exactly the same visual language. Output {f} (and img/ svg files that this page needs). Output style.css too ONLY when you had to add classes: then the complete extended file.\nThe menu on every page: {nav}\nThis page: {title} ({f})\n\n{text}\n\n{ctx}{cur}", pk=pk))
            if f not in new:
                raise ValueError(f"De pagina '{title}' kwam niet terug. Probeer het nog eens.")
            files = {**files, **new}
            _set(pk, files=files)
        b2 = {k: v for k, v in (job.brief or {}).items() if k not in ("improve_now", "focus")}
        done_msg = "Het ontwerp is verbeterd. Bekijk de pagina's en zeg wat er anders moet. Is het goed, dan kun je alles aanmaken." if improve else "Je website is ontworpen. Bekijk de pagina's en zeg wat er anders moet. Daarna kun je alles aanmaken of eerst importeren om te controleren."
        _set(pk, status="done", progress=100, step="Klaar", files=files, brief=b2, messages=list(SiteDesignJob.objects.get(pk=pk).messages or []) + [{"role": "ai", "text": done_msg}])
    except Stopped:
        _finish_stopped(pk, "Gestopt. Wat al klaar was is bewaard; de rest is zoals het was.")
    except Exception as e:  # noqa: BLE001
        logger.exception("sitecreator")
        row = SiteDesignJob.objects.filter(pk=pk).first()
        _set(pk, status="error", error=str(e) if isinstance(e, ValueError) else "Het ontwerpen is niet gelukt. Probeer het nog eens.", **({"brief": {k: v for k, v in (row.brief or {}).items() if k not in ("improve_now", "focus")}} if row else {}))
    finally:
        db.connections.close_all()


def stop(job):
    """Stop was pressed: the work ends at the next moment (also the answer of Claude that is coming in)."""
    SiteDesignJob.objects.filter(pk=job.pk, status="running").update(status="stopping", step="Bezig met stoppen…", updated_at=timezone.now())  # (the status is read from the database, not from this copy)
    return SiteDesignJob.objects.get(pk=job.pk)


def _finish_stopped(pk, text):
    row = SiteDesignJob.objects.filter(pk=pk).first()
    if not row:
        return
    has = any(n.endswith(".html") for n in (row.files or {}))
    b = {k: v for k, v in (row.brief or {}).items() if k not in ("improve_now", "focus")}
    _STOP.pop(pk, None)
    SiteDesignJob.objects.filter(pk=pk).update(status="done" if has else "draft", progress=100, step="Gestopt", error="", brief=b, messages=list(row.messages or []) + [{"role": "ai", "text": text}], updated_at=timezone.now())


def restore(job):
    """Puts the files back as they were before the last improvement."""
    if job.status in ("running", "stopping"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    if not job.files_prev:
        raise ValueError("Er is geen vorige versie om terug te zetten.")
    SiteDesignJob.objects.filter(pk=job.pk).update(files=job.files_prev, files_prev={}, messages=list(job.messages or []) + [{"role": "ai", "text": "Het ontwerp van vóór het verbeteren is teruggezet."}], updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def revise(job, instruction, page=""):
    if job.status in ("running", "stopping"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    instruction = str(instruction or "").strip()[:2000]
    if not instruction:
        raise ValueError("Schrijf wat er anders moet.")
    msgs = list(job.messages or []) + [{"role": "user", "text": instruction}]
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", progress=10, step="De aanpassing doorvoeren", error="", messages=msgs, updated_at=timezone.now())
    threading.Thread(target=_revise, args=(job.pk, instruction, page), daemon=True).start()


def _revise(pk, instruction, page):
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        files = dict(job.files or {})
        listing_ = "\n\n".join(f"=== FILE: {n} ===\n{c}" for n, c in files.items())
        focus = f"The user is looking at the page {page}.\n" if page in files else ""
        photos = "\n".join(f"- {p['file']}: {p.get('note') or ''}" for p in (job.brief or {}).get("photos") or [])
        ph = f"Photos that can be used (img/<file>):\n{photos}\n" if photos else ""
        new = parse(_ask(rules(), f"Here is the current website. Apply the change that the user asks for. Output ONLY the files that change, each complete (when the change is the look of the whole site, change style.css; when it is a text or section, change that page). Keep everything else exactly as it is, and keep the structure rules.\n{focus}{ph}Change: {instruction}\n\n{listing_}", pk=pk))
        if not new:
            raise ValueError("De AI gaf geen aanpassing terug. Probeer het anders te zeggen.")
        _set(pk, status="done", progress=100, step="Klaar", files={**files, **new}, messages=list(job.messages) + [{"role": "ai", "text": "Aangepast: " + ", ".join(sorted(new)) + "."}])
    except Stopped:
        _finish_stopped(pk, "Gestopt: de aanpassing is niet doorgevoerd.")
    except Exception as e:  # noqa: BLE001
        logger.exception("sitecreator revise")
        _set(pk, status="done", progress=100, step="", error="", messages=list(SiteDesignJob.objects.get(pk=pk).messages) + [{"role": "ai", "text": "Dat is niet gelukt: " + (str(e) if isinstance(e, ValueError) else "onbekende fout") + " Het ontwerp is niet veranderd."}])
    finally:
        db.connections.close_all()


def _doc_public(d):
    """A document without its storage key; one that has been 'reading' for too long (the server was restarted) is shown as failed, so it can be removed."""
    out = {k: v for k, v in d.items() if k not in ("key", "result")}
    try:
        if out.get("status") == "reading" and timezone.now() - timezone.datetime.fromisoformat(out["uploaded_at"]) > timezone.timedelta(minutes=10):
            out.update(status="error", error="Het lezen is afgebroken. Verwijder het document en plaats het opnieuw.")
    except (KeyError, ValueError, TypeError):
        pass
    return out


def _stale(job):
    """A job that says 'running' but has not moved for 15 minutes (the server was restarted): it is shown as stopped so it does not hang for ever."""
    if job.status in ("running", "stopping") and timezone.now() - job.updated_at > timezone.timedelta(minutes=15):
        SiteDesignJob.objects.filter(pk=job.pk, status=job.status).update(status="error", error="Het ontwerpen is afgebroken (de server is opnieuw gestart). Probeer het nog eens.")
        job.refresh_from_db()
    return job


def public(job, files=False):
    job = _stale(job)
    b = job.brief or {}
    return {"id": str(job.pk), "name": job.name, "status": job.status, "progress": job.progress, "step": job.step, "error": job.error, "files": (job.files or {}) if files else {}, "translation_files": (job.translations or {}) if files else {}, "file_names": sorted(job.files or {}), "can_restore": bool(job.files_prev), "translations": sorted((job.translations or {}).keys()), "messages": job.messages or [], "brief": b, "modules_off_effective": sorted(effective_off(b)),
            "pages": [{"file": f, "title": t} for f, t in pages_of(b)], "ai": ai.available(),
            "docs": [_doc_public(d) for d in job.docs or []]}
