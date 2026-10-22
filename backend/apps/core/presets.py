"""Standard installations: ready-made sets of modules, plugins and the community theme for a kind of business. Choosing one switches everything for you
(Super admin → Systeem resetten, or right after a reset). The website texts, users and other data are never touched: only what is on or off, and the theme."""
import logging

from . import modules

logger = logging.getLogger(__name__)

BASE = ["pages", "edit_mode", "media", "branding", "theme", "languages", "privacy_pages", "cookies", "communication", "registration", "notifications", "help"]

# the parts of the admin itself (system settings, licence, plugins, storage, back-ups, and with them the page Standaard installaties): never switched off by an installation
ALWAYS_ON = ["system", "plugins", "storage", "backups"]

PRESETS = [
    {"key": "standaard-website", "name": "Standaard website", "icon": "globe", "theme": "normal", "plugins": [],
     "desc": "Alleen een website: pagina's en menu, media en systeemobjecten, FAQ en SEO. Zonder community, abonnementen, donaties of webshop. Met demo-gegevens heb je meteen een complete site.",
     "modules": BASE + ["seo", "faq", "sysobjects", "siteimport", "integrations"]},
    {"key": "webshop", "name": "Webwinkel", "icon": "cart", "theme": "webshop", "plugins": ["webshop"],
     "desc": "Producten verkopen met winkelwagen, bestellingen en online betalen. Klantaccounts, e-mailmeldingen en een FAQ.",
     "modules": BASE + ["seo", "faq", "orders", "subscriptions", "integrations", "sysobjects"]},
    {"key": "bedrijfswebsite", "name": "Bedrijfswebsite", "icon": "building", "theme": "normal", "plugins": [],
     "desc": "Een gewone website voor je bedrijf: pagina's, menu, bewerkmodus, SEO, FAQ en contact. Zonder community of webshop.",
     "modules": ["pages", "edit_mode", "media", "branding", "theme", "languages", "seo", "faq", "privacy_pages", "cookies", "communication", "help", "sysobjects"]},
    {"key": "zakelijk-netwerk", "name": "Zakelijk netwerk", "icon": "handshake", "theme": "business", "plugins": ["agenda", "marketplace"],
     "desc": "Een besloten netwerk voor ondernemers: profielen, zoeken, berichten en chat, een agenda voor afspraken en een marktplaats voor diensten.",
     "modules": BASE + ["seo", "faq", "profiles", "discover", "messages", "chat", "roles", "sysobjects"]},
    {"key": "datingplatform", "name": "Datingplatform", "icon": "heart", "theme": "dating", "plugins": ["agenda", "games"],
     "desc": "Leden vinden elkaar met zoeken en swipen, chatten en videobellen. Met leeftijdscontrole, abonnementen en een agenda voor dates en spelletjes.",
     "modules": BASE + ["faq", "profiles", "discover", "messages", "chat", "directconnect", "subscriptions", "donations", "age_gate", "word_filter", "twofa", "geo", "sysobjects"]},
    {"key": "sportclub", "name": "Sportclub of vereniging", "icon": "medal", "theme": "sporters", "plugins": ["agenda", "games"],
     "desc": "Een club met ledenprofielen, trainingsmaatjes zoeken, chat, een clubagenda met evenementen, lidmaatschappen en donaties.",
     "modules": BASE + ["seo", "faq", "profiles", "discover", "messages", "chat", "subscriptions", "donations", "sysobjects"]},
    {"key": "stichting", "name": "Stichting of goed doel", "icon": "ribbon", "theme": "normal", "plugins": ["agenda"],
     "desc": "Donaties en vrienden-abonnementen, een agenda met evenementen op de website, nieuws, FAQ en meldingen aan leden.",
     "modules": BASE + ["seo", "faq", "donations", "subscriptions", "integrations", "sysobjects"]},
    {"key": "marktplaats", "name": "Marktplaats", "icon": "tag", "theme": "webshop", "plugins": ["marketplace", "agenda"],
     "desc": "Leden zetten producten en diensten te koop, bieden of boeken een afspraak. Met berichten, zoeken en een agenda.",
     "modules": BASE + ["seo", "faq", "profiles", "discover", "messages", "orders", "integrations", "sysobjects"]},
    {"key": "spelletjessite", "name": "Spelletjessite", "icon": "gamepad", "theme": "normal", "plugins": ["games"],
     "desc": "Een community rond spelletjes: speel alleen of samen, met profielen, chat, ranglijsten en een abonnement voor extra spellen.",
     "modules": BASE + ["faq", "profiles", "messages", "chat", "subscriptions", "donations", "sysobjects"]},
]
BY_KEY = {p["key"]: p for p in PRESETS}


def _wanted_modules(preset):
    """The modules of the preset plus the ones they need (and the always-on core)."""
    want = {m["key"] for m in modules.MODULES if m.get("core")} | set(ALWAYS_ON) | set(preset["modules"])
    changed = True
    while changed:
        changed = False
        for m in modules.MODULES:
            if m["key"] in want:
                for r in m.get("requires", []):
                    if r not in want:
                        want.add(r)
                        changed = True
    return want


def ensure_home_logo():
    """The home page of a clean site starts with a hero with the logo of the theme in use (the block "home.hero" shows the logo of the theme by itself). A home page that was built before stays as it is."""
    from apps.pages import layout as page_layout
    from apps.pages.models import PageLayout

    lay = PageLayout.objects.filter(key="home").first()
    rows = (lay.data or {}).get("rows") if lay else None
    if rows and not (lay.data or {}).get("auto"):
        return False
    hero = {"id": "a1f0c3d2", "cols": 1, "width": "100", "gap": "lg", "title": "Hero", "screen": True, "top": "touch", "h_mode": "pct", "h": 50, "v": "top", "padding": {"t": 0}, "bg": {},
            "cells": [{"id": "b2e1d4c3", "width": "auto", "halign": "center", "valign": "center", "items": [{"id": "c3d2e5b4", "type": "image", "ref": "home.hero"}]}]}
    data = page_layout.clean({"rows": [hero], "bg": {}})
    PageLayout.objects.update_or_create(key="home", defaults={"data": data})
    return True


def _contents(p):
    """What an installation holds: its pages, modules and plugins (for the pop-up Inhoud en prijs)."""
    try:
        from apps.pages.models import Page
        from apps.plugins.models import Plugin

        want, plugs = _wanted_modules(p), plugins_for(p)
        titles = {x.name: x.title or x.name for x in Plugin.objects.all()}
        pages = []
        for pg in Page.objects.filter(scope="public", kind__in=("system", "content")).exclude(source="demo").order_by("order", "id"):
            mods = [m for m in (pg.module or "").split("|") if m]
            if mods and not any((m in want) if not m.startswith("plugin:") else (m[7:] in plugs) for m in mods):
                continue
            pages.append({"key": pg.key, "title": (pg.title or {}).get("nl") or (pg.title or {}).get("en") or pg.key, "url": pg.url or f"/p/{pg.key}"})
        core = {m["key"] for m in modules.MODULES if m.get("core")}
        mods_out = [{"key": m["key"], "label": m["label"], "desc": m.get("desc", "")} for m in modules.MODULES if m["key"] in want and m["key"] not in core]
        return {"pages": pages, "modules": mods_out, "plugins": [{"name": n, "title": titles.get(n, n)} for n in plugs]}
    except Exception:  # noqa: BLE001
        logger.exception("contents of a preset")
        return None


def _price(p):
    """Price (per month, quarter, year) and the estimate for design and implementation of this installation."""
    try:
        from . import pricing

        return pricing.plan_of(_wanted_modules(p), plugins_for(p))
    except Exception:  # noqa: BLE001
        logger.exception("price of a preset")
        return None


def _demo_parts(key):
    """What the demo data of this installation makes (see apps/core/demo.py)."""
    try:
        from . import demo

        return demo.parts_for(key)
    except Exception:  # noqa: BLE001
        return []


def listing():
    from apps.plugins.models import Plugin

    have = {p.name: p.title or p.name for p in Plugin.objects.all()}
    labels = {m["key"]: m["label"] for m in modules.MODULES}
    allowed = admin_allowed()
    act = active()
    out = []
    for p in PRESETS:
        want = _wanted_modules(p)
        out.append({"contents": _contents(p), "price": _price(p), "demo_parts": _demo_parts(p["key"]), "active": p["key"] == act, "saved_pages": sorted(saved_pages(p["key"])), "admin": p["key"] in allowed, "key": p["key"], "name": p["name"], "icon": p["icon"], "desc": p["desc"], "theme": p["theme"] if "profiles" in want else "normal",
                    "modules": [labels[k] for k in labels if k in want and k not in {m["key"] for m in modules.MODULES if m.get("core")} | set(ALWAYS_ON)],
                    "plugins": [{"name": n, "title": have.get(n, n), "installed": n in have} for n in p["plugins"]]})
    return out


def admin_allowed():
    """The keys of the standard installations that administrators (not only superadmins) may set; chosen by the superadmin."""
    from .models import SystemSettings

    data = SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    return [k for k in (data.get("admin_presets") or []) if k in BY_KEY]


def set_admin_allowed(keys):
    from .models import SystemSettings

    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    obj.data = {**(obj.data or {}), "admin_presets": [k for k in dict.fromkeys(keys) if k in BY_KEY]}
    obj.save()
    return admin_allowed()


def plugins_for(preset):
    """The plugins of a standard installation and the plugins those need (the webshop needs Orders and Payments): all of them must be on."""
    from apps.plugins.models import Plugin

    out, todo = [], list(preset["plugins"])
    while todo:
        n = todo.pop(0)
        if n in out:
            continue
        out.append(n)
        row = Plugin.objects.filter(name=n).first()
        todo += [r for r in ((row.manifest or {}).get("requires") or []) if r not in out] if row else []
    return out


def _data():
    from .models import SystemSettings

    return dict(SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {})


def _save_data(data):
    from .models import SystemSettings

    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    obj.data = data
    obj.save()


def active():
    """The standard installation that was set last (or None)."""
    k = _data().get("active_preset")
    return k if k in BY_KEY else None


def saved_pages(key):
    return dict((_data().get("preset_pages") or {}).get(key) or {})


def save_page(key, page_key):
    """Keep the page as it is now (blocks and their texts) in this standard installation: setting the installation puts it back."""
    from apps.core.models import ContentBlock
    from apps.pages.models import PageLayout

    lay = PageLayout.objects.filter(key=page_key).first()
    if not lay:
        raise ValueError("Deze pagina heeft nog geen blokken om op te slaan.")
    keys = set()
    for r in (lay.data or {}).get("rows", []):
        for c in r.get("cells", []):
            for it in c.get("items", []):
                if it.get("type") != "object":
                    keys.add(it.get("ref") or f"layout.{page_key}.{it.get('id')}")
    blocks = {}
    for b in ContentBlock.objects.filter(key__in=keys):
        blocks.setdefault(b.key, {})[b.lang] = b.text
    data = _data()
    pages = dict(data.get("preset_pages") or {})
    mine = dict(pages.get(key) or {})
    mine[page_key] = {"layout": lay.data, "blocks": blocks, "media": _media_names(lay.data)}
    pages[key] = mine
    data["preset_pages"] = pages
    _save_data(data)
    return sorted(mine)


def _media_ids(layout):
    """The pictures a layout uses: the backgrounds of its rows (and their mouse-over)."""
    ids = set()
    for r in (layout or {}).get("rows", []):
        for bg in (r.get("bg") or {}, (r.get("bg") or {}).get("hover") or {}):
            if isinstance(bg, dict) and bg.get("media"):
                ids.add(int(bg["media"]))
    return ids


def _media_names(layout):
    """{id: {name, source}}: a picture is found again by its name (the id differs per installation)."""
    from apps.medialib.models import MediaItem

    return {str(m.id): {"name": m.name, "source": m.source} for m in MediaItem.objects.filter(pk__in=_media_ids(layout))}


def _find_media(info):
    from apps.medialib.models import MediaItem

    qs = MediaItem.objects.filter(name=info.get("name"))
    return qs.filter(source=info.get("source")).first() or qs.first()


def _link_media(layout, names, only_missing=False):
    """Put the pictures of a saved layout (found by name) back in its rows; a picture that cannot be found leaves the background empty (it comes when the demo data is made)."""
    from apps.medialib.models import MediaItem

    for r in (layout or {}).get("rows", []):
        bg = r.get("bg")
        if not isinstance(bg, dict) or not bg.get("media"):
            continue
        info = names.get(str(bg["media"]))
        if info:
            item = _find_media(info)
            if item:
                bg["media"] = item.id
            else:
                r["bg"] = {}
        elif not MediaItem.objects.filter(pk=bg["media"]).exists():
            r["bg"] = {}
    return layout


def relink_saved_pages(key):
    """After demo data was made: the backgrounds that could not be linked when the installation was set are linked now (by the name of the picture)."""
    from apps.pages.models import PageLayout

    for page_key, row in saved_pages(key).items():
        names, saved = row.get("media") or {}, row.get("layout") or {}
        lay = PageLayout.objects.filter(key=page_key).first()
        if not lay or not names:
            continue
        data = dict(lay.data or {})
        by_id = {r.get("id"): r for r in saved.get("rows", [])}
        changed = False
        for r in data.get("rows", []):
            was = (by_id.get(r.get("id")) or {}).get("bg") or {}
            if was.get("media") and not (r.get("bg") or {}).get("media"):
                item = _find_media(names.get(str(was["media"])) or {})
                if item:
                    r["bg"] = {**was, "media": item.id}
                    changed = True
        if changed:
            PageLayout.objects.filter(pk=lay.pk).update(data=data)


def _apply_saved_pages(key):
    from apps.core.models import ContentBlock, Language
    from apps.pages.models import PageLayout

    have = set(Language.objects.values_list("code", flat=True))
    for page_key, row in saved_pages(key).items():
        import copy

        PageLayout.objects.update_or_create(key=page_key, defaults={"data": _link_media(copy.deepcopy(row.get("layout") or {}), row.get("media") or {})})
        for bk, texts in (row.get("blocks") or {}).items():
            for lang, text in texts.items():
                if lang in have:
                    ContentBlock.objects.update_or_create(key=bk, lang=lang, defaults={"text": text})


def unapply(key):
    """Take the installation away: its modules and plugins go off (what the always-on core needs stays), its pages of plugins leave the menu, and it is no longer the installation in use. No data is removed."""
    from apps.plugins import runtime
    from apps.plugins.models import Plugin

    from .models import ModuleState

    preset = BY_KEY.get(key)
    if not preset:
        raise KeyError(key)
    keep = {m["key"] for m in modules.MODULES if m.get("core")} | set(ALWAYS_ON)
    for m in modules.MODULES:
        if not m.get("core"):
            ModuleState.objects.update_or_create(key=m["key"], defaults={"enabled": m["key"] in keep})
    modules.invalidate()
    Plugin.objects.filter(enabled=True).update(enabled=False)
    runtime.ensure_loaded(True)
    try:
        from apps.pages.models import Page

        Page.objects.filter(module__startswith="plugin:").update(enabled=False, in_menu=False)
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: pages of plugins could not be switched off", key)
    data = _data()
    data.pop("active_preset", None)
    _save_data(data)
    try:
        from apps.sysobjects import service as so

        so.sync()
    except Exception:  # noqa: BLE001
        pass
    logger.warning("Standard installation %s removed", key)
    return {"preset": key, "removed": True}


def apply(key, preset=None):
    """Switch everything for this standard installation (or for a set made by the wizard: preset = {modules, plugins, theme}). Returns what happened."""
    from apps.plugins import runtime
    from apps.plugins.models import Plugin
    from apps.social import service as social, themes

    from .models import ModuleState

    preset = preset or BY_KEY.get(key)
    if not preset:
        raise KeyError(key)
    want = _wanted_modules(preset)
    for m in modules.MODULES:
        if not m.get("core"):
            ModuleState.objects.update_or_create(key=m["key"], defaults={"enabled": m["key"] in want})
    modules.invalidate()
    need = plugins_for(preset)
    missing = []
    for p in Plugin.objects.all():
        on = p.name in need
        if p.enabled != on or (on and p.error):
            Plugin.objects.filter(pk=p.pk).update(enabled=on, **({"error": ""} if on else {}))
    missing = [n for n in need if not Plugin.objects.filter(name=n).exists()]
    runtime.ensure_loaded(True)
    theme = preset["theme"]
    try:
        if "profiles" in want:  # the community theme: switched on for this website, with its fields and the layout of the standard pages
            on = set(themes.enabled()) | {theme}
            themes.set_enabled(sorted(on))
            social.save({"profiles": themes.theme_payload(theme)}, ["profiles"])
            from apps.pages import defaults as page_defaults

            page_defaults.apply_theme(theme)
    except Exception:  # noqa: BLE001 - the modules and plugins are done; the theme can be set by hand
        logger.exception("Preset %s: community theme could not be set", key)
    try:  # the pages of a plugin (Producten, Winkelwagen ...) belong to the installations that use that plugin: the others do not have them in the menu
        from apps.pages.models import Page

        for pg in Page.objects.filter(module__startswith="plugin:"):
            on = pg.module[7:] in need
            if on and not pg.enabled:
                Page.objects.filter(pk=pg.pk).update(enabled=True, in_menu=pg.key == "products" or pg.in_menu)
            elif not on and (pg.enabled or pg.in_menu):
                Page.objects.filter(pk=pg.pk).update(enabled=False, in_menu=False)
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: pages of plugins could not be switched", key)
    try:
        from apps.pages import service as pages_service

        pages_service.ensure_defaults()
    except Exception:  # noqa: BLE001
        pass
    try:
        ensure_home_logo()
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: the logo in the home design could not be set", key)
    try:  # the logos of the theme in use also go into the media library
        from . import themepacks

        themepacks.logos_to_library()
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: logos could not be put in the media library", key)
    try:
        _apply_saved_pages(key)  # the pages that were saved in this installation come back as they were
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: saved pages could not be put back", key)
    data = _data()
    data["active_preset"] = key
    _save_data(data)
    try:
        from apps.sysobjects import service as so

        so.sync()
    except Exception:  # noqa: BLE001
        pass
    logger.warning("Standard installation %s applied", key)
    return {"preset": key, "modules_on": sorted(want), "plugins_on": [n for n in need if n not in missing], "plugins_missing": missing, "theme": theme if "profiles" in want else None}
