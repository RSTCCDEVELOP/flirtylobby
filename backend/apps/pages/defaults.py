"""The standard pages of the website for every part of the admin (games, community, webshop and payment, subscriptions and donations):
public pages and private pages (in the dashboard), with their addresses, texts in every language, the link to the Pages module (a page is only there while its module is on)
and a layout that differs per community theme (normal, dating, business, sporters, webshop). Nothing that an administrator changed is ever overwritten."""
import hashlib
import json
from pathlib import Path

from .models import Page, PageLayout

TEXTS = json.loads((Path(__file__).parent / "data" / "default_texts.json").read_text(encoding="utf-8"))
LANGS = ("nl", "en", "de", "fr", "es", "pt", "zh", "ar")


# pages with a screen of their own that also get an opening text and cards (shown above the screen), with blocks per community theme
SCREEN_BLOCKS = ["members", "products", "subscriptions", "donations", "games"]


def slugs_of(key):
    from .default_source import SLUGS

    return {l: v for l, v in SLUGS.get(key, {}).items()}


def title(key):
    return {l: TEXTS[f"title.{key}"][l] for l in LANGS if TEXTS[f"title.{key}"].get(l)}


# Pages that already have their own screen in the frontend: only their names (in every language) and the link to the module are set here.
# (key, url, module, scope, in_menu)
SCREENS = [
    ("cart", "/winkelwagen", "plugin:webshop", "public", False),
    ("checkout", "/afrekenen", "plugin:webshop", "public", False),
    ("my-community", "/dashboard/community", "profiles|discover|messages|chat", "private", True),
    ("product", "/producten/<slug>", "plugin:webshop", "public", False),
    ("my-subscriptions", "/dashboard/subscriptions", "subscriptions", "private", True),
    ("my-orders", "/dashboard/mijn-bestellingen", "orders", "private", True),
    ("my-donations", "/dashboard/mijn-donaties", "donations", "private", True),
]
# Pages with texts and blocks that the administrator can change in edit mode (content pages at an address of their own).
# (key, url, module, scope, in_menu)
CONTENT = [
    ("community", "/community", "profiles|discover|messages|chat", "public", True),
    ("search", "/zoeken", "discover", "public", False),
    ("payment", "/betalen", "orders|plugin:webshop", "public", False),
]

# the layout of the blocks per community theme: how many cards per row, how much room between them
THEME_LAYOUT = {
    "normal": {"cols": 1, "gap": "md"},
    "dating": {"cols": 3, "gap": "lg"},
    "business": {"cols": 2, "gap": "md"},
    "sporters": {"cols": 3, "gap": "md"},
    "webshop": {"cols": 3, "gap": "sm"},
}


# the pages of the webshop (a plugin): each holds the block of the plugin that does the work (an object that can be moved) between texts that the administrator can change
SHOP_PAGES = {"products": "products", "product": "product", "cart": "cart", "checkout": "checkout"}  # page key -> part of the webshop plugin


def hero_row(page, theme, name="intro"):
    """The top of a page: a banner in the colours of the theme with the title and the opening text (all layouts keep it)."""
    c = {"id": _id(page, f"cell-{name}"), "width": "auto", "halign": "center", "valign": "center", "items": [{"id": _id(page, name), "type": "text", "ref": ""}]}
    return {"id": _id(page, f"row-{name}"), "cols": 1, "width": "default", "gap": "md", "cells": [c], "bg": {}, "hero": theme}


def shop_layout(page, theme):
    """Opening text, the block of the plugin, and (shop page) three cards: all movable in edit mode."""
    base = layout_for(page, theme) if page == "products" else {"rows": [], "bg": {}}

    def cell(name, kind="text", ref=""):
        return {"id": _id(page, f"cell-{name}"), "width": "auto", "halign": "left", "valign": "top", "items": [{"id": _id(page, name), "type": kind, "ref": ref}]}

    def row(name, c, gap="md"):
        return {"id": _id(page, f"row-{name}"), "cols": 1, "width": "default", "gap": gap, "cells": [c], "bg": {}}

    obj = row("part", cell("part", "object", f"plugin-webshop-{SHOP_PAGES[page]}"))
    if page == "products":
        rows = base["rows"][:1] + [obj] + base["rows"][1:]  # intro, the products, the cards
    elif page == "product":
        rows = [hero_row(page, theme), obj]
    else:
        rows = [hero_row(page, theme), obj]
    return {"rows": rows, "bg": {}, "auto": theme}


def _id(page, name):
    return hashlib.md5(f"{page}:{name}".encode()).hexdigest()[:8]


def _text_for(page, name, theme):
    if name == "intro":
        return TEXTS.get(f"{page}.intro.{theme}") or TEXTS.get(f"{page}.intro") or TEXTS.get(f"{page}.intro.normal")
    return TEXTS.get(f"{page}.{name}")


def layout_for(page, theme):
    """The blocks of a standard page for a community theme: an opening text and three cards, in a grid that suits the theme."""
    spec = THEME_LAYOUT.get(theme) or THEME_LAYOUT["normal"]

    def cell(name, halign="left"):
        return {"id": _id(page, f"cell-{name}"), "width": "auto", "halign": halign, "valign": "top", "items": [{"id": _id(page, name), "type": "text", "ref": ""}]}

    rows = [hero_row(page, theme)]
    cards = ["card1", "card2", "card3"]
    cols = spec["cols"]
    if cols == 1:
        rows += [{"id": _id(page, f"row-{c}"), "cols": 1, "width": "default", "gap": spec["gap"], "cells": [cell(c)], "bg": {}} for c in cards]
    elif cols == 2:  # two cards side by side, the third one full width
        rows.append({"id": _id(page, "row-a"), "cols": 2, "width": "default", "gap": spec["gap"], "cells": [cell("card1"), cell("card2")], "bg": {}})
        rows.append({"id": _id(page, "row-b"), "cols": 1, "width": "default", "gap": spec["gap"], "cells": [cell("card3")], "bg": {}})
    else:
        rows.append({"id": _id(page, "row-cards"), "cols": 3, "width": "default", "gap": spec["gap"], "cells": [cell(c) for c in cards], "bg": {}})
    return {"rows": rows, "bg": {}, "auto": theme}


def _blocks(page, theme):
    """The texts (per language) that the layout shows: (content key, {lang: text})."""
    from .models import Page as _P  # noqa: F401

    out = []
    for name in ("intro", "card1", "card2", "card3"):
        t = _text_for(page, name, theme)
        if t:
            out.append((f"layout.{page}.{_id(page, name)}", t))
    return out


def _seed_blocks(page, theme):
    from apps.core.models import ContentBlock, Language

    have = set(Language.objects.values_list("code", flat=True))
    for key, t in _blocks(page, theme):
        for lang, text in t.items():
            if lang in have and text:
                ContentBlock.objects.get_or_create(key=key, lang=lang, defaults={"text": text})


def _theme():
    from apps.social import service as social

    try:
        return social.get()["profiles"]["theme"]
    except Exception:  # noqa: BLE001
        return "normal"


def ensure_pages():
    """Create the standard pages that are missing and the names/texts that are missing (never changes what an administrator edited)."""
    from apps.core.models import ContentBlock, Language

    theme = _theme()
    have_lang = set(Language.objects.values_list("code", flat=True))
    order = Page.objects.count()
    for key, url, module, scope, in_menu in SCREENS:
        row = Page.objects.filter(key=key).first() or Page.objects.filter(url=url, scope=scope).first()
        if not row:
            Page.objects.create(key=key, kind="link" if scope == "private" else "system", title=title(key), url=url, module=module, scope=scope, in_menu=in_menu,
                                audience="members" if scope == "private" else "all", order=order)
            order += 1
        elif not row.module:  # an old row follows the module now
            Page.objects.filter(pk=row.pk).update(module=module)
    for key, url, module, scope, in_menu in CONTENT:
        row = Page.objects.filter(key=key).first()
        if not row:
            Page.objects.create(key=key, kind="content", title=title(key), url=url, module=module, scope=scope, in_menu=in_menu, audience="all", order=order)
            order += 1
        _seed_blocks(key, theme)
        if not PageLayout.objects.filter(key=key).exists():
            PageLayout.objects.create(key=key, data=layout_for(key, theme))
        for lang in have_lang:  # the title text of the page itself, per language
            tt = TEXTS.get(f"title.{key}", {}).get(lang)
            if tt:
                ContentBlock.objects.get_or_create(key=f"page.{key}.title", lang=lang, defaults={"text": tt})
    # the opening texts of the dashboard pages of a member (Mijn community, Mijn abonnementen ...), in every language
    for tid, per_lang in TEXTS.items():
        if tid.startswith("my-"):
            for lang, text in per_lang.items():
                if lang in have_lang and text:
                    ContentBlock.objects.get_or_create(key=f"page.{tid}", lang=lang, defaults={"text": text})
    # the webshop pages: a layout with the plugin block as a movable object (only while the webshop plugin is installed)
    from apps.plugins.models import Plugin
    from apps.sysobjects import service as sysobj

    if Plugin.objects.filter(name="webshop").exists():
        sysobj.sync()
        for key in SHOP_PAGES:
            _seed_blocks(key, theme)
            lay = PageLayout.objects.filter(key=key).first()
            has_obj = lay and any(i.get("type") == "object" for r in (lay.data or {}).get("rows", []) for c in r.get("cells", []) for i in c.get("items", []))
            if lay is None or ((lay.data or {}).get("auto") and not has_obj):
                PageLayout.objects.update_or_create(key=key, defaults={"data": shop_layout(key, theme)})
    # the pages with a screen of their own: opening text and cards above it (editable), in a layout that fits the theme
    for key in SCREEN_BLOCKS:
        _seed_blocks(key, theme)
        if not PageLayout.objects.filter(key=key).exists():
            PageLayout.objects.create(key=key, data=layout_for(key, theme))
    # the address in every language of every standard page (never changes an address somebody set)
    from .default_source import SLUGS

    for key, sl in SLUGS.items():
        row = Page.objects.filter(key=key).first() or (Page.objects.filter(key="plugin-games").first() if key == "games" else None)
        if row and not row.slugs:
            Page.objects.filter(pk=row.pk).update(slugs=sl)
    # the names of the pages that already exist, in the languages they still miss (and the games page the plugins module made)
    for key in ("games", "members", "products", "subscriptions", "donations"):
        row = Page.objects.filter(key=key).first() or (Page.objects.filter(key="plugin-games").first() if key == "games" else None)
        if row and f"title.{key}" in TEXTS:
            merged = {**title(key), **(row.title or {})}
            if merged != (row.title or {}):
                Page.objects.filter(pk=row.pk).update(title=merged)


def apply_theme(theme):
    """The community theme changed: the standard pages that nobody edited get the layout of the new theme (an edited layout stays)."""
    for key in [k for k, *_ in CONTENT] + SCREEN_BLOCKS:
        lay = PageLayout.objects.filter(key=key).first()
        _seed_blocks(key, theme)
        if key in SHOP_PAGES and lay is not None and any(i.get("type") == "object" for r in (lay.data or {}).get("rows", []) for c in r.get("cells", []) for i in c.get("items", [])):
            if (lay.data or {}).get("auto"):
                PageLayout.objects.update_or_create(key=key, defaults={"data": shop_layout(key, theme)})
            continue
        if lay is None or (lay.data or {}).get("auto"):
            PageLayout.objects.update_or_create(key=key, defaults={"data": layout_for(key, theme)})
    for key in ("product", "cart", "checkout"):  # the other webshop pages follow the theme too (their layout is the plugin block between texts)
        lay = PageLayout.objects.filter(key=key).first()
        if lay is not None and (lay.data or {}).get("auto"):
            PageLayout.objects.update_or_create(key=key, defaults={"data": shop_layout(key, theme)})
