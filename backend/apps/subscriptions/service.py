"""
Subscriptions and donations.

  Plan (what is sold, price, once or every period, what it gives)  ->  Subscription (one member's) -> Order per period (apps/shop Order, kind "subscription")
  DonationCampaign (a gift with a slider between min and max)      ->  Donation  ->  Order (kind "donation")

What a plan or donation gives is a list of grants: {"type", "ref", "value"}. Parts of the site ask `can()` / `entitlements()`:
chat, photos+video in chat, video chat, likes per day, own pages, exclusive content, services (products), and access to the whole site.
A part is only locked when the admin switches its gate on (Admin -> Subscription -> Instellingen): without gates everything stays free.
"""
import logging
import secrets
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from apps.core import modules

from .models import ActionItem, Donation, DonationCampaign, DonorAction, Plan, Subscription, SubscriptionSettings

logger = logging.getLogger(__name__)
CENT = Decimal("0.01")
INTERVAL_DAYS = {"week": 7, "month": 30, "quarter": 91, "year": 365}
LIVE = ("trial", "active", "past_due", "canceled")  # statuses that still give access (until period_end)

GRANT_TYPES = {
    "site": {"label": "Toegang tot de website", "ref": None, "help": "Zonder dit abonnement kom je niet verder dan de inlog- en abonnementspagina's (als de poort aan staat)."},
    "page": {"label": "Pagina", "ref": "page", "help": "Een eigen pagina die alleen voor leden met dit abonnement zichtbaar is."},
    "content": {"label": "Exclusieve content", "ref": "text", "help": "Een sleutel (bv. cursus-1) voor tekst of beeld dat je met de component Paywall afschermt."},
    "service": {"label": "Dienst of product", "ref": "product", "help": "Een product uit de webshop dat alleen met dit abonnement te bestellen is."},
    "chat": {"label": "Chat", "ref": None, "help": "Berichten sturen in de chat."},
    "chat_media": {"label": "Foto's en video's in de chat", "ref": None, "help": "Foto's en video's delen in de chat."},
    "video_chat": {"label": "Videochat", "ref": None, "help": "Videobellen via de chat en de directe verbinding."},
    "likes": {"label": "Likes per dag", "ref": None, "value": True, "help": "Aantal likes per dag bij zoeken en swipen. 0 = onbeperkt."},
    "discover": {"label": "Zoeken en matchen", "ref": None, "help": "Leden zoeken en swipen."},
    "see_likes": {"label": "Zien wie mij leuk vond", "ref": None, "help": "Het overzicht van leden die jou een like gaven."},
    "see_visitors": {"label": "Profielbezoekers zien", "ref": None, "help": "Wie je profiel heeft bekeken."},
    "messages": {"label": "Berichten sturen (postvak)", "ref": None, "help": "Berichten sturen naar andere leden."},
    "friend_requests": {"label": "Vriendschapsverzoeken sturen", "ref": None, "help": "Andere leden om vriendschap vragen."},
    "private_photos": {"label": "Privé-foto's plaatsen", "ref": None, "help": "Foto's plaatsen die alleen voor vrienden of na toegang zichtbaar zijn."},
    "direct_connection": {"label": "Directe verbinding", "ref": None, "help": "Een directe verbinding (chat, beeld en geluid) opzetten met een code of QR."},
    "games": {"label": 'Games spelen', "ref": None, "help": 'Alle games in de spelletjeshal spelen.', "themes": None},
    "game_rooms": {"label": 'Samen spelen (kamers)', "ref": None, "help": 'Een kamer maken of meedoen aan een kamer om een spel met anderen te spelen.', "themes": None},
    "game_scores": {"label": 'Scores en ranglijst', "ref": None, "help": 'Scores bewaren en de ranglijst van een spel zien.', "themes": None},
    "game": {"label": "Een bepaald spel", "ref": "text", "help": "De sleutel (naam) van een spel uit de games-plugin, bv. snake.", "themes": None},
    "visible_if_liked": {"label": 'Alleen zichtbaar voor mensen die ik leuk vind', "ref": None, "help": 'Het profiel alleen laten zien aan leden die het lid zelf leuk vond.', "themes": None},
    "public_search": {"label": 'Gevonden worden door zoekmachines', "ref": None, "help": 'De profielpagina openbaar laten indexeren door Google en andere zoekmachines.', "themes": None},
    "hide_details": {"label": 'Leeftijd, plaats en afstand verbergen', "ref": None, "help": 'Leeftijd, plaats en afstand op de kaart en het profiel verbergen.', "themes": None},
    "profile_design": {"label": 'Eigen kleuren voor de profielpagina', "ref": None, "help": 'Een eigen kleurenthema kiezen voor de profielpagina.', "themes": None},
    "available_for": {"label": 'Beschikbaar voor kiezen', "ref": None, "help": 'Aangeven waarvoor je beschikbaar bent (games, chat, soort date, werk ...) en daarop gevonden worden.', "themes": None},
    "advanced_search": {"label": 'Zoeken op profielvelden', "ref": None, "help": 'Leden zoeken met de extra filters op profielvelden (lengte, niveau, branche ...).', "themes": None},
    "undo_swipe": {"label": 'Swipe ongedaan maken', "ref": None, "help": 'Een like of nee terugdraaien met de gele knop.', "themes": ['dating']},
    "like_message": {"label": 'Bericht meesturen met een like', "ref": None, "help": 'Een kort bericht meesturen bij een like.', "themes": ['dating']},
    "post_vacancy": {"label": 'Vacatures plaatsen', "ref": None, "help": 'Op het profiel aangeven dat je vacatures hebt ("Ik heb vacatures").', "themes": ['business']},
    "job_seeker": {"label": 'Werkzoekend tonen', "ref": None, "help": 'Het profiel markeren als open voor een baan of opdracht, met gezochte functie en soort werk.', "themes": ['business']},
    "search_jobs": {"label": 'Zoeken op vacatures en werkzoekenden', "ref": None, "help": 'Zoeken naar leden met vacatures of die open staan voor werk.', "themes": ['business']},
}
FEATURE_KEYS = ["site", "chat", "chat_media", "video_chat", "discover", "see_likes", "see_visitors", "messages", "friend_requests", "private_photos", "direct_connection", "games", "game_rooms", "game_scores", "visible_if_liked", "public_search", "hide_details", "profile_design", "available_for", "advanced_search", "undo_swipe", "like_message", "post_vacancy", "job_seeker", "search_jobs"]
DEFAULTS = {
    "gates": {"site": False, "chat": False, "chat_media": False, "video_chat": False, "likes": False},
    "free_likes_per_day": 10,  # only used when the likes gate is on
    "grace_days": 7,  # after a missed payment: access stays for this many days
    "invoice_activate": True,  # pay by invoice (no online payment): the subscription starts right away
    "site_message": "Voor deze website heb je een abonnement nodig.",
    "intro": "",
}


class SubError(Exception):
    pass


def money(v):
    return Decimal(str(v)).quantize(CENT, rounding=ROUND_HALF_UP)


def settings():
    stored = SubscriptionSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULTS.items()}
    for k, v in stored.items():
        if k == "gates" and isinstance(v, dict):
            out["gates"].update({g: bool(x) for g, x in v.items() if g in out["gates"]})
        elif k in out and k != "gates":
            out[k] = v
    return out


def save_settings(incoming):
    cur = settings()
    for g, x in (incoming.get("gates") or {}).items():
        if g in cur["gates"]:
            cur["gates"][g] = bool(x)
            ensure_items()
            ActionItem.objects.filter(key=g).update(gated=bool(x))  # the Actions list is the source; the old switches keep it in step
    for k, lo, hi in (("free_likes_per_day", 0, 10000), ("grace_days", 0, 90)):
        if k in incoming:
            try:
                cur[k] = max(lo, min(hi, int(incoming[k])))
            except (TypeError, ValueError):
                raise ValueError("Geef een geheel getal op.")
    if "invoice_activate" in incoming:
        cur["invoice_activate"] = bool(incoming["invoice_activate"])
    for k in ("site_message", "intro"):
        if k in incoming:
            cur[k] = str(incoming[k] or "").strip()[:500]
    obj, _ = SubscriptionSettings.objects.get_or_create(pk=1)
    obj.data = cur
    obj.save()
    return cur


# ── grants ───────────────────────────────────────────────────────────────────
def clean_grants(raw):
    """Validate the grants an admin entered; raises ValueError with a readable text."""
    from apps.pages.models import Page
    from apps.shop import catalog

    out, seen = [], set()
    for g in raw or []:
        t = str((g or {}).get("type") or "")
        if t not in GRANT_TYPES:
            raise ValueError(f"Onbekend type toegang: {t or '?'}.")
        spec, ref, value = GRANT_TYPES[t], str(g.get("ref") or "").strip()[:80], 0
        if spec["ref"] == "page" and not Page.objects.filter(key=ref, kind="content").exists():
            raise ValueError("Kies een bestaande eigen pagina.")
        if spec["ref"] == "product" and not catalog.exists(ref):
            raise ValueError("Kies een bestaand product.")
        if spec["ref"] == "text" and not ref:
            raise ValueError("Geef de sleutel van de content op.")
        if spec.get("value"):
            try:
                value = max(0, min(100000, int(g.get("value") or 0)))
            except (TypeError, ValueError):
                raise ValueError("Het aantal likes moet een geheel getal zijn.")
        if (t, ref) in seen:
            continue
        seen.add((t, ref))
        out.append({"type": t, "ref": ref if spec["ref"] else "", "value": value})
    return out


def describe(grants):
    from apps.pages.models import Page
    from apps.shop import catalog

    out = []
    for g in grants or []:
        spec, label = GRANT_TYPES.get(g["type"]), ""
        if not spec:
            continue
        label = spec["label"]
        if g["type"] == "page":
            p = Page.objects.filter(key=g["ref"]).first()
            label += f": {(p.title.get('nl') or next(iter(p.title.values()), g['ref'])) if p else g['ref']}"
        elif g["type"] == "service":
            p = catalog.get(g["ref"] or 0)
            label += f": {p['name'] if p else g['ref']}"
        elif g["type"] == "content":
            label += f": {g['ref']}"
        elif g["type"] == "likes":
            label = "Onbeperkt likes" if not g.get("value") else f"{g['value']} likes per dag"
        out.append({"type": g["type"], "label": label})
    return out


# ── what does this user have? ────────────────────────────────────────────────
def _empty():
    return {"full": False, "site": False, "game_refs": set(), "pages": set(), "content": set(), "services": set(), "chat": False, "chat_media": False, "video_chat": False,
            "likes": False, "plans": [], **{k: False for k in FEATURE_KEYS}}  # likes: False = nothing extra, None = unlimited, n = per day


def _add(ent, grants):
    for g in grants or []:
        t = g.get("type")
        if t == "page":
            ent["pages"].add(g.get("ref"))
        elif t == "content":
            ent["content"].add(g.get("ref"))
        elif t == "service":
            ent["services"].add(str(g.get("ref")))
        elif t == "game":
            ent["game_refs"].add(str(g.get("ref") or ""))
        elif t == "likes":
            n = int(g.get("value") or 0)
            ent["likes"] = None if (n == 0 or ent["likes"] is None) else max(n, ent["likes"] or 0)
        elif t in FEATURE_KEYS:
            ent[t] = True


def entitlements(user, with_limited=True):
    ent = _empty()
    if not user or not getattr(user, "is_authenticated", False):
        return ent
    if user.is_staff or user.is_superuser:
        ent.update(full=True, likes=None, **{k: True for k in FEATURE_KEYS})
        return ent
    now = timezone.now()
    for s in Subscription.objects.filter(user=user, status__in=LIVE).select_related("plan"):
        if s.period_end and s.period_end <= now:
            continue
        ent["plans"].append(s.plan_id)
        _add(ent, s.plan.grants)
    for d in Donation.objects.filter(user=user, status="paid", access_until__gt=now).select_related("campaign"):
        _add(ent, d.campaign.grants)
    if modules.enabled("donations"):
        for r in _live_rewards(user, now, limited=None if with_limited else False):
            if r.type == "likes" and r.uses_total:
                continue  # a limited number of extra likes is counted in likes_left
            _add(ent, [{"type": r.type, "ref": r.ref, "value": r.value}])
    return ent


def either_on():
    """Subscriptions and donations share the access rules (what needs a subscription or a donor action)."""
    return modules.enabled("subscriptions") or modules.enabled("donations")


# the built-in things that can be paid for: key, name, group, description
CATALOG = [
    ("site", "De hele website", "Website", "Toegang tot de website. Zonder voorwaarden kom je alleen op inloggen, aanmelden en abonnementen."),
    ("discover", "Zoeken en matchen", "Leden vinden", "Leden zoeken en swipen."),
    ("likes", "Likes per dag", "Leden vinden", "Het aantal likes per dag. Afgeschermd = het gratis aantal uit de instellingen, meer met de voorwaarden."),
    ("see_likes", "Zien wie mij leuk vond", "Leden vinden", "Het overzicht van leden die jou een like gaven."),
    ("see_visitors", "Profielbezoekers zien", "Leden vinden", "Wie je profiel heeft bekeken."),
    ("messages", "Berichten sturen (postvak)", "Contact", "Berichten sturen naar andere leden."),
    ("friend_requests", "Vriendschapsverzoeken sturen", "Contact", "Andere leden om vriendschap vragen."),
    ("chat", "Chat", "Contact", "Berichten sturen in de chat."),
    ("chat_media", "Foto's en video's in de chat", "Contact", "Foto's en video's delen in de chat."),
    ("video_chat", "Videochat", "Contact", "Videobellen via de chat en de directe verbinding."),
    ("direct_connection", "Directe verbinding", "Contact", "Een directe verbinding opzetten met een code of QR."),
    ("private_photos", "Privé-foto's plaatsen", "Profiel", "Foto's plaatsen die alleen na toegang zichtbaar zijn."),    ('games', 'Games spelen', 'Games', 'Alle games in de spelletjeshal spelen.', None),
    ('game_rooms', 'Samen spelen (kamers)', 'Games', 'Een kamer maken of meedoen aan een kamer om een spel met anderen te spelen.', None),
    ('game_scores', 'Scores en ranglijst', 'Games', 'Scores bewaren en de ranglijst van een spel zien.', None),
    ('visible_if_liked', 'Alleen zichtbaar voor mensen die ik leuk vind', 'Profiel en gevonden worden', 'Het profiel alleen laten zien aan leden die het lid zelf leuk vond.', None),
    ('public_search', 'Gevonden worden door zoekmachines', 'Profiel en gevonden worden', 'De profielpagina openbaar laten indexeren door Google en andere zoekmachines.', None),
    ('hide_details', 'Leeftijd, plaats en afstand verbergen', 'Profiel en gevonden worden', 'Leeftijd, plaats en afstand op de kaart en het profiel verbergen.', None),
    ('profile_design', 'Eigen kleuren voor de profielpagina', 'Profiel en gevonden worden', 'Een eigen kleurenthema kiezen voor de profielpagina.', None),
    ('available_for', 'Beschikbaar voor kiezen', 'Profiel en gevonden worden', 'Aangeven waarvoor je beschikbaar bent (games, chat, soort date, werk ...) en daarop gevonden worden.', None),
    ('advanced_search', 'Zoeken op profielvelden', 'Leden vinden', 'Leden zoeken met de extra filters op profielvelden (lengte, niveau, branche ...).', None),
    ('undo_swipe', 'Swipe ongedaan maken', 'Date-acties', 'Een like of nee terugdraaien met de gele knop.', ['dating']),
    ('like_message', 'Bericht meesturen met een like', 'Date-acties', 'Een kort bericht meesturen bij een like.', ['dating']),
    ('post_vacancy', 'Vacatures plaatsen', 'Werk en netwerk', 'Op het profiel aangeven dat je vacatures hebt ("Ik heb vacatures").', ['business']),
    ('job_seeker', 'Werkzoekend tonen', 'Werk en netwerk', 'Het profiel markeren als open voor een baan of opdracht, met gezochte functie en soort werk.', ['business']),
    ('search_jobs', 'Zoeken op vacatures en werkzoekenden', 'Werk en netwerk', 'Zoeken naar leden met vacatures of die open staan voor werk.', ['business']),
]
CATALOG_BY_KEY = {c[0]: c for c in CATALOG}
CONDITION_TYPES = {
    "entitlement": "Abonnement of donatie-actie die dit onderdeel geeft",
    "any_plan": "Een lopend abonnement (welk dan ook)",
    "plan": "Een bepaald abonnement",
    "donation_total": "Totaal gedoneerd vanaf een bedrag",
    "donation_campaign": "Gedoneerd aan een bepaalde actie",
    "member_days": "Lid sinds minstens … dagen",
    "verified_email": "E-mailadres bevestigd",
    "profile_complete": "Profiel actief met minstens … foto's",
    "verified_profile": "Profiel gecontroleerd door de beheerder",
    "role": "Heeft een bepaalde rol",
}


def profile_theme():
    """The community theme of this site (normal | dating | sporters | business | webshop): some actions only make sense for one of them."""
    from apps.social import service as social

    return social.get()["profiles"]["theme"]


def ensure_items():
    """Make sure every built-in thing has a row. A new row starts as the old 'gates' setting said (default: free)."""
    sync_game_items()
    have = set(ActionItem.objects.filter(kind="builtin").values_list("key", flat=True))
    legacy = settings()["gates"]
    for i, (key, *_r) in enumerate(CATALOG):
        if key not in have:
            ActionItem.objects.create(key=key, kind="builtin", gated=bool(legacy.get(key)), order=i)


def sync_game_items():
    """One item per game of the games plugin ("Spel: Snake"): new games appear in the list (open for everybody), removed games go."""
    from apps.plugins import installer
    from apps.plugins.models import Plugin

    p = Plugin.objects.filter(name="games").first()
    games = {it["name"]: it for it in (installer.content_items(p) if p else []) or [] if not it.get("problem")}
    have = {i.ref: i for i in ActionItem.objects.filter(kind="game")}
    for n, it in games.items():
        name = f"Spel: {it['title']}"
        if n not in have:
            ActionItem.objects.create(key=f"game:{n}", kind="game", ref=n, name=name, description=(it.get("description") or "")[:300], gated=False, order=200)
        elif have[n].name != name:
            ActionItem.objects.filter(pk=have[n].pk).update(name=name, description=(it.get("description") or "")[:300])
    for n, row in have.items():
        if n not in games:
            row.delete()


def item_of(key):
    return ActionItem.objects.filter(key=key).first()


def gate_on(key):
    if not either_on():
        return False
    row = item_of(key)
    return row.gated if row else bool(settings()["gates"].get(key, False))


def _ent_has(ent, item):
    if ent.get("full"):
        return True
    if item.kind == "game":
        return str(item.ref) in ent["game_refs"]
    if item.kind == "page":
        return item.ref in ent["pages"]
    if item.kind == "content":
        return item.ref in ent["content"]
    if item.kind == "service":
        return str(item.ref) in ent["services"]
    return bool(ent.get(item.key))


def check_condition(user, item, c, ent):
    """(passes, reason) for one condition."""
    t = c.get("type")
    now = timezone.now()
    if t == "entitlement":
        return _ent_has(ent, item), "abonnement of donatie-actie"
    if t == "any_plan":
        return bool(ent["plans"]), "een lopend abonnement"
    if t == "plan":
        return int(c.get("ref") or 0) in ent["plans"], "dat abonnement"
    if t in ("donation_total", "donation_campaign"):
        qs = Donation.objects.filter(user=user, status="paid")
        if t == "donation_campaign":
            qs = qs.filter(campaign_id=int(c.get("ref") or 0))
        if int(c.get("days") or 0):
            qs = qs.filter(paid_at__gte=now - timedelta(days=int(c["days"])))
        from django.db.models import Sum

        total = qs.aggregate(s=Sum("amount"))["s"] or Decimal("0")
        need = Decimal(str(c.get("amount") or 0))
        return (total >= need if need > 0 else qs.exists()), "genoeg gedoneerd"
    if t == "member_days":
        return (now - user.date_joined).days >= int(c.get("value") or 0), "lang genoeg lid"
    if t == "verified_email":
        return bool(user.email_verified), "e-mailadres bevestigd"
    if t == "profile_complete":
        from apps.social.models import Profile

        p = Profile.objects.filter(user=user, enabled=True).first()
        return bool(p and p.photos.count() >= int(c.get("value") or 1)), "profiel compleet"
    if t == "verified_profile":
        return user.verification in ("checked", "verified"), "profiel gecontroleerd"
    if t == "role":
        return int(c.get("ref") or 0) in {r.id for r in user.all_roles()}, "de rol"
    return False, "onbekende voorwaarde"


# things two people do together: the right of one of them can be made to count for the other as well (Actions -> "ook voor de ander")
PAIR_KEYS = ("chat", "chat_media", "video_chat", "messages", "direct_connection")


def access(user, key, partner=None):
    """(allowed, payer): may `user` use `key`, also through the right of the `partner` when the item says it counts for the other party?
    `payer` is the member whose right it was (so a limited number of uses is taken from him), None when it is free."""
    if not gate_on(key):
        return True, None
    if can(user, key):
        return True, user
    row = item_of(key)
    if row and row.share and partner is not None and getattr(partner, "is_authenticated", True) and can(partner, key):
        return True, partner
    return False, None


def evaluate(user, item, ent=None):
    """Does this user meet the conditions of the item? Returns (ok, [(type, passes, reason)])."""
    if not user or not getattr(user, "is_authenticated", False):
        return False, []
    ent = ent or entitlements(user)
    if ent["full"]:
        return True, []
    conds = item.conditions or [{"type": "entitlement"}]
    res = [(c.get("type"), *check_condition(user, item, c, ent)) for c in conds]
    ok = all(r[1] for r in res) if item.mode == "all" else any(r[1] for r in res)
    return ok, res


def can(user, key):
    """May this user use the part `key`? Free as long as it is not gated; otherwise the conditions of the item decide."""
    if not gate_on(key):
        return True
    row = item_of(key)
    if row:
        return evaluate(user, row)[0]
    return bool(entitlements(user).get(key))


GATE_MESSAGE = {
    "site": "Voor deze website heb je een abonnement nodig.", "chat": "Chatten is er voor leden met een abonnement.",
    "chat_media": "Foto's en video's delen in de chat kan met een abonnement.", "video_chat": "Videobellen kan met een abonnement.",
    "likes": "Je dagelijkse likes zijn op. Met een abonnement krijg je er meer.",
    "discover": "Zoeken en matchen is er voor leden met een abonnement of donatie.", "see_likes": "Zien wie je leuk vond kan met een abonnement of donatie.",
    "see_visitors": "Zien wie je profiel bekeek kan met een abonnement of donatie.", "messages": "Berichten sturen is er voor leden met een abonnement of donatie.",
    "friend_requests": "Vriendschapsverzoeken sturen kan met een abonnement of donatie.", "private_photos": "Privé-foto's plaatsen kan met een abonnement of donatie.",
    "direct_connection": "Een directe verbinding opzetten kan met een abonnement of donatie.",
    'games': 'Games spelen kan met een abonnement of donatie.',
    'game_rooms': 'Samen spelen kan met een abonnement of donatie.',
    'game_scores': 'Scores en ranglijsten kunnen met een abonnement of donatie.',
    'visible_if_liked': 'Alleen zichtbaar zijn voor leden die je leuk vindt kan met een abonnement of donatie.',
    'public_search': 'Gevonden worden door zoekmachines kan met een abonnement of donatie.',
    'hide_details': 'Je gegevens verbergen kan met een abonnement of donatie.',
    'profile_design': 'Een eigen design voor je profiel kan met een abonnement of donatie.',
    'available_for': 'Aangeven waarvoor je beschikbaar bent kan met een abonnement of donatie.',
    'advanced_search': 'Zoeken op profielvelden kan met een abonnement of donatie.',
    'undo_swipe': 'Een swipe ongedaan maken kan met een abonnement of donatie.',
    'like_message': 'Een bericht bij je like kan met een abonnement of donatie.',
    'post_vacancy': 'Vacatures plaatsen kan met een abonnement of donatie.',
    'job_seeker': 'Jezelf als werkzoekend tonen kan met een abonnement of donatie.',
    'search_jobs': 'Zoeken op vacatures en werkzoekenden kan met een abonnement of donatie.',
}


def likes_left(user):
    """None = no limit, else how many likes are left today."""
    if not gate_on("likes"):
        return None
    ent = entitlements(user)
    if ent["likes"] is None:
        return None
    row = item_of("likes")
    if row and any(c.get("type") != "entitlement" for c in row.conditions or []) and evaluate(user, row, ent)[0]:
        return None  # the conditions (a donation, a subscription …) open unlimited likes
    from apps.social.models import Like

    limit = max(settings()["free_likes_per_day"], ent["likes"] or 0)
    today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    extra = sum(r.uses_total - r.uses_used for r in _live_rewards(user, limited=True) if r.type == "likes")  # extra likes from a donation
    return max(0, limit - Like.objects.filter(from_user=user, created_at__gte=today).count()) + extra


def locked_pages():
    """Pages that need a subscription: any page that a plan or a campaign lists."""
    if not either_on():
        return set()
    keys = set(ActionItem.objects.filter(kind="page", gated=True).values_list("ref", flat=True))
    for grants in list(Plan.objects.values_list("grants", flat=True)) + list(DonationCampaign.objects.values_list("grants", flat=True)) + list(DonationCampaign.objects.values_list("actions", flat=True)):
        keys |= {g["ref"] for g in grants or [] if g.get("type") == "page"}
    return keys


def page_ok(user, key):
    if key not in locked_pages():
        return True
    ent = entitlements(user)
    if ent["full"] or key in ent["pages"]:
        return True
    row = ActionItem.objects.filter(kind="page", ref=key, gated=True).first()
    return bool(row and evaluate(user, row, ent)[0])


def check_products(user, products):
    """Products that are only for subscribers or donors: a 'service' item (conditions) or a plan that lists them."""
    if not either_on():
        return
    listed = set()
    for grants in Plan.objects.values_list("grants", flat=True):
        listed |= {str(g["ref"]) for g in grants or [] if g.get("type") == "service"}
    ent = entitlements(user)
    for p in products:
        row = ActionItem.objects.filter(kind="service", ref=str(p.id), gated=True).first()
        if row:
            if not evaluate(user, row, ent)[0]:
                raise SubError(f"'{p.name}' is alleen te bestellen als je aan de voorwaarden voldoet.")
        elif str(p.id) in listed and not (ent["full"] or str(p.id) in ent["services"]):
            raise SubError(f"'{p.name}' is alleen te bestellen met een abonnement.")


def locked_products():
    if not either_on():
        return set()
    out = set(ActionItem.objects.filter(kind="service", gated=True).values_list("ref", flat=True))
    for grants in Plan.objects.values_list("grants", flat=True):
        out |= {str(g["ref"]) for g in grants or [] if g.get("type") == "service"}
    return out


# ── orders ───────────────────────────────────────────────────────────────────
def _order(user, kind, ref_id, title, amount, vat_rate, period_no=1, contact=None):
    from apps.shop.models import Order, OrderItem
    from apps.shop.service import settings as shop_settings

    c = contact or {}
    amount = money(amount)
    vat = money(amount - amount / (1 + Decimal(str(vat_rate)) / 100)) if vat_rate else Decimal("0.00")
    name = c.get("name") or (user.get_full_name() or user.email or user.username if user else "") or "Onbekend"
    order = Order.objects.create(
        token=secrets.token_urlsafe(18), kind=kind, ref_id=ref_id, period_no=period_no, status="new", name=name[:150],
        email=(c.get("email") or (user.email if user else "") or "")[:254], phone=(getattr(user, "phone", "") or "")[:30],
        street=(c.get("street") or getattr(user, "address", "") or "-")[:200], postal_code=(getattr(user, "postal_code", "") or "-")[:20],
        city=(getattr(user, "city", "") or "-")[:100], country=(getattr(user, "country", "") or "NL")[:2], subtotal=amount, vat_total=vat, total=amount,
        currency=shop_settings()["currency"], user=user, shipping_method="-")
    order.number = f"{order.created_at.year}-{order.id:05d}"
    order.save(update_fields=["number"])
    OrderItem.objects.create(order=order, product=None, name=title[:200], sku=kind, unit_price=amount, quantity=1, line_total=amount, vat_rate=vat_rate or 0, vat_amount=vat)
    return order


def ensure_can_pay():
    """Fail before anything is created when online payment is required but not available."""
    from apps.sandbox import service as sandbox
    from apps.shop.service import settings as shop_settings

    if shop_settings()["pay_online"] and not sandbox.active("payments"):
        raise SubError("Online betalen is nog niet beschikbaar.")


def start_payment(order, return_base=""):
    """Online (sandbox) payment, or pay by invoice. Returns the checkout path or None."""
    from apps.sandbox import service as sandbox
    from apps.shop.service import settings as shop_settings

    if order.total <= 0:
        mark_paid(order)
        return None
    if shop_settings()["pay_online"]:
        if not sandbox.active("payments"):
            raise SubError("Online betalen is nog niet beschikbaar.")
        back = f"{return_base.rstrip('/')}/bestelling/{order.number}?t={order.token}" if return_base else ""
        payment = sandbox.create_payment(order.total, order.currency, f"Bestelling {order.number}", sandbox.payment_provider(), back)
        order.status, order.payment_ref = "pending_payment", payment.ref
        order.save(update_fields=["status", "payment_ref"])
        done = sandbox.settle(payment, back or "/dashboard/subscriptions")  # automatic mode: paid at once
        return done or f"/sandbox/checkout/{payment.ref}"
    if settings()["invoice_activate"] or order.kind == "donation":
        mark_paid(order, note="op factuur")
    return None


def mark_paid(order, note=""):
    if order.status not in ("paid", "completed"):
        order.status = "paid"
        order.save(update_fields=["status"])
    on_order_status(order, "new")


def _plan_period(plan, start):
    if plan.recurring:
        return start + timedelta(days=INTERVAL_DAYS[plan.interval])
    return start + timedelta(days=plan.duration_days) if plan.duration_days else None


def interval_label(plan):
    return dict(__import__("apps.subscriptions.models", fromlist=["INTERVALS"]).INTERVALS).get(plan.interval, plan.interval)


def subscribe(user, plan, return_base=""):
    if not plan.active:
        raise SubError("Dit abonnement is niet meer te koop.")
    if plan.price > 0 and not (plan.trial_days):
        ensure_can_pay()
    if Subscription.objects.filter(user=user, plan=plan, status__in=LIVE).exclude(status="canceled").exists():
        raise SubError("Je hebt dit abonnement al.")
    for old in Subscription.objects.filter(user=user, plan=plan, status="pending"):  # an unfinished earlier try
        open_orders(old).update(status="canceled")
        old.status = "expired"
        old.save(update_fields=["status"])
    now = timezone.now()
    with transaction.atomic():
        sub = Subscription.objects.create(user=user, plan=plan, price=plan.price, status="pending")
        if plan.trial_days and plan.price > 0:
            sub.status, sub.started_at, sub.period_start, sub.period_end = "trial", now, now, now + timedelta(days=plan.trial_days)
            sub.save()
            logger.info("Subscription %s: trial for %s", sub.pk, user.pk)
            _mail(user, f"Je proefperiode van {plan.name} is gestart", f"Je kunt {plan.trial_days} dagen gratis gebruikmaken van {plan.name}. Daarna wordt het eerste bedrag in rekening gebracht.")
            return sub, None
        order = _order(user, "subscription", sub.pk, f"{plan.name} ({interval_label(plan).lower()})", plan.price, plan.vat_rate, 1)
    path = start_payment(order, return_base)
    sub.refresh_from_db()
    return sub, path or None


def _repeat_order(sub):
    return _order(sub.user, "subscription", sub.pk, f"{sub.plan.name} ({interval_label(sub.plan).lower()}), periode {sub.periods + 1}", sub.price, sub.plan.vat_rate, sub.periods + 1)


def on_order_status(order, old):
    """Called when an order changes status (payment, admin). Paid -> access starts or is extended; canceled -> pending things end."""
    if order.kind == "shop" or not modules.enabled("subscriptions"):
        return
    paid = order.status in ("paid", "processing", "shipped", "completed")
    if order.kind == "subscription":
        sub = Subscription.objects.filter(pk=order.ref_id).select_related("plan", "user").first()
        if not sub:
            return
        if paid and old not in ("paid", "processing", "shipped", "completed"):
            _activate(sub, order)
        elif order.status in ("canceled", "refunded") and old in ("new", "pending_payment") and sub.status == "pending":
            sub.status = "expired"
            sub.save(update_fields=["status"])


def on_payment(payment):
    """Donations are paid without an order (no webshop needed): the payment itself tells the outcome. Registered with the sandbox in apps.py."""
    d = Donation.objects.filter(payment_ref=payment.ref).select_related("campaign").first()
    if not d or not modules.enabled("donations"):
        return
    if payment.status == "paid" and d.status != "paid":
        now = timezone.now()
        d.status, d.paid_at = "paid", now
        if d.campaign.grants and d.amount >= d.campaign.min_for_grants:
            d.access_until = now + timedelta(days=d.campaign.grant_days)
        d.save()
        give_rewards(d)
        _mail_donation(d)
    elif payment.status in ("failed", "canceled", "expired") and d.status == "pending":
        d.status = "failed"
        d.save(update_fields=["status"])
    elif payment.status == "refunded":
        d.status, d.access_until = "failed", None
        d.save(update_fields=["status", "access_until"])
        d.rewards.all().delete()  # a refunded gift takes the actions away


VALID_FOR = {"1h": timedelta(hours=1), "1d": timedelta(days=1), "1w": timedelta(days=7), "1m": timedelta(days=30), "3m": timedelta(days=91), "1y": timedelta(days=365)}  # how long an action stays valid after the donation; empty = always (no end)
# our proposal per item: how long a donor may use it after a completed donation
SUGGEST = {"site": "1m", "discover": "1m", "likes": "1d", "see_likes": "1m", "see_visitors": "1m", "messages": "1m", "friend_requests": "1m", "chat": "1m", "chat_media": "1m", "video_chat": "1w",
           "direct_connection": "1w", "private_photos": "1y", "visible_if_liked": "1m", "public_search": "1y", "hide_details": "1y", "profile_design": "1y", "available_for": "1y", "advanced_search": "1m",
           "undo_swipe": "1w", "like_message": "1w", "post_vacancy": "1m", "job_seeker": "1m", "search_jobs": "1m"}


def rule_of(key):
    """The "Geldig tot" settings of an item (empty = the settings of the donation itself)."""
    row = ActionItem.objects.filter(key=key).first()
    return dict(row.rule or {}) if row else {}


def give_rewards(d):
    """The actions of the campaign that fit the amount become this donor's own (with their own use counter). Needs an account."""
    from datetime import datetime
    from decimal import Decimal

    if not d.user_id or d.rewards.exists():
        return
    for a in d.campaign.actions or []:
        key = a["type"] if a["type"] not in ("page", "content", "service") else f"{a['type']}:{a.get('ref') or ''}"
        rule = rule_of(key) or {}  # "Geldig tot" of the item (Admin -> Actions) goes before what an older donation setup says
        a = {**a, **{k: v for k, v in rule.items() if k in ("valid_for", "from", "until", "uses", "session_only", "min_amount")}} if rule else a
        if d.amount < Decimal(str(a.get("min_amount") or 0)):
            continue
        until = datetime.fromisoformat(a["until"]) if a.get("until") else None
        if a.get("valid_for") in VALID_FOR:  # "valid for 1 week / 1 month ... after the donation": counted from the moment it was paid
            end = (d.paid_at or timezone.now()) + VALID_FOR[a["valid_for"]]
            until = min(until, end) if until else end
        DonorAction.objects.create(
            donation=d, user_id=d.user_id, type=a["type"], ref=a.get("ref") or "", value=int(a.get("value") or 0),
            valid_from=datetime.fromisoformat(a["from"]) if a.get("from") else None, valid_until=until,
            uses_total=int(a.get("uses") or 0), session_only=bool(a.get("session_only")))


def _live_rewards(user, now=None, limited=None):
    """Donor actions that can be used right now: in their dates, uses left, and (session only) tied to the current login."""
    from rest_framework.authtoken.models import Token

    now = now or timezone.now()
    token = Token.objects.filter(user=user).values_list("key", flat=True).first()
    out = []
    for r in DonorAction.objects.filter(user=user):
        if (r.valid_from and r.valid_from > now) or (r.valid_until and r.valid_until <= now):
            continue
        if r.uses_total and r.uses_used >= r.uses_total:
            continue
        if limited is True and not r.uses_total or limited is False and r.uses_total:
            continue
        if r.session_only:
            if not token or (r.bound_token and r.bound_token != token):
                continue  # logged out since: the session is over
            if not r.bound_token:
                r.bound_token = token  # the first login that sees it is the session it belongs to
                r.save(update_fields=["bound_token"])
        out.append(r)
    return out


def charge(user, type_, ref=""):
    """One use of a feature happened. Free access (subscription, unlimited action, staff) costs nothing; otherwise a limited donor action pays one use."""
    if not user or not getattr(user, "is_authenticated", False) or user.is_staff or not modules.enabled("donations"):
        return
    base = entitlements(user, with_limited=False)
    if type_ in FEATURE_KEYS and base[type_]:
        return
    if type_ == "page" and (ref in base["pages"]):
        return
    if type_ == "content" and (ref in base["content"]):
        return
    for r in _live_rewards(user, limited=True):
        if r.type == type_ and (not r.ref or r.ref == ref):
            r.uses_used += 1
            r.save(update_fields=["uses_used"])
            return


def charge_like(user):
    """A like was given: once the daily allowance is used up, extra likes from a donation pay for it."""
    if not gate_on("likes") or user.is_staff:
        return
    from apps.social.models import Like

    ent = entitlements(user, with_limited=False)
    if ent["likes"] is None:
        return
    limit = max(settings()["free_likes_per_day"], ent["likes"] or 0)
    today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    if Like.objects.filter(from_user=user, created_at__gte=today).count() > limit:
        for r in _live_rewards(user, limited=True):
            if r.type == "likes":
                r.uses_used += 1
                r.save(update_fields=["uses_used"])
                return


def my_rewards(user):
    return [{"id": r.id, "type": r.type, "label": describe([{"type": r.type, "ref": r.ref, "value": r.value}])[0]["label"], "until": r.valid_until, "uses_left": (r.uses_total - r.uses_used) if r.uses_total else None,
             "session_only": r.session_only} for r in _live_rewards(user)]


def _activate(sub, order):
    now = timezone.now()
    grace = timedelta(days=settings()["grace_days"])
    # a repeat continues where the last period ended (also when paid a little late); a long lapse starts fresh
    start = sub.period_end if sub.period_end and order.period_no > 1 and sub.period_end > now - grace else now
    sub.period_start, sub.period_end = start, _plan_period(sub.plan, start)
    sub.status = "canceled" if sub.cancel_at_period_end else "active"
    sub.started_at = sub.started_at or now
    sub.periods = max(sub.periods + 1, order.period_no)
    sub.save()
    first = sub.periods == 1
    if first:
        _mail(sub.user, f"Je abonnement {sub.plan.name} is actief", f"Bedankt! Je abonnement {sub.plan.name} loopt tot {sub.period_end:%d-%m-%Y}." if sub.period_end else f"Bedankt! Je abonnement {sub.plan.name} is actief.")
    logger.info("Subscription %s active until %s (period %s)", sub.pk, sub.period_end, sub.periods)


def cancel(sub, now_=False):
    """The member cancels: access stays until the end of the paid period. `now_` ends it immediately (admin)."""
    if sub.status in ("expired",):
        return sub
    if now_ or not sub.period_end:
        sub.status, sub.period_end = "expired", timezone.now() if sub.period_end else None
        sub.cancel_at_period_end = False
    else:
        sub.cancel_at_period_end, sub.status = True, ("canceled" if sub.status != "pending" else "expired")
    sub.save()
    open_orders(sub).update(status="canceled")  # an unpaid repeat is no longer needed
    return sub


def resume(sub):
    if sub.status == "canceled" and sub.period_end and sub.period_end > timezone.now():
        sub.cancel_at_period_end, sub.status = False, "active"
        sub.save()
    return sub


def open_orders(sub):
    from apps.shop.models import Order

    return Order.objects.filter(kind="subscription", ref_id=sub.pk, status__in=("new", "pending_payment"))


def process_due(user=None):
    """Repeat orders for periods that ended, grace for unpaid ones, expiry. Safe to run often (cron / command, and when a member opens their page)."""
    now, grace, done = timezone.now(), timedelta(days=settings()["grace_days"]), 0
    qs = Subscription.objects.filter(status__in=LIVE, period_end__lte=now).select_related("plan", "user")
    if user:
        qs = qs.filter(user=user)
    for sub in qs:
        if sub.cancel_at_period_end or not sub.plan.recurring or sub.status == "canceled":
            sub.status = "expired"
            sub.save(update_fields=["status"])
            open_orders(sub).update(status="canceled")
            done += 1
            continue
        pending = open_orders(sub).first()
        if sub.status == "past_due" and pending and now - sub.period_end > grace:
            sub.status = "expired"
            sub.save(update_fields=["status"])
            open_orders(sub).update(status="canceled")
            _mail(sub.user, f"Je abonnement {sub.plan.name} is verlopen", "We hebben geen betaling ontvangen. Je abonnement is beëindigd.")
            done += 1
        elif not pending:
            order = _repeat_order(sub)
            try:
                start_payment(order)
            except SubError:
                pass  # no online payment possible: the order stays open and the member sees it as unpaid
            sub.refresh_from_db()
            if sub.period_end and sub.period_end <= now and sub.status != "past_due":
                sub.status = "past_due"
                sub.save(update_fields=["status"])
                _mail(sub.user, f"Betaling voor {sub.plan.name}", f"Er staat een nieuwe betaling klaar ({sub.price} euro). Betaal binnen {settings()['grace_days']} dagen via je abonnementenpagina.")
            done += 1
    return done


def pay_open(sub, return_base=""):
    """The member pays an open repeat order: returns the checkout path."""
    order = open_orders(sub).order_by("-id").first()
    if not order:
        raise SubError("Er staat niets open.")
    return start_payment(order, return_base), order


# ── donations ────────────────────────────────────────────────────────────────
def donate(campaign, amount, user=None, name="", email="", message="", anonymous=False, return_base="", return_path=""):
    if not campaign.active:
        raise SubError("Deze actie is gesloten.")
    try:
        amount = money(amount)
    except Exception:  # noqa: BLE001
        raise SubError("Ongeldig bedrag.")
    if not campaign.min_amount <= amount <= campaign.max_amount:
        raise SubError(f"Het bedrag is tussen {campaign.min_amount} en {campaign.max_amount}.")
    if campaign.step > 0 and ((amount - campaign.min_amount) / campaign.step) % 1 != 0 and amount != campaign.max_amount:
        amount = campaign.min_amount + ((amount - campaign.min_amount) / campaign.step).to_integral_value(rounding=ROUND_HALF_UP) * campaign.step
        amount = min(max(amount, campaign.min_amount), campaign.max_amount)
    from apps.sandbox import service as sandbox

    if not sandbox.active("payments"):
        raise SubError("Online betalen is nog niet beschikbaar.")  # a gift needs a real (or simulated) payment: no paying by invoice
    if not user and not email:
        raise SubError("Vul je e-mailadres in, dan sturen we een bevestiging.")
    from apps.security.words import find_forbidden

    if message and find_forbidden(message):
        raise SubError("Je bericht bevat niet toegestane woorden.")
    who = name or ((user.get_full_name() or user.username) if user else "")
    d = Donation.objects.create(campaign=campaign, user=user, name=who[:120], email=(email or (user.email if user else ""))[:254], amount=amount,
                                message=(message if campaign.allow_message else "")[:300], anonymous=bool(anonymous and campaign.allow_anonymous))
    path = return_path if return_path.startswith("/") and not return_path.startswith("//") else "/doneren"
    back = f"{return_base.rstrip('/')}{path}{'&' if '?' in path else '?'}bedankt={campaign.id}" if return_base else ""
    payment = sandbox.create_payment(amount, "EUR", f"Donatie {campaign.name}", sandbox.payment_provider(), back)
    d.payment_ref = payment.ref
    d.save(update_fields=["payment_ref"])
    done = sandbox.settle(payment, back or f"/doneren?bedankt={campaign.id}")  # automatic mode: paid at once
    return d, done or f"/sandbox/checkout/{payment.ref}"


def raised(campaign):
    from django.db.models import Count, Sum

    r = campaign.donations.filter(status="paid").aggregate(total=Sum("amount"), n=Count("id"))
    return {"total": r["total"] or Decimal("0.00"), "count": r["n"]}


def _mail(user, subject, body):
    try:
        from apps.communication import sending

        if user and user.email:
            sending.send_email(user.email, subject, body, purpose="notifications")
    except Exception as e:  # noqa: BLE001  e-mail problems never block a payment
        logger.warning("Subscription mail failed: %s", e)


def _mail_donation(d):
    try:
        from apps.communication import sending

        if d.email:
            sending.send_email(d.email, f"Bedankt voor je donatie aan {d.campaign.name}", f"Bedankt{(' ' + d.name) if d.name else ''}! We hebben je donatie van € {d.amount} ontvangen.", purpose="notifications")
    except Exception as e:  # noqa: BLE001
        logger.warning("Donation mail failed: %s", e)
