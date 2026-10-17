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
    {"key": "branding", "group": "Content", "label": "Logo's & beeld",
     "desc": "Logo, favicon, app-icoon en de foto's op de homepage."},
    {"key": "theme", "group": "Content", "label": "Vormgeving",
     "desc": "Kleuren, lettertypen, thema's en popup-stijl. Uit = de standaardstijl."},
    {"key": "languages", "group": "Content", "label": "Talen",
     "desc": "Meertaligheid en taalkeuze. Uit = alleen de standaardtaal."},
    {"key": "seo", "group": "Content", "label": "SEO",
     "desc": "Zoekmachines, bots en AI-agents: robots.txt, sitemap, llms.txt, paginatitels, omschrijvingen en structured data."},
    {"key": "privacy_pages", "group": "Content", "label": "Privacy- en cookiepagina",
     "desc": "De publieke pagina's /privacy en /cookies met links in de footer."},
    # ── Webshop ──
    {"key": "products", "group": "Webshop", "label": "Producten",
     "desc": "Producten en productgroepen met beheerpagina's en de productpagina's op de website."},
    {"key": "subscriptions", "group": "Subscription", "label": "Abonnementen",
     "desc": "Abonnementen die toegang geven (site, pagina's, content, chat, video, likes, diensten), eenmalig of herhaald, met een order per periode.",
     "default": False, "requires": ["orders"]},
    {"key": "donations", "group": "Subscription", "label": "Donaties",
     "desc": "Eenmalige giften aan de makers met een bedrag dat je met een schuifbalk kiest. Werkt zonder de webshop.",
     "default": False},
    {"key": "orders", "group": "Webshop", "label": "Orders & webshop",
     "desc": "Orderbeheer en de webshop op de website: winkelwagen, afrekenen en bestelstatus."},
    # ── Community ──
    {"key": "profiles", "group": "Community", "label": "Profielen & blokkeren",
     "desc": "Eigen profielpagina met meerdere foto's, zichtbaarheid per taal en groep, ledenzoeker en het blokkeren van andere users."},
    {"key": "discover", "group": "Community", "label": "Zoeken & matchen",
     "desc": "Andere users zoeken en ontmoeten zoals bij een datingsite: filters, aanbevelingen, leuk vinden, matches, favorieten en bezoekers."},
    {"key": "messages", "group": "Community", "label": "Berichten",
     "desc": "Berichtensysteem tussen users (postvak)."},
    {"key": "chat", "group": "Community", "label": "Chat",
     "desc": "Chat in een popup of scherm, via de portal of rechtstreeks (WebRTC), met foto's, video's en videochat."},
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
    {"key": "sandbox", "group": "Systeem", "label": "Sandbox",
     "desc": "Testomgeving: e-mail, sms, betalingen en andere externe diensten simuleren zonder dat de echte API's worden aangeroepen."},
    {"key": "system", "group": "Systeem", "label": "Basisgegevens",
     "desc": "Naam en adressen van de website (frontend en API), contactgegevens en een controlelijst plus kant-en-klare instellingen voor de deployment."},
    {"key": "storage", "group": "Systeem", "label": "Mappenstructuur",
     "desc": "Waar bestanden staan (gebruikers, website, overig): map, lokaal of S3, en versleuteling per gebruiker."},
    {"key": "roles", "group": "Systeem", "label": "Rollen",
     "desc": "Rollen en rechten. Uit = alleen superadmins hebben rechten."},
    # ── Kern (altijd aan) ──
    {"key": "users", "group": "Kern", "label": "Users", "desc": "Accounts aanmaken, blokkeren en verwijderen. Met een foto en openbaar profiel voor op de website.", "core": True},
    {"key": "dashboard", "group": "Kern", "label": "Dashboard & profiel", "desc": "Inloggen, dashboard en eigen profiel.", "core": True, "acl": False},
    {"key": "security_basic", "group": "Kern", "label": "Algemene beveiliging",
     "desc": "Inlogslot, sessieduur, wachtwoordregels en beveiligingsheaders.", "core": True},
    {"key": "modules", "group": "Kern", "label": "Modulebeheer", "desc": "Deze pagina. Alleen voor superadmins.", "core": True, "acl": False},
]
BY_KEY = {m["key"]: m for m in MODULES}

_cache = {"t": 0, "v": None}
TTL = 10


def states():
    now = time.time()
    if _cache["v"] is None or now - _cache["t"] > TTL:
        from .models import ModuleState

        stored = dict(ModuleState.objects.values_list("key", "enabled"))
        _cache.update(t=now, v={m["key"]: True if m.get("core") else stored.get(m["key"], m.get("default", True)) for m in MODULES})
    return _cache["v"]


def invalidate():
    _cache["v"] = None


def enabled(key):
    return states().get(key, True)


def module_required(*keys):
    """DRF permission: all given modules must be on."""

    class _ModuleOn(BasePermission):
        message = "Deze module is uitgeschakeld."

        def has_permission(self, request, view):
            return all(enabled(k) for k in keys)

    return _ModuleOn
