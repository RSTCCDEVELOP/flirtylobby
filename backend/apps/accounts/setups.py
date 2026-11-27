# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Standard set-ups for people and rights: for every standard installation (apps/core/presets.py) ready-made roles, user groups with module access, and demo users in those groups.
An administrator chooses one (Admin → User groups → Standaard setup). Applying only ADDS: what exists stays as it is (a group or role with the same slug is kept, its rights are not changed),
and modules or plugins that are switched off in this installation are skipped (reported, never switched on). The demo users are recognisable (username demo_<setup>_n, e-mail …@example.com),
cannot log in (no password) and can be removed per setup again."""
import logging

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.core import modules, presets
from apps.core.modules import module_required

from .models import ModuleGrant, Role, User, UserGroup
from .permissions import has_level

logger = logging.getLogger(__name__)
PERM = [has_level("users", "manage"), module_required("users")]
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731

# The roles that the set-ups use (slug: name, description, permissions). The first three are the standard roles of the system.
ROLES = {
    "content-manager": ("Content manager", "Mag de website bewerken via de bewerkmodus.", ["content.edit"]),
    "moderator": ("Moderator", "Heeft toegang tot moderatie.", ["moderation.access"]),
    "gebruiker": ("Gebruiker", "Alleen een eigen dashboard en profiel.", []),
    "marketeer": ("Marketeer", "Teksten, SEO en media: de website vindbaar en mooi maken.", ["content.edit", "seo.manage", "media.manage"]),
    "websitebeheerder": ("Websitebeheerder", "Pagina's, menu, vormgeving, logo's en talen beheren.", ["content.edit", "pages.manage", "theme.manage", "branding.manage", "languages.manage"]),
    "ledenbeheer": ("Ledenbeheer", "Gebruikers en de community beheren.", ["users.manage", "community.manage", "moderation.access"]),
    "winkelbeheer": ("Winkelbeheer", "Producten en bestellingen beheren, met de documenten van orders.", ["products.manage", "orders.manage", "orders.documents"]),
    "klantenservice": ("Klantenservice", "Bestellingen inzien, berichten sturen en meldingen modereren.", ["orders.manage", "communication.manage", "moderation.access"]),
}
READ, USE, EDIT, MANAGE = 1, 1, 2, 3


def _g(name, desc, roles, grants, people):
    return {"name": name, "desc": desc, "roles": roles, "grants": grants, "people": people}


# Per standard installation: groups {name, desc, roles, grants {module: level}, people [(first, last)]}.
GROUPS = {
    "standaard-website": [
        _g("Redactie", "Schrijft en onderhoudt de pagina's.", ["content-manager", "marketeer"], {"pages": EDIT, "media": EDIT, "faq": EDIT, "seo": EDIT, "edit_mode": EDIT}, [("Sanne", "Bakker"), ("Lars", "Visser")]),
        _g("Websitebeheer", "Beheert menu, vormgeving en talen.", ["websitebeheerder"], {"pages": MANAGE, "theme": MANAGE, "branding": MANAGE, "languages": EDIT, "media": MANAGE, "sysobjects": EDIT}, [("Mila", "de Vries")]),
        _g("Lezers", "Mogen alleen de website en hun eigen profiel zien.", ["gebruiker"], {}, [("Jesse", "Smit")]),
    ],
    "webshop": [
        _g("Winkelteam", "Beheert producten en bestellingen.", ["winkelbeheer", "content-manager"], {"orders": MANAGE, "payments": EDIT, "pages": EDIT, "media": EDIT, "edit_mode": EDIT}, [("Daan", "Mulder"), ("Eva", "Brouwer")]),
        _g("Klantenservice", "Beantwoordt vragen en volgt bestellingen.", ["klantenservice"], {"orders": EDIT, "communication": EDIT, "faq": EDIT}, [("Noa", "Dekker")]),
        _g("Marketing", "Zorgt voor teksten, SEO en acties.", ["marketeer"], {"seo": EDIT, "pages": EDIT, "media": EDIT, "faq": EDIT}, [("Tim", "Hendriks")]),
        _g("Klanten", "Vaste klanten met een account.", ["gebruiker"], {}, [("Fleur", "Peters"), ("Ruben", "Vos")]),
    ],
    "bedrijfswebsite": [
        _g("Directie", "Ziet alles en beslist over de website.", ["websitebeheerder"], {"pages": MANAGE, "theme": MANAGE, "branding": MANAGE, "languages": EDIT, "users": EDIT, "entities": MANAGE}, [("Anna", "van Dijk")]),
        _g("Marketing en communicatie", "Onderhoudt teksten, nieuws en SEO.", ["content-manager", "marketeer"], {"pages": EDIT, "media": EDIT, "seo": EDIT, "faq": EDIT, "edit_mode": EDIT}, [("Bram", "Jansen"), ("Lotte", "Smit")]),
        _g("Medewerkers", "Collega's met een eigen account.", ["gebruiker"], {}, [("Milan", "Bos"), ("Iris", "Meijer")]),
    ],
    "zakelijk-netwerk": [
        _g("Netwerkbeheer", "Beheert leden, profielen en regels van het netwerk.", ["ledenbeheer", "moderator"], {"users": MANAGE, "profiles": MANAGE, "messages": EDIT, "chat": EDIT, "tags": EDIT, "word_filter": EDIT}, [("Sophie", "Jansen")]),
        _g("Moderatoren", "Houden de gesprekken netjes.", ["moderator"], {"profiles": EDIT, "messages": EDIT, "chat": EDIT, "word_filter": USE}, [("Thijs", "de Boer"), ("Julia", "Mulder")]),
        _g("Ondernemers", "Leden van het netwerk.", ["gebruiker"], {"profiles": USE, "discover": USE, "messages": USE, "chat": USE}, [("Niels", "Dekker"), ("Emma", "Visser"), ("Sam", "Bakker")]),
        _g("Gastleden", "Mogen meekijken, maar niet alles.", ["gebruiker"], {"profiles": USE}, [("Kai", "Vos")]),
    ],
    "intranet": [
        _g("Intranetbeheer", "Beheert het intranet, de rechten en de documenten.", ["websitebeheerder", "ledenbeheer"], {"pages": MANAGE, "users": MANAGE, "roles": MANAGE, "faq": MANAGE, "twofa": EDIT, "edit_mode": EDIT}, [("Eva", "Smit")]),
        _g("HR", "Beheert het smoelenboek en de kennisbank.", ["ledenbeheer", "content-manager"], {"users": EDIT, "profiles": EDIT, "faq": EDIT, "pages": EDIT, "edit_mode": EDIT}, [("Lotte", "Meijer"), ("Ruben", "Hendriks")]),
        _g("Collega's", "Alle medewerkers.", ["gebruiker"], {"profiles": USE, "messages": USE, "chat": USE, "faq": USE}, [("Daan", "Peters"), ("Fleur", "Brouwer"), ("Jesse", "de Vries"), ("Nina", "Bos")]),
    ],
    "datingplatform": [
        _g("Moderatie", "Controleert profielen en meldingen.", ["moderator", "ledenbeheer"], {"profiles": MANAGE, "messages": EDIT, "chat": EDIT, "age_gate": EDIT, "word_filter": EDIT, "users": EDIT}, [("Anna", "Mulder"), ("Tim", "Visser")]),
        _g("Support", "Helpt leden met vragen en abonnementen.", ["klantenservice"], {"subscriptions": EDIT, "communication": EDIT, "faq": EDIT}, [("Noa", "Jansen")]),
        _g("Premium leden", "Leden met een betaald abonnement.", ["gebruiker"], {"profiles": USE, "discover": USE, "messages": USE, "chat": USE}, [("Sophie", "de Boer"), ("Milan", "Dekker"), ("Julia", "Smit")]),
        _g("Gratis leden", "Leden met een gratis account.", ["gebruiker"], {"profiles": USE, "discover": USE}, [("Bram", "Vos"), ("Iris", "Peters")]),
    ],
    "sportclub": [
        _g("Bestuur", "Beheert de vereniging en de website.", ["websitebeheerder", "ledenbeheer"], {"pages": MANAGE, "users": MANAGE, "subscriptions": MANAGE, "donations": EDIT, "entities": MANAGE}, [("Lars", "Bakker")]),
        _g("Trainers", "Plannen trainingen en schrijven nieuws.", ["content-manager"], {"pages": EDIT, "profiles": USE, "messages": EDIT, "chat": EDIT, "edit_mode": EDIT}, [("Mila", "Hendriks"), ("Thijs", "Brouwer")]),
        _g("Leden", "Alle leden van de club.", ["gebruiker"], {"profiles": USE, "discover": USE, "messages": USE, "chat": USE}, [("Emma", "van Dijk"), ("Sem", "Mulder"), ("Lotte", "de Vries"), ("Jesse", "Bos")]),
        _g("Vrijwilligers", "Helpen mee bij evenementen.", ["gebruiker"], {"profiles": USE, "messages": USE}, [("Eva", "Visser")]),
    ],
    "stichting": [
        _g("Bestuur", "Beheert de stichting en de donaties.", ["websitebeheerder", "ledenbeheer"], {"donations": MANAGE, "subscriptions": MANAGE, "pages": MANAGE, "users": EDIT, "entities": MANAGE}, [("Anna", "Jansen")]),
        _g("Communicatie", "Schrijft nieuws en onderhoudt de website.", ["content-manager", "marketeer"], {"pages": EDIT, "media": EDIT, "seo": EDIT, "faq": EDIT, "edit_mode": EDIT, "notifications": EDIT}, [("Sanne", "de Boer"), ("Ruben", "Mulder")]),
        _g("Donateurs", "Vrienden van de stichting.", ["gebruiker"], {}, [("Daan", "Dekker"), ("Noa", "Bakker"), ("Fleur", "Smit")]),
    ],
    "marktplaats": [
        _g("Marktplaatsbeheer", "Beheert aanbod, leden en bestellingen.", ["ledenbeheer", "winkelbeheer"], {"orders": MANAGE, "users": MANAGE, "profiles": EDIT, "messages": EDIT}, [("Tim", "Peters")]),
        _g("Moderatoren", "Controleren advertenties en berichten.", ["moderator"], {"profiles": EDIT, "messages": EDIT, "word_filter": EDIT}, [("Iris", "Visser")]),
        _g("Verkopers", "Leden die aanbieden.", ["gebruiker"], {"profiles": USE, "messages": USE, "orders": USE}, [("Bram", "Brouwer"), ("Julia", "Vos"), ("Kai", "Hendriks")]),
        _g("Kopers", "Leden die kopen of boeken.", ["gebruiker"], {"profiles": USE, "messages": USE}, [("Lars", "de Vries"), ("Mila", "Smit")]),
    ],
    "spelletjessite": [
        _g("Spelbeheer", "Beheert de spellen en de ranglijsten.", ["ledenbeheer", "content-manager"], {"users": EDIT, "profiles": EDIT, "subscriptions": EDIT, "pages": EDIT}, [("Thijs", "Meijer")]),
        _g("Moderatoren", "Houden de chat netjes.", ["moderator"], {"chat": EDIT, "messages": EDIT, "word_filter": EDIT}, [("Eva", "Bos"), ("Sem", "Dekker")]),
        _g("Spelers", "Alle spelers.", ["gebruiker"], {"profiles": USE, "chat": USE, "messages": USE}, [("Niels", "Peters"), ("Emma", "Mulder"), ("Jesse", "Jansen"), ("Lotte", "Visser")]),
        _g("Abonnees", "Spelers met een abonnement.", ["gebruiker"], {"profiles": USE, "chat": USE, "subscriptions": USE}, [("Sanne", "Smit")]),
    ],
    "easy2edit-max": [
        _g("Systeembeheer", "Beheert alles.", ["websitebeheerder", "ledenbeheer", "winkelbeheer"], {"pages": MANAGE, "users": MANAGE, "roles": MANAGE, "orders": MANAGE, "profiles": MANAGE, "subscriptions": MANAGE, "stats": EDIT}, [("Ronald", "Testbeheer")]),
        _g("Redactie", "Teksten, media en SEO.", ["content-manager", "marketeer"], {"pages": EDIT, "media": EDIT, "seo": EDIT, "faq": EDIT, "edit_mode": EDIT}, [("Anna", "Bakker"), ("Lars", "Smit")]),
        _g("Support en moderatie", "Helpt leden en houdt de community netjes.", ["klantenservice", "moderator"], {"messages": EDIT, "chat": EDIT, "orders": EDIT, "word_filter": EDIT}, [("Noa", "Visser"), ("Tim", "Mulder")]),
        _g("Leden", "Alle leden.", ["gebruiker"], {"profiles": USE, "discover": USE, "messages": USE, "chat": USE}, [("Emma", "Jansen"), ("Daan", "Peters"), ("Eva", "de Boer")]),
    ],
}


def _mod_labels():
    return {m["key"]: m.get("label", m["key"]) for m in modules.MODULES if m.get("acl", True)}


def _slug(key, name):
    from django.utils.text import slugify

    return f"{key}-{slugify(name)}"[:100]


def _gname(preset, g):
    return f"{preset['name']} · {g['name']}"[:100]


def _user_of(key, n):
    return f"demo_{key.replace('-', '')}_{n}"[:150]


def describe(key):
    """What is in a set-up, for the choice screen (nothing is changed)."""
    p, labels = presets.BY_KEY[key], _mod_labels()
    out, n_people, active = [], 0, set(Role.objects.values_list("slug", flat=True))
    for g in GROUPS[key]:
        mods = [{"key": m, "label": labels[m], "level": lv, "on": modules.enabled(m)} for m, lv in g["grants"].items() if m in labels]
        out.append({"name": g["name"], "desc": g["desc"], "roles": [ROLES[r][0] for r in g["roles"]], "modules": mods, "people": [f"{a} {b}" for a, b in g["people"]],
                    "exists": UserGroup.objects.filter(slug=_slug(key, g["name"])).exists()})
        n_people += len(g["people"])
    roles = sorted({r for g in GROUPS[key] for r in g["roles"]})
    return {"key": key, "name": p["name"], "icon": p.get("icon", ""), "desc": p["desc"], "recommended": presets.active() == key, "groups": out,
            "roles": [{"name": ROLES[r][0], "desc": ROLES[r][1], "permissions": ROLES[r][2], "exists": r in active} for r in roles], "people": n_people,
            "applied": all(x["exists"] for x in out), "demo_users": User.objects.filter(username__startswith=_user_of(key, "")).count()}


STEPS = ("roles", "groups", "grants", "enable_modules", "people")
DEFAULT_STEPS = {"roles": True, "groups": True, "grants": True, "enable_modules": False, "people": True}


@transaction.atomic
def apply(key, steps=None):
    """Follow the chosen steps of a set-up: roles, groups, module access (grants), switching on the modules that are needed, demo users. Only adds. Returns counts and what was skipped."""
    st = {**DEFAULT_STEPS, **{k: bool(v) for k, v in (steps or {}).items() if k in STEPS}}
    if not st["groups"]:  # module access and demo users belong to a group
        st["grants"] = st["people"] = False
    p, labels = presets.BY_KEY[key], _mod_labels()
    made = {"roles": 0, "groups": 0, "grants": 0, "people": 0}
    skipped, switched = [], []
    roles = {}
    for slug in sorted({r for g in GROUPS[key] for r in g["roles"]}):
        name, desc, perms = ROLES[slug]
        r = Role.objects.filter(slug=slug).first() or Role.objects.filter(name=name).first()
        if not r and st["roles"]:
            r = Role.objects.create(slug=slug, name=name, description=desc, permissions=perms)
            made["roles"] += 1
        if r:
            roles[slug] = r
    n = 0
    for g in (GROUPS[key] if st["groups"] else []):
        grp, new = UserGroup.objects.get_or_create(slug=_slug(key, g["name"]), defaults={"name": _gname(p, g), "description": g["desc"]})
        if new:
            made["groups"] += 1
            grp.roles.set([roles[r] for r in g["roles"] if r in roles])
            for m, lv in (g["grants"].items() if st["grants"] else []):
                if m not in labels:
                    continue
                if not modules.enabled(m) and st["enable_modules"] and not m.startswith("plugin:"):
                    from apps.core.models import ModuleState

                    ModuleState.objects.update_or_create(key=m, defaults={"enabled": True})
                    modules.invalidate()
                    switched.append(labels[m])
                if not modules.enabled(m):
                    skipped.append(f"{labels[m]} (staat uit)")
                    continue
                _, c = ModuleGrant.objects.get_or_create(module=m, group=grp, defaults={"level": lv})
                made["grants"] += int(c)
        if st["people"]:
            for first, last in g["people"]:
                n += 1
                un = _user_of(key, n)
                if User.objects.filter(username=un).exists():
                    continue
                u = User(username=un, email=f"demo-{key}-{n}@example.com", first_name=first, last_name=last, email_verified=True)
                u.set_unusable_password()
                u.save()
                u.user_groups.add(grp)
                made["people"] += 1
    logger.info("Set-up %s applied: %s", key, made)
    return {"made": made, "skipped": sorted(set(skipped)), "switched_on": sorted(set(switched))}


@transaction.atomic
def remove(key):
    """Remove what a set-up made: its demo users and its groups (with their module access). The roles stay: other groups and people may use them."""
    from .erasure import erase_user

    users = list(User.objects.filter(username__startswith=_user_of(key, "")))
    for u in users:
        erase_user(u)
    slugs = [_slug(key, g["name"]) for g in GROUPS[key]]
    groups = UserGroup.objects.filter(slug__in=slugs)
    n = groups.count()
    groups.delete()
    return {"people": len(users), "groups": n}


@api_view(["GET", "POST"])
@permission_classes(PERM)
def setups(request):
    if request.method == "GET":
        return Response({"setups": [describe(k) for k in GROUPS if k in presets.BY_KEY], "active": presets.active()})
    key = str(request.data.get("key") or "")
    if key not in GROUPS or key not in presets.BY_KEY:
        return bad("Onbekende setup.")
    if request.data.get("action") == "remove":
        return Response({"removed": remove(key), "setup": describe(key)})
    steps = request.data.get("steps")
    res = apply(key, steps if isinstance(steps, dict) else None)
    return Response({**res, "setup": describe(key)}, status=status.HTTP_201_CREATED)
