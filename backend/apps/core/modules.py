"""
Module registry. Superadmins switch modules on/off (Admin -> Modules).
A module that is off is inactive everywhere: its API refuses requests, menus and buttons disappear,
and its behaviour on the website stops. Core modules cannot be switched off.

To add a module: add an entry to MODULES, guard its API with `module_required("key")`,
and hide its UI with `useModules()` (frontend).
"""
import time

from rest_framework.permissions import BasePermission

# group, key, label, description, flags
MODULES = [
    # ── Content ──
    {"key": "pages", "group": "Content", "label": "Pagina's en menu",
     "desc": "Overzicht van de pagina's, het menu in de header en eigen pagina's en links."},
    {"key": "edit_mode", "group": "Content", "label": "Bewerkmodus",
     "desc": "Teksten, uitgebreide opmaak en afbeeldingen op de website zelf bewerken (schakelaar in de header)."},
    {"key": "media", "group": "Content", "label": "Mediabibliotheek",
     "desc": "Alle afbeeldingen en video's beheren, lokaal of op S3."},
    {"key": "siteimport", "group": "Content", "label": "Site importeren",
     "desc": "Een andere website (adres, map of ZIP) inlezen: thema, pagina's, startpagina, iconen en plaatjes. Te verwijderen met alles wat erbij hoort."},
    {"key": "sysobjects", "group": "Content", "label": "Systeemobjecten",
     "desc": "Onderdelen van andere modules (donatieknoppen, abonnementen, …) die je in de bewerkmodus op een pagina kunt zetten. Overzicht en aan/uit per object.",
     "default": False},
    {"key": "branding", "group": "Content", "label": "Logo's & beeld",
     "desc": "Logo, favicon, app-icoon en de foto's op de homepage."},
    {"key": "theme", "group": "Content", "label": "Vormgeving",
     "desc": "Kleuren, lettertypen, thema's en popup-stijl. Uit = de standaardstijl."},
    {"key": "languages", "group": "Content", "label": "Talen",
     "desc": "Meertaligheid en taalkeuze. Uit = alleen de standaardtaal."},
    {"key": "seo", "group": "Content", "label": "SEO",
     "desc": "Zoekmachines, bots en AI-agents: robots.txt, sitemap, llms.txt, paginatitels, omschrijvingen en structured data."},
    {"key": "help", "group": "Content", "label": "Easy2edit-help",
     "desc": "De uitleg van Easy2edit zelf (het systeem), alleen in het dashboard, in alle talen. Gebruikers zien alleen de uitleg over onderdelen waar ze rechten voor hebben."},
    {"key": "faq", "group": "Content", "label": "FAQ van je website",
     "desc": "Je eigen veelgestelde vragen, zelf te maken en te vertalen, op de pagina /faq. Zet de pagina in het menu bij Pagina's."},
    {"key": "privacy_pages", "group": "Content", "label": "Privacy- en cookiepagina",
     "desc": "De publieke pagina's /privacy en /cookies met links in de footer."},
    # ── Webshop ──
    {"key": "subscriptions", "group": "Subscription", "label": "Abonnementen", "plugin": "subscriptions", "hidden": True,
     "desc": "Abonnementen die toegang geven (site, pagina's, content, chat, video, likes, diensten), eenmalig of herhaald, met een order per periode.",
     "default": False, "requires": ["orders"]},
    {"key": "donations", "group": "Subscription", "label": "Donaties", "plugin": "subscriptions", "hidden": True,
     "desc": "Eenmalige giften aan de makers met een bedrag dat je met een schuifbalk kiest. Werkt zonder de webshop, maar heeft de plugins Orders en Betalen nodig.",
     "default": False, "requires": ["orders", "payments"]},
    {"key": "orders", "group": "Subscription", "label": "Orders", "plugin": "orders", "hidden": True,
     "desc": "Orderbeheer, btw en de bestelstatus voor de webshop, abonnementen en donaties. Is de plugin Orders: aan of uit zet je bij Plugins; hier stel je alleen in wie erbij mag."},
    {"key": "payments", "group": "Subscription", "label": "Betalen", "plugin": "finance", "hidden": True,
     "desc": "Online betalen voor bestellingen, abonnementen en donaties. Is de plugin Betalen (heeft Orders nodig): aan of uit zet je bij Plugins; hier stel je alleen in wie erbij mag."},
    # ── Community ──
    {"key": "profiles", "group": "Community", "label": "Profielen & blokkeren", "plugin": "community", "hidden": True,
     "desc": "Eigen profielpagina met meerdere foto's, zichtbaarheid per taal en groep, ledenzoeker en het blokkeren van andere users."},
    {"key": "discover", "group": "Community", "label": "Zoeken & matchen", "plugin": "community", "hidden": True,
     "desc": "Andere users zoeken en ontmoeten zoals bij een datingsite: filters, aanbevelingen, leuk vinden, matches, favorieten en bezoekers."},
    {"key": "messages", "group": "Community", "label": "Berichten", "plugin": "community", "hidden": True,
     "desc": "Berichtensysteem tussen users (postvak)."},
    {"key": "chat", "group": "Community", "label": "Chat", "plugin": "community", "hidden": True,
     "desc": "Chat in een popup of scherm, via de portal of rechtstreeks (WebRTC), met foto's, video's en videochat."},
    {"key": "directconnect", "group": "Community", "label": "Directe verbinding", "plugin": "community", "hidden": True,
     "desc": "Een rechtstreekse verbinding tussen twee mensen (WebRTC) via een code, link of QR-code, ook zonder account: chat, foto's, video's en videochat. Pagina's /directconnect en /direct."},
    # ── Beveiliging ──
    {"key": "geo", "group": "Beveiliging", "label": "Landcontrole",
     "desc": "Website blokkeren of toestaan per land via IP-controle."},
    {"key": "age_gate", "group": "Beveiliging", "label": "Leeftijdscontrole",
     "desc": "18+ popup voor bezoekers."},
    {"key": "gambling", "group": "Beveiliging", "label": "Gokken-popup",
     "desc": "Leeftijds- en waarschuwingspopup voor gokken."},
    {"key": "cookies", "group": "Beveiliging", "label": "Cookies",
     "desc": "Cookiebanner, voorkeuren en cookiebeleid-popup."},
    {"key": "word_filter", "group": "Beveiliging", "label": "Woordfilter",
     "desc": "Verboden woorden in teksten, namen en bijschriften."},
    {"key": "registration", "group": "Beveiliging", "label": "Aanmelden",
     "desc": "Bezoekers kunnen zelf een account aanmaken, met e-mailbevestiging en 2-staps verificatie volgens de beveiligingsregels."},
    {"key": "twofa", "group": "Beveiliging", "label": "Twee-staps verificatie",
     "desc": "Inloggen met een code per e-mail of sms."},
    # ── Systeem ──
    {"key": "integrations", "group": "Systeem", "label": "API keys",
     "desc": "Koppelingen met externe systemen (Claude, Stripe, S3, Postmark, …). Uit = alle koppelingen inactief."},
    {"key": "communication", "group": "Systeem", "label": "Communicatie",
     "desc": "E-mailadressen, antwoordadressen en mobiele nummers die het systeem mag gebruiken."},
    {"key": "plugins", "group": "Systeem", "label": "Plugins",
     "desc": "Losse programma's (plugins) uploaden die met het systeem samenwerken en alle functies kunnen gebruiken. Alleen voor superadmins; plugins draaien als vertrouwde code.",
     "default": False},
    {"key": "notifications", "group": "Systeem", "label": "Notificaties",
     "desc": "Meldingen voor gebruikers van het systeem en alle modules: een belletje en pagina met alle meldingen, berichten van de beheerder en per gebruiker te kiezen welke meldingen en e-mails hij wil."},
    {"key": "sandbox", "group": "Systeem", "label": "Sandbox",
     "desc": "Testomgeving: e-mail, sms, betalingen en andere externe diensten simuleren zonder dat de echte API's worden aangeroepen."},
    {"key": "system", "group": "Systeem", "label": "Basisgegevens",
     "desc": "Naam en adressen van de website (frontend en API), contactgegevens en een controlelijst plus kant-en-klare instellingen voor de deployment."},
    {"key": "storage", "group": "Systeem", "label": "Mappenstructuur",
     "desc": "Waar bestanden staan (gebruikers, website, overig): map, lokaal of S3, en versleuteling per gebruiker."},
    {"key": "stats", "group": "Systeem", "label": "Statistieken",
     "desc": "Grafieken en cijfers over de hele website: bezoekers, SEO, bots en AI-aanroepen, en per module en plugin een eigen tabblad. Modules en plugins schrijven hun cijfers hierheen."},
    {"key": "backups", "group": "Systeem", "label": "Backup",
     "desc": "Backups van de website per dag, week of maand (pagina's, menu's, teksten, afbeeldingen, thema en instellingen van modules en plugins), terugzetten en downloaden. De standaardgegevens van easy2edit zitten er niet in."},
    {"key": "roles", "group": "Systeem", "label": "Rollen",
     "desc": "Rollen en rechten. Uit = alleen superadmins hebben rechten."},
    # ── Kern (altijd aan) ──
    {"key": "users", "group": "Kern", "label": "Users", "desc": "Accounts aanmaken, blokkeren en verwijderen. Met een foto en openbaar profiel voor op de website.", "core": True},
    {"key": "dashboard", "group": "Kern", "label": "Dashboard & profiel", "desc": "Inloggen, dashboard en eigen profiel.", "core": True, "acl": False},
    {"key": "security_basic", "group": "Kern", "label": "Algemene beveiliging",
     "desc": "Inlogslot, sessieduur, wachtwoordregels en beveiligingsheaders.", "core": True},
    {"key": "modules", "group": "Kern", "label": "Modulebeheer", "desc": "Deze pagina. Alleen voor superadmins.", "core": True, "acl": False},
]
# ── Packages: what is sold apart from the core CMS ──
# The core CMS (pages, edit mode, media, themes, languages, SEO, security, backups …) is the product. These parts are not for every target group, so they are
# sold as separate packages: a package is on while one of its modules is on, and has its own price in the licence (Super admin → Licentie).
PACKAGES = [
    {"key": "community", "label": "Community & dating", "desc": "Profielen, zoeken en matchen, berichten, chat en directe verbinding: voor community's, netwerken en datingplatforms.",
     "modules": ["profiles", "discover", "messages", "chat", "directconnect"]},
    {"key": "age", "label": "Leeftijd, land & gokken", "desc": "Leeftijdscontrole (18+), landcontrole en de gokken-popup (24+): alleen voor doelgroepen waar dat verplicht of gewenst is.",
     "modules": ["age_gate", "geo", "gambling"]},
    {"key": "commerce", "label": "Webshop, abonnementen & donaties", "desc": "Bestellingen en betalen, abonnementen en donaties: voor wie online iets verkoopt of geld ophaalt.",
     "modules": ["orders", "payments", "subscriptions", "donations"]},
]
PACKAGE_OF = {k: p["key"] for p in PACKAGES for k in p["modules"]}
for _m in MODULES:
    _m["package"] = PACKAGE_OF.get(_m["key"], "cms")  # everything else is the core CMS
BY_KEY = {m["key"]: m for m in MODULES}

_cache = {"t": 0, "v": None}
TTL = 10


def states():
    now = time.time()
    if _cache["v"] is None or now - _cache["t"] > TTL:
        from .models import ModuleState

        stored = dict(ModuleState.objects.values_list("key", "enabled"))
        _cache.update(t=now, v={m["key"]: True if m.get("core") else plugin_on(m["plugin"]) if m.get("plugin") else stored.get(m["key"], m.get("default", True)) for m in MODULES})  # "plugin": on while that plugin is on
    return _cache["v"]


def invalidate():
    _cache["v"] = None
    _pl["t"] = 0


def enabled(key):
    if key.startswith("plugin:"):  # a page or part that belongs to a plugin is on when that plugin is switched on
        return plugin_on(key[7:])
    return states().get(key, True)


_pl = {"t": 0, "v": set()}


def plugin_on(name):
    now = time.time()
    if now - _pl["t"] > TTL:
        from apps.plugins.models import Plugin

        try:  # the plugin folders are found (and the plugins that are on are loaded) before we say what is on
            from apps.plugins import runtime

            runtime.ensure_loaded()
        except Exception:  # noqa: BLE001
            pass

        try:
            _pl.update(t=now, v=set(Plugin.objects.filter(enabled=True).values_list("name", flat=True)))
        except Exception:  # noqa: BLE001 - database not ready
            _pl.update(t=now, v=set())
    return name in _pl["v"]


def module_required(*keys):
    """DRF permission: all given modules must be on."""

    class _ModuleOn(BasePermission):
        message = "Deze module is uitgeschakeld."

        def has_permission(self, request, view):
            return all(enabled(k) for k in keys)

    return _ModuleOn
