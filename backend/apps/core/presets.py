"""Standard installations: ready-made sets of modules, plugins and the community theme for a kind of business. Choosing one switches everything for you
(Super admin → Systeem resetten, or right after a reset). The website texts, users and other data are never touched: only what is on or off, and the theme."""
import logging

from . import modules

logger = logging.getLogger(__name__)

BASE = ["pages", "edit_mode", "media", "branding", "theme", "languages", "privacy_pages", "cookies", "communication", "registration", "notifications", "help"]

PRESETS = [
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
    want = {m["key"] for m in modules.MODULES if m.get("core")} | set(preset["modules"])
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


def listing():
    from apps.plugins.models import Plugin

    have = {p.name: p.title or p.name for p in Plugin.objects.all()}
    labels = {m["key"]: m["label"] for m in modules.MODULES}
    out = []
    for p in PRESETS:
        want = _wanted_modules(p)
        out.append({"key": p["key"], "name": p["name"], "icon": p["icon"], "desc": p["desc"], "theme": p["theme"] if "profiles" in want else "normal",
                    "modules": [labels[k] for k in labels if k in want and k not in {m["key"] for m in modules.MODULES if m.get("core")}],
                    "plugins": [{"name": n, "title": have.get(n, n), "installed": n in have} for n in p["plugins"]]})
    return out


def apply(key):
    """Switch everything for this standard installation. Returns what happened."""
    from apps.plugins import runtime
    from apps.plugins.models import Plugin
    from apps.social import service as social, themes

    from .models import ModuleState

    preset = BY_KEY.get(key)
    if not preset:
        raise KeyError(key)
    want = _wanted_modules(preset)
    for m in modules.MODULES:
        if not m.get("core"):
            ModuleState.objects.update_or_create(key=m["key"], defaults={"enabled": m["key"] in want})
    modules.invalidate()
    missing = []
    for p in Plugin.objects.all():
        on = p.name in preset["plugins"]
        if p.enabled != on or (on and p.error):
            Plugin.objects.filter(pk=p.pk).update(enabled=on, **({"error": ""} if on else {}))
    missing = [n for n in preset["plugins"] if not Plugin.objects.filter(name=n).exists()]
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
    try:
        from apps.pages import service as pages_service

        pages_service.ensure_defaults()
    except Exception:  # noqa: BLE001
        pass
    try:
        from apps.sysobjects import service as so

        so.sync()
    except Exception:  # noqa: BLE001
        pass
    logger.warning("Standard installation %s applied", key)
    return {"preset": key, "modules_on": sorted(want), "plugins_on": [n for n in preset["plugins"] if n not in missing], "plugins_missing": missing, "theme": theme if "profiles" in want else None}
