# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Standard installations: ready-made sets of modules, plugins and the community theme for a kind of business. Choosing one switches everything for you
(Super admin → Systeem resetten, or right after a reset). The website texts, users and other data are never touched: only what is on or off, and the theme."""
import logging

from . import modules

logger = logging.getLogger(__name__)

BASE = ["pages", "edit_mode", "media", "branding", "theme", "languages", "privacy_pages", "cookies", "communication", "registration", "notifications", "help"]

# the parts of the admin itself (system settings, licence, plugins, storage, back-ups, and with them the page Standaard installaties): never switched off by an installation
ALWAYS_ON = ["system", "plugins", "storage", "backups"]

PRESETS = [
    {"key": "standaard-website", "name": "Standaard website", "icon": "globe", "theme": "normal", "plugins": ["documents"],
     "desc": "Alleen een website: pagina's en menu, media en systeemobjecten, FAQ en SEO, en documentbeheer. Zonder community, abonnementen, donaties of webshop. Met demo-gegevens heb je meteen een complete site.",
     "modules": BASE + ["seo", "faq", "sysobjects", "siteimport", "integrations"]},
    {"key": "webshop", "name": "Webwinkel", "icon": "cart", "theme": "webshop", "plugins": ["webshop", "subscriptions"],
     "desc": "Producten verkopen met winkelwagen, bestellingen en online betalen. Klantaccounts, e-mailmeldingen en een FAQ.",
     "modules": BASE + ["seo", "faq", "integrations", "sysobjects"]},
    {"key": "bedrijfswebsite", "name": "Bedrijfswebsite", "icon": "building", "theme": "normal", "plugins": ["documents"],
     "desc": "Een gewone website voor je bedrijf: pagina's, menu, bewerkmodus, SEO, FAQ en contact. Zonder community of webshop.",
     "modules": ["pages", "edit_mode", "media", "branding", "theme", "languages", "seo", "faq", "privacy_pages", "cookies", "communication", "help", "sysobjects"]},
    {"key": "zakelijk-netwerk", "name": "Zakelijk netwerk", "icon": "handshake", "theme": "business", "plugins": ["community", "profile-themes", "agenda", "marketplace", "documents"],
     "desc": "Een besloten netwerk voor ondernemers: profielen, zoeken, berichten en chat, een agenda voor afspraken, een marktplaats voor diensten en documentbeheer.",
     "modules": BASE + ["seo", "faq", "roles", "sysobjects"]},
    {"key": "intranet", "name": "Intranet", "icon": "lock", "theme": "business", "plugins": ["community", "profile-themes", "documents", "agenda"], "closed": True,
     "exclude_modules": ["discover", "directconnect"],
     "desc": "Een volledig besloten intranet voor je organisatie: zonder inloggen is er niets te zien. Eén startpagina, een smoelenboek van collega's, een documentensysteem (DMS) en een agenda, met berichten en chat, een interne kennisbank (FAQ), rollen en rechten, meldingen en twee-staps verificatie.",
     "modules": ["pages", "edit_mode", "media", "branding", "theme", "languages", "communication", "notifications", "help", "faq", "roles", "twofa", "word_filter", "sysobjects", "stats", "integrations"]},
    {"key": "datingplatform", "name": "Datingplatform", "icon": "heart", "theme": "dating", "plugins": ["community", "profile-themes", "subscriptions", "agenda", "games", "age-gates"],
     "desc": "Leden vinden elkaar met zoeken en swipen, chatten en videobellen. Met leeftijdscontrole, abonnementen en een agenda voor dates en spelletjes.",
     "modules": BASE + ["faq", "age_gate", "word_filter", "twofa", "geo", "sysobjects"]},
    {"key": "sportclub", "name": "Sportclub of vereniging", "icon": "medal", "theme": "sporters", "plugins": ["community", "profile-themes", "subscriptions", "agenda", "games", "documents"],
     "desc": "Een club met ledenprofielen, trainingsmaatjes zoeken, chat, een clubagenda met evenementen, lidmaatschappen en donaties.",
     "modules": BASE + ["seo", "faq", "sysobjects"]},
    {"key": "stichting", "name": "Stichting of goed doel", "icon": "ribbon", "theme": "normal", "plugins": ["subscriptions", "agenda", "documents"],
     "desc": "Donaties en vrienden-abonnementen, een agenda met evenementen op de website, nieuws, FAQ en meldingen aan leden.",
     "modules": BASE + ["seo", "faq", "integrations", "sysobjects"]},
    {"key": "marktplaats", "name": "Marktplaats", "icon": "tag", "theme": "webshop", "plugins": ["community", "profile-themes", "marketplace", "agenda", "orders"],
     "desc": "Leden zetten producten en diensten te koop, bieden of boeken een afspraak. Met berichten, zoeken en een agenda.",
     "modules": BASE + ["seo", "faq", "integrations", "sysobjects"]},
    {"key": "spelletjessite", "name": "Spelletjessite", "icon": "gamepad", "theme": "normal", "plugins": ["community", "profile-themes", "subscriptions", "games"],
     "desc": "Een community rond spelletjes: speel alleen of samen, met profielen, chat, ranglijsten en een abonnement voor extra spellen.",
     "modules": BASE + ["faq", "sysobjects"]},
]
# (the parts that are plugins - Community, Abonnementen, Orders, Webshop, Financieel - are in the plugin list of an installation; plugins_for adds what they need, and _wanted_modules the modules that belong to them)
for _p in PRESETS:  # a part that became a plugin (SEO, FAQ, Statistieken, Site importeren, Leeftijd/land/gokken) is named in the modules above: it goes to the plugin list, where the screens show it
    _own = {m["key"]: m["plugin"] for m in modules.MODULES if m.get("plugin")}
    _p["plugins"] = list(dict.fromkeys([*_p.get("plugins", []), *[_own[k] for k in _p["modules"] if k in _own]]))
    _p["modules"] = [k for k in _p["modules"] if k not in _own]
BY_KEY = {p["key"]: p for p in PRESETS}
DEMO_PARTS = {"media": "Voorbeeldplaatjes", "heroes": "Hero-achtergronden", "users": "Gebruikers met profiel", "plans": "Abonnementen", "money": "Donatie-acties met giften", "faq": "FAQ-vragen", "pages": "Pagina's",
              "views": "Media-systeemobjecten"}
DEMO_DEFAULT = {"media": 16, "heroes": 6, "users": 8}


def edits(key):
    """What the superadmin changed in this standard installation (Super admin → Standaard installaties → Inhoud bekijken): {modules, plugins, pages: {add, remove}, demo: {drop, media, heroes, users}}."""
    return dict(((_data().get("preset_edits") or {}).get(key)) or {})


def get(key):
    """The standard installation as it is now: the built-in definition with the superadmin's changes (modules and plugins added or removed)."""
    base = BY_KEY.get(key)
    if not base:
        return None
    e = edits(key)
    out = dict(base)
    for field in ("modules", "plugins"):
        d = e.get(field) or {}
        out[field] = [x for x in [*base[field], *(d.get("add") or [])] if x not in (d.get("remove") or [])]
        out[field] = list(dict.fromkeys(out[field]))
    return out


def demo_config(key):
    """The demo data of an installation: the parts that are left out and the numbers (pictures, backgrounds, users)."""
    d = dict(edits(key).get("demo") or {})
    return {"drop": [x for x in d.get("drop", []) if x in DEMO_PARTS or str(x).startswith("plugin:")], **{k: int(d.get(k, v)) for k, v in DEMO_DEFAULT.items()}}


def page_edits(key):
    d = edits(key).get("pages") or {}
    return {"add": list(d.get("add") or []), "remove": list(d.get("remove") or [])}


def edit_options(key):
    """Everything the editor offers, with what is chosen now (and what the built-in definition has): modules, installed plugins, existing pages, demo parts."""
    from apps.plugins.models import Plugin
    from apps.pages.models import Page

    base, cur = BY_KEY[key], get(key)
    want = _wanted_modules(cur)
    core = {m["key"] for m in modules.MODULES if m.get("core")} | set(ALWAYS_ON)
    chosen = set(cur["modules"])
    needs = {}
    for m in modules.MODULES:
        if m["key"] in want:
            for r in m.get("requires", []):
                needs.setdefault(r, []).append(m["label"])
    mods = [{"key": m["key"], "label": m["label"], "group": m.get("group", ""), "desc": m.get("desc", ""), "on": m["key"] in chosen, "auto": m["key"] in want and m["key"] not in chosen, "base": m["key"] in base["modules"],
             "needed_by": needs.get(m["key"], []), "always": m["key"] in core} for m in modules.MODULES if m["key"] not in core and not m.get("hidden")]
    plugs_on = set(cur["plugins"])
    plugs = [{"name": p.name, "title": p.title or p.name, "enabled": p.enabled, "on": p.name in plugs_on, "base": p.name in base["plugins"], "requires": (p.manifest or {}).get("requires") or []} for p in Plugin.objects.order_by("name")]
    contents = _contents(cur) or {}
    in_now = {x["key"] for x in contents.get("pages", [])}
    pe = page_edits(key)
    pages = [{"key": pg.key, "title": (pg.title or {}).get("nl") or (pg.title or {}).get("en") or pg.key, "on": pg.key in in_now, "kind": pg.kind, "module": pg.module or ""}
             for pg in Page.objects.filter(scope="public", kind__in=("system", "content")).exclude(source="demo").order_by("order", "id")]
    dc = demo_config(key)
    parts = _demo_parts(key, ignore_drop=True)
    titles = {p.name: p.title or p.name for p in Plugin.objects.all()}
    return {"key": key, "name": base["name"], "modules": mods, "plugins": plugs, "pages": pages, "page_edits": pe, "edited": bool(edits(key)),
            "demo": {"parts": [{"key": x, "label": DEMO_PARTS.get(x) or ("Demo van " + titles.get(x[7:], x[7:]) if x.startswith("plugin:") else x), "on": x not in dc["drop"]} for x in parts], "media": dc["media"], "heroes": dc["heroes"], "users": dc["users"]}}


def save_edits(key, body):
    """Save the superadmin's choices as changes against the built-in definition. Everything added must exist: modules in the system, plugins installed (on or off), pages in the website."""
    from apps.plugins.models import Plugin
    from apps.pages.models import Page

    base = BY_KEY[key]
    out = {}
    if "modules" in body:
        want = [str(x) for x in (body["modules"] or [])]
        unknown = [x for x in want if x not in modules.BY_KEY]
        if unknown:
            raise ValueError(f"Deze module bestaat niet: {unknown[0]}.")
        out["modules"] = {"add": [x for x in want if x not in base["modules"]], "remove": [x for x in base["modules"] if x not in want]}
    if "plugins" in body:
        want = [str(x) for x in (body["plugins"] or [])]
        have = set(Plugin.objects.values_list("name", flat=True))
        missing = [x for x in want if x not in have]
        if missing:
            raise ValueError(f"De plugin \"{missing[0]}\" is niet geïnstalleerd: installeer hem eerst bij Admin → Plugins (hij hoeft niet aan te staan).")
        out["plugins"] = {"add": [x for x in want if x not in base["plugins"]], "remove": [x for x in base["plugins"] if x not in want]}
    pages_on = None
    if "pages_on" in body:
        have = set(Page.objects.filter(scope="public", kind__in=("system", "content")).exclude(source="demo").values_list("key", flat=True))
        pages_on = [str(x) for x in (body["pages_on"] or [])]
        missing = [x for x in pages_on if x not in have]
        if missing:
            raise ValueError(f"Deze pagina bestaat niet: {missing[0]}.")
    elif isinstance(body.get("pages"), dict):
        have = set(Page.objects.filter(scope="public", kind__in=("system", "content")).exclude(source="demo").values_list("key", flat=True))
        add, rem = [str(x) for x in body["pages"].get("add", [])], [str(x) for x in body["pages"].get("remove", [])]
        missing = [x for x in add + rem if x not in have]
        if missing:
            raise ValueError(f"Deze pagina bestaat niet: {missing[0]}.")
        out["pages"] = {"add": list(dict.fromkeys(add)), "remove": [x for x in dict.fromkeys(rem) if x not in add]}
    if isinstance(body.get("demo"), dict):
        d = body["demo"]
        drop = [str(x) for x in d.get("drop", []) if x in DEMO_PARTS or str(x).startswith("plugin:")]
        num = lambda k, hi: max(0, min(hi, int(d.get(k, DEMO_DEFAULT[k]) or 0)))  # noqa: E731
        out["demo"] = {"drop": drop, "media": num("media", 80), "heroes": num("heroes", 24), "users": num("users", 200)}
    data = _data()
    allx = dict(data.get("preset_edits") or {})
    cur = dict(allx.get(key) or {})
    cur.update(out)
    if pages_on is not None:  # the pages follow the modules and plugins as they are after this save: what differs becomes an addition or a removal
        data["preset_edits"] = {**allx, key: cur}
        _save_data(data)
        mine = {pg.key for pg in _module_pages(get(key))}
        cur["pages"] = {"add": [k for k in pages_on if k not in mine], "remove": [k for k in mine if k not in pages_on]}
        data = _data()
        allx = dict(data.get("preset_edits") or {})
    allx[key] = {k: v for k, v in cur.items() if v and not (isinstance(v, dict) and not any(v.values()) and k != "demo")}
    data["preset_edits"] = allx
    _save_data(data)
    return edit_options(key)


def reset_edits(key):
    data = _data()
    allx = dict(data.get("preset_edits") or {})
    allx.pop(key, None)
    data["preset_edits"] = allx
    _save_data(data)
    return edit_options(key)


def _wanted_modules(preset):
    """The modules of the preset plus the ones they need (and the always-on core)."""
    want = {m["key"] for m in modules.MODULES if m.get("core")} | set(ALWAYS_ON) | set(preset["modules"])
    try:
        plugs = set(plugins_for(preset)) if (preset.get("plugins") or preset.get("modules")) else set()
    except Exception:  # noqa: BLE001 - database not ready
        plugs = set(preset.get("plugins") or [])
    want |= {m["key"] for m in modules.MODULES if m.get("plugin") in plugs}  # the modules that belong to the plugins of the installation (Community: profiles, matching, messages, chat ...)
    changed = True
    while changed:
        changed = False
        for m in modules.MODULES:
            if m["key"] in want:
                for r in m.get("requires", []):
                    if r not in want:
                        want.add(r)
                        changed = True
    return want - set(preset.get("exclude_modules") or [])  # parts of a plugin this installation does not use (an intranet has no matching or direct connection)


def ensure_home_logo():
    """A clean site has the standard start page (the title and text "Onze website is in aanbouw", the logo is in the header): a start page that only holds the big logo of an older
    version is taken away. A start page that was designed (by hand or by an installation) stays. Returns True when something was removed."""
    from apps.pages.models import PageLayout

    lay = PageLayout.objects.filter(key="home").first()
    if not lay:
        return False
    data = lay.data or {}
    items = [i for r in data.get("rows", []) for c in r.get("cells", []) for i in c.get("items", [])]
    if data.get("auto") or (len(items) == 1 and items[0].get("type") == "image" and items[0].get("ref") == "home.hero"):
        lay.delete()
        return True
    return False


def _module_pages(p):
    """The pages that belong to an installation by its modules and plugins (before the superadmin's additions and removals)."""
    from apps.pages.models import Page

    want, plugs = _wanted_modules(p), plugins_for(p)
    out = []
    for pg in Page.objects.filter(scope="public", kind__in=("system", "content")).exclude(source="demo").order_by("order", "id"):
        mods = [m for m in (pg.module or "").split("|") if m]
        if mods and not any((m in want) if not m.startswith("plugin:") else (m[7:] in plugs) for m in mods):
            continue
        out.append(pg)
    return out


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
        pe = page_edits(p.get("key", "")) if p.get("key") else {"add": [], "remove": []}
        have = {x["key"] for x in pages}
        pages = [x for x in pages if x["key"] not in pe["remove"]]
        for pg in Page.objects.filter(scope="public", kind__in=("system", "content"), key__in=[k for k in pe["add"] if k not in have]).exclude(source="demo").order_by("order", "id"):
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


def _demo_parts(key, ignore_drop=False):
    """What the demo data of this installation makes (see apps/core/demo.py)."""
    try:
        from . import demo

        return demo.parts_for(key, ignore_drop=ignore_drop)
    except Exception:  # noqa: BLE001
        return []


def listing():
    from apps.plugins.models import Plugin

    have = {p.name: p.title or p.name for p in Plugin.objects.all()}
    labels = {m["key"]: m["label"] for m in modules.MODULES}
    allowed = admin_allowed()
    act = active()
    dflt = set(default_keys())
    out = []
    for base in PRESETS:
        p = get(base["key"])
        want = _wanted_modules(p)
        out.append({"default": p["key"] in dflt, "edited": bool(edits(p["key"])), "demo_cfg": {k: v for k, v in demo_config(p["key"]).items() if k != "drop"}, "contents": _contents(p), "price": _price(p), "demo_parts": _demo_parts(p["key"]), "active": p["key"] == act, "saved_pages": sorted(saved_pages(p["key"])), "admin": p["key"] in allowed, "key": p["key"], "name": p["name"], "icon": p["icon"], "desc": p["desc"], "theme": p["theme"] if "profiles" in want else "normal",
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

    out, todo = [], list(preset.get("plugins") or [])
    todo += [m["plugin"] for m in modules.MODULES if m.get("plugin") and m["key"] in (preset.get("modules") or [])]  # (a set from the wizard that names a module that is a plugin now)
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


def default_keys():
    """The standard installations that are offered when nothing is installed yet (several can be ticked; the first one until the superadmin chooses)."""
    d = _data()
    keys = [k for k in dict.fromkeys(d.get("default_presets") or ([d["default_preset"]] if d.get("default_preset") else [])) if k in BY_KEY]
    return keys or [PRESETS[0]["key"]]


def set_default(key, on=True):
    """Tick or untick one installation as offered. At least one always stays ticked."""
    if key not in BY_KEY:
        raise ValueError("Onbekende installatie.")
    keys = default_keys()
    keys = [k for k in PRESETS_ORDER if k in set(keys) | {key}] if on else [k for k in keys if k != key] or keys
    _save_data({**_data(), "default_presets": keys})
    return keys


PRESETS_ORDER = [p["key"] for p in PRESETS]


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
    if preset.get("closed"):
        set_closed(False)  # without the installation the website is open again
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
    try:
        from . import preset_pages

        preset_pages.remove(key)  # the designed pages of this installation go with it
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: its pages could not be removed", key)
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


def set_closed(on):
    """Closed website on/off (Beveiliging -> Algemeen). Self sign-up goes off with it: in a closed website people are invited."""
    from apps.security import service

    from apps.security.models import SecuritySettings

    obj, _ = SecuritySettings.objects.get_or_create(pk=1)
    data = dict(obj.data or {})
    data["basic"] = {**(data.get("basic") or {}), "closed_site": bool(on)}
    if on:
        data["registration"] = {**(data.get("registration") or {}), "enabled": False}
    obj.data = data
    obj.save()
    service.invalidate()


def apply(key, preset=None):
    """Switch everything for this standard installation (or for a set made by the wizard: preset = {modules, plugins, theme}). Returns what happened."""
    from apps.plugins import runtime
    from apps.plugins.models import Plugin

    from .models import ModuleState

    preset = preset or get(key)
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
    from apps.plugins import installer

    for n in need:  # a plugin of the installation that is in the library but not installed yet (SEO, FAQ ...): installed now
        if not Plugin.objects.filter(name=n).exists():
            installer.install_from_library(n)
    for p in Plugin.objects.filter(name__in=need, enabled=False):  # (just installed: switch on, the loop above ran before)
        Plugin.objects.filter(pk=p.pk).update(enabled=True, error="")
    missing = [n for n in need if not Plugin.objects.filter(name=n).exists()]
    runtime.ensure_loaded(True)
    theme = preset["theme"]
    from apps.plugins import facade

    social, themes = facade.mod("community", "service"), facade.mod("community", "themes")  # (the plugin Community)
    try:
        if "profiles" in want and social and themes:  # the community theme: switched on for this website, with its fields and the layout of the standard pages
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
    try:  # the designed pages of this installation (start page, community pages) go in; those of another installation go out
        from . import preset_pages

        preset_pages.install(key)
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: its pages could not be installed", key)
    try:
        _apply_saved_pages(key)  # the pages that were saved in this installation come back as they were
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: saved pages could not be put back", key)
    try:  # pages the superadmin added to or took out of this installation: on or off (they must exist; they need not be active now)
        from apps.pages.models import Page

        pe = page_edits(key)
        Page.objects.filter(key__in=pe["add"]).update(enabled=True)
        Page.objects.filter(key__in=pe["remove"]).update(enabled=False, in_menu=False)
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: the edited pages could not be set", key)
    try:  # an installation can be closed (an intranet): nothing is shown or answered without logging in; the others are open again
        set_closed(bool(preset.get("closed")))
    except Exception:  # noqa: BLE001
        logger.exception("Preset %s: the closed website setting could not be set", key)
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
