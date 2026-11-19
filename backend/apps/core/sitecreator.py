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

_RULES = """You are a senior web designer. You design complete, professional websites as plain static files that are imported into the website system easy2edit.
The importer reads the html and css and rebuilds every page with the blocks of the easy2edit page editor, so a clean, predictable structure matters more than clever tricks.

FILES
- One html file per page (the start page is index.html), ONE shared style.css, and optional illustrations as svg files in img/ (img/hero.svg). No other file types, no JavaScript, no external fonts/scripts/frameworks, no data: urls, no photos or hotlinks.
- File rules of the importer (they are checked, anything else is skipped): at most @MAX_PAGES@ html pages and at most @MAX_IMAGES@ pictures in total, each picture at most @MAX_IMAGE_MB@ MB; file names only a-z, 0-9, - and _ (at most @NAME_MAX@ characters before the extension); everything in the root of the ZIP plus the folder img/ (no other folders, so never en/index.html).
- Every html file is a complete document (<!doctype html>, <html lang>, <meta charset>, <meta name=viewport>, <title>, <meta name=description>, <link rel="stylesheet" href="style.css">). Links between pages are relative (about.html); "#id" for places on the same page.
- Pictures: svg illustrations in img/ (simple, single or two-colour flat shapes in the palette of the site) or inline <svg>, with <img src="img/x.svg" alt="..." width height>. Photos are added later by the user, so where a photo belongs make a tasteful svg illustration or a gradient shape instead.

STRUCTURE OF EVERY PAGE
- <body> = one <header> (brand, <nav> with 3-6 links, optional button), one <main>, one <footer> (short text, links). Header and footer are identical on every page.
- <main> consists ONLY of full-width <section> elements with an id. The band background goes on the <section> (edge to edge); inside ONE centred <div class="container"> (max-width 1100px, margin 0 auto, padding 0 1.25rem). Never put a card around a whole section. Section padding 4rem 0 (hero 6rem 0), alternate light and tinted/dark bands.
- Allowed content: h1 (once, in the hero), h2 (section title), h3 (card title); p, ul/ol/li, strong, em, a; img/figure; buttons as <a class="btn btn-primary"> or <a class="btn btn-outline">; hr; no <form>, no <button> without a link.
- Logos of partners, customers or clients are NOT pictures: you cannot supply them and they are not on iStock. Write those names as plain text (for example a row of names) and never use <img> for them.
- The page is later built from the blocks of the easy2edit page editor only (heading, text with lists, picture, button, line, spacer, cards in columns, figures/stats, quote, opening hours, contact details, social links, map, video, logo, FAQ, ready-made components with a data-easy2edit-tag, system objects). There are no html or css blocks: do not design anything that needs its own markup (progress bars, check-mark icons, mock-up screens, tables, decorative shapes, inline svg in the text). Where such a part would go, use one of those blocks instead.
- EDITOR POSITIONS (every block of the page editor has a Position, Uitlijnen and Lettertype tab, so these are rebuilt exactly when you write them like this): a heading, paragraph or quote that is narrower than its column gets a max-width in % (10-100) or px on that element (a lead paragraph of max-width 38rem or 60%), and sits left, centred (margin-inline: auto) or right (margin-left: auto) in its column; text-align left/center/right/justify says how its lines run; align-items / align-self start, center or end in a tall column puts a block at the top, in the middle or at the bottom of that column (a text next to a tall picture: centre it); font-family is only the theme's body or heading font, a serif stack (Georgia) or a monospace stack; never other fonts. Where a photo or video belongs but is not there yet, the editor shows a neat placeholder in the style of the theme.
- COLOUR AND QUOTES: every text, heading and quote can have its own colour (css color on that element, a variable of the palette); a quote is ONE <blockquote> with the quotation and the author in a <figcaption> (or <cite>), and the editor draws the two big quotation marks itself in the theme colour, which can be changed per quote: never type or draw quotation marks of your own around it.
- Columns: a div with display grid/flex, 2-4 columns, one column on mobile (@media (max-width: 760px)). Cards: <div class="card"> with own background, radius, padding, 1px border and/or shadow, only inside the columns, equal height.
- A hero with text on one side and a visual on the other: two columns (50/50), text left (small label, h1, p, buttons), svg visual right.
- FAQ: one section id="faq" with <details><summary>Question?</summary><p>Answer.</p></details> per question. Products with prices: <div class="product"> cards with <p class="price">. Events: <article class="event">.
- Colours as css variables on :root (--primary, --secondary, --bg, --text, --card, --line), used everywhere; contrast at least 4.5:1. Typography in rem (body 1rem/1.6, h1 2.6-3.4rem, h2 1.8-2.2rem, h3 1.2-1.4rem), system font stack. Buttons padding .75rem 1.4rem, radius 10px, weight 600. Works from 360px to 1600px. One h1 per page, alt texts, descriptive link texts. Icons: only single-colour inline svg (stroke="currentColor"), never emoji.
- Write real, convincing copy in the requested language (no lorem ipsum), concrete headings, short paragraphs, clear calls to action. Every page has a unique <title> (max 60 chars) and meta description (max 155).

LIGHT/DARK MODE AND LANGUAGES
- Colours are ALWAYS used through css variables (no hard-coded colours in rules, svg illustrations use currentColor or the variables). The user message says which display the website has: "light" = the colours as given on :root; "dark" = the dark colours as given on :root; "both" = the light colours on :root, and the dark colours twice: in :root[data-theme="dark"] {...} and in @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }. easy2edit sets data-theme on <html> and shows its own light/dark switch: never build a switch and never use JavaScript for it. Text on pictures and on dark bands stays readable in both modes (contrast at least 4.5:1).
- Languages: write every page in the main language only, one html file per page, never one file per language, no language switcher of your own: the system translates the pages into the other languages and adds the language switch to the header. Leave room for it at the right of the header (the menu must wrap or shrink gracefully), let buttons and menu items grow with longer words (no fixed widths on text, min-width instead of width), and when a right-to-left language is among them (ar, he, fa, ur) use logical css properties (margin-inline, padding-inline, text-align: start, inset-inline) so the layout mirrors correctly.

MODULES AND SYSTEM OBJECTS
- easy2edit has modules (webshop, FAQ, community, agenda, ...) and system objects: ready-made, live blocks (an overview of products, an agenda, a subscription plan, a donation button, ...). The user message lists the modules the website uses, with what each module needs from the pages, and the system objects to place.
- A system object is placed as an EMPTY element on its own line: <div data-sysobject="SLUG"></div> (SLUG exactly as given), directly inside the <div class="container"> of the section where it belongs, after the section heading and a short intro. Never inside <p>, <a>, <details> or a card, never styled, never imitated, never with content: easy2edit fills it with the live content. Give such a section an id and make it a full band like every other section.
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


def rules(brief=None):
    """The system rules for the AI with the numbers of importrules.py filled in (the same numbers that the importer and the AI prompt of the screen use)."""
    d = R.as_dict()
    out = _RULES
    for k, v in (("MAX_PAGES", d["max_pages"]), ("MAX_IMAGES", d["max_images"]), ("MAX_IMAGE_MB", f"{d['max_image_mb']:g}"), ("NAME_MAX", d["name_max"])):
        out = out.replace(f"@{k}@", str(v))
    from . import componentpacks

    comp = componentpacks.rules_text((brief or {}).get("component_set") or None)  # the ready-made components (the set that was chosen) with their easy2edit_tag: the designs use them, the import recognises them
    out = out + ("\n\n" + comp if comp else "")
    if comp:
        out += COMPONENTS_ONLY.replace("@TEMPLATES@", componentpacks.templates_text((brief or {}).get("component_set") or None))
    from . import entity

    about = entity.creator_text()  # step "Over je organisatie": who the website is for (module Entiteit); texts, colours, the contact page and the footer follow it
    if about:
        out += ABOUT_ENTITY.replace("@ABOUT@", about)
    if (brief or {}).get("chat"):
        out += CHAT_PHOTO_RULES.replace("@MAX_IMAGES@", str(d["max_images"]))
    return out


ABOUT_ENTITY = """

ABOUT THE ORGANISATION (the entity of this website: use it for the texts, the colours and tone, the contact page and the footer; do not invent other data)
@ABOUT@
- Where the name, address, e-mail or phone of the organisation appears in a text, you may write the variable instead: {{organisatie.naam}}, {{organisatie.adres}}, {{organisatie.email}}, {{organisatie.telefoon}}, {{organisatie.website}}, {{organisatie.plaats}}, {{organisatie.kvk}}, {{organisatie.btw}}, {{organisatie.soort}}. The website fills them in, so a change of the data works through on every page.
- The person who looks at the page has variables too: {{user.naam}}, {{user.voornaam}}, {{user.achternaam}}, {{user.email}}, {{user.functie}}, {{user.bedrijf}}. They are filled in for a logged-in visitor and stay empty for others, so use them only in text meant for logged-in people (a welcome line on a dashboard or account page), never in the main text of a public page. Variables are pieces of text: write them inside a sentence, never as a section or as a <div data-sysobject>."""


COMPONENTS_ONLY = """

COMPONENTS ONLY (this overrides everything above about layout, structure and css where it differs)
The website is built ONLY from the easy2edit components and the theme, so that the preview is exactly the website after the import. You do not design your own look.
- <header> is the ui-navbar component and <footer> is the ui-footer component. Every section of <main> is ONE component: <div data-easy2edit-tag="TAG"> ... </div> (an id for #links goes on that div). Choose the components that fit the content from the list of tags above; the templates below show the exact markup of the main ones.
- COPY the markup of the template: the same tags, the same e2e-* classes, the same nesting. You change only the texts, the links, the pictures (src/alt) and the number of repeated items (cards, steps, questions, logos ...). Use the component for the use it was made for, in the language of the website.
- NEVER write css for a class that starts with e2e-, never colours, sizes or fonts of your own inside a component (no style="" on components), no own button classes: buttons are e2e-btn, e2e-btn e2e-btn--outline, e2e-btn--lg, e2e-btn--sm.
- Colours, fonts and corners are the THEME of this website, written by the SYSTEM on :root in style.css (the variables --primary, --secondary, --bg, --surface, --card, --hover, --line, --text, --muted, --font-heading, --font-body, --radius, --btn-radius). You never write a :root block or a colour value of your own. style.css only holds at most 15 lines for a rare helper class (using those variables), or is just a comment. The system draws all components with the theme.
- Three or more photos that belong together (a gallery, our work, the team, the location, a row of pictures): NEVER place them under each other, as separate blocks or in a "logos" row: use EXACTLY this markup, the photo carousel of easy2edit (a media system object): <div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery"><img src="img/name.jpg" alt="..."><img src="img/other.jpg" alt="..."> ...</div></div> with only <img> children (no wrappers). Use e2e-logos ONLY for real logos (svg), never for photos.
- Plain text outside the components: use ui-section-heading (eyebrow, heading, intro) and ui-split (text with a picture). Pictures: <img src="img/name.jpg" alt="..."> where a template has a picture slot (instead of the empty e2e-hero__visual / picture div).

TEMPLATES (the exact markup of the main components):
@TEMPLATES@"""


CHAT_PHOTO_RULES = """

PHOTOS (this website is made in a chat; the user has no photos yet)
- Where a real photo fits (hero, team, product, service, blog), use <img src="img/<descriptive-english-words>.jpg" alt="<what the photo shows, in English, 4-10 words, concrete>"> with a short lowercase file name with hyphens (e.g. img/hair-salon-interior.jpg). Use at most @MAX_IMAGES@ photos in the whole website and give every photo its own file name.
- The user searches these photos on iStock (istockphoto.com) from the alt text and downloads them himself: so the alt text must be a good search description. Never use external image urls, never hotlink, never invent other photo sources. Logos, icons and illustrations stay inline svg or img/*.svg that you make yourself. NEVER make pictures of logos of partners, clients or brands (no img/partner-logo-*.jpg): write those names as plain text.
- Video: where a moving picture fits (at most ONE, for example a calm background of the hero), use <video src="video/<descriptive-english-words>.mp4" autoplay muted loop playsinline aria-label="<what the video shows, in English, 4-10 words>"></video> inside a box with a fixed aspect-ratio and a background colour; never controls, never a second video. The user finds it on iStock Video and puts it in.
- The page must look good while the photo is still missing: give the photo a fixed aspect-ratio or height and a background colour from the variables, so nothing jumps when the photo arrives."""


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
        for o in SystemObject.objects.filter(enabled=True).exclude(kind="variable"):  # variables are pieces of text, never a section to place
            r = sov._row(o, public=True)
            if not r:
                continue
            names = r.get("names") or {}
            name = (names.get("") or next(iter(names.values()), "") or (r.get("data") or {}).get("title") or o.slug)
            objs.append({"slug": o.slug, "kind": o.kind, "kind_label": dict(SystemObject.KINDS).get(o.kind, o.kind), "name": str(name)[:120]})
    except Exception:  # noqa: BLE001
        logger.exception("sitecreator catalog")
    from .models import Language

    langs = [{"code": l.code, "name": l.name, "native": l.native_name, "rtl": l.rtl, "enabled": l.enabled, "default": l.is_default} for l in Language.objects.all()]
    from . import entity

    return {"modules": mods, "objects": objs, "languages": langs, "rules": R.as_dict(),
            "organisation": {"filled": entity.filled(), "label": entity.label(), "text": entity.creator_text()}}  # step "Over je organisatie" of the creator


HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
COLOR_KEYS = ("primary", "secondary", "bg", "card", "text", "dark", "dbg", "dcard", "dtext", "page", "dpage")  # page/dpage: the background behind the site (bg/dbg: the frontend: heroes, blocks and content)  # dbg/dcard/dtext: the colours of the dark mode
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
    off = set(brief.get("pages_off") or [])  # pages that are not ticked in the menu of the wizard are not made (the start page always is)
    for i, p in enumerate(raw[:10]):
        f = slug(p, i)
        while f in seen:
            f = f.replace(".html", "-2.html")
        seen.add(f)
        if i > 0 and p[:60] in off:
            continue
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


def theme_library():
    """All colour themes to choose from: the installed ones and the themes of the library (resource/themas) that are not installed yet. Each with its colours."""
    import io
    import json
    import zipfile

    from . import resources, theme as T

    out = [{**t, "installed": True} for t in themes()]
    have = {t["key"] for t in out}
    try:
        cat = resources.catalog("themas")
    except Exception:  # noqa: BLE001 - the library is a bonus: the installed themes still work
        return out
    for e in cat:
        if e.get("bundle") or e["name"] in have:
            continue
        try:
            zf = zipfile.ZipFile(io.BytesIO(resources._zip_bytes("themas", e)))
            man = next((json.loads(zf.read(n)) for n in zf.namelist() if n.endswith("theme.json") and "__MACOSX" not in n), None)
            v = T.merged((man or {}).get("values"))
        except Exception:  # noqa: BLE001
            continue
        out.append({"key": e["name"], "name": (man or {}).get("name") or e.get("title") or e["name"], "description": (man or {}).get("description", ""), "mode": (man or {}).get("mode"),
                    "colors": {k: v[k] for k in ("primary", "secondary", "light_bg", "light_card", "light_text", "dark_bg", "dark_card", "dark_text")}, "installed": False})
        have.add(e["name"])
    return out


def apply_theme(job, key, user):
    """The customer chose a colour theme in the chat: install it when it is not installed yet, give the design its colours at once, and remove the theme that an earlier choice installed
    (only one that this flow installed and that the website does not use). Returns the job."""
    from . import resources, theme as T, themepacks

    if job.status not in ("draft", "done", "error"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    prev = str((job.brief or {}).get("theme_installed") or "")
    man = themepacks.manifest_of(key)
    fresh = False
    if not man:
        try:
            resources.install("themas", key, user)
        except resources.ResourceError as e:
            raise ValueError(str(e))
        man = themepacks.manifest_of(key)
        fresh = True
        if not man:
            raise ValueError("Dit thema bestaat niet.")
    if prev and prev != key and prev not in themepacks.BUILTIN_KEYS():
        if not next((r.get("active") for r in themepacks.listing() if r["key"] == prev), False):
            themepacks.remove(prev)  # the theme that the earlier choice installed goes away; the new one is shown
    v = T.merged(man.get("values"))
    colors = {"primary": v["primary"], "secondary": v["secondary"], "bg": v["light_page"], "card": v["light_card"], "text": v["light_text"], "dark": v["dark_bg"], "dbg": v["dark_page"], "dcard": v["dark_card"], "dtext": v["dark_text"]}
    job = save(job, {"colors": colors, "theme_name": man.get("name") or key})
    b = {**(job.brief or {}), "theme_installed": key if (fresh or prev == key) else ""}
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b)
    job.brief = b
    return job


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


# The page layouts that the customer can ask for in the wizard (key -> what the designer is told). They map to the bands with columns of the page editor.
LAYOUT_CHOICES = {
    "full": "Full-width sections one below the other (calm, classic); a full-width band is a band with cols \"1\".",
    "split": "Text next to an image or form: bands with two equal columns (cols \"2\"), the image side alternating left and right.",
    "wide_narrow": "A wide main column next to a narrow side column (cols \"2-1\" and \"1-2\"), for example text with a contact card, price or opening hours.",
    "three": "Three equal columns for services, benefits or steps (cols \"3\").",
    "four": "Four small blocks in a row for facts, numbers or icons (cols \"4\").",
    "rhythm": "A varied rhythm: alternate full-width bands, two- and three-column bands and tinted bands (bg \"soft\"), so no two neighbouring sections look the same.",
    "screen": "A full-screen opening band (screen true) with the main message, then calmer bands below it.",
}


def _clean_layouts(v):
    return [k for k in (v if isinstance(v, list) else []) if k in LAYOUT_CHOICES][:7]


def clean_brief(patch, old):
    """The brief with only known keys and safe values; the photos are checked against the media library."""
    b = dict(old or {})
    p = patch if isinstance(patch, dict) else {}
    for k, n in (("name", 120), ("lang", 40), ("pages", 600), ("style", 300), ("extra", 1500), ("theme", 60), ("theme_name", 120), ("component_set", 60), ("contact", 500), ("one_pager_pages", 300)):
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
    if "unanswered" in p:
        b["unanswered"] = [str(x)[:160] for x in (p["unanswered"] if isinstance(p["unanswered"], list) else [])][:12]
    if "no_cta" in p:
        b["no_cta"] = bool(p["no_cta"])
    if "extras" in p:  # the extra functions that the customer chose in the questionnaire ([] = none)
        b["extras"] = [str(x)[:40] for x in (p["extras"] if isinstance(p["extras"], list) else [])][:12]
    if "locked" in p:  # the choices that the customer made himself (wizard): the designer does not change them
        b["locked"] = [k for k in (p["locked"] if isinstance(p["locked"], list) else []) if k in ("name", "kind", "pages", "style", "style_tags", "layouts", "max_width", "lang", "colors", "font", "radius", "color_mode", "langs", "lang_switch", "istock_search")][:20]
    if "max_width" in p:
        try:
            b["max_width"] = int(p["max_width"]) if int(p["max_width"]) in MAX_WIDTHS else 1100
        except (TypeError, ValueError):
            pass
    if "layouts" in p:
        b["layouts"] = _clean_layouts(p["layouts"])
    if "istock_search" in p:
        b["istock_search"] = bool(p["istock_search"])  # the customer allows the designer to look for photos and videos on iStock
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
    if "pages_off" in p:  # the pages that are NOT made (unticked in the menu)
        b["pages_off"] = [str(x)[:60] for x in (p["pages_off"] if isinstance(p["pages_off"], list) else []) if str(x).strip()][:20]
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
    if "chat" in p:  # a design that is made in a conversation (AI chat build)
        b["chat"] = bool(p["chat"])
    return b


def create(user, name=""):
    if not ai.available():
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    for old in SiteDesignJob.objects.filter(created_at__lt=timezone.now() - timezone.timedelta(days=60)):
        old.delete()
    brief = {"name": str(name or "")[:120], "kind": "company", "lang": "Dutch", "mode": "new", "step": 0, "font": "sans"}
    return SiteDesignJob.objects.create(user=user, status="draft", name=brief["name"] or "Nieuw ontwerp", brief=brief)


def _sig(job, brief=None):
    """A fingerprint of the concept (the files and the choices of the steps): what is live is the concept with this fingerprint."""
    import hashlib
    import json

    b = {k: v for k, v in (brief if brief is not None else job.brief or {}).items() if k not in ("live_hash", "step")}
    return hashlib.sha1(json.dumps([job.files or {}, b], sort_keys=True, default=str).encode()).hexdigest()


def is_live(job):
    """True when the concept has been applied and has not been changed since (green 'Live'); changed again: back to 'Concept'."""
    h = (job.brief or {}).get("live_hash")
    return bool(h) and h == _sig(job)


def save(job, patch):
    if job.status not in ("draft", "done", "error"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    b = clean_brief(patch, job.brief)
    if isinstance(patch, dict) and patch.get("live") is True:  # the design has been applied: this state is live; every later change makes it a concept again, and is applied to the live pages
        b["live_hash"] = _sig(job, b)
    upd = {}
    if isinstance(patch, dict) and any(k in patch for k in ("colors", "font", "radius", "color_mode")) and (job.files or {}).get("style.css"):
        upd["files"] = themed(job.files, b)  # new colours: the theme of the pages changes at once, without asking the AI
        job.files = upd["files"]
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, name=(b.get("name") or job.name)[:120], updated_at=timezone.now(), **upd)
    job.brief = b
    return job


def listing(user):
    out = []
    for j in SiteDesignJob.objects.filter(user=user).order_by("-updated_at")[:30]:
        out.append({"id": str(j.pk), "name": j.name, "status": j.status, "step": (j.brief or {}).get("step", 0), "live": is_live(j), "applied": bool((j.brief or {}).get("live_hash")), "chat": bool((j.brief or {}).get("chat")), "pages": len(j.files or {}) and len([f for f in j.files if f.endswith(".html")]), "updated_at": j.updated_at.isoformat()})
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
    shots = {}  # the screenshots of the pages from the ZIP: the reference for the import (stem -> {id, url})
    for stem, data in bundle.screenshots.items():
        key = default_storage.save(areas.site_path("library", f"{date.today():%Y/%m}/{uuid.uuid4().hex[:8]}-shot-{get_valid_filename(stem)}.jpg"), ContentFile(data))
        item = MediaItem.objects.get(key=key)
        item.name, item.uploaded_by, item.tags = f"screenshot {stem}.jpg"[:255], user, ["design-shot"]
        item.save(update_fields=["name", "uploaded_by", "tags"])
        shots[stem] = {"id": item.id, "url": default_storage.url(item.key)}
    if shots:
        notes.append(f"{len(shots)} screenshots van pagina's meegenomen: ze helpen bij het namaken van de vormgeving.")
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
    b.update({"mode": "improve", "photos": photos, "shots": shots, "pages": ", ".join(pages), "from_zip": [n for n in files]})
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
    _spawn(_read_document, job.pk, doc["id"])
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
        _doc_set(pk, doc_id, percent=30, step="easy2edit leest de doelstellingen")
        seen = {"n": 0}

        def on_event(kind, _t=""):
            if kind == "write" and not seen["n"]:
                seen["n"] = 1
                _doc_set(pk, doc_id, percent=60, step="easy2edit bepaalt de instellingen")

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
        "light_page": c.get("page") or c["bg"], "light_bg": c["bg"], "light_card": c["card"], "light_hover": mix(c["bg"], c["card"], 0.5), "light_line": mix(c["text"], c["bg"], 0.86), "light_text": c["text"], "light_muted": mix(c["text"], c["bg"], 0.42),
        "dark_page": c.get("dpage") or c["dbg"], "dark_bg": c["dbg"], "dark_card": c["dcard"], "dark_hover": mix(c["dbg"], c["dcard"], 0.5), "dark_line": mix(c["dbg"], c["dtext"], 0.15), "dark_text": c["dtext"], "dark_muted": mix(c["dtext"], c["dbg"], 0.36),
        "font_body": SYSTEM_FONT.get(b.get("font") or "sans", "System"), "font_heading": SYSTEM_FONT.get(b.get("font") or "sans", "System"),
        "radius": r, "btn_radius": max(0, r - 4), "popup_radius": r,
        "default_mode": {"light": "light", "dark": "dark", "both": "system"}.get(b.get("color_mode") or "light", "light"),
    }
    clean, _errors = T.validate(TI._complete(v))
    return clean


def _top_blocks(css):
    out, depth, start, pre = [], 0, 0, ""
    for i, ch in enumerate(css):
        if ch == "{":
            if depth == 0:
                pre, start = css[start:i].strip(), i + 1
            depth += 1
        elif ch == "}" and depth:
            depth -= 1
            if depth == 0:
                out.append((pre, css[start:i]))
                start = i + 1
    return out


def theme_root_css(b):
    """The theme of this design as the css variables on :root, written by the SYSTEM (not by the AI): the colours, font and corners of the step plan in the same variables that a theme of easy2edit has.
    So the preview, the saved theme and the imported website all have the same colours, and the user can change them without asking the AI again."""
    from . import theme

    v = theme_values(b)
    fonts = {c["value"]: c for c in theme.FIELDS["font_body"]["choices"]}
    fb, fh = fonts.get(v["font_body"]) or {}, fonts.get(v["font_heading"]) or {}
    light = {"--primary": v["primary"], "--secondary": v["secondary"], "--bg": v["light_bg"], "--page": v["light_page"], "--surface": v["light_bg"], "--card": v["light_card"], "--hover": v["light_hover"], "--line": v["light_line"], "--text": v["light_text"], "--muted": v["light_muted"]}
    dark = {"--bg": v["dark_bg"], "--page": v["dark_page"], "--surface": v["dark_bg"], "--card": v["dark_card"], "--hover": v["dark_hover"], "--line": v["dark_line"], "--text": v["dark_text"], "--muted": v["dark_muted"]}
    common = {"--font-heading": fh.get("css") or "system-ui, sans-serif", "--font-body": fb.get("css") or "system-ui, sans-serif", "--radius": f"{v['radius']}px", "--btn-radius": f"{v['btn_radius']}px"}
    block = lambda d, ind="  ": "\n".join(f"{ind}{k}: {val};" for k, val in d.items())  # noqa: E731
    mode = (b or {}).get("color_mode") or "light"
    base = {**light, **common} if mode != "dark" else {**light, **dark, **common}
    css = f"/* THEME (written by the system from the colours of the design: change the colours in the step plan or with the colour button, not here) */\n:root {{\n{block(base)}\n}}"
    if mode == "both":
        css += f'\n:root[data-theme="dark"] {{\n{block(dark)}\n}}\n@media (prefers-color-scheme: dark) {{\n  :root:not([data-theme="light"]) {{\n{block(dark, "    ")}\n  }}\n}}'
    return css


# The layout vocabulary of a design (bands with columns): written by the SYSTEM, the same for the preview and the import. A band is a full-width row of the page editor, a column is a cell of that row.
LAYOUT_COLS = {"1": "1fr", "2": "repeat(2, 1fr)", "3": "repeat(3, 1fr)", "4": "repeat(4, 1fr)", "2-1": "2fr 1fr", "1-2": "1fr 2fr", "3-1": "3fr 1fr", "1-3": "1fr 3fr"}
LAYOUT_CSS = """/* LAYOUT (written by the system): bands (rows) with columns */
.band { padding: 4rem 0; }
.band--soft { background: var(--surface); --e2e-bg: var(--surface); --e2e-surface: var(--bg); }
.band--screen { min-height: 100vh; display: flex; align-items: center; }
.band--screen > .container { width: 100%; }
.band .container { max-width: __MAXW__; margin: 0 auto; padding: 0 1.25rem; }
.cols { display: grid; gap: 1.5rem; }
""" + "".join(f".cols-{k} {{ display: grid; grid-template-columns: {v}; }}\n" for k, v in LAYOUT_COLS.items()) + """.cols--center { align-items: center; }
@media (max-width: 760px) { .cols, .cols-1, .cols-2, .cols-3, .cols-4, .cols-2-1, .cols-1-2, .cols-3-1, .cols-1-3 { grid-template-columns: 1fr; } .band--screen { min-height: 0; } }
"""


MAX_WIDTHS = (960, 1100, 1280, 1440, 0)  # the maximum width of the content in px; 0 = the whole width of the screen


def max_width_of(b):
    try:
        w = int((b or {}).get("max_width", 1100))
    except (TypeError, ValueError):
        w = 1100
    return w if w in MAX_WIDTHS else 1100


GALLERY_CSS = """.e2e-gallery { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; }  /* photos together: a photo carousel (the importer makes the media system object of it) */
.e2e-gallery > * { flex: 0 0 calc(33.333% - 8px); margin: 0; scroll-snap-align: start; min-width: 0; }
.e2e-gallery img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; }
@media (max-width: 760px) { .e2e-gallery > * { flex-basis: 80%; } }
"""


def layout_css(b):
    w = max_width_of(b)
    mw = f"{w}px" if w else "none"
    return LAYOUT_CSS.replace("__MAXW__", mw) + f"body {{ background: var(--page, var(--bg)); }}  /* the page colour: the whole page, 100% wide */\nbody > main {{ max-width: {mw}; margin-left: auto; margin-right: auto; background: var(--bg); }}  /* the frontend: the column up to the maximum width, with its own colour: the elements, blocks and heroes stand in it. The header is a block of its own, 100% wide; the footer has the same width as the column */\nbody > footer {{ max-width: {mw}; margin-left: auto; margin-right: auto; box-sizing: border-box; }}\n" + f".container, .band .container {{ max-width: {mw}; margin: 0 auto; padding: 0 1.25rem; box-sizing: border-box; width: 100%; }}\n" + GALLERY_CSS


def themed(files, b):
    """The files with the theme of the design on :root in style.css: what the AI wrote on :root (colours, fonts) is replaced by the theme of the system. A design from a ZIP keeps its own css."""
    css = (files or {}).get("style.css")
    if not css or ((b or {}).get("mode") == "improve" and (b or {}).get("palette_from_zip")):
        return files
    rest = []
    for pre, body in _top_blocks(re.sub(r"/\*.*?\*/", "", css, flags=re.S)):
        flat = re.sub(r"\s+", "", pre)
        if flat.startswith(":root") or (flat.startswith("@media(prefers-color-scheme") and ":root" in body) or re.match(r"^\.(band|cols|valign|e2e-gallery)", flat) or (flat.startswith("@media(max-width:760px)") and (".cols" in body or ".e2e-gallery" in body)):
            continue  # the colours of the theme and the layout vocabulary are written by the system, not by the AI
        rest.append(f"{pre}{{{body}}}")
    return {**files, "style.css": theme_root_css(b) + "\n\n" + "\n".join(rest) + "\n" + layout_css(b)}


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
        *([ "ONE PAGER: the whole website is ONE page (index.html). Put everything (hero, about, services, reviews, contact ...) as sections of that page, each section with an id; the menu in the navbar consists of anchor links to those sections (href=\"#id\"), no other pages exist." ] if len(pages) == 1 else []),
        "Style: " + ", ".join([*(b.get("style_tags") or []), *([b["style"]] if b.get("style") else [])] or ["modern, clean, lots of white space, friendly and professional"]),
    ]
    if b.get("unanswered"):
        lines.append("UNANSWERED: the customer left these questions EMPTY, so design NOTHING for them (no section, no text, no button, no menu item, no placeholder content): " + "; ".join(b["unanswered"]))
    if b.get("no_cta"):
        lines.append("NO CALL TO ACTION: the customer chose no main goal. Do NOT design a call-to-action section or banner, no 'Request a ...' / 'Contact us' / 'Get started' buttons in the hero or the navbar, and no call-to-action wording anywhere.")
    if isinstance(b.get("extras"), list):
        lines.append("FUNCTIONS: the customer chose only these extra functions: " + (", ".join(b["extras"]) or "none") + ". Do NOT add any other function: no FAQ, agenda/appointments/booking, web shop, community, login or sign-up, documents/downloads, newsletter or contact form unless it is in this list (a plain contact section with the contact details is always fine). No login, sign-up, account or downloads links in the menu or the footer.")
    if b.get("contact"):
        lines.append("CONTACT DETAILS of the customer (use EXACTLY these in the contact section, the call to action and the footer; never invent an address, a phone number or an e-mail address, and never use example.com): " + str(b["contact"])[:500])
    if b.get("theme_name"):
        lines.append(f"Based on the theme '{b['theme_name']}' of the system: follow its look and colours.")
    if c and b.get("mode") == "improve" and b.get("palette_from_zip") and c == b.get("zip_palette"):
        lines.append("Colours: KEEP the colours of the existing design exactly as they are in its css (keep its own colour variables and values; they were read from it: " + ", ".join(f"{k} {v}" for k, v in c.items() if k in COLOR_KEYS[:6]) + "). Do not change them and do not invent new ones.")
    else:
        tv = theme_values(b)
        lines.append("THEME (colours, font and corners): the SYSTEM writes these on :root in style.css as css variables; you do NOT write a :root block and no colours of your own. Use them only through var(--primary), var(--secondary), var(--bg), var(--surface), var(--card), var(--hover), var(--line), var(--text), var(--muted), var(--font-heading), var(--font-body), var(--radius), var(--btn-radius). "
                     f"The values: primary {tv['primary']}, secondary {tv['secondary']}, page {tv['light_page']}, cards {tv['light_card']}, text {tv['light_text']}" + (f"; dark mode: page {tv['dark_page']}, cards {tv['dark_card']}, text {tv['dark_text']}" if (b.get("color_mode") or "light") != "light" else "") + ". The user can change the colours later; everything follows at once.")
    mode = b.get("color_mode") or "light"
    lines.append({"light": "Display: light only.", "dark": "Display: dark only (the theme already holds the dark colours on :root).", "both": "Display: light AND dark (the theme holds both: :root[data-theme=\"dark\"] is written by the system)."}.get(mode, "Display: light only."))
    codes = b.get("langs") or []
    if codes:
        names = {l.code: f"{l.native_name} ({l.code}{', right-to-left' if l.rtl else ''})" for l in Language.objects.filter(code__in=codes)}
        lines.append(f"Other languages of the website (the system translates the pages into them; write only in the main language): {', '.join(names.get(x, x) for x in codes)}." + (" Show a language switch: leave room for it in the header." if b.get("lang_switch", True) else " No language switch in the header."))
    lines.append(f"Maximum width of the content: {max_width_of(b) or 'the whole screen'}{'px' if max_width_of(b) else ''} (the system sets it on .container; write no max-width of your own on containers).")
    if b.get("layouts"):
        lines.append("LAYOUT wishes of the customer (use these page layouts, with bands and columns, instead of making everything full width):\n" + "\n".join(f"- {LAYOUT_CHOICES[k]}" for k in b["layouts"]))
    allph = b.get("photos") or []
    logos = [p for p in allph if str(p.get("file", "")).startswith("logo.")]
    ph = [p for p in allph if p not in logos]
    if logos:
        lines.append("LOGO of the company (separate from the content pictures): use it ONLY as the logo in the header and the footer, as <img src=\"img/" + logos[0]["file"] + "\" alt=\"" + str(b.get("name") or "logo")[:60] + "\"> next to or instead of the text mark; never as a content picture, never in the body of a page; the file is added by the system.")
    if ph:
        lines.append("CONTENT PHOTOS the user uploaded (use them: reference as img/<file> in <img> tags and url(img/<file>) in css, with fitting alt texts; use each where it fits, hero pictures first; do not output these files, they are added by the system):\n" + "\n".join(f"- {p['file']}: {p.get('note') or 'no description'}" for p in ph))
    vids = b.get("videos") or []
    if vids:
        lines.append("CONTENT VIDEOS the user uploaded (use them: <video src=\"video/<file>\" autoplay muted loop playsinline> as a calm background or block; the files are added by the system):\n" + "\n".join(f"- {p['file']}: {p.get('note') or ''}" for p in vids))
    picked = [(f, it) for f, it in (b.get("picked") or {}).items() if f not in {p.get("file") for p in [*(b.get("photos") or []), *(b.get("videos") or [])]}]
    if picked:
        lines.append("PHOTOS and VIDEOS that the user already chose on iStock (use them where they fit: <img src=\"img/FILE\" alt=\"...\"> or <video src=\"video/FILE\" ...>, with these exact file names):\n" + "\n".join(f"- {f}: {it.get('title') or ''}" for f, it in picked[:12]))
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


SHOT_RE = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$")


def clean_shots(raw):
    """Screenshots that the user sends along with a message: [(media_type, base64)], at most 3, each a png, jpeg or webp of at most about 4 MB."""
    out = []
    for x in (raw if isinstance(raw, list) else [])[:12]:
        m = SHOT_RE.match(str(x or ""))
        if m and len(m.group(2)) <= 6_000_000:
            out.append((m.group(1), m.group(2)))
        if len(out) == 3:
            break
    return out


def _thumbs(shots):
    """Small pictures (data urls) of the screenshots for in the chat; they are kept with the message."""
    out = []
    try:
        import base64
        from PIL import Image

        for _mt, b64 in shots:
            im = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
            im.thumbnail((420, 420))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=70)
            out.append("data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode())
    except Exception:  # noqa: BLE001
        logger.warning("screenshot thumbnail failed", exc_info=True)
    return out


def _ask(system, prompt, max_tokens=24000, pk=None, images=None):
    def cancel():
        if pk and _stop_requested(pk):
            raise Stopped("Gestopt.")

    if pk and _stop_requested(pk, fresh=True):
        raise Stopped("Gestopt.")
    from apps.integrations import aiusage

    with aiusage.for_ref(_ref_of(pk) if pk else ""):  # the costs of this design are counted
        return ai.claude_stream(system, prompt, max_tokens=max_tokens, timeout=600, cancel=cancel if pk else None, images=images)


def _notify_done(pk, what):
    """A notification (bell, pop-up) for the owner: the design is ready or changed. Also when the window of the design has been closed. Never breaks the work."""
    try:
        from apps.notifications import service

        job = SiteDesignJob.objects.filter(pk=pk).select_related("user").first()
        if job and job.user_id:
            service.notify(job.user, "design", f"{what}: {job.name or 'Website'}", "De AI is klaar. Open het ontwerp om het te bekijken.", f"/dashboard/admin/siteimport?design={pk}")
    except Exception:  # noqa: BLE001
        logger.warning("design notification failed", exc_info=True)


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
    _spawn(_generate, job.pk)



# ── sectioned design: a website is built in SMALL pieces (one component at a time), so an answer is never too long ──
SECTION_SYSTEM = """You write ONE part of a website for easy2edit: the html of ONE ready-made component (a block of the page editor), in the language of the website.
- Output ONLY the html of that component, nothing else: no explanation, no markdown fences. It starts with <div data-easy2edit-tag="TAG"> and ends with the matching </div>.
- COPY the template that you get: the same tags, the same e2e-* classes, the same nesting. You change only the texts (real, convincing, concrete copy that fits this business; no lorem ipsum), the links, the pictures (src/alt) and the number of repeated items (cards, steps, questions ...; as asked).
- NEVER write css, a <style> or <script>, never style="" colours/sizes, never classes of your own: the theme and the component set draw everything. Buttons: e2e-btn, e2e-btn e2e-btn--outline.
- Links between pages are relative file names (about.html); for places on the same page "#id". For the system use: /producten, /winkelwagen, /faq, /registreren, /login, /dashboard, /privacy, /cookies.
- Pictures: <img src="img/<descriptive-english-words>.jpg" alt="<what it shows, in English, 4-10 words>"> where the template has a picture slot (the user adds the real photos later; never external urls, never data: urls)."""
SECTION_JSON = """You plan the pages of a website made ONLY of ready-made components of easy2edit. Answer with ONE JSON object, nothing else."""


def _div_balanced(html):
    return len(re.findall(r"<div\b", html, re.I)) == len(re.findall(r"</div\s*>", html, re.I))


def _clean_component(text, tag):
    """The html of one component from an answer of the AI, or None when it is not usable."""
    t = FENCE.sub("", str(text or "").strip()).strip()
    t = re.sub(r"^```[a-z]*\s*|\s*```$", "", t, flags=re.I).strip()
    m = re.search(r'<div\b[^>]*data-easy2edit-tag="%s"' % re.escape(tag), t)
    if not m:
        return None
    t = t[m.start():]
    last = t.rfind("</div>")
    if last < 0:
        return None
    t = t[: last + 6]
    if re.search(r"<\s*(script|style|iframe)\b", t, re.I) or len(t) > 30000 or not _div_balanced(t):
        return None
    return t


def _template(brief, tag):
    from . import componentpacks

    return componentpacks.templates_text((brief or {}).get("component_set") or None, (tag,))


def _fallback_component(brief, tag, title=""):
    """The unchanged template: a part that never gets lost, the user changes its texts in the editor."""
    t = _template(brief, tag)
    t = re.sub(r"^--- .*? ---\n", "", t)
    return t or f'<div data-easy2edit-tag="{tag}"><section class="e2e-section"><div class="e2e-container"><h2>{title or tag}</h2></div></section></div>'


def _piece(pk, brief, system, prompt, tag, max_tokens=4500, title=""):
    """ONE small piece (one component): asked with a retry (shorter) when the answer is cut off or not usable; when it still fails the template is used. Never raises, except for Stop."""
    last = ""
    for attempt, hint in enumerate(("", "\nYour previous answer was cut off or not usable. Be SHORTER: at most 3 repeated items, short sentences. Output only the html of the component.", "\nOnce more, as short as possible: at most 2 repeated items.")):
        try:
            out = _ask(system, prompt + hint, max_tokens=max_tokens, pk=pk)
        except Stopped:
            raise
        except ValueError as e:
            last = str(e)
            continue
        html = _clean_component(out, tag)
        if html:
            return html
    logger.warning("sitecreator piece %s: template used (%s)", tag, last)
    return _fallback_component(brief, tag, title)


def _section_system(brief):
    from . import componentpacks

    comp = componentpacks.rules_text((brief or {}).get("component_set") or None)
    return SECTION_SYSTEM + "\n\n" + comp


def _site_plan(pk, job, pages):
    """A SMALL plan: for every page the components (sections) in order, chosen from the whole set. Never fails: a standard plan is the fallback."""
    from . import componentpacks

    b = job.brief or {}
    tags = [c["easy2edit_tag"] for c in componentpacks.get(b.get("component_set") or None)["components"]]
    lst = componentpacks.rules_text(b.get("component_set") or None).split("Tags:\n", 1)[-1]
    objs = ", ".join(b.get("objects") or [])
    prompt = (f"{_brief_text(b)}\n\nPlan the pages. The pages (file = title): " + "; ".join(f"{f} = {t}" for f, t in pages) + ".\n"
              + ("This is a ONE PAGER: there is only ONE page, so give 7 to 10 sections for it that together make the complete website (hero, about, services/offer, benefits, showcase or gallery, reviews, contact ... as fits the business; only the functions that the customer chose, see FUNCTIONS above). Give a short \"menu\" label (max 20 characters, in the language of the website) ONLY to the sections that the customer asked for: about us, services, contact, and showcase/portfolio, FAQ, blog or documents ONLY when the customer chose them. Sections such as reviews, results or how it works get NO menu label (leave it empty): a menu has at most 5 items. Every section gets a unique lowercase \"id\" (about, services, ...). "
                 if len(pages) == 1 else "For EVERY page give 4 to 8 sections, each ONE component, in the order of the page.")
              + " Each section is ONE component, in the order of the page. Use the full variety of the set where it fits the content (hero variants, features, cards, split text+picture, stats, steps, timeline, testimonials, team, gallery, video, pricing, comparison table, FAQ, calendar, agenda, booking, charts, KPI, newsletter, contact, call-to-action ...), not the same few every time. "
              "The first section of the start page is a hero; every page ends with a call to action or contact section. Do NOT include the navbar and footer (they are added to every page). "
              "Besides a single component a section can be a BAND with COLUMNS (a full-width row of the page editor with 1-4 columns side by side, each column holding one component): "
              '{"layout": "band", "id": "x", "bg": "none"|"soft" (a tinted band), "cols": "1"|"2"|"3"|"4"|"2-1"|"1-2"|"3-1"|"1-3" (width ratios of the columns), "valign": "top"|"center", "screen": false|true (true = a full-screen-height band, for a hero), "cells": [{"tag": "ui-...", "goal": "..."}, ...one cell per column]}. '
              "Use bands where two or three things belong side by side (for example text next to a form, a stats block next to a testimonial, two cards of different kinds) and vary the rhythm of the page: a tinted band, a full-screen hero, wide and narrow columns; not every section the same. "
              + (f"System objects that must be placed as a section: {objs} (use {{\"sysobject\": \"slug\"}} for them). " if objs else "")
              + 'Answer: {"pages": [{"file": "index.html", "title": "page title (max 60 chars)", "description": "meta description (max 155 chars)", "sections": [{"tag": "ui-hero-split", "id": "hero", "menu": "", "goal": "what this section says, in one sentence"}]}], "brand": "short brand name for the menu"}\n'
              f"Available tags:\n{lst}")
    plan = {}
    try:
        out = _ask(SECTION_JSON, prompt, max_tokens=6000, pk=pk)
        m = re.search(r"\{.*\}", out, re.S)
        plan = json.loads(m.group(0)) if m else {}
    except Stopped:
        raise
    except Exception:  # noqa: BLE001
        logger.warning("sitecreator plan failed, standard plan", exc_info=True)
    byfile = {p.get("file"): p for p in (plan.get("pages") or []) if isinstance(p, dict)}
    out_pages = []
    clean_id = lambda x: re.sub(r"[^a-z0-9_-]", "", str(x or "").lower())[:40]  # noqa: E731
    for i, (f, title) in enumerate(pages):
        p = byfile.get(f) or {}
        secs = []
        for s in (p.get("sections") or [])[:(12 if len(pages) == 1 else 10)]:
            if not isinstance(s, dict):
                continue
            if s.get("layout") == "band":  # a band with columns: 1-4 cells, each one component
                cells = [{"tag": c.get("tag"), "goal": str(c.get("goal") or "")[:300]} for c in (s.get("cells") or [])[:4] if isinstance(c, dict) and c.get("tag") in tags]
                if cells:
                    cols = str(s.get("cols") or len(cells))
                    cols = cols if cols in LAYOUT_COLS and (cols.isdigit() and int(cols) == len(cells) or "-" in cols and len(cells) == 2) else str(len(cells))
                    secs.append({"layout": "band", "id": clean_id(s.get("id")), "bg": "soft" if s.get("bg") == "soft" else "none", "cols": cols, "valign": "center" if s.get("valign") == "center" else "top", "screen": bool(s.get("screen")), "cells": cells, "goal": str(s.get("goal") or "")[:200], "menu": str(s.get("menu") or "")[:30]})
            elif s.get("sysobject") or s.get("tag") in tags:
                secs.append({"tag": s.get("tag"), "sysobject": clean_id(s.get("sysobject")), "id": clean_id(s.get("id")), "goal": str(s.get("goal") or "")[:300], "menu": str(s.get("menu") or "")[:30]})
        if not secs and len(pages) == 1:  # a one pager always gets a complete standard plan
            secs = [{"tag": "ui-hero-split", "id": "hero", "goal": f"Introduce {title}", "menu": ""}, {"tag": "ui-split", "id": "about", "goal": "Who we are and what we stand for", "menu": "About us"},
                    {"tag": "ui-features", "id": "services", "goal": "The services or the offer", "menu": "Services"}, {"tag": "ui-testimonials", "id": "reviews", "goal": "What customers say", "menu": "Reviews"},
                    {"tag": "ui-faq", "id": "faq", "goal": "The most asked questions", "menu": "FAQ"} if "ui-faq" not in blocked_tags(b.get("extras") if isinstance(b.get("extras"), list) else None) else None, {"tag": "ui-cta", "id": "contact", "goal": "Contact: ask for a quote or call", "menu": "Contact"}]
            secs = [x for x in secs if x and x["tag"] in tags] or [x for x in secs if x]
        if not secs:  # standard plan
            secs = ([{"tag": "ui-hero-split", "id": "hero", "goal": f"Introduce {title}"}, {"tag": "ui-features", "id": "voordelen", "goal": "The main benefits"}] if i == 0 else [{"tag": "ui-section-heading", "id": "intro", "goal": f"Introduction of {title}"}, {"tag": "ui-split", "id": "tekst", "goal": f"The story of {title}"}]) + [{"tag": "ui-cta", "id": "contact", "goal": "Invite to get in touch"}]
        out_pages.append({"file": f, "title": str(p.get("title") or title)[:60], "description": str(p.get("description") or "")[:155], "sections": secs})
    block = blocked_tags(b.get("extras") if isinstance(b.get("extras"), list) else None)
    if b.get("no_cta"):
        block = block | {"ui-cta"}
    if block:  # sections of functions that the customer did not choose are left out
        for pg_ in out_pages:
            pg_["sections"] = [x for x in pg_["sections"] if x.get("tag") not in block and not (x.get("layout") == "band" and any(c.get("tag") in block for c in x.get("cells") or []))] or pg_["sections"][:1]
    if len(out_pages) == 1:  # a one pager: every section has a unique id (the menu links to it)
        seen = set()
        for n, x in enumerate(out_pages[0]["sections"]):
            i = x.get("id") or (x.get("menu") and re.sub(r"[^a-z0-9]+", "-", x["menu"].lower()).strip("-")) or f"sectie-{n + 1}"
            while i in seen:
                i += "-2"
            seen.add(i)
            x["id"] = i
    return {"brand": str(plan.get("brand") or (b.get("name") or "Website"))[:40], "pages": out_pages}


def _band_html(s, cells):
    """A band (a full-width row of the page editor) with columns; every column holds one component. The css for it is the layout vocabulary of the system."""
    cls = "band" + (" band--soft" if s.get("bg") == "soft" else "") + (" band--screen" if s.get("screen") else "")
    cols = f"cols cols-{s.get('cols') or len(cells)}" + (" cols--center" if s.get("valign") == "center" else "")
    body = "\n".join(f'<div class="col">\n{h}\n</div>' for h in cells)
    return f'<section class="{cls}">\n<div class="container">\n<div class="{cols}">\n{body}\n</div>\n</div>\n</section>'


def _page_html(brief, plan_page, header, sections, footer):
    name = str((brief or {}).get("name") or "")
    lang = {"dutch": "nl", "nederlands": "nl", "english": "en", "engels": "en", "german": "de", "duits": "de", "french": "fr", "frans": "fr", "spanish": "es", "spaans": "es"}.get(str((brief or {}).get("lang") or "").strip().lower(), "nl")
    esc = lambda x: str(x or "").replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")  # noqa: E731
    title = esc(plan_page["title"] + (f" | {name}" if name and name.lower() not in plan_page["title"].lower() else ""))
    wide = lambda h: h if ("e2e-container" in h or 'class="container"' in h or "class='container'" in h) else f'<div class="container">\n{h}\n</div>'  # noqa: E731 - every section has the same width: a component without a container of its own gets the container of the site
    sections = [(s_id, wide(h)) for s_id, h in sections]
    body = "\n".join(f'<div id="{s_id}">\n{h}\n</div>' if s_id else h for s_id, h in sections)
    return (f'<!doctype html>\n<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{title[:80]}</title>\n<meta name="description" content="{esc(plan_page["description"])}">\n<link rel="stylesheet" href="style.css">\n</head>\n'
            f"<body>\n<header>\n{header}\n</header>\n<main>\n{body}\n</main>\n<footer>\n{footer}\n</footer>\n</body>\n</html>\n")


def _generate_sections(pk, job):
    """A new design, piece by piece: plan -> navbar -> footer -> every section of every page (one small answer each). The page is shown after every piece. Returns the files."""
    b = job.brief or {}
    pages = pages_of(b)
    text = _brief_text(b)
    nav = "; ".join(f"{t} -> {f}" for f, t in pages)
    sysm = _section_system(b)
    _set(pk, progress=3, step="Het plan van de pagina's maken")
    plan = _site_plan(pk, job, pages)
    if len(plan["pages"]) == 1:  # a one pager: the menu consists of anchor links to the sections of the page
        links = [(x.get("menu"), x["id"]) for x in plan["pages"][0]["sections"] if x.get("menu") and x.get("id") and menu_allowed(b, x)][:6]
        if links:
            nav = "; ".join(f"{t} -> #{i}" for t, i in links) + " (all links are anchors on this ONE page: use exactly these href values)"
    total = 2 + sum(len(s.get("cells") or [1]) for p in plan["pages"] for s in p["sections"])
    done = [0]

    def step(label):
        done[0] += 1
        _set(pk, progress=min(97, 5 + int(92 * done[0] / total)), step=f"{label} ({done[0]} van {total})")

    files = themed({"style.css": "/* extra rules for rare helper classes (the theme is written by the system) */\n"}, b)
    tpl = lambda tag: _template(b, tag)  # noqa: E731
    step("Menu maken")
    header = _piece(pk, b, sysm, f"Component: ui-navbar.\nBrand: {plan['brand']}\nMenu links (label -> file): {nav}\nA button on the right: a short call to action to the contact page (leave it out when the brief says NO CALL TO ACTION). No login, sign-up or account links, unless the FUNCTIONS in the brief include them.\n\n{text}\n\nTemplate:\n{tpl('ui-navbar')}", "ui-navbar", title=plan["brand"])
    step("Voettekst maken")
    footer = _piece(pk, b, sysm, f"Component: ui-footer.\nBrand: {plan['brand']}\nLinks (label -> file): {nav}; also 'Privacy' -> /privacy and 'Cookies' -> /cookies.\n\n{text}\n\nTemplate:\n{tpl('ui-footer')}", "ui-footer", title=plan["brand"])
    header, footer = strip_unchosen_links(header, b.get("extras")), strip_unchosen_links(footer, b.get("extras"))  # no login, sign-up or downloads links when the customer did not choose such functions
    def one(pg, n, s, tag, goal, label):
        step(label)
        ctx = f"Page: {pg['title']} ({pg['file']}). Section {n + 1} of {len(pg['sections'])}: {tag}. Goal: {goal}\nOther sections on this page: " + ", ".join(f"{x.get('tag') or x.get('sysobject') or 'band'}: {x.get('goal', '')}" for x in pg["sections"] if x is not s)[:700]
        return _piece(pk, b, sysm, f"Component: {tag}.\n{ctx}\nMenu (label -> file): {nav}\n\n{text}\n\nTemplate (copy it, change texts/links/pictures and the number of items):\n{tpl(tag)}", tag, title=pg["title"])

    for pg in plan["pages"]:
        secs = []
        for n, s in enumerate(pg["sections"]):
            label = f"{pg['title']}: sectie {n + 1} van {len(pg['sections'])}"
            if s.get("layout") == "band":
                cells = [one(pg, n, s, c["tag"], c["goal"] or s.get("goal", ""), f"{label} (kolom {k + 1} van {len(s['cells'])})") for k, c in enumerate(s["cells"])]
                secs.append((s.get("id") or "", _band_html(s, cells)))
            elif s.get("sysobject"):
                step(label)
                secs.append((s.get("id") or "", f'<div data-sysobject="{s["sysobject"]}"></div>'))
            else:
                secs.append((s.get("id") or "", one(pg, n, s, s["tag"], s["goal"], f"{label} ({s['tag'].replace('ui-', '')})")))
            files[pg["file"]] = normalise_galleries(_without_missing_svgs(_page_html(b, pg, header, secs, footer), files))  # the page is complete after every piece: the preview shows it growing
            _set(pk, files=files)
    return files


def _generate(pk):
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        improve = (((job.brief or {}).get("mode") == "improve") or bool((job.brief or {}).get("improve_now"))) and any(n.endswith(".html") for n in (job.files or {}))
        old = dict(job.files or {}) if improve else {}
        pages = pages_of(job.brief)
        if improve:  # the pages are the html files of the ZIP (in the order of the brief)
            have = sorted((n for n in old if n.endswith(".html")), key=lambda n: (n != "index.html", n))
            pages = [(f, pages_of(job.brief)[i][1] if i < len(pages_of(job.brief)) else f[:-5]) for i, f in enumerate(have)]
        if not improve:  # a new design is built in small pieces (one component at a time): an answer can never be too long
            files = _generate_sections(pk, SiteDesignJob.objects.get(pk=pk))
            if ((SiteDesignJob.objects.get(pk=pk).brief or {}).get("picked") or {}):
                try:
                    assign_unused_picked(SiteDesignJob.objects.get(pk=pk))  # empty places get the photos that the customer chose and the pages do not use
                except Exception:  # noqa: BLE001
                    logger.warning("unused photos not placed", exc_info=True)
                auto_previews(pk)  # while the status is still "running": the real example photos come in the preview
            b2 = {k: v for k, v in (SiteDesignJob.objects.get(pk=pk).brief or {}).items() if k not in ("improve_now", "focus")}
            b2["sectioned"] = True
            _set(pk, status="done", progress=100, step="Klaar", files=files, brief=b2, messages=list(SiteDesignJob.objects.get(pk=pk).messages or []) + [{"role": "ai", "text": "Je website is ontworpen. Bekijk de pagina's en zeg wat er anders moet. Daarna kun je alles aanmaken of eerst importeren om te controleren."}])
            _notify_done(pk, "Ontwerp klaar")
            return
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
        files = parse(_ask(rules(job.brief), prompt, pk=pk))
        if "style.css" not in files or first not in files:
            raise ValueError("De AI gaf geen bruikbaar ontwerp terug. Probeer het nog eens.")
        if improve:
            files = {**old, **files}  # what is not improved yet stays as it was: nothing is lost when a later page fails
        files = themed(files, job.brief)  # the colours come from the theme of the design, not from the AI
        _set(pk, files=files, progress=30)
        rest = pages[1:]
        for n, (f, title) in enumerate(rest):
            _set(pk, progress=30 + int(65 * n / max(1, len(rest))), step=f"Pagina '{title}' {'verbeteren' if improve else 'ontwerpen'}")
            ctx = f"style.css:\n{files['style.css']}\n\n{first} (copy its header and footer exactly, same menu):\n{files[first]}"
            cur = f"\n\nCURRENT {f} (improve this page, keep its content):\n{old.get(f, '')}" if improve else ""
            new = parse(_ask(rules(job.brief), f"{'Improve' if improve else 'Design'} ONE more page of the same website, in exactly the same visual language. Output {f} (and img/ svg files that this page needs). Output style.css too ONLY when you had to add classes: then the complete extended file.\nThe menu on every page: {nav}\nThis page: {title} ({f})\n\n{text}\n\n{ctx}{cur}", pk=pk))
            if f not in new:
                raise ValueError(f"De pagina '{title}' kwam niet terug. Probeer het nog eens.")
            files = {**files, **new}
            files = themed(files, job.brief)
            _set(pk, files=files)
        b2 = {k: v for k, v in (job.brief or {}).items() if k not in ("improve_now", "focus")}
        done_msg = "Het ontwerp is verbeterd. Bekijk de pagina's en zeg wat er anders moet. Is het goed, dan kun je alles aanmaken." if improve else "Je website is ontworpen. Bekijk de pagina's en zeg wat er anders moet. Daarna kun je alles aanmaken of eerst importeren om te controleren."
        _set(pk, status="done", progress=100, step="Klaar", files=files, brief=b2, messages=list(SiteDesignJob.objects.get(pk=pk).messages or []) + [{"role": "ai", "text": done_msg}])
        _notify_done(pk, "Ontwerp verbeterd" if improve else "Ontwerp klaar")
    except Stopped:
        _finish_stopped(pk, "Gestopt. Wat al klaar was is bewaard; de rest is zoals het was.")
    except Exception as e:  # noqa: BLE001
        logger.exception("sitecreator")
        row = SiteDesignJob.objects.filter(pk=pk).first()
        _set(pk, status="error", error=str(e) if isinstance(e, ValueError) else "Het ontwerpen is niet gelukt. Probeer het nog eens.", **({"brief": {k: v for k, v in (row.brief or {}).items() if k not in ("improve_now", "focus")}} if row else {}))
    finally:
        db.connections.close_all()


# ── AI chat build: the website is designed in a conversation ──
PHOTO_REF = re.compile(r"""(?:src=|url\()\s*["']?(?:\.?/?)(img/[A-Za-z0-9_\-]+\.(?:jpe?g|png|webp|gif))""", re.I)
ALT_REF = re.compile(r"""<img\b[^>]*>""", re.I)
VIDEO_REF = re.compile(r"""<video\b[^>]*>""", re.I)
VIDEO_SRC = re.compile(r"""src=\s*["']?(?:\.?/?)(video/[A-Za-z0-9_\-]+\.(?:mp4|webm))""", re.I)


def photo_slots(job):
    """The photos that the pages ask for (img/<name>.jpg) and that are not filled in yet: [{file, alt, query, url, done}] with a search address on iStock. The user downloads the photo there himself and puts it in the slot."""
    have = {p["file"]: p for p in [*((job.brief or {}).get("photos") or []), *((job.brief or {}).get("videos") or [])]}
    picked = (job.brief or {}).get("picked") or {}  # photos and videos that the user chose with the search field: they are in the list even when no page asks for them
    numbers = {**picked, **((job.brief or {}).get("istock") or {})}
    hidden = set((job.brief or {}).get("slots_hidden") or [])
    found = {}
    for n, c in (job.files or {}).items():
        if not n.endswith((".html", ".css")):
            continue
        text = str(c)
        for m in ALT_REF.finditer(text):
            tag = m.group(0)
            r = PHOTO_REF.search(tag)
            if r:
                alt = re.search(r"""alt=["']([^"']*)["']""", tag, re.I)
                found.setdefault(r.group(1).split("/")[-1].lower(), (alt.group(1).strip() if alt else ""))
        for r in PHOTO_REF.finditer(text):
            found.setdefault(r.group(1).split("/")[-1].lower(), "")
        for m in VIDEO_REF.finditer(text):
            r = VIDEO_SRC.search(m.group(0))
            if r:
                alt = re.search(r"""aria-label=["']([^"']*)["']""", m.group(0), re.I)
                found.setdefault(r.group(1).split("/")[-1].lower(), (alt.group(1).strip() if alt else ""))
    for f, it in picked.items():
        found.setdefault(f, str((it or {}).get("title") or ""))
    out = []
    for f, alt in found.items():
        if f in hidden:
            continue
        words = re.sub(r"[^a-z0-9 ]+", " ", (alt or os.path.splitext(f)[0].replace("-", " ").replace("_", " ")).lower()).split()[:10]
        q = "-".join(words)
        out.append({"file": f, "alt": alt[:160], "query": " ".join(words), "url": (f"https://www.istockphoto.com/{'search/2/film?phrase=' if f.endswith(('.mp4', '.webm')) else 'photos/'}{(q.replace('-', '%20') if f.endswith(('.mp4', '.webm')) else q)}" if q else "https://www.istockphoto.com/photos"), "done": f in have, "extra": f in picked and f not in (job.brief or {}).get("istock", {}), "kind": "video" if f.endswith((".mp4", ".webm")) else "photo", **_istock_of(numbers.get(f))})
    return sorted(out, key=lambda x: (x["done"], x["file"]))


def _istock_of(v):
    """{istock: number, download: address, title} of a stored value (a typed number, or what the AI found: {id, url, title}). A photo of Pexels also has source "pexels" and full (the free photo in full size)."""
    if isinstance(v, dict):
        n, url, title, prev, vid = str(v.get("id") or ""), str(v.get("url") or ""), str(v.get("title") or "")[:160], str(v.get("preview") or ""), str(v.get("video") or "")
        src, full = (v.get("source") if v.get("source") in FREE_SOURCES else "istock"), str(v.get("full") or "")
    else:
        n, url, title, prev, vid, src, full = str(v or ""), "", "", "", "", "istock", ""
    if not n:
        return {"istock": "", "download": "", "title": "", "preview": "", "video": "", "source": "istock", "full": ""}
    return {"istock": n, "download": url or f"https://www.istockphoto.com/search/2/{'film' if vid else 'image'}?phrase={n}", "title": title, "preview": prev, "video": vid, "source": src, "full": full}


def resolve_istock(n):
    """What iStock shows for a photo number: {id, url (the page of the photo), preview (the small watermarked example picture), title}; {} when it is not found. Only istockphoto.com is called."""
    import urllib.request

    try:
        req = urllib.request.Request(f"https://www.istockphoto.com/search/2/image?phrase={int(n)}", headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"})
        with urllib.request.urlopen(req, timeout=15) as r:
            final = r.geturl()
            html = r.read(1_500_000).decode("utf-8", "ignore")
    except Exception:  # noqa: BLE001
        return {}
    if not re.match(r"https://www\.istockphoto\.com/[a-z/]*photo/[^?#]*gm%s" % re.escape(str(int(n))), final):
        return {}
    m = re.search(r"https://media\.istockphoto\.com/id/%s/photo/([a-z0-9-]+)\.jpg\?s=612x612[^\"'\\\s<]*" % re.escape(str(int(n))), html) or re.search(r"https://media\.istockphoto\.com/id/%s/photo/([a-z0-9-]+)\.jpg\?s=\d+x\d+[^\"'\\\s<]*" % re.escape(str(int(n))), html)
    return {"id": str(int(n)), "url": final[:400], "preview": m.group(0).replace("&amp;", "&")[:600] if m else "", "title": (m.group(1).replace("-", " ").capitalize() if m else "")}


def _istock_id(text):
    text = str(text or "")
    m = re.search(r"gm(\d+)", text, re.I) or re.search(r"\d{5,}", text)  # "1234567890", "gm1234567890-123" or a pasted iStock address
    return (m.group(1) if m and m.lastindex else m.group(0)) if m else ""


def _istock_get(url):
    import urllib.request

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.geturl(), r.read(2_500_000).decode("utf-8", "ignore")


def search_istock(query, skip=(), video=False):
    """The best fitting photos that iStock itself shows for a search: [{id, url, preview, title}] in the order of iStock, without the numbers in skip. Only istockphoto.com is called."""
    words = re.sub(r"[^a-z0-9 ]+", " ", str(query or "").lower()).split()[:8]
    q = "-".join(words)
    if not q:
        return []
    try:
        _, html = _istock_get(f"https://www.istockphoto.com/search/2/film?phrase={'%20'.join(words)}" if video else f"https://www.istockphoto.com/photos/{q}")
    except Exception:  # noqa: BLE001
        return []
    out, seen = [], set(skip)
    kind = "video" if video else "photo"
    html = html.replace("\\u0026", "&").replace("&amp;", "&")
    for m in re.finditer(r"/%s/([a-z0-9-]+)-gm(\d{5,14})-(\d+)" % kind, html):
        n = m.group(2)
        if n in seen:
            continue
        seen.add(n)
        if video:
            pm = re.search(r"https://media\.istockphoto\.com/id/%s/video/[a-z0-9-]+\.jpg\?s=\d+x\d+[^\"'\\\s<]*" % n, html)
            vm = re.search(r"https://media\.istockphoto\.com/id/%s/video/[a-z0-9-]+\.mp4\?s=mp4-[^\"'\\\s<]*" % n, html)
            if not vm:
                continue  # without an example film there is nothing to show
        else:
            pm, vm = re.search(r"https://media\.istockphoto\.com/id/%s/photo/[a-z0-9-]+\.jpg\?s=612x612[^\"'\\\s<]*" % n, html), None
        out.append({"id": n, "url": f"https://www.istockphoto.com/{kind}/{m.group(1)}-gm{n}-{m.group(3)}", "preview": pm.group(0)[:600] if pm else "", "video": vm.group(0)[:600] if vm else "", "title": m.group(1).replace("-", " ").capitalize()[:160]})
        if len(out) >= 12:
            break
    return out


FREE_SOURCES = {"pexels": "Pexels", "unsplash": "Unsplash"}  # the free photo sources (each needs its key in Admin -> API keys)
UNSPLASH_HOSTS = {"url": "unsplash.com", "preview": "images.unsplash.com", "full": "images.unsplash.com"}
PEXELS_HOSTS = {"url": "www.pexels.com", "preview": "images.pexels.com", "video": "videos.pexels.com", "full": "images.pexels.com"}


def pexels_key():
    """The API key of Pexels (Admin -> API keys), or "" when it is not linked or switched off."""
    from apps.integrations.models import Integration

    obj = Integration.objects.filter(provider="pexels", enabled=True).order_by("id").first()
    return (obj.config.get("api_key") or "").strip() if obj else ""


def unsplash_key():
    """The Access Key of Unsplash (Admin -> API keys), or "" when it is not linked or switched off."""
    from apps.integrations.models import Integration

    obj = Integration.objects.filter(provider="unsplash", enabled=True).order_by("id").first()
    return (obj.config.get("api_key") or "").strip() if obj else ""


def search_unsplash(query, skip=(), video=False):
    """The best fitting FREE photos that Unsplash shows for a search (photos only, Unsplash has no videos): [{id, url, preview, video, full, title, source}]. Called through the official API (key in Admin -> API keys)."""
    import urllib.parse
    import urllib.request

    key = unsplash_key()
    if not key:
        raise ValueError("Koppel Unsplash eerst bij Admin → API keys (Unsplash, een gratis Access Key van unsplash.com/developers) en zet de koppeling aan.")
    if video:
        return []  # Unsplash has no videos
    words = re.sub(r"[^a-z0-9 ]+", " ", str(query or "").lower()).split()[:8]
    if not words:
        return []
    url = "https://api.unsplash.com/search/photos?" + urllib.parse.urlencode({"query": " ".join(words), "per_page": 15, "orientation": "landscape"})
    try:
        req = urllib.request.Request(url, headers={"Authorization": "Client-ID " + key, "Accept-Version": "v1", "User-Agent": "easy2edit"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read(3_000_000).decode("utf-8", "ignore"))
    except Exception:  # noqa: BLE001
        raise ValueError("Zoeken op Unsplash is niet gelukt. Controleer de Access Key bij Admin → API keys en probeer het nog eens.")
    host = lambda u, h: isinstance(u, str) and re.match(r"https://%s/" % re.escape(h), u)  # noqa: E731
    out, seen = [], {str(x) for x in skip}
    for it in data.get("results") or []:
        n = str(it.get("id") or "")
        urls, page = it.get("urls") or {}, (it.get("links") or {}).get("html") or ""
        prev, full = urls.get("small") or "", urls.get("regular") or ""
        if not re.match(r"^[A-Za-z0-9_-]{5,30}$", n) or n in seen or not host(page, "unsplash.com") or not host(prev, "images.unsplash.com") or not host(full, "images.unsplash.com"):
            continue
        seen.add(n)
        who = str((it.get("user") or {}).get("name") or "")[:60]
        title = (str(it.get("alt_description") or it.get("description") or "").strip() or "Unsplash " + n)[:120]
        out.append({"id": n, "url": page[:400], "preview": prev[:600], "video": "", "full": full[:600], "title": (f"{title} ({who} / Unsplash)" if who else title)[:160], "source": "unsplash", "track": str((it.get("links") or {}).get("download_location") or "")[:600]})
        if len(out) >= 12:
            break
    return out


def search_pexels(query, skip=(), video=False):
    """The best fitting FREE photos or videos that Pexels shows for a search: [{id, url, preview, video, full, title, source}]. Pexels is called through its official API (key in Admin -> API keys)."""
    import urllib.parse
    import urllib.request

    key = pexels_key()
    if not key:
        raise ValueError("Koppel Pexels eerst bij Admin → API keys (Pexels, een gratis sleutel van pexels.com/api) en zet de koppeling aan.")
    words = re.sub(r"[^a-z0-9 ]+", " ", str(query or "").lower()).split()[:8]
    if not words:
        return []
    url = f"https://api.pexels.com/{'videos' if video else 'v1'}/search?" + urllib.parse.urlencode({"query": " ".join(words), "per_page": 15, "orientation": "landscape"})
    try:
        req = urllib.request.Request(url, headers={"Authorization": key, "User-Agent": "easy2edit"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read(3_000_000).decode("utf-8", "ignore"))
    except Exception:  # noqa: BLE001
        raise ValueError("Zoeken op Pexels is niet gelukt. Controleer de sleutel bij Admin → API keys en probeer het nog eens.")
    host = lambda u, h: isinstance(u, str) and re.match(r"https://%s/" % re.escape(h), u)  # noqa: E731
    out, seen = [], {str(x) for x in skip}
    for it in (data.get("videos") if video else data.get("photos")) or []:
        n = str(it.get("id") or "")
        page = it.get("url") or ""
        if not n.isdigit() or n in seen or not host(page, "www.pexels.com"):
            continue
        seen.add(n)
        if video:
            files = [f for f in it.get("video_files") or [] if f.get("file_type") == "video/mp4" and host(f.get("link"), "videos.pexels.com")]
            files.sort(key=lambda f: abs((f.get("width") or 0) - 1280))
            prev = it.get("image") or ""
            if not files or not host(prev, "images.pexels.com"):
                continue
            title = (it.get("url") or "").rstrip("/").split("/")[-1].rsplit("-", 1)[0].replace("-", " ").capitalize()
            out.append({"id": n, "url": page, "preview": prev[:600], "video": files[0]["link"][:600], "full": "", "title": title[:160], "source": "pexels"})
        else:
            src = it.get("src") or {}
            prev, full = src.get("large") or src.get("medium") or "", src.get("large2x") or src.get("large") or ""
            if not host(prev, "images.pexels.com") or not host(full, "images.pexels.com"):
                continue
            out.append({"id": n, "url": page, "preview": prev[:600], "video": "", "full": full[:600], "title": str(it.get("alt") or "")[:160] or "Pexels " + n, "source": "pexels"})
        if len(out) >= 12:
            break
    return out


def _clean_pick(item):
    """(number, address, example picture, video, full, source) of a photo or video that the user chose in the search field; only addresses of iStock or Pexels are accepted."""
    item = item if isinstance(item, dict) else {}
    url, prev, vid, full = str(item.get("url") or ""), str(item.get("preview") or ""), str(item.get("video") or ""), str(item.get("full") or "")
    ok = lambda u, host: not u or re.match(r"https://%s/" % re.escape(host), u)  # noqa: E731
    if item.get("source") == "pexels":
        n = str(item.get("id") or "")
        if not (n.isdigit() and 1 <= len(n) <= 14) or not url or not all(ok(item.get(k) or "", h) for k, h in PEXELS_HOSTS.items()):
            raise ValueError("Deze foto komt niet van Pexels.")
        return n, url, prev, vid, full, "pexels"
    if item.get("source") == "unsplash":
        n = str(item.get("id") or "")
        if not re.match(r"^[A-Za-z0-9_-]{5,30}$", n) or not url or not all(ok(item.get(k) or "", h) for k, h in UNSPLASH_HOSTS.items()):
            raise ValueError("Deze foto komt niet van Unsplash.")
        return n, url, prev, vid, full, "unsplash"
    n = _istock_id(item.get("id"))
    if not (5 <= len(n) <= 14) or not url or not ok(url, "www.istockphoto.com") or not ok(prev, "media.istockphoto.com") or not ok(vid, "media.istockphoto.com"):
        raise ValueError("Deze foto komt niet van iStock.")
    return n, url, prev, vid, "", "istock"


def _pick_entry(item):
    n, url, prev, vid, full, src = _clean_pick(item)
    e = {"id": n, "url": url[:400], "preview": prev[:600], "video": vid[:600], "title": str(item.get("title") or "")[:160]}
    if src in FREE_SOURCES:
        e.update(source=src, full=full[:600])
    if src == "unsplash" and re.match(r"https://api\.unsplash\.com/", str(item.get("track") or "")):
        e["track"] = str(item["track"])[:600]  # Unsplash wants to hear that a photo is used
    return e


def photo_source(job):
    """Where the designer searches photos and videos for this design: "pexels" (free, the default) or "istock". Pexels needs its key (Admin -> API keys): without it iStock is used."""
    want = (job.brief or {}).get("photo_source") or "pexels"
    keys = {"pexels": pexels_key, "unsplash": unsplash_key}
    if want in keys and keys[want]():
        return want
    return next((k for k in ("pexels", "unsplash") if keys[k]()), "istock") if want != "istock" else "istock"


def set_photo_source(job, source):
    """Remember the choice of the user (Pexels or iStock) in the design: the automatic searches follow it."""
    if source not in ("pexels", "unsplash", "istock"):
        return job
    b = dict(job.brief or {})
    if b.get("photo_source") != source:
        b["photo_source"] = source
        SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
        job = SiteDesignJob.objects.get(pk=job.pk)
    return job


def search_photos(job, query, skip=(), video=False):
    """The search of the chosen source; an automatic search never fails (no result instead)."""
    try:
        src = photo_source(job)
        return (search_pexels if src == "pexels" else search_unsplash if src == "unsplash" else search_istock)(query, skip=skip, video=video)
    except Exception:  # noqa: BLE001
        return []


def _pick_from(hit, title=""):
    """What is stored for a found item (with source and full size for Pexels), with a title."""
    e = {k: hit.get(k, "") for k in ("id", "url", "preview", "video")}
    e["title"] = title or hit.get("title") or ""
    if hit.get("source") in FREE_SOURCES:
        e.update(source=hit["source"], full=hit.get("full", ""))
        if hit.get("track"):
            e["track"] = hit["track"]
    return e


def find_istock(job):
    """For every open photo slot iStock is searched (with the description of the photo) and the best fitting photo is given: number, address and an example picture. Slots that have a number without an example picture get the picture. Photos are not used twice. Returns the job; the number of new photos is in job.found."""
    b = dict(job.brief or {})
    d = dict(b.get("istock") or {})
    used = {_istock_of(v)["istock"] for v in d.values()}
    found = 0
    for x in photo_slots(job):
        if x["done"]:
            continue
        if x["istock"]:
            if not x["preview"] and x["kind"] == "photo":
                got = resolve_istock(x["istock"])
                if got:
                    d[x["file"]] = got
                    found += 1
            continue
        hit = next(iter(search_photos(job, x["alt"] or x["query"], skip=used, video=x["kind"] == "video")), None)
        if hit:
            d[x["file"]] = _pick_from(hit)
            used.add(hit["id"])
            found += 1
    b["istock"] = d
    b["istock_tried"] = True
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    job = SiteDesignJob.objects.get(pk=job.pk)
    job.found = found
    return job


def set_istock(job, file, number):
    """Remember the iStock number (the id of the photo on iStock) of a slot; empty removes it. The download link of the slot is made from it."""
    file = str(file or "").split("/")[-1].lower()
    text = str(number or "")
    number = _istock_id(text)
    if text.strip() and not number:
        raise ValueError("Een iStock-nummer bestaat uit 5 tot 14 cijfers.")
    if not any(x["file"] == file for x in photo_slots(job)):
        raise ValueError("Deze plek bestaat niet (meer).")
    if number and not 5 <= len(number) <= 14:
        raise ValueError("Een iStock-nummer bestaat uit 5 tot 14 cijfers.")
    b = dict(job.brief or {})
    d = dict(b.get("istock") or {})
    if number:
        d[file] = number if file.endswith((".mp4", ".webm")) else (resolve_istock(number) or number)
    else:
        d.pop(file, None)
    b["istock"] = d
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def set_slot(job, file, media_id):
    """Put a photo of the media library (uploaded by the user) in a slot of the pages: from now on the file name of the slot shows this photo."""
    from apps.medialib.models import MediaItem

    file = str(file or "").split("/")[-1].lower()
    if not any(x["file"] == file for x in photo_slots(job)):
        raise ValueError("Deze plek bestaat niet (meer).")
    video = file.endswith((".mp4", ".webm"))
    m = MediaItem.objects.filter(pk=media_id, kind="video" if video else "image").first()
    if not m:
        raise ValueError("Deze video is niet gevonden. Upload hem opnieuw." if video else "Deze foto is niet gevonden. Upload hem opnieuw.")
    b = dict(job.brief or {})
    store = "videos" if video else "photos"  # videos live apart from the photos (the photo list is checked against the images of the library)
    photos = [p for p in b.get(store) or [] if p.get("file") != file]
    if len(photos) >= (3 if video else MAX_PHOTOS):
        raise ValueError("Er kunnen niet meer video's bij." if video else "Er kunnen niet meer foto's bij.")
    alt = next((x["alt"] for x in photo_slots(job) if x["file"] == file), "")
    photos.append({"id": m.id, "file": file, "name": m.name[:120], "url": default_storage.url(m.key), "note": alt[:200]})
    b[store] = photos
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def fictional_answer(job, question, name="", what="", lang=""):
    """The customer typed @ and Enter in a field of the questionnaire: the AI invents fictional but believable data for that question (for a company like this one), so the design can be tried out. Only example addresses and numbers."""
    question = str(question or "").strip()[:240]
    if len(question) < 3:
        raise ValueError("Er is geen vraag.")
    if not ai.available():
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    ui = re.sub(r"[^A-Za-z-]", "", str(lang or (job.brief or {}).get("ui_lang") or ""))[:10]
    lg = Language.objects.filter(code=ui).first() if ui else None
    prompt = (f"Question of a questionnaire for a new website: {question}\nCompany name: {str(name or (job.brief or {}).get('name') or '-')[:120]}\nWhat it does: {str(what or '-')[:400]}\n\n"
              f"Write a short, realistic but FICTIONAL answer for this question, as the customer could have filled it in (for contact details: an invented address, telephone number and e-mail address; use only example domains such as example.com and fictional numbers). "
              f"Language: {(lg.name if lg else ui) or 'the language of the question'}. Max 300 characters, no explanation, no quotes: only the answer text.")
    with __import__("apps.integrations.aiusage", fromlist=["x"]).for_ref(_ref_of(job.pk)):
        out = ai.claude("You invent fictional sample data for a website questionnaire. Reply with only the answer text.", prompt, max_tokens=300, timeout=40)
    text = " ".join(str(out or "").split()).strip().strip('"')[:300]
    if not text:
        raise ValueError("De AI kon geen gegevens bedenken.")
    return text


def search_terms(name, what, kind="photo"):
    """From what the customer filled in about the company (name, what it offers and to whom): 4 to 6 English iStock search phrases for fitting photos (or videos). [] without an AI link or on an error."""
    what = str(what or "").strip()[:400]
    name = str(name or "").strip()[:120]
    if len(what) + len(name) < 4 or not ai.available():
        return []
    try:
        out = ai.claude("You choose search phrases for the stock photo site iStock. Reply with ONLY a JSON object.",
                        f"Company: {name or '-'}\nWhat it does and for whom: {what or '-'}\n\nGive 4 to 6 search phrases in English (2 to 4 words each) for {'calm, short background videos' if kind == 'video' else 'photos'} that fit the website of this company: concrete subjects and settings, no brand names, no people's names. "
                        'Answer: {"terms": ["phrase 1", "phrase 2"]}', max_tokens=300, timeout=40)
        m = re.search(r"\{.*\}", out or "", re.S)
        terms = (json.loads(m.group(0)) if m else {}).get("terms") or []
    except Exception:  # noqa: BLE001
        logger.warning("search terms failed", exc_info=True)
        return []
    return [str(t).strip()[:60] for t in terms if isinstance(t, str) and len(str(t).strip()) >= 3][:6]


def add_own_media(job, media_id, role="media"):
    """The customer dropped his own logo, photo or video in the questionnaire: it goes in the project (the photo list or the video list) and the designer is told to use it. role "logo": the company logo (one)."""
    from apps.medialib.models import MediaItem

    if job.status not in ("draft", "done", "error"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    m = MediaItem.objects.filter(pk=media_id, kind__in=("image", "video")).first()
    if not m:
        raise ValueError("Dit bestand is niet gevonden. Upload het opnieuw.")
    b = dict(job.brief or {})
    video = m.kind == "video"
    if video and role == "logo":
        raise ValueError("Een logo is een afbeelding.")
    store = "videos" if video else "photos"
    lst = list(b.get(store) or [])
    if any(x.get("id") == m.id for x in lst):
        return job
    taken = {x["file"] for x in [*b.get("photos", []), *b.get("videos", [])]}
    if video:
        if len(lst) >= 3:
            raise ValueError("Er kunnen niet meer video's bij.")
        ext = os.path.splitext(m.name)[1].lstrip(".").lower()
        base = re.sub(r"[^a-z0-9_-]+", "-", os.path.splitext(get_valid_filename(m.name).lower())[0]).strip("-_")[:R.NAME_MAX] or "video"
        f, n = f"{base}.{ext if ext in ('mp4', 'webm') else 'mp4'}", 2
        while f in taken:
            f, n = f"{base}-{n}.{ext if ext in ('mp4', 'webm') else 'mp4'}", n + 1
        note = "Own video of the customer: use it as a calm background or block where it fits."
    else:
        if role == "logo":
            lst = [x for x in lst if not str(x.get("file", "")).startswith("logo.")]  # one logo
            taken = {x["file"] for x in lst}
            ext = os.path.splitext(m.name)[1].lstrip(".").lower()
            f = f"logo.{ext if ext in IMG_OK else 'png'}"
            note = "LOGO of the company: use it as the logo in the header and the footer instead of a text mark."
        else:
            if len(lst) >= MAX_PHOTOS:
                raise ValueError("Er kunnen niet meer foto's bij.")
            f = photo_file(m.name, taken)
            note = "Own photo of the customer: use it where it fits."
    lst.append({"id": m.id, "file": f, "name": m.name[:120], "url": default_storage.url(m.key), "note": note})
    b[store] = lst
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def remove_own_media(job, file):
    b = dict(job.brief or {})
    f = str(file or "").split("/")[-1].lower()
    for store in ("photos", "videos"):
        b[store] = [x for x in b.get(store) or [] if x.get("file") != f]
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def set_istock_pick(job, file, item):
    """A photo (or video) that the user found with the search field of iStock goes to a slot: number, address, example picture and title. Only addresses on iStock are accepted."""
    file = str(file or "").split("/")[-1].lower()
    slot = next((x for x in photo_slots(job) if x["file"] == file), None)
    if not slot:
        raise ValueError("Deze plek bestaat niet (meer).")
    entry = _pick_entry(item)
    vid = entry["video"]
    if (slot["kind"] == "video") != bool(vid):
        raise ValueError("Kies een video voor een video-plek en een foto voor een foto-plek.")
    b = dict(job.brief or {})
    d = dict(b.get("istock") or {})
    d[file] = entry
    b["istock"] = d
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def add_pick(job, item):
    """A photo or video that the user found with the search field is ADDED to the list (also when no page asks for it yet). Only addresses on iStock are accepted."""
    entry = _pick_entry(item)
    n, vid = entry["id"], entry["video"]
    b = dict(job.brief or {})
    d = dict(b.get("picked") or {})
    file = f"{entry.get('source', 'istock')}-{n}.{'mp4' if vid else 'jpg'}"
    if file not in d and len(d) >= 30:
        raise ValueError("De lijst is vol (30). Haal eerst iets weg.")
    d[file] = entry
    b["picked"] = d
    b["slots_hidden"] = [x for x in b.get("slots_hidden") or [] if x != file]
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def use_preview(job, file, user):
    """Download the example (with the watermark) that iStock shows for the photo or the video of a slot, put it in the media library and in the slot, so the website shows a real picture or film until the licensed one is there."""
    import urllib.request
    import uuid as _uuid

    from apps.medialib.models import MediaItem

    file = str(file or "").split("/")[-1].lower()
    slot = next((x for x in photo_slots(job) if x["file"] == file), None)
    if not slot:
        raise ValueError("Deze plek bestaat niet (meer).")
    video = slot["kind"] == "video"
    src = slot.get("source") if slot.get("source") in FREE_SOURCES else "istock"
    pexels = src != "istock"  # a photo of Pexels or Unsplash is free: the real photo in full size, not a watermarked example
    url = (slot.get("video") if video else (slot.get("full") if pexels and slot.get("full") else slot.get("preview"))) or ""
    if not re.match({"pexels": r"https://(videos|images)\.pexels\.com/", "unsplash": r"https://images\.unsplash\.com/"}.get(src, r"https://media\.istockphoto\.com/id/\d+/"), url):
        raise ValueError("Er is nog geen voorbeeld van " + FREE_SOURCES.get(src, "iStock") + " voor deze plek. Zoek eerst een " + ("video." if video else "foto."))
    cap = 40_000_000 if video else (15_000_000 if pexels else 8_000_000)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Referer": {"pexels": "https://www.pexels.com/", "unsplash": "https://unsplash.com/"}.get(src, "https://www.istockphoto.com/")})
        with urllib.request.urlopen(req, timeout=60 if video else 20) as r:
            data = r.read(cap + 1)
    except Exception:  # noqa: BLE001
        raise ValueError("Het voorbeeld van iStock kon niet worden gehaald. Probeer het nog eens.")
    if len(data) > cap:
        raise ValueError("Het voorbeeld is te groot.")
    if video:
        ext = "mp4" if data[4:8] == b"ftyp" else None  # an mp4 starts with the box "ftyp"
    else:
        try:
            from PIL import Image

            im = Image.open(io.BytesIO(data))
            im.verify()
            ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(im.format)
        except Exception:  # noqa: BLE001
            ext = None
    if not ext:
        raise ValueError("Het voorbeeld van iStock is geen geldige " + ("video." if video else "afbeelding."))
    name = f"{src}-{slot['istock']}.{ext}" if pexels else f"istock-{slot['istock']}-voorbeeld.{ext}"
    key = default_storage.save(areas.site_path("library", f"{date.today():%Y/%m}/{_uuid.uuid4().hex[:8]}-{get_valid_filename(name)}"), ContentFile(data))
    item = MediaItem.objects.get(key=key)
    item.name, item.uploaded_by = name[:255], user
    item.tags = ["design", src]
    item.save(update_fields=["name", "uploaded_by", "tags"])
    if src == "unsplash":  # the rules of Unsplash: tell them a photo is used (the download address that came with the search)
        try:
            bb = job.brief or {}
            track = str(((bb.get("istock") or {}).get(file) or (bb.get("picked") or {}).get(file) or {}).get("track") or "")
            key = unsplash_key()
            if key and re.match(r"https://api\.unsplash\.com/", track):
                urllib.request.urlopen(urllib.request.Request(track, headers={"Authorization": "Client-ID " + key, "User-Agent": "easy2edit"}), timeout=10).read(1000)
        except Exception:  # noqa: BLE001
            pass
    return set_slot(job, file, item.id)


def hide_slot(job, file):
    """Take a photo slot out of the list (the page keeps its grey tile)."""
    file = str(file or "").split("/")[-1].lower()
    b = dict(job.brief or {})
    b["slots_hidden"] = sorted(set(b.get("slots_hidden") or []) | {file})[:200]
    if file in (b.get("picked") or {}):  # a chosen photo is taken out of the list for good
        b["picked"] = {k: v for k, v in b["picked"].items() if k != file}
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def clear_slot(job, file):
    b = dict(job.brief or {})
    f = str(file or "").split("/")[-1].lower()
    b["photos"] = [p for p in b.get("photos") or [] if p.get("file") != f]
    b["videos"] = [p for p in b.get("videos") or [] if p.get("file") != f]
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


CHAT_SYSTEM = """You are the website designer of easy2edit, talking with a customer in a chat. Together you design a complete website that is built from the ready-made components, modules and system objects of easy2edit.
Be friendly, short and concrete (2-4 sentences), in the language of the customer.
QUESTIONS: when the request is short or vague (for example only "make a website for an accountancy firm"), do NOT ask one question at a time and do not start designing: ask a QUESTIONNAIRE in the same answer: 6 to 9 questions that fit this kind of business, each with ready-made answer options that the customer can click (and a sensible default). ALWAYS start with these two questions, in this order: 1. the name of the company or organisation (id "name", type "text"), 2. the address (url) of the current website, if there is one (id "url", type "text", the customer may leave it empty; when given, use it as a source for the offer, texts and tone). Then think of what a good designer needs to know, for example: what exactly does the business offer and for whom (text), the feeling of the style (options), light, dark or both (light/dark mode), which other languages the website needs (multi choice of common languages, default none), the maximum width of the content (ask this BEFORE the page layout; give it the id "width", choice: narrow 960, standard 1100, wide 1280, extra wide 1440, whole screen; default 1100), which page layout (give this question the id "layout" and type "multi": the system shows it as a carousel of pictures, so the options may be short; it offers:  full width, text next to image, wide with narrow side column, three columns, four blocks, varied rhythm with tinted bands, full-screen opening; default varied rhythm), which pages (give this question the id "pages" and type "multi": fitting pages with a sensible default selection; the system adds the option "One pager (alles op één pagina)" at the front, which excludes the others), which extra functions fit this kind of business (multi choice: FAQ, agenda/appointments, webshop, community, documents/downloads, newsletter, contact form ...), the colours (give this question the id "colors" and type "choice"; the system shows the colour themes of the system as a carousel and sends the chosen theme with its hex colours: use exactly those colours; your options may be just "my own: tell me" and a few palette names), whether there is a logo (give this question the id "logo": the system shows a drop zone where the customer drops his logo, which is then in the project; he can also type the brand name), photos and videos (give this question the id "media" and type "text": the system shows an iStock search where the customer finds and chooses photos and videos; the chosen ones are put in his list and come back in his answer as "iStock <number>"; when he chose some or says yes, set istock_search true in the brief; when he chose none, you may still look for fitting ones yourself unless he says not to; the customer downloads them himself with an iStock licence; below the search the system also shows a drop zone for his own photos and videos, which are put in the project and mentioned in his answer),  the main goal of the website (call to action: appointment, quote, call, buy ...), and contact details to show (text). Use "type": "choice" (one answer), "multi" (several answers) or "text" (free text).
When the customer has already given a lot of detail, ask only what is missing (at most 3 questions) or go on. When you know enough, or the customer answered the questionnaire or says to decide yourself, set "ready" to true: the website is then designed at once and shown on the right. Everything that was not answered you decide yourself and say what you chose; the customer can change it afterwards in the chat.
Photos: the website uses photos that the customer downloads from iStock (istockphoto.com) himself; you only say what is needed, never claim to supply photos.
Answer with ONLY a JSON object: {"reply": "your message to the customer", "ready": true|false, "questions": [{"id": "short_id", "q": "the question", "type": "choice|multi|text", "options": ["option 1", "option 2"], "default": "option or [options] or empty"}] (only when you ask questions; otherwise []), "brief": {"name": "name of the website", "kind": "company|shop|community|agenda|blog|portfolio|club", "lang": "language of the texts, e.g. Dutch", "pages": "Home, Over ons, Diensten, Contact (comma separated, 3-8 pages, the first is the start page; when the customer chose a one pager: only \"Home\")", "style": "one sentence about the look and feel", "extra": "everything else the customer told you that matters for texts and content (offer, audience, tone, address, opening hours ...)", "colors": {"primary": "#rrggbb main colour", "secondary": "#rrggbb second colour", "bg": "#rrggbb page background", "card": "#rrggbb cards", "text": "#rrggbb text"} (choose colours that fit the business and the feeling of the style; use the colours the customer names; with good contrast), "font": "sans|serif|round", "radius": 0-24 (corners in px), "max_width": 960|1100|1280|1440|0 (maximum width of the content in px, 0 = whole screen), "layouts": ["full|split|wide_narrow|three|four|rhythm|screen" (the page layouts the customer chose; [] when nothing was chosen)], "color_mode": "light|dark|both", "langs": ["language codes of the OTHER languages, e.g. en, de; [] for none"], "lang_switch": true|false, "istock_search": true|false (true when the customer allows you to look for photos and videos on iStock), "modules_off": []}}
The "brief" is only needed when "ready" is true."""


def clean_questions(raw):
    """The questions of the designer for the customer, checked: [{id, q, type: choice|multi|text, options, default}], at most 10."""
    out = []
    for x in (raw if isinstance(raw, list) else [])[:10]:
        if not isinstance(x, dict) or not str(x.get("q") or "").strip():
            continue
        t = x.get("type") if x.get("type") in ("choice", "multi", "text") else "text"
        opts = [str(o).strip()[:80] for o in (x.get("options") or []) if str(o).strip()][:12] if t != "text" else []
        if t != "text" and not opts:
            t = "text"
        dflt = x.get("default")
        dflt = [str(v)[:80] for v in dflt][:12] if isinstance(dflt, list) else str(dflt or "")[:200]
        out.append({"id": re.sub(r"[^a-z0-9_]", "", str(x.get("id") or f"q{len(out) + 1}").lower())[:30] or f"q{len(out) + 1}", "q": str(x["q"]).strip()[:240], "type": t, "options": opts, "default": dflt})
    return out


def auto_photos(pk, job):
    """Before the design: the designer looks for fitting photos (and at most one calm video) on iStock, makes a selection and puts it in the list of the customer. The design then uses them. Never fails: no result = the design goes on without."""
    b = dict(job.brief or {})
    try:
        _set(pk, progress=5, step="Passende foto's zoeken op iStock")
        out = _ask(SECTION_JSON, f"{_brief_text(b)}\n\nPlan the photos for this website: 6 to 8 searches for iStock, each with English search words that describe the photo concretely (subject, setting, mood; no brand names), the purpose (hero, team, office, service, customer, detail ...) and kind \"photo\" (at most ONE \"video\": a calm hero background). "
                   'Answer: {"searches": [{"query": "english words", "purpose": "hero", "kind": "photo"}]}', max_tokens=2000, pk=pk)
        m = re.search(r"\{.*\}", out or "", re.S)
        searches = [s for s in ((json.loads(m.group(0)) if m else {}).get("searches") or []) if isinstance(s, dict) and str(s.get("query") or "").strip()][:8]
    except Stopped:
        raise
    except Exception:  # noqa: BLE001
        logger.warning("iStock plan failed", exc_info=True)
        return job
    picked = dict(b.get("picked") or {})
    used = {str((v or {}).get("id")) for v in picked.values()}
    videos = 0
    for n, s in enumerate(searches):
        video = s.get("kind") == "video" and videos < 1
        _set(pk, progress=6, step=f"Foto's zoeken op {FREE_SOURCES.get(photo_source(SiteDesignJob.objects.get(pk=pk)), 'iStock')} ({n + 1} van {len(searches)})")
        try:
            hit = next(iter(search_photos(SiteDesignJob.objects.get(pk=pk), str(s["query"]), skip=used, video=video)), None)
        except Exception:  # noqa: BLE001
            hit = None
        if hit and len(picked) < 30:
            picked[f"{hit.get('source', 'istock')}-{hit['id']}.{'mp4' if video else 'jpg'}"] = _pick_from(hit, str(s.get("purpose") or "")[:40] + (": " if s.get("purpose") else "") + str(hit.get("title") or "")[:120])
            used.add(hit["id"])
            videos += 1 if video else 0
    if picked != (b.get("picked") or {}):
        b["picked"] = picked
        SiteDesignJob.objects.filter(pk=pk).update(brief=b, updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=pk)


def normalise_galleries(html):
    """Photos together are ONE photo carousel (the media system object of easy2edit), in the markup that the importer knows: <div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery"><img>...</div></div>.
    A row of photos in a "logos" row, and a gallery with wrappers around the pictures, are made like that. Real logos (svg) stay a logos row."""
    def imgs_of(inner):
        return re.findall(r"<img\b[^>]*>", inner, re.I)

    def gallery(imgs):
        return '<div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery">' + "".join(imgs) + "</div></div>"

    def logos(m):
        imgs = imgs_of(m.group(1))
        photos = [i for i in imgs if re.search(r"""src=["'][^"']+\.(?:jpe?g|png|webp)["']""", i, re.I)]
        return gallery(photos) if len(imgs) >= 3 and len(photos) == len(imgs) else m.group(0)

    html = re.sub(r"""<div\b[^>]*class=["'][^"']*\be2e-logos\b[^"']*["'][^>]*>((?:\s*<img\b[^>]*>){3,}\s*)</div>""", logos, html or "", flags=re.I)

    # a gallery (with or without the tag, with or without wrappers): rebuilt from its pictures
    out, pos = [], 0
    for m in re.finditer(r"""<div\b[^>]*class=["'][^"']*\be2e-gallery\b[^"']*["'][^>]*>""", html, re.I):
        if m.start() < pos:
            continue
        depth, i = 1, m.end()
        for t in re.finditer(r"</?div\b[^>]*>", html[m.end():], re.I):
            depth += -1 if t.group(0).startswith("</") else 1
            if depth == 0:
                i = m.end() + t.end()
                break
        else:
            continue
        inner = html[m.end():i - len("</div>")]
        imgs = imgs_of(inner)
        if len(imgs) < 2:
            continue
        start = m.start()
        pre = re.search(r"""<div\b[^>]*data-easy2edit-tag=["']ui-gallery["'][^>]*>\s*$""", html[:start], re.I)
        tail = re.match(r"\s*</div>", html[i:]) if pre else None
        if pre and tail:
            start, i = pre.start(), i + tail.end()
        out.append(html[pos:start] + gallery(imgs))
        pos = i
    return "".join(out) + html[pos:] if out else html


def _without_missing_svgs(html, files):
    """The designer refers to pictures (img/logo-client-1.svg) that it does not make: such a tag becomes its text (the alt), so there is no broken picture and no request that ends in a 404."""
    def fix(m):
        tag = m.group(0)
        src = re.search(r"""src=["']([^"']+\.svg)["']""", tag, re.I) or re.search(r"""src=["'](img/[^"']*logo[^"']*\.(?:jpe?g|png|webp|gif))["']""", tag, re.I)  # (a made-up logo of a partner or client as a photo: no photo exists for it, iStock has none)
        if not src or src.group(1).startswith(("http:", "https:", "data:", "/")) or src.group(1) in files:
            return tag
        if not src.group(1).lower().endswith(".svg") and os.path.basename(src.group(1)).lower().startswith("logo."):
            return tag  # the logo of the customer himself (dropped in the questionnaire): that file is added by the system
        alt = re.search(r"""alt=["']([^"']*)["']""", tag, re.I)
        return f"<span>{alt.group(1)}</span>" if alt and alt.group(1).strip() else ""

    return re.sub(r"<img\b[^>]*>", fix, html or "", flags=re.I)


def assign_unused_picked(job):
    """The pages ask for pictures (img/backoffice.jpg) that have none yet, while the customer chose more photos than the pages use: the unused chosen photos go in the empty places (the example picture follows in auto_previews)."""
    b = job.brief or {}
    picked = b.get("picked") or {}
    html = " ".join(str(v) for k, v in (job.files or {}).items() if k.endswith((".html", ".css")))
    unused = [(f, it) for f, it in picked.items() if f not in html and it and it.get("preview") and not it.get("video")]
    empty = [x for x in photo_slots(job) if x["kind"] == "photo" and not x["done"] and not x["istock"] and not x.get("extra") and "logo" not in x["file"]]
    n = 0
    for x, (f, it) in zip(empty, unused):
        try:
            job = set_istock_pick(job, x["file"], _pick_from(it, x["alt"] or it.get("title") or ""))
            n += 1
        except ValueError:
            continue
    return job, n


def auto_previews(pk):
    """After the design: the example pictures (with watermark) of the chosen iStock photos that the pages use are put in the pictures of the design, so the preview shows real photos at once. Never fails."""
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        for x in photo_slots(job):
            if x.get("kind") == "photo" and x.get("preview") and not x.get("done"):
                _set(pk, step=f"Voorbeeldfoto's ophalen ({x['file']})")
                try:
                    job = use_preview(job, x["file"], job.user)
                except ValueError:
                    continue
    except Exception:  # noqa: BLE001
        logger.warning("auto previews failed", exc_info=True)


def _ref_of(pk):
    """What the AI calls of a design are marked with (short: the field holds 40 characters)."""
    return "d:" + str(pk).replace("-", "")


ACTIVE = set()  # the designs that are being worked on in THIS process (a restart of the server empties it: then a design that says "running" is stuck)


def _run_for(fn, pk, args):
    """Work in the background for a design: every AI call inside is counted for that design."""
    from apps.integrations import aiusage

    ACTIVE.add(pk)
    try:
        with aiusage.for_ref(_ref_of(pk)):
            fn(*args)
        row = SiteDesignJob.objects.filter(pk=pk).values("status").first()  # the work ended but the design still says "running": say so, never hang
        if row and row["status"] in ("running", "stopping"):
            SiteDesignJob.objects.filter(pk=pk).update(status="error", progress=100, step="", error="Het ontwerpen stopte onverwacht, zonder melding. Probeer het nog eens.", updated_at=timezone.now())
    except Exception as e:  # noqa: BLE001 - an error is caught and reported on the design (the window shows it), never swallowed
        logger.exception("design work failed")
        msg = str(e).strip() or type(e).__name__
        SiteDesignJob.objects.filter(pk=pk).update(status="error", progress=100, step="", error=f"Er ging iets mis: {msg[:300]}", updated_at=timezone.now())
    finally:
        ACTIVE.discard(pk)


def _spawn(fn, pk, *args):
    try:  # what runs is kept, so a design that got stuck (the server was restarted) can go on
        row = SiteDesignJob.objects.filter(pk=pk).first()
        if row:
            b = dict(row.brief or {})
            b["run"] = {"fn": fn.__name__, "args": [a for a in args if isinstance(a, (str, int, bool)) or a is None]}
            SiteDesignJob.objects.filter(pk=pk).update(brief=b)
    except Exception:  # noqa: BLE001
        logger.warning("run not kept", exc_info=True)
    threading.Thread(target=_run_for, args=(fn, pk, (pk, *args)), daemon=True).start()


def is_stalled(job):
    """The design says "running" but nothing works on it any more (no worker in this process and no sign of life for a minute): the server was restarted or the work died."""
    return job.status in ("running", "stopping") and job.pk not in ACTIVE and timezone.now() - job.updated_at > timezone.timedelta(seconds=60)


def resume(job):
    """Go on with what was running when it got stuck."""
    if not is_stalled(job):
        raise ValueError("Het ontwerpen loopt nog.")
    run = (job.brief or {}).get("run") or {}
    fns = {"_generate": _generate, "_chat": _chat, "_revise": _revise, "_more_photos": _more_photos, "_read_document": _read_document}
    fn, args = fns.get(run.get("fn")), list(run.get("args") or [])
    if not fn:  # (it started before the work was kept) see where the chat stands
        last = (job.messages or [])[-1] if job.messages else None
        has = any(n.endswith(".html") for n in (job.files or {}))
        if last and last.get("role") == "user":
            fn, args = _chat, [str(last.get("text") or ""), has]  # the answer of the designer was still to come
        elif last and last.get("role") == "ai" and not has and (job.brief or {}).get("chat") and str((job.brief or {}).get("name") or "").strip():
            fn, args = _generate, []  # the designer was ready: the website was being designed
    if not fn:
        raise ValueError("Er is niets om mee door te gaan. Stop het en begin opnieuw.")
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", step="Verder gaan", error="", updated_at=timezone.now())
    _spawn(fn, job.pk, *args)


def more_photos(job):
    """After the design: the places where the pages ask for a picture and that still have none (no photo, no iStock choice): the designer searches iStock for each of them and puts the best fit in the design. Runs in the background."""
    if job.status not in ("done", "error", "draft"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    if not [x for x in photo_slots(job) if x["kind"] == "photo" and not x["done"] and "logo" not in x["file"]]:
        raise ValueError("Er ontbreken geen afbeeldingen.")
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", progress=5, step="Meer afbeeldingen zoeken", error="", updated_at=timezone.now())
    _spawn(_more_photos, job.pk)


def _more_photos(pk):
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        job, placed = assign_unused_picked(job)  # first the photos that were chosen and are not used yet, only then a new search
        if placed:
            _set(pk, step="De gekozen foto's plaatsen", progress=20)
        for x in [x for x in photo_slots(job) if x["kind"] == "photo" and not x["done"] and x["istock"] and not x.get("preview") and "logo" not in x["file"]]:
            got = resolve_istock(x["istock"])  # a photo was chosen but its example picture was never found: look it up again
            if got.get("preview"):
                try:
                    set_istock_pick(SiteDesignJob.objects.get(pk=pk), x["file"], {**got, "title": x["alt"] or got.get("title") or ""})
                except ValueError:
                    continue
        job = SiteDesignJob.objects.get(pk=pk)
        empty = [x for x in photo_slots(job) if x["kind"] == "photo" and not x["done"] and not x["istock"] and "logo" not in x["file"]][:20]  # (a logo of a partner or customer is not a photo: iStock has no fitting picture)
        used = {str(x.get("istock") or "") for x in photo_slots(job)}
        for n, x in enumerate(empty):
            _set(pk, progress=5 + int(80 * n / max(1, len(empty))), step=f"Afbeeldingen zoeken op {FREE_SOURCES.get(photo_source(job), 'iStock')} ({n + 1} van {len(empty)})")
            try:
                hit = next(iter(search_photos(job, x["query"] or x["alt"] or x["file"], skip=used)), None)
            except Exception:  # noqa: BLE001
                hit = None
            if hit:
                try:
                    set_istock_pick(SiteDesignJob.objects.get(pk=pk), x["file"], _pick_from(hit, x["alt"] or x["query"]))
                    used.add(str(hit["id"]))
                except ValueError:
                    continue
        _set(pk, step="Voorbeeldfoto's ophalen", progress=90)
        auto_previews(pk)
    except Exception:  # noqa: BLE001
        logger.warning("more photos failed", exc_info=True)
    finally:
        _set(pk, status="done", progress=100, step="")


def footer_columns_of(html):
    """The link columns of the footer of the design: [{title, links: [{label, url}]}] (a column is a heading with a list of links). Addresses of the design become addresses of the website: #about -> /#about, index.html -> /, about.html -> /about."""
    m = re.search(r"<footer\b[^>]*>(.*?)</footer>", html or "", re.S | re.I)
    foot = m.group(1) if m else ""

    def url(h):
        h = (h or "").strip()
        if h.startswith("#"):
            return "/" + h
        if re.fullmatch(r"(?:\./)?index\.html(#.*)?", h):
            return "/" + (re.search(r"#.*", h).group(0) if "#" in h else "")
        r = re.fullmatch(r"(?:\./)?([a-z0-9_-]+)\.html(#.*)?", h)
        return f"/{r.group(1)}{r.group(2) or ''}" if r else h

    cols = []
    for head, body in re.findall(r"<h[3-5]\b[^>]*>(.*?)</h[3-5]>\s*<ul\b[^>]*>(.*?)</ul>", foot, re.S | re.I):
        title = " ".join(re.sub(r"<[^>]+>", " ", head).split())
        links = [{"label": " ".join(re.sub(r"<[^>]+>", " ", t).split()), "url": url(h)} for h, t in re.findall(r"<a\b[^>]*href=[\"']([^\"']*)[\"'][^>]*>(.*?)</a>", body, re.S | re.I)]
        links = [x for x in links if x["label"] and x["url"]]
        if title and links:
            cols.append({"title": title, "links": links})
    return cols


def brand_of(html):
    """The text mark in the header of the design: ("Blue", "BPS") for <a class="e2e-nav__brand">Blue<b>BPS</b></a> (the bold part gets the accent colour); ("", "") when there is none."""
    m = re.search(r"<header\b[^>]*>.*?<a\b[^>]*class=[\"'][^\"']*brand[^\"']*[\"'][^>]*>(.*?)</a>", html or "", re.S | re.I)
    if not m:
        return "", ""
    inner = m.group(1)
    b = re.search(r"<(?:b|strong)\b[^>]*>(.*?)</(?:b|strong)>", inner, re.S | re.I)
    clean = lambda t: " ".join(re.sub(r"<[^>]+>", " ", t).split())  # noqa: E731
    if b:
        return clean(inner[:b.start()]), clean(b.group(1))
    return clean(inner), ""


def text_logo(name, colors, parts=None):
    """The header of the design shows the name of the company as its logo; the website has no text logo, only pictures: when the website has no logo of its own (an upload), the name becomes a logo (svg) in the colours of the design, for the light and for the dark mode. A text logo of an earlier design is replaced; a logo that was uploaded is never touched."""
    import html as _h
    import secrets

    from django.core.files.base import ContentFile

    from apps.branding.models import SiteAsset

    prefix = "design-logo-"

    def mine(slot):
        a = SiteAsset.objects.filter(slot=slot).first()
        return a, (a is None or os.path.basename(a.image.name).startswith((prefix, "easy2edit-")))  # (the standard logo of the system is not a logo of the customer)

    def hexof(v, d):
        return v if re.fullmatch(r"#[0-9a-fA-F]{6}", str(v or "")) else d

    for slot, ink in (("logo", hexof(colors.get("text"), "#1f2937")), ("logo_dark", hexof(colors.get("dtext"), "#f3f4f6"))):
        asset, replace = mine(slot)
        if not replace:
            continue
        words = name.split()
        first, rest = (" ".join(words[:-1]), words[-1]) if len(words) > 1 else (name, "")
        if parts and (parts[0] or parts[1]):
            first, rest = parts  # the text mark of the header of the design
        w = int((len(first) + len(rest) + 1) * 21 + 16)
        accent = hexof(colors.get("primary"), ink)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="56" viewBox="0 0 {w} 56"><text x="0" y="39" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="700" fill="{ink}">'
               f'{_h.escape(first)}{(" <tspan fill=%s>%s</tspan>" % (chr(34) + accent + chr(34), _h.escape(rest))) if rest else ""}</text></svg>')
        fname = f"{prefix}{slot}-{secrets.token_hex(3)}.svg"
        if asset:
            old = asset.image.name
            asset.image.save(fname, ContentFile(svg.encode()), save=True)
            if os.path.basename(old).startswith("easy2edit-"):
                continue  # the file of the standard logo stays (the system may need it again)
            try:
                from apps.medialib import service

                service.release(old)
            except Exception:  # noqa: BLE001
                pass
        else:
            SiteAsset(slot=slot).image.save(fname, ContentFile(svg.encode()), save=True)


def apply_identity(job):
    """When the design is put on the website: the footer of the site shows what the designer made (name, short text, address, phone, e-mail), not the standard "easy2edit": the identity of the website is filled from the design.
    The name and the footer text are always set (they belong to this design); address, phone and e-mail only when they are still empty (existing details are never overwritten). Returns what was set."""
    from . import system

    b = job.brief or {}
    name = str(b.get("name") or job.name or "").strip()[:100]
    html = str((job.files or {}).get("index.html") or "")
    m = re.search(r"<footer\b[^>]*>(.*?)</footer>", html, re.S | re.I)
    foot = m.group(1) if m else ""
    paras = [" ".join(re.sub(r"<[^>]+>", " ", x).split()) for x in re.findall(r"<p\b[^>]*>(.*?)</p>", foot, re.S | re.I)]
    texts = [" ".join(t.split()) for t in re.split(r"\s*(?:<br\s*/?>|</(?:p|li|div|span|a|h\d)>)\s*", foot) for t in [re.sub(r"<[^>]+>", " ", t)] if t.strip()]
    email = next(iter(re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", foot)), "")
    phone = next((x.strip() for t in texts for x in re.findall(r"\+?\d[\d\s().-]{7,}\d", t)), "")
    address = next((t for t in texts if re.search(r"\d", t) and "," in t and email not in t and phone not in t and len(t) < 160), "")
    blurb = next((p for p in paras if len(p) >= 40 and email not in p), "")
    given = str(b.get("contact") or "")  # what the customer typed wins over what the designer wrote in the footer
    if given:
        email = next(iter(re.findall(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", given)), email)
        phone = next(iter(re.findall(r"\+?\d[\d\s().-]{7,}\d", given)), phone).strip()
        rest = re.sub(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", " ", re.sub(r"\+?\d[\d\s().-]{7,}\d", " ", given))
        rest = re.sub(r"(?i)\b(phone|tel|telefoon|e-?mail|email|address|adres|contact)\s*:", " ", rest)
        parts = [x.strip(" .;|") for x in re.split(r"[.;\n|]", rest) if x.strip(" .;|")]
        address = next((x for x in parts if re.search(r"\d", x) and "," in x), address)
    cur = system.get()
    new = {}
    if name:
        new["site_name"] = name
        if not cur.get("company_name"):
            new["company_name"] = name
    if blurb:
        new["footer_text"] = blurb[:500]
    if email and not cur.get("contact_email"):
        new["contact_email"] = email
    if phone and not cur.get("phone"):
        new["phone"] = phone[:40]
    if address and not cur.get("address"):
        new["address"] = address[:200]
    cols = footer_columns_of(html)
    if cols:
        new["footer_columns"] = cols  # the link columns of the footer of the design (the footer of the website shows them)
    if new:
        system.save(new)
    if name:
        try:
            text_logo(name, b.get("colors") or {}, brand_of(html))
        except Exception:  # noqa: BLE001 - only the look
            logger.warning("text logo not made", exc_info=True)
    if 'data-easy2edit-tag="ui-footer"' in html:  # the footer of the website looks like the footer of the design: dark, brand on the left with columns, the name of the website as brand
        try:
            from . import theme as T
            from .models import SiteSettings

            so = SiteSettings.load()
            clean, errors = T.validate({"footer_tone": "dark", "footer_layout": "brand", "footer_brand": "name"})
            if not errors:
                so.theme = {**(so.theme or {}), **{k: v for k, v in clean.items() if v != T.DEFAULTS[k]}}
                so.save()
                new["footer_tone"] = "dark"
        except Exception:  # noqa: BLE001 - only the look
            logger.warning("footer look not set", exc_info=True)
    return new


SNAP_KEYS = ("name", "brief", "messages", "files", "files_prev", "translations")


def snapshot(job):
    """The state of a design as data (what 'save' keeps): used to see whether something changed while the creator was open, and to put the old state back."""
    return {k: getattr(job, k) for k in SNAP_KEYS}


def restore_snapshot(job, snap):
    """Put an earlier state of the design back (not saving the changes of this session)."""
    if job.status in ("running", "stopping"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    if not isinstance(snap, dict):
        raise ValueError("Er is niets om terug te zetten.")
    fields = {k: snap[k] for k in SNAP_KEYS if k in snap and isinstance(snap[k], (dict, list, str))}
    fields["status"] = "done" if (fields.get("files") or {}) else "draft"
    SiteDesignJob.objects.filter(pk=job.pk).update(**fields, step="", error="", updated_at=timezone.now())
    return SiteDesignJob.objects.get(pk=job.pk)


def next_version_name(name):
    """'Blue' -> 'Blue 2', 'Blue 2' -> 'Blue 3'."""
    name = str(name or "Nieuw ontwerp").strip()
    m = re.match(r"^(.*?)(?:\s+v?(\d+))$", name)
    return (f"{m.group(1)} {int(m.group(2)) + 1}" if m else f"{name} 2")[:120]


def save_as_new_version(job, old_snap):
    """What was done in this session becomes a NEW design (name +1); the design that was opened goes back to how it was. Returns the new job."""
    if job.status in ("running", "stopping"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    cur = snapshot(job)
    name = next_version_name(job.name)
    brief = {k: v for k, v in (cur["brief"] or {}).items() if k not in ("live_hash", "run")}
    brief["name"] = name
    new = SiteDesignJob.objects.create(user=job.user, status="done" if cur["files"] else "draft", name=name, brief=brief, messages=cur["messages"], files=cur["files"], files_prev=cur["files_prev"], translations=cur["translations"])
    restore_snapshot(job, old_snap)
    return new


EXPORT_FORMAT = "easy2edit-design"


def designs_costs(user):
    """What each of the designs of this user costs (charged, margin included), since the counter of that design was reset: [{id, name, charged, calls}] for the designs that have costs, most recent first."""
    from django.db.models import Count, Sum

    from apps.integrations import aiusage
    from apps.integrations.models import AiSettings, AiUsage

    jobs = list(SiteDesignJob.objects.filter(user=user).order_by("-updated_at")[:30])
    refs = {_ref_of(j.pk): j for j in jobs}
    base = {r["ref"]: r for r in AiUsage.objects.filter(ref__in=list(refs), billable=True).values("ref").annotate(c=Sum("charged"), n=Count("id"))}
    out = []
    for ref, j in refs.items():
        since = (j.brief or {}).get("cost_reset_at")
        if since:
            r = AiUsage.objects.filter(ref=ref, billable=True, created_at__gte=since).aggregate(c=Sum("charged"), n=Count("id"))
        else:
            r = base.get(ref) or {"c": 0, "n": 0}
        busy = aiusage.running_for(ref)
        if r["n"] or busy:
            out.append({"id": str(j.pk), "name": j.name, "charged": round(float(r["c"] or 0) + sum(b["charged"] for b in busy), 4), "calls": r["n"] + len(busy)})
    return {"currency": AiSettings.load().currency, "designs": out}


def design_costs(job):
    """What this design costs (what is charged, margin included; never the purchase price), since the counter was reset: total, per request (for the chart) and the tokens."""
    from apps.integrations import aiusage
    from apps.integrations.models import AiSettings, AiUsage

    since = (job.brief or {}).get("cost_reset_at")
    qs = AiUsage.objects.filter(ref=_ref_of(job.pk))
    if since:
        qs = qs.filter(created_at__gte=since)
    rows = list(qs.order_by("id")[:400])
    items = [{"id": r.id, "at": r.created_at.isoformat(timespec="seconds"), "charged": float(r.charged) if r.billable else 0.0, "tokens": r.tokens_in + r.tokens_out, "ok": r.ok} for r in rows]
    busy = aiusage.running_for(_ref_of(job.pk))  # what is being made now counts along (live)
    items += [{"id": 0, "at": "", "charged": b["charged"], "tokens": b["tokens"], "ok": True, "busy": True} for b in busy]
    return {"currency": AiSettings.load().currency, "charged": round(sum(i["charged"] for i in items), 4), "calls": len(items), "tokens": sum(i["tokens"] for i in items), "since": since or "", "busy": len(busy), "items": items[-40:]}


def reset_costs(job):
    b = dict(job.brief or {})
    b["cost_reset_at"] = timezone.now().isoformat()
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b)


def export_job(job):
    """A design as data (json): the choices, the chat with the questionnaires and their answers, and the files (html, css, svg). Pictures of the media library are not part of it (only their names in the brief)."""
    pages = [{"file": f, "title": ((re.search(r"<title>(.*?)</title>", str(c), re.S | re.I) or [None, ""])[1]).strip()[:120]} for f, c in (job.files or {}).items() if f.endswith(".html")]
    out = {"format": EXPORT_FORMAT, "version": 2, "exported_at": timezone.now().isoformat(), "design": {
        "id": str(job.pk), "name": job.name, "status": job.status, "brief": job.brief or {}, "messages": job.messages or [], "translations": job.translations or {}}}
    if job.files:  # the pages that were made: a section of their own (the questions and answers stay usable without it)
        out["render"] = {"pages": pages, "files": job.files or {}, "files_prev": job.files_prev or {}}
    return out


def import_job(user, data, mode="", parts="all"):
    """Reads an exported design. When a design with the same id exists: without mode the answer is {"exists": ...} (the user chooses), mode "replace" replaces it, mode "add" adds the design as a new row. Returns (job or None, info)."""
    from apps.medialib.models import MediaItem

    if not isinstance(data, dict) or data.get("format") != EXPORT_FORMAT or not isinstance(data.get("design"), dict):
        raise ValueError("Dit is geen geëxporteerd ontwerp (verwacht: easy2edit-design json).")
    d = data["design"]
    rd = data.get("render") if isinstance(data.get("render"), dict) else d  # (an older export has the files in the design itself)
    files = {str(k)[:120]: v for k, v in (rd.get("files") if isinstance(rd.get("files"), dict) else {}).items() if isinstance(v, str)}
    prev = {str(k)[:120]: v for k, v in (rd.get("files_prev") if isinstance(rd.get("files_prev"), dict) else {}).items() if isinstance(v, str)}
    if parts == "questions":  # only the questions, the answers and the choices: the pages are made again
        files, prev = {}, {}
    if sum(len(v) for v in files.values()) + sum(len(v) for v in prev.values()) > 8_000_000:
        raise ValueError("Dit ontwerp is te groot om in te lezen.")
    brief = dict(d.get("brief") if isinstance(d.get("brief"), dict) else {})
    brief.pop("live_hash", None)  # it is not live on this website
    for k in ("photos", "videos"):  # own pictures of the media library only stay when they exist here
        if isinstance(brief.get(k), list):
            ids = {x.get("id") for x in brief[k] if isinstance(x, dict)}
            have = set(MediaItem.objects.filter(pk__in=[i for i in ids if isinstance(i, int)]).values_list("pk", flat=True))
            brief[k] = [x for x in brief[k] if isinstance(x, dict) and x.get("id") in have]
    msgs = [m for m in (d.get("messages") if isinstance(d.get("messages"), list) else []) if isinstance(m, dict)][:200]
    trans = d.get("translations") if isinstance(d.get("translations"), dict) else {}
    name = str(d.get("name") or brief.get("name") or "Nieuw ontwerp")[:120]
    status_ = d.get("status") if d.get("status") in ("draft", "done", "error") else ("done" if files else "draft")
    if not files:
        status_ = "draft"
    fields = dict(name=name, status=status_, progress=100 if status_ == "done" else 0, step="", error="", brief=brief, files=files, files_prev=prev, messages=msgs, translations=trans)
    try:
        old = SiteDesignJob.objects.filter(pk=str(d.get("id") or "")).first() if d.get("id") else None
    except (ValueError, TypeError):
        old = None
    if old and not mode:
        return None, {"exists": True, "id": str(old.pk), "name": old.name}
    if old and mode == "replace":
        if old.status in ("running", "stopping"):
            raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
        SiteDesignJob.objects.filter(pk=old.pk).update(user=user, updated_at=timezone.now(), **fields)
        return SiteDesignJob.objects.get(pk=old.pk), {"replaced": True}
    return SiteDesignJob.objects.create(user=user, **fields), {"added": True}


def save_answers(job, index, ans, own):
    """The filled in values of a questionnaire are kept with the question message (ids and values only, size limited)."""
    msgs = list(job.messages or [])
    try:
        i = int(index)
    except (TypeError, ValueError):
        raise ValueError("Onbekende vraag.")
    if not (0 <= i < len(msgs)) or not msgs[i].get("questions"):
        raise ValueError("Onbekende vraag.")
    ids = {q.get("id") for q in msgs[i]["questions"]} | {"name", "url", "logo", "media", "colors", "page_bg", "front_bg"}  # (the questions that the screen adds itself are kept too)
    clean = {}
    for k, v in (ans if isinstance(ans, dict) else {}).items():
        if k in ids:
            clean[k] = [str(x)[:300] for x in v[:30]] if isinstance(v, list) else str(v or "")[:1500]
    keep = {k: str(v)[:600] for k, v in (own if isinstance(own, dict) else {}).items() if k in ids}
    msgs[i] = {**msgs[i], "answers": {"ans": clean, "own": keep}}
    upd = {"messages": msgs}
    for qid in [q.get("id") for q in msgs[i]["questions"]] + ["name"]:  # the design is saved under the company name that was filled in (the answer to the question about the name)
        if re.match(r"^(name|naam|company_?name|business_?name|bedrijfs_?naam|brand)$", str(qid or ""), re.I) and isinstance(clean.get(qid), str) and clean[qid].strip():
            upd["name"] = clean[qid].strip()[:120]
            break
    SiteDesignJob.objects.filter(pk=job.pk).update(**upd)


def chat(job, text, shots=None, ui_lang=""):
    if job.status in ("running", "stopping"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    text = str(text or "").strip()[:2000]
    if not text:
        raise ValueError("Schrijf een bericht.")
    if not ai.available():
        raise ValueError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    has = any(n.endswith(".html") for n in (job.files or {}))
    b = dict(job.brief or {})
    b["chat"] = True
    ui = re.sub(r"[^A-Za-z-]", "", str(ui_lang or ""))[:10]
    if ui:
        b["ui_lang"] = ui  # the language of the screen of the customer: the designer speaks it
    shots = clean_shots(shots)
    msgs = list(job.messages or []) + [{"role": "user", "text": text, **({"img": _thumbs(shots)} if shots else {})}]
    SiteDesignJob.objects.filter(pk=job.pk).update(brief=b, status="running", progress=5, step="Aan het denken" if not has else "De aanpassing doorvoeren", error="", messages=msgs, updated_at=timezone.now())
    _spawn(_chat, job.pk, text, has, shots)


def _answered_contact(msgs):
    """What the customer filled in as contact details in the last questionnaire (address, phone, e-mail ...), or "" when nothing: the designer uses exactly this."""
    for m in reversed(msgs or []):
        if not m.get("questions"):
            continue
        ans = ((m.get("answers") or {}).get("ans")) or {}
        for q in m["questions"]:
            txt = f"{q.get('id') or ''} {q.get('q') or ''}"
            v = ans.get(q.get("id"))
            if re.search(r"contact|adres|address|telefoon|phone|e-?mail|gegevens|details", txt, re.I) and isinstance(v, str) and len(v.strip()) >= 6 and not re.fullmatch(r"(beslis zelf|decide yourself|none|geen)\W*", v.strip(), re.I):
                return v.strip()[:500]
        return ""
    return ""


EXTRA_FAMILIES = (  # (words in the answer, the components that belong to that function)
    (r"faq|veelgestelde", {"ui-faq"}),
    (r"agenda|afspra|appoint|booking|boek|calendar|kalender", {"ui-calendar", "ui-agenda", "ui-booking", "ui-schedule", "ui-mini-calendar", "ui-calendar-weeks", "ui-year-calendar", "ui-calendar-toolbar"}),
    (r"shop|winkel", {"ui-product-cards", "ui-cart-summary"}),
    (r"community|gemeenschap", {"ui-login-card", "ui-profile-card"}),
    (r"document|download", {"ui-files-feed"}),
    (r"newsletter|nieuwsbrief", {"ui-newsletter"}),
)


def _answered_extras(msgs):
    """The extra functions that the customer ticked in the last questionnaire ([] = none ticked), or None when there was no such question."""
    for m in reversed(msgs or []):
        if not m.get("questions"):
            continue
        ans = ((m.get("answers") or {}).get("ans")) or {}
        for q in m["questions"]:
            if q.get("type") == "multi" and re.search(r"extra|function|functie|module|feature", f"{q.get('id') or ''} {q.get('q') or ''}", re.I) and not re.search(r"page|pagina|layout|indeling|lang|taal", str(q.get("id") or ""), re.I):
                v = ans.get(q.get("id"))
                if isinstance(v, list):
                    return [str(x) for x in v if not re.fullmatch(r"(none|geen|geen van .*)", str(x).strip(), re.I)]
        return None
    return None


_ACCOUNT_LABELS = r"inloggen|aanmelden|registreren|account|mijn account|log ?in|sign ?(?:up|in)|register|login|anmelden|einloggen|registrieren|se connecter|s'inscrire|connexion|inscription|iniciar sesi[oó]n|registrarse"
_DOWNLOAD_LABELS = r"downloads?|documenten|documents|dokumente"


def strip_unchosen_links(html, extras):
    """The menu and footer of the kit have a login and sign-up link and a downloads link: they are removed when the customer did not choose such a function."""
    if not isinstance(extras, list):
        return html
    chosen = " ".join(extras).lower()
    labels = []
    if not re.search(r"community|gemeenschap|account|login", chosen):
        labels.append(_ACCOUNT_LABELS)
    if not re.search(r"document|download", chosen):
        labels.append(_DOWNLOAD_LABELS)
    if not labels:
        return html
    lab = "|".join(labels)
    html = re.sub(rf"<li[^>]*>\s*<a\b[^>]*>\s*(?:{lab})\s*</a>\s*</li>", "", html or "", flags=re.I)
    return re.sub(rf"<a\b[^>]*>\s*(?:{lab})\s*</a>", "", html, flags=re.I)


def menu_allowed(b, sec):
    """A section only gets an item in the menu of a one pager when the customer asked for it: about us, services and contact always; showcase/portfolio, FAQ, blog, documents only when chosen. Reviews, results, how it works and the like stay on the page without a menu item."""
    key = f"{sec.get('id') or ''} {sec.get('menu') or ''}".lower()
    if re.search(r"about|over[- ]ons|service|dienst|contact|offer|aanbod", key):
        return True
    chosen = " ".join([str(b.get("pages") or ""), " ".join(b.get("extras") or []), str(b.get("one_pager_pages") or "")]).lower()
    for words, label in ((r"faq|veelgestelde", r"faq"), (r"portfolio|showcase|project|werk|cases", r"portfolio|showcase|project|werk|cases|results|resultaten"), (r"blog|nieuws", r"blog|news|nieuws"), (r"document|download", r"document|download")):
        if re.search(label, key) and re.search(words, chosen):
            return True
    return False


def blocked_tags(extras):
    """The components of the functions that the customer did NOT choose: they are not used in the pages (extras None = everything is allowed)."""
    if extras is None:
        return set()
    chosen = " ".join(extras).lower()
    out = set()
    for words, tags in EXTRA_FAMILIES:
        if not re.search(words, chosen):
            out |= tags
    return out


def _unanswered(msgs):
    """The questions of the last questionnaire that the customer left empty (nothing chosen, nothing typed): nothing may be designed for them. Name, address, logo, photos, colours, layout and languages are handled elsewhere."""
    out = []
    for m in reversed(msgs or []):
        if not m.get("questions"):
            continue
        ans = ((m.get("answers") or {}).get("ans")) or {}
        if not ans:
            return []  # nothing was saved: the customer let the designer decide
        for q in m["questions"]:
            qid = str(q.get("id") or "")
            if re.search(r"^(name|naam|url|logo|media|colou?rs?|kleur|layout|indeling|width|breedte|langs?|talen|pages?|paginas?)|photo|foto|video|colou?r|kleur|layout|lang|width|pagina|page", qid, re.I):
                continue
            v = ans.get(qid)
            empty = (not v) if isinstance(v, (list, str)) or v is None else False
            if isinstance(v, str) and re.fullmatch(r"\s*(none|geen|beslis zelf|decide yourself)?\W*", v, re.I):
                empty = True
            if isinstance(v, list) and all(re.fullmatch(r"(none|geen)", str(x).strip(), re.I) for x in v):
                empty = True
            if empty:
                out.append(str(q.get("q") or qid)[:160])
        return out
    return out


def _answered_pages_raw(msgs):
    """What was ticked at the pages question, as it stands (also for a one pager): used to decide which sections get a menu item."""
    for m in reversed(msgs or []):
        if not m.get("questions"):
            continue
        ans = ((m.get("answers") or {}).get("ans")) or {}
        for q in m["questions"]:
            qid = str(q.get("id") or "")
            if re.search(r"page|pagina", qid, re.I) and not re.search(r"layout|indeling", qid, re.I) and q.get("type") == "multi" and isinstance(ans.get(qid), list):
                return ", ".join(str(x) for x in ans[qid])[:300]
        return ""
    return ""


def _answered_pages(msgs):
    """The pages that the customer ticked in the last questionnaire (saved with the answers): "Home" for a one pager, else the ticked pages as a list. None when there is no such answer."""
    for m in reversed(msgs or []):
        if not m.get("questions"):
            continue
        ans = ((m.get("answers") or {}).get("ans")) or {}
        for q in m["questions"]:
            qid = str(q.get("id") or "")
            if re.search(r"page|pagina", qid, re.I) and not re.search(r"layout|indeling", qid, re.I) and q.get("type") == "multi":
                v = ans.get(qid)
                if isinstance(v, list) and v:
                    if any(re.search(r"one.?pager", str(x), re.I) for x in v):
                        return "Home"
                    return ", ".join(str(x) for x in v)[:600]
        return None
    return None


def _chat(pk, text, has, shots=None):
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        if has:
            _revise(pk, text, "", shots)
            return
        convo = "\n".join(f"{'Customer' if m['role'] == 'user' else 'Designer'}: {m['text']}" for m in (job.messages or [])[-20:])
        mods = [i for i in module_items() if i["key"] not in effective_off(job.brief)]
        cat = "Modules of the system: " + ", ".join(f"{i['key']} ({i['label']})" for i in mods[:40]) if mods else ""
        ui = (job.brief or {}).get("ui_lang") or ""
        try:
            lg = Language.objects.filter(code=ui).first() if ui else None
        except Exception:
            lg = None
        say = f"LANGUAGE: write the reply, every question, every answer option and the default in {(lg.name if lg else ui)} ({ui}), the language of the customer's screen, even if the conversation so far is in another language.\n\n" if ui else ""
        out = _ask(CHAT_SYSTEM, f"{say}{cat}\n\nConversation so far:\n{convo}\n\nAnswer now with the JSON.", max_tokens=5000, pk=pk, images=shots or None)
        m = re.search(r"\{.*\}", out, re.S)
        try:
            d = json.loads(m.group(0)) if m else {}
        except ValueError:
            d = {}
        reply = str(d.get("reply") or "").strip()[:1500]
        if not reply:
            raise ValueError("De AI gaf geen antwoord. Probeer het nog eens.")
        job = SiteDesignJob.objects.get(pk=pk)
        qs = clean_questions(d.get("questions")) if not d.get("ready") else []
        msgs = list(job.messages or []) + [{"role": "ai", "text": reply, **({"questions": qs} if qs else {})}]
        br = d.get("brief") if isinstance(d.get("brief"), dict) else {}
        if isinstance(br, dict):
            left = _unanswered(msgs)
            br = {**br, "unanswered": left}
            if any(re.search(r"call to action|main goal|hoofddoel|doel van", q, re.I) for q in left):
                br["no_cta"] = True  # no goal chosen: no call to action is designed
            else:
                br["no_cta"] = False
        answered_extras = _answered_extras(msgs)
        if answered_extras is not None and isinstance(br, dict):
            br = {**br, "extras": answered_extras}
        answered_contact = _answered_contact(msgs)  # the contact details that the customer typed win over everything the designer could invent
        if answered_contact and isinstance(br, dict):
            br = {**br, "contact": answered_contact}
        answered = _answered_pages(msgs)  # the pages that the customer ticked in the questionnaire win over what the designer wrote down
        if answered and isinstance(br, dict):
            br = {**br, "pages": answered}
            raw_pages = _answered_pages_raw(msgs)
            if raw_pages and isinstance(br, dict):
                br = {**br, "one_pager_pages": raw_pages}
        if d.get("ready") and str(br.get("name") or "").strip():
            patch = {k: br.get(k) for k in ("name", "kind", "lang", "pages", "style", "extra", "colors", "font", "radius", "color_mode", "langs", "lang_switch", "istock_search", "layouts", "max_width", "contact", "extras", "one_pager_pages", "unanswered", "no_cta") if br.get(k) not in (None, "", {}, []) and not (k in ((job.brief or {}).get("locked") or []) or (k in ("colors", "font", "radius", "color_mode") and (job.brief or {}).get(k) not in (None, "", {})))}  # what the customer already chose (in the wizard or the blocks: name, pages, colours, languages ...) stays
            patch["chat"] = True
            _set(pk, brief=clean_brief(patch, job.brief), name=str(((job.brief or {}).get("name") if "name" in ((job.brief or {}).get("locked") or []) else "") or br["name"]).strip()[:120], messages=msgs, progress=6, step="De website ontwerpen")
            if patch.get("istock_search"):
                auto_photos(pk, SiteDesignJob.objects.get(pk=pk))  # the selection is in the list before the designing starts
            _generate(pk)  # makes the files and ends with status "done" (also on an error)
            return
        _set(pk, status="done", progress=100, step="", messages=msgs)
    except Stopped:
        _finish_stopped(pk, "Gestopt.")
    except Exception as e:  # noqa: BLE001
        logger.exception("sitecreator chat")
        row = SiteDesignJob.objects.filter(pk=pk).first()
        _set(pk, status="done", progress=100, step="", error="", messages=list(row.messages if row else []) + [{"role": "ai", "text": "Dat is niet gelukt: " + (str(e) if isinstance(e, ValueError) else "probeer het nog eens.")}])
    finally:
        db.connections.close_all()


def stop(job):
    """Stop was pressed: the work ends at the next moment (also the answer of Claude that is coming in)."""
    if is_stalled(job):  # nothing works on it any more: it ends at once
        _finish_stopped(job.pk, "Het ontwerpen is gestopt omdat het vast stond.")
        return SiteDesignJob.objects.get(pk=job.pk)
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


def revise(job, instruction, page="", shots=None):
    if job.status in ("running", "stopping"):
        raise ValueError("Er wordt nog gewerkt aan dit ontwerp.")
    instruction = str(instruction or "").strip()[:2000]
    if not instruction:
        raise ValueError("Schrijf wat er anders moet.")
    shots = clean_shots(shots)
    msgs = list(job.messages or []) + [{"role": "user", "text": instruction, **({"img": _thumbs(shots)} if shots else {})}]
    SiteDesignJob.objects.filter(pk=job.pk).update(status="running", progress=10, step="De aanpassing doorvoeren", error="", messages=msgs, updated_at=timezone.now())
    _spawn(_revise, job.pk, instruction, page, shots)



# ── changing a sectioned design: only the parts that change are asked, one small answer each ──
def _main_parts(html):
    """(before, [(id, html)], after) of a page made in sections: the text before <main>, the top-level blocks of <main>, the text after </main>. None when there is no <main>."""
    m1 = re.search(r"<main[^>]*>", html or "")
    if not m1:
        return None
    m2 = html.rfind("</main>")
    if m2 < m1.end():
        return None
    inner = html[m1.end():m2]
    parts, depth, start = [], 0, None
    for m in re.finditer(r"<div\b[^>]*>|</div\s*>", inner):
        if m.group(0).startswith("</"):
            depth -= 1
            if depth == 0 and start is not None:
                parts.append(inner[start:m.end()].strip())
                start = None
        else:
            if depth == 0:
                start = m.start()
            depth += 1
    out = []
    for p in parts:
        idm = re.match(r'<div id="([a-z0-9_-]*)">\s*(?=<div\b)', p)
        if idm and p.endswith("</div>"):
            out.append((idm.group(1), p[idm.end():-6].strip()))  # the wrapper with the id of the section is taken off
        else:
            out.append(("", p))
    return html[:m1.end()], out, html[m2:]


def _band_cells(h):
    """[(start, end)] of the inner html of the columns (<div class="col">) of a band; [] when it is not a band."""
    cells, depth, open_at, inner_at = [], 0, [], []
    for m in re.finditer(r"<div\b[^>]*>|</div\s*>", h):
        if m.group(0).startswith("</"):
            depth -= 1
            if open_at and open_at[-1] == depth:
                cells.append((inner_at.pop(), m.start()))
                open_at.pop()
        else:
            if re.search(r'class="col"', m.group(0)):
                open_at.append(depth)
                inner_at.append(m.end())
            depth += 1
    return sorted(cells)


def _join_main(before, sections, after):
    body = "\n".join(f'<div id="{i}">\n{h}\n</div>' if i else h for i, h in sections)
    return f"{before}\n{body}\n{after}"


def _outline(files):
    lines = []
    for n in sorted((n for n in files if n.endswith(".html")), key=lambda n: (n != "index.html", n)):
        mp = _main_parts(files[n])
        if not mp:
            continue
        lines.append(f"{n}:")
        for i, (sid, h) in enumerate(mp[1]):
            tag = re.search(r'data-easy2edit-tag="([^"]+)"', h) or re.search(r'data-(sysobject)="([^"]+)"', h)
            head = re.search(r"<h[1-3][^>]*>(.*?)</h[1-3]>", h, re.S)
            cells = _band_cells(h) if 'class="band' in h else []
            name = ("band with columns [" + " | ".join((re.search(r'data-easy2edit-tag="([^"]+)"', h[a:b_]) or [None, "?"])[1] for k, (a, b_) in enumerate(cells)) + "] (edit a column with \"cell\": 0..)") if cells else (tag.group(1) if tag else "part")
            lines.append(f"  {i}. {name}{f' #{sid}' if sid else ''}" + (f" - {re.sub(r'<[^>]+>', '', head.group(1)).strip()[:70]}" if head else ""))
    return "\n".join(lines)


def _revise_sections(pk, job, instruction, page, shots):
    """The change is planned first (small answer: which parts change), then every part is redone on its own. A shared menu or footer is changed on every page. Never too long."""
    b = dict(job.brief or {})
    files = dict(job.files or {})
    sysm = _section_system(b)
    outline = _outline(files)
    focus = f"The user is looking at the page {page}.\n" if page in files else ""
    look = "The user attached a screenshot of how the page looks to him now (see the picture): use it to understand what he means.\n" if shots else ""
    plan_prompt = (f"{focus}{look}Here are the pages of the website as a list of parts (index. component - first heading):\n{outline}\n\nThe user asks: {instruction}\n\n"
                   "Decide what has to change and answer with ONE JSON object: "
                   '{"reply": "one or two friendly sentences for the user about what you will do", "changes": [{"op": "edit", "file": "index.html", "index": 2, "goal": "what the part must become"}, {"op": "add", "file": "index.html", "after": 1, "tag": "ui-cta", "goal": "what the new part says"}, {"op": "delete", "file": "index.html", "index": 3}, {"op": "menu", "goal": "..."}, {"op": "footer", "goal": "..."}, '
                   '{"op": "theme", "colors": {"primary": "#rrggbb", "secondary": "#rrggbb", "bg": "#rrggbb", "card": "#rrggbb", "text": "#rrggbb"}, "font": "sans|serif|round", "radius": 14}]}\n'
                   "Rules: change as little as possible, at most 14 changes; a change of colours, font or corners is ONE theme change (no part is redone for it); a change of the menu or footer is one menu/footer change (it goes to every page). Use only tags of the component set for add.")
    out = _ask(SECTION_JSON, plan_prompt, max_tokens=4000, pk=pk, images=shots or None)
    m = re.search(r"\{.*\}", out or "", re.S)
    try:
        plan = json.loads(m.group(0)) if m else {}
    except ValueError:
        plan = {}
    changes = [c for c in (plan.get("changes") or []) if isinstance(c, dict)][:14]
    if not changes:
        raise ValueError("De AI wist niet welk deel er anders moest. Zeg het iets concreter (bijvoorbeeld op welke pagina).")
    total, n = len(changes), 0
    parts = {f: _main_parts(h) for f, h in files.items() if f.endswith(".html")}
    for c in changes:
        n += 1
        op = c.get("op")
        _set(pk, progress=min(95, 8 + int(85 * n / total)), step=f"Onderdeel {n} van {total} aanpassen")
        f = str(c.get("file") or "")
        if op == "theme":
            patch = {k: c.get(k) for k in ("colors", "font", "radius") if c.get(k) not in (None, "", {})}
            if patch:
                b = clean_brief(patch, b)
                files = themed(files, b)
        elif op in ("menu", "footer"):
            part, tagname = ("header", "ui-navbar") if op == "menu" else ("footer", "ui-footer")
            for fn, h in list(files.items()):
                mm = re.search(rf"<{part}>\s*(.*?)\s*</{part}>", h, re.S) if fn.endswith(".html") else None
                if mm:
                    cur = mm.group(1)
                    break
            else:
                continue
            nav = "; ".join(f"{t} -> {fi}" for fi, t in pages_of(b))
            new = _piece(pk, b, sysm, f"Component: {tagname}. Change this part: {c.get('goal') or instruction}\nMenu (label -> file): {nav}\n\nCURRENT html (keep everything that does not change):\n{cur}", tagname)
            if new == _fallback_component(b, tagname):
                new = cur  # (nothing usable came back: the part stays as it was)
            for fn, h in list(files.items()):
                if fn.endswith(".html"):
                    files[fn] = re.sub(rf"(<{part}>\s*).*?(\s*</{part}>)", lambda mm_: mm_.group(1) + new + mm_.group(2), h, count=1, flags=re.S)
                    parts[fn] = _main_parts(files[fn])
        elif f in parts and parts[f]:
            before, secs, after = parts[f]
            if op == "edit":
                i = int(c.get("index", -1)) if str(c.get("index", "")).lstrip("-").isdigit() else -1
                if 0 <= i < len(secs) and 'class="band' in secs[i][1] and _band_cells(secs[i][1]):  # a column of a band: only that column is redone
                    band = secs[i][1]
                    spans = _band_cells(band)
                    k = int(c.get("cell", 0)) if str(c.get("cell", "0")).isdigit() else 0
                    a0, b0 = spans[min(k, len(spans) - 1)]
                    cur = band[a0:b0].strip()
                    tag = (re.search(r'data-easy2edit-tag="([^"]+)"', cur) or [None, ""])[1]
                    if tag:
                        new = _piece(pk, b, sysm, f"Component: {tag}. Change this part: {c.get('goal') or instruction}\nPage: {f}. Menu (label -> file): " + "; ".join(f"{t} -> {fi}" for fi, t in pages_of(b)) + f"\n\n{_brief_text(b)[:1500]}\n\nCURRENT html (keep what does not change, same structure and classes):\n{cur}", tag)
                        if new != _fallback_component(b, tag):
                            secs[i] = (secs[i][0], band[:a0] + "\n" + new + "\n" + band[b0:])
                elif 0 <= i < len(secs):
                    cur = secs[i][1]
                    tag = (re.search(r'data-easy2edit-tag="([^"]+)"', cur) or [None, ""])[1]
                    if tag:
                        new = _piece(pk, b, sysm, f"Component: {tag}. Change this part: {c.get('goal') or instruction}\nPage: {f}. Menu (label -> file): " + "; ".join(f"{t} -> {fi}" for fi, t in pages_of(b)) + f"\n\n{_brief_text(b)[:1500]}\n\nCURRENT html (keep what does not change, same structure and classes):\n{cur}", tag)
                        if new != _fallback_component(b, tag):
                            secs[i] = (secs[i][0], new)
            elif op == "add":
                tag = str(c.get("tag") or "")
                from . import componentpacks

                known = {x["easy2edit_tag"] for x in componentpacks.get(b.get("component_set") or None)["components"]}
                if tag in known:
                    at = int(c.get("after", len(secs) - 1)) if str(c.get("after", "")).lstrip("-").isdigit() else len(secs) - 1
                    new = _piece(pk, b, sysm, f"Component: {tag}.\nPage: {f}. Goal: {c.get('goal') or instruction}\n\n{_brief_text(b)[:1500]}\n\nTemplate (copy it, change texts/links/pictures and the number of items):\n{_template(b, tag)}", tag)
                    secs.insert(max(0, min(len(secs), at + 1)), ("", new))
            elif op == "delete":
                i = int(c.get("index", -1)) if str(c.get("index", "")).lstrip("-").isdigit() else -1
                if 0 <= i < len(secs) and len(secs) > 1:
                    secs.pop(i)
            files[f] = _join_main(before, secs, after)
        _set(pk, files=files)  # the preview shows every change as soon as it is done
    return files, b, str(plan.get("reply") or "").strip()[:400], changes


def _revise(pk, instruction, page, shots=None):
    try:
        job = SiteDesignJob.objects.get(pk=pk)
        if (job.brief or {}).get("sectioned") and any(_main_parts(h) for n, h in (job.files or {}).items() if n.endswith(".html")):  # a design in sections: only the parts that change, one small answer each
            files2, b2, reply, changes = _revise_sections(pk, job, instruction, page, shots)
            names = sorted({str(c.get("file")) for c in changes if str(c.get("file") or "").endswith(".html")})
            _set(pk, status="done", progress=100, step="Klaar", files=themed(files2, b2), brief=b2, messages=list(SiteDesignJob.objects.get(pk=pk).messages or []) + [{"role": "ai", "text": (reply + " " if reply else "") + f"Aangepast: {len(changes)} onderdeel/onderdelen" + (f" ({', '.join(names)})" if names else "") + "."}])
            _notify_done(pk, "Ontwerp bijgewerkt")
            return
        files = dict(job.files or {})
        listing_ = "\n\n".join(f"=== FILE: {n} ===\n{c}" for n, c in files.items())
        focus = f"The user is looking at the page {page}.\n" if page in files else ""
        photos = "\n".join(f"- {p['file']}: {p.get('note') or ''}" for p in [*((job.brief or {}).get("photos") or []), *((job.brief or {}).get("videos") or [])])
        ph = f"Photos that can be used (img/<file>):\n{photos}\n" if photos else ""
        chosen = "\n".join(f"- {f}: {it.get('title') or ''}" for f, it in ((job.brief or {}).get("picked") or {}).items() if f not in {p["file"] for p in [*((job.brief or {}).get("photos") or []), *((job.brief or {}).get("videos") or [])]})
        ph += f"Photos that the user chose on iStock and wants in the website (use them where they fit, as <img src=\"img/<file>\"> or <video src=\"video/<file>\">):\n{chosen}\n" if chosen else ""
        look = "The user attached a screenshot of how the page looks to him right now (see the picture(s)): use it to understand what he means.\n" if shots else ""
        new = parse(_ask(rules(job.brief), f"Here is the current website. Apply the change that the user asks for. Output ONLY the files that change, each complete (when the change is the look of the whole site, change style.css; when it is a text or section, change that page). Keep everything else exactly as it is, and keep the structure rules.\n{focus}{look}{ph}Change: {instruction}\n\n{listing_}", pk=pk, images=shots or None))
        if not new:
            raise ValueError("De AI gaf geen aanpassing terug. Probeer het anders te zeggen.")
        _set(pk, status="done", progress=100, step="Klaar", files=themed({**files, **new}, job.brief), messages=list(job.messages) + [{"role": "ai", "text": "Aangepast: " + ", ".join(sorted(new)) + "."}])
        _notify_done(pk, "Ontwerp bijgewerkt")
    except Stopped:
        _finish_stopped(pk, "Gestopt: de aanpassing is niet doorgevoerd.")
    except Exception as e:  # noqa: BLE001
        row = SiteDesignJob.objects.filter(pk=pk).first()
        if row and isinstance(e, ValueError) and "afgebroken" in str(e) and not (row.brief or {}).get("sectioned") and (row.brief or {}).get("chat"):
            # the answer was too long for a design in the old, one-piece form: it is rebuilt in small pieces (with the change as a wish) and the progress bar shows every piece
            b = dict(row.brief or {})
            b["extra"] = (str(b.get("extra") or "") + f"\nChange asked for in the chat: {instruction}")[-1500:]
            _set(pk, brief=b, files_prev=row.files or {}, status="running", progress=3, step="Het ontwerp opnieuw opbouwen in kleine stukjes", error="", messages=list(row.messages or []) + [{"role": "ai", "text": "Dat was te veel voor één keer. Ik bouw het ontwerp nu opnieuw op in kleine stukjes, met jouw wens erbij. Je ziet de voortgang."}])
            db.connections.close_all()
            return _generate(pk)
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
    return {"id": str(job.pk), "name": job.name, "stalled": is_stalled(job), "live": is_live(job), "applied": bool(b.get("live_hash")), "status": job.status, "progress": job.progress, "step": job.step, "error": job.error, "files": (job.files or {}) if files else {}, "translation_files": (job.translations or {}) if files else {}, "file_names": sorted(job.files or {}), "can_restore": bool(job.files_prev), "translations": sorted((job.translations or {}).keys()), "messages": job.messages or [], "brief": b, "modules_off_effective": sorted(effective_off(b)),
            "pages": [{"file": f, "title": t} for f, t in pages_of(b)], "ai": ai.available(), "files_sig": f"{len(job.files or {})}-{sum(len(str(v)) for v in (job.files or {}).values())}", "chat": bool(b.get("chat")), "istock_tried": bool(b.get("istock_tried")), "photo_slots": photo_slots(job) if b.get("chat") else [],
            "docs": [_doc_public(d) for d in job.docs or []]}


def theme_brief(key):
    """The chosen theme as conditions for a design: the :root css with its colours (light and dark), the fonts, the corners and the Google Fonts address. Installed themes and themes of the library
    (not installed yet) both work. Raises ValueError when the theme is not found."""
    import json
    import zipfile

    from . import resources, theme, themepacks

    man = themepacks.manifest_of(key)
    if not man:
        entry = next((e for e in resources.catalog("themas") if e["name"] == key and not e["bundle"]), None)
        if not entry:
            raise ValueError("Dit thema bestaat niet.")
        import io

        zf = zipfile.ZipFile(io.BytesIO(resources._zip_bytes("themas", entry)))
        for n in zf.namelist():
            if n.endswith("theme.json") and "__MACOSX" not in n:
                d = json.loads(zf.read(n))
                if d.get("key") == key:
                    man = d
                    break
    if not man:
        raise ValueError("Dit thema bestaat niet.")
    v = theme.merged(man.get("values"))
    fonts = {c["value"]: c for c in theme.FIELDS["font_body"]["choices"]}
    fb, fh = fonts.get(v["font_body"]) or {}, fonts.get(v["font_heading"]) or {}
    _css, fonts_url = theme.build(v)
    light = {"--primary": v["primary"], "--secondary": v["secondary"], "--bg": v["light_page"], "--surface": v["light_bg"], "--card": v["light_card"], "--hover": v["light_hover"], "--line": v["light_line"], "--text": v["light_text"], "--muted": v["light_muted"]}
    dark = {"--bg": v["dark_page"], "--surface": v["dark_bg"], "--card": v["dark_card"], "--hover": v["dark_hover"], "--line": v["dark_line"], "--text": v["dark_text"], "--muted": v["dark_muted"]}
    common = {"--font-heading": fh.get("css") or "system-ui, sans-serif", "--font-body": fb.get("css") or "system-ui, sans-serif", "--radius": f"{v['radius']}px", "--btn-radius": f"{v['btn_radius']}px"}
    block = lambda d, ind="  ": "\n".join(f"{ind}{k}: {val};" for k, val in d.items())  # noqa: E731
    mode = man.get("mode")
    css = f":root {{\n{block({**light, **common})}\n}}"
    if mode != "light":
        css += f'\n:root[data-theme="dark"] {{\n{block(dark)}\n}}\n@media (prefers-color-scheme: dark) {{\n  :root:not([data-theme="light"]) {{\n{block(dark, "    ")}\n  }}\n}}'
    return {"key": key, "name": man.get("name") or key, "mode": mode or "light and dark", "css": css, "fonts_url": fonts_url or "", "font_heading": v["font_heading"], "font_body": v["font_body"], "heading_weight": v["heading_weight"],
            "radius": v["radius"], "btn_radius": v["btn_radius"], "shadow": v["shadow"], "base_size": v["font_size_base"], "line_height": v["line_height"]}
