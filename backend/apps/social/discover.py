"""Zoeken & matchen: search members like a dating site, like them, match, favorites and visitors."""
import logging
import re
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.modules import module_required

from . import geocode, service
from .models import DirectMessage, Favorite, Like, Notification, Pass, Profile, ProfileVisit

User = get_user_model()
logger = logging.getLogger(__name__)
DISCOVER = [IsAuthenticated, module_required("profiles", "discover")]
GENDERS, AIMS = ("m", "f", "x"), ("dating", "relationship", "friends", "chat")
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


def age_of(p):
    if not p.birth_date:
        return None
    t = date.today()
    return t.year - p.birth_date.year - ((t.month, t.day) < (p.birth_date.month, p.birth_date.day))


def validate_dating_fields(p, b):
    """Apply gender, birth date, city, interests, preferences from a profile PUT. Returns an error message or None."""
    if "gender" in b:
        if b["gender"] not in ("", *GENDERS):
            return "Ongeldig geslacht."
        p.gender = b["gender"]
    if "birth_date" in b:
        try:
            p.birth_date = date.fromisoformat(b["birth_date"]) if b["birth_date"] else None
        except ValueError:
            return "Ongeldige geboortedatum."
        if p.birth_date and (p.birth_date > date.today() or p.birth_date.year < 1900):
            return "Ongeldige geboortedatum."
        from apps.security.service import underage_message

        if msg := underage_message(p.birth_date):
            p.birth_date = None
            return msg
    if "gender" in b or "birth_date" in b:  # the account keeps the same values
        type(p.user).objects.filter(pk=p.user_id).update(gender=p.gender, birth_date=p.birth_date)
    if "city" in b:
        p.city = str(b["city"])[:100]
    if "country" in b:
        from apps.security.countries import COUNTRY_CODES

        c = str(b["country"]).upper()
        if c and c not in COUNTRY_CODES:
            return "Onbekend land."
        p.country = c
    if "interests" in b:
        tags = []
        for t in b["interests"] or []:
            t = str(t).strip().lower()[:30]
            if t and t not in tags:
                tags.append(t)
        from apps.security.words import find_forbidden

        if words := find_forbidden(" ".join(tags)):
            return f"Bevat niet toegestane woorden: {', '.join(words)}."
        p.interests = tags[:12]
    if "looking_for_genders" in b:
        p.looking_for_genders = [g for g in (b["looking_for_genders"] or []) if g in GENDERS]
    if "aim" in b:
        if b["aim"] not in ("", *AIMS):
            return "Ongeldig doel."
        p.aim = b["aim"]
    for k in ("age_min", "age_max"):
        if k in b:
            if isinstance(b[k], bool) or not isinstance(b[k], int) or not 18 <= b[k] <= 99:
                return "Leeftijdsvoorkeur: tussen 18 en 99."
            setattr(p, k, b[k])
    if p.age_min > p.age_max:
        return "De minimumleeftijd is hoger dan de maximumleeftijd."
    for k in ("show_age", "show_city"):
        if k in b:
            setattr(p, k, bool(b[k]))
    if "discover" in b:
        want = bool(b["discover"])
        if want:
            cfg = service.get()["discover"]
            age = age_of(p)
            if age is None:
                return "Vul je geboortedatum in om mee te doen aan zoeken & matchen."
            if age < cfg["min_age"]:
                return f"Je moet minimaal {cfg['min_age']} jaar zijn om mee te doen."
            if age > cfg["max_age"]:
                return f"Zoeken & matchen is voor leden tot {cfg['max_age']} jaar."
            if p.pk and p.photos.count() < cfg["require_photo"]:
                return f"Voeg minimaal {cfg['require_photo']} foto('s) toe om mee te doen."
        p.discover = want
    if "show_distance" in b:
        p.show_distance = bool(b["show_distance"])
    if "city" in b or "country" in b:  # place changed: look up the coordinates (distance search); the account keeps the same place
        type(p.user).objects.filter(pk=p.user_id).update(city=p.city, country=p.country)
        c = geocode.geocode(p.city, p.country)
        p.lat, p.lon = c if c else (None, None)
    return None


def _card(p, me, likes=None, favs=None, matches=None, mine=None):
    u = p.user
    liked, fav, match = (u.id in likes if likes is not None else False), (u.id in favs if favs is not None else False), (u.id in matches if matches is not None else False)
    return service.mask({"id": u.id, "slug": p.slug, "name": service.display_name(u), "headline": p.headline, "photo": service.photo_url(u, me),
            "age": age_of(p) if p.show_age else None, "city": p.city if p.show_city else "", "country": p.country if p.show_city else "",
            "gender": p.gender, "aim": p.aim, "interests": p.interests[:6], "online": service.online(u), "verification": u.verification, "card_fields": service.visible_fields(p, me, only_card=True),
            "distance_km": _distance(mine, p), "liked": liked, "favorite": fav, "match": match, "accept_messages": p.accept_messages, "accept_chat": p.accept_chat})


def _distance(mine, p):
    """Whole kilometres between two members, only when distance is on and both shared a known place."""
    if not (mine and mine.lat is not None and p.lat is not None and p.show_distance and service.get()["discover"]["distance_enabled"]):
        return None
    return max(1, round(geocode.km(mine.lat, mine.lon, p.lat, p.lon)))


def _sets(me):
    likes = set(Like.objects.filter(from_user=me).values_list("to_user_id", flat=True))
    liked_me = set(Like.objects.filter(to_user=me).values_list("from_user_id", flat=True))
    favs = set(Favorite.objects.filter(user=me).values_list("target_id", flat=True))
    return likes, liked_me, favs, likes & liked_me


def _base(me):
    qs = Profile.objects.filter(enabled=True, searchable_local=True, user__is_active=True)
    if not service.get()["discover"]["show_non_participants"]:
        qs = qs.filter(discover=True)  # only members who take part are found
    return (qs.exclude(user=me)
            .exclude(user_id__in=service.hidden_ids(me)).select_related("user").prefetch_related("photos"))


def _my_profile(me):
    p = Profile.objects.filter(user=me).first()
    return p if p and p.enabled and p.discover else None


@api_view(["GET"])
@permission_classes(DISCOVER)
def search(request):
    me, g, cfg = request.user, request.query_params.get, service.get()["discover"]
    mine = Profile.objects.filter(user=me).first()
    if cfg["require_to_search"] and not _my_profile(me):
        return Response({"results": [], "participating": False, "locked": True, "me": {"gender": "", "interests": []}})
    qs = _base(me)
    if g("gender") in GENDERS:
        qs = qs.filter(gender=g("gender"))
    if g("aim") in AIMS:
        qs = qs.filter(aim=g("aim"))
    if g("country"):
        qs = qs.filter(country=g("country").upper())
    if g("city"):
        qs = qs.filter(city__icontains=g("city"))
    if g("interest"):
        qs = qs.filter(interests__icontains=g("interest").lower())
    if g("q"):
        qs = qs.filter(Q(user__first_name__icontains=g("q")) | Q(headline__icontains=g("q")) | Q(bio__icontains=g("q")))
    today = date.today()
    try:
        if g("age_min"):
            qs = qs.filter(birth_date__lte=today.replace(year=today.year - int(g("age_min"))))
        if g("age_max"):
            qs = qs.filter(birth_date__gt=today.replace(year=today.year - int(g("age_max")) - 1))
    except (ValueError, OverflowError):
        return bad("Ongeldige leeftijd.")
    if g("online") == "1":
        qs = qs.filter(user__last_seen__gt=timezone.now() - timedelta(minutes=5))
    if g("photo") == "1":
        qs = qs.filter(photos__isnull=False).distinct()
    likes, liked_me, favs, matches = _sets(me)
    lang = g("lang")
    sort = g("sort") or cfg["default_sort"]
    results = [p for p in qs.order_by("-id" if sort == "newest" else "-user__last_seen")[:600] if service.can_view(me, p, lang)]

    # filters on the configured profile fields (only fields this member may see)
    for fl in service.get()["profiles"]["fields"]:
        if not fl["filter"]:
            continue
        k, t = fl["key"], fl["type"]
        val, vmin, vmax = g(f"f_{k}"), g(f"f_{k}_min"), g(f"f_{k}_max")
        if not (val or vmin or vmax):
            continue

        def match(p, fl=fl, k=k, t=t, val=val, vmin=vmin, vmax=vmax):
            if not service.can_see_field(fl, me, p.user_id):
                return False
            v = (p.data or {}).get(k)
            if t == "checkbox":
                return bool(v) == (val == "1")
            if t == "number":
                try:
                    return v not in (None, "") and (not vmin or v >= float(vmin)) and (not vmax or v <= float(vmax))
                except ValueError:
                    return False
            if t == "multiselect":
                return val in (v or [])
            if t == "select":
                return v == val
            return val.lower() in str(v or "").lower()

        results = [p for p in results if match(p)]

    if g("distance_km") and cfg["distance_enabled"]:
        if not mine or mine.lat is None:
            return bad("Vul je plaats in op je profiel om op afstand te zoeken (en laat de plaats vinden).")
        try:
            limit = min(int(g("distance_km")), cfg["max_distance_km"])
        except ValueError:
            return bad("Ongeldige afstand.")
        results = [p for p in results if (d := _distance(mine, p)) is not None and d <= limit]
    if sort == "distance":
        results.sort(key=lambda p: (_distance(mine, p) is None, _distance(mine, p) or 0))

    if g("mode") == "suggested" and mine and cfg["suggestions"]:
        my_age, my_tags = age_of(mine), set(mine.interests)

        def compatible(p):
            a = age_of(p)
            if mine.looking_for_genders and p.gender not in mine.looking_for_genders:
                return False
            if p.looking_for_genders and mine.gender not in p.looking_for_genders:
                return False
            if a is not None and not mine.age_min <= a <= mine.age_max:
                return False
            return not (my_age is not None and not p.age_min <= my_age <= p.age_max)

        results = [p for p in results if compatible(p)]
        results.sort(key=lambda p: (-len(my_tags & set(p.interests)), p.user_id in likes))
    out = [_card(p, me, likes, favs, matches, mine) for p in results[: cfg["max_results"]]]
    return Response({"results": out, "participating": bool(_my_profile(me)), "me": {"gender": mine.gender if mine else "", "interests": mine.interests if mine else []}})


@api_view(["POST", "DELETE"])
@permission_classes(DISCOVER)
def like(request, uid=None):
    me = request.user
    target = User.objects.filter(pk=uid or request.data.get("user"), is_active=True).first()
    if not target or target.id == me.id or service.is_blocked_between(me, target):
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        Like.objects.filter(from_user=me, to_user=target).delete()
        Notification.objects.filter(user=target, kind="like", from_user=me, seen=False).delete()
        return Response({"liked": False, "match": False})
    cfg = service.get()["discover"]
    if cfg["require_to_like"] and not _my_profile(me):
        return bad("Zet eerst je profiel actief en doe mee aan zoeken & matchen.")
    tp = Profile.objects.filter(user=target, enabled=True, **({} if cfg["show_non_participants"] else {"discover": True})).first()
    if not tp or not service.can_view(me, tp):
        return Response(status=status.HTTP_404_NOT_FOUND)
    if not Like.objects.filter(from_user=me, to_user=target).exists():
        from apps.subscriptions import service as subs

        left = subs.likes_left(me)
        if left is not None and left <= 0:
            return Response({"detail": subs.GATE_MESSAGE["likes"], "subscribe": True}, status=status.HTTP_402_PAYMENT_REQUIRED)
    _, created = Like.objects.get_or_create(from_user=me, to_user=target)
    if created:
        from apps.subscriptions import service as subs

        subs.charge_like(me)
    Pass.objects.filter(from_user=me, to_user=target).delete()
    match = Like.objects.filter(from_user=target, to_user=me).exists()
    sent = False
    msg = str(request.data.get("message") or "").strip()[:140]
    if msg:  # a short message together with the like (swipe deck)
        from apps.security.words import find_forbidden

        if find_forbidden(msg):
            return bad("Je bericht bevat niet toegestane woorden.")
        if tp.accept_messages and service.module_on("messages"):
            DirectMessage.objects.create(sender=me, recipient=target, body=msg)
            sent = True
    if created:  # tell the other member (a match is told to both)
        who = service.display_name(me)
        if match:
            Notification.objects.create(user=target, kind="match", from_user=me)
            Notification.objects.create(user=me, kind="match", from_user=target, seen=True)
            Notification.objects.filter(user=me, kind="like", from_user=target).update(seen=True)
        else:
            Notification.objects.create(user=target, kind="like", from_user=me)
        if sent:
            Notification.objects.create(user=target, kind="message", from_user=me, text=msg[:200])
        if not match and cfg.get("like_email"):
            try:
                from apps.communication import sending

                sending.send_email(target.email, "Iemand vindt je leuk", f"{who if cfg['show_likes_received'] else 'Iemand'} heeft je profiel leuk gevonden. Open je dashboard om te kijken.", purpose="notifications")
            except Exception as e:
                logger.warning("Like mail failed: %s", e)
    if created and match and cfg["match_email"]:  # a new match: tell both
        for a, b in ((me, target), (target, me)):
            try:
                from apps.communication import sending

                sending.send_email(a.email, "Het is een match!", f"Jij en {service.display_name(b)} vinden elkaar leuk. Stuur een bericht of start een chat.", purpose="notifications")
            except Exception as e:
                logger.warning("Match mail failed: %s", e)
    return Response({"liked": True, "match": match, "message_sent": sent})


@api_view(["POST", "DELETE"])
@permission_classes(DISCOVER)
def favorite(request, uid):
    target = User.objects.filter(pk=uid, is_active=True).first()
    if not target or target.id == request.user.id or service.is_blocked_between(request.user, target):
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "POST":
        Favorite.objects.get_or_create(user=request.user, target=target)
    else:
        Favorite.objects.filter(user=request.user, target=target).delete()
    return Response({"favorite": request.method == "POST"})


@api_view(["GET"])
@permission_classes(DISCOVER)
def lists(request):
    """?kind= matches | liked | likedme | favorites | visitors"""
    me, kind = request.user, request.query_params.get("kind", "matches")
    likes, liked_me, favs, matches = _sets(me)
    hidden = service.hidden_ids(me)
    if kind == "visitors":
        if not service.get()["discover"]["show_visitors"]:
            return bad("Bezoekers tonen staat uit.", status.HTTP_403_FORBIDDEN)
        mine = Profile.objects.filter(user=me).first()
        visits = ProfileVisit.objects.filter(profile=mine, visited_at__gt=timezone.now() - timedelta(days=service.get()["discover"]["visitors_days"])).exclude(viewer_id__in=hidden).order_by("-visited_at") if mine else []
        ids = [v.viewer_id for v in visits]
        when = {v.viewer_id: v.visited_at for v in visits}
    else:
        if kind == "likedme" and not service.get()["discover"]["show_likes_received"]:
            return bad("Dit overzicht staat uit.", status.HTTP_403_FORBIDDEN)
        ids = {"matches": list(matches), "liked": list(likes), "likedme": list(liked_me), "favorites": list(favs)}.get(kind, [])
        ids = [i for i in ids if i not in hidden]
        when = {}
        if kind == "likedme":
            Like.objects.filter(to_user=me, seen=False).update(seen=True)
    profs = {p.user_id: p for p in Profile.objects.filter(user_id__in=ids, enabled=True, user__is_active=True).select_related("user").prefetch_related("photos")}
    out = []
    for i in ids:
        p = profs.get(i)
        if p and service.can_view(me, p):
            out.append({**_card(p, me, likes, favs, matches, Profile.objects.filter(user=me).first()), "at": when.get(i)})
    return Response(out)


def record_visit(viewer, profile):
    """Called when someone opens a profile page."""
    if viewer.is_authenticated and viewer.id != profile.user_id and service.module_on("discover"):
        ProfileVisit.objects.update_or_create(profile=profile, viewer=viewer)


def counts(me):
    likes, liked_me, favs, matches = _sets(me)
    hidden = service.hidden_ids(me)
    cfg = service.get()["discover"]
    return {"matches": len(matches - hidden), "likes_new": Like.objects.filter(to_user=me, seen=False).exclude(from_user_id__in=hidden).count() if cfg["show_likes_received"] else 0,
            "favorites": len(favs - hidden)}


# ── swipe deck (like Tinder): one profile at a time, like / pass / like with a short message ─────────
def _compatible(mine, p):
    """Gender and age wishes of both members (only when the member filled them in)."""
    if not mine:
        return True
    a, my_age = age_of(p), age_of(mine)
    if mine.looking_for_genders and p.gender not in mine.looking_for_genders:
        return False
    if p.looking_for_genders and mine.gender not in p.looking_for_genders:
        return False
    if a is not None and not mine.age_min <= a <= mine.age_max:
        return False
    return not (my_age is not None and not p.age_min <= my_age <= p.age_max)


@api_view(["GET"])
@permission_classes(DISCOVER)
def deck(request):
    """The next profiles to swipe: not yet liked, not swiped away recently; people who already liked you come first."""
    me, cfg = request.user, service.get()["discover"]
    mine = Profile.objects.filter(user=me).first()
    if cfg["require_to_search"] and not _my_profile(me):
        return Response({"cards": [], "locked": True})
    likes, liked_me, favs, matches = _sets(me)
    since = timezone.now() - timedelta(days=cfg["pass_days"])
    passed = set(Pass.objects.filter(from_user=me, created_at__gt=since).values_list("to_user_id", flat=True))
    lang = request.query_params.get("lang")
    qs = _base(me).exclude(user_id__in=likes | passed)
    people = [p for p in qs.order_by("-user__last_seen")[:200] if service.can_view(me, p, lang) and _compatible(mine, p)]
    people.sort(key=lambda p: (p.user_id not in liked_me, 0))  # stable: keeps the "recently active" order inside each group
    cards = []
    for p in people[:12]:
        photos = [u for ph in p.photos.all() for u, _bl in [service.photo_for(ph, me, p.user_id)] if u][:5]
        cards.append({**_card(p, me, likes, favs, matches, mine), "photos": photos, "likes_me": p.user_id in liked_me, "bio": (p.bio or "")[:220]})
    return Response({"cards": cards, "locked": False})


@api_view(["POST"])
@permission_classes(DISCOVER)
def pass_(request, uid):
    me = request.user
    target = User.objects.filter(pk=uid, is_active=True).first()
    if not target or target.id == me.id:
        return Response(status=status.HTTP_404_NOT_FOUND)
    Pass.objects.update_or_create(from_user=me, to_user=target, defaults={"created_at": timezone.now()})
    return Response({"passed": True})


# ── notifications: someone liked you, a match, a short message ───────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated, module_required("profiles")])
def notifications(request):
    me, hidden = request.user, service.hidden_ids(request.user)
    show_who = service.get()["discover"]["show_likes_received"]
    rows = list(Notification.objects.filter(user=me).exclude(from_user_id__in=hidden).select_related("from_user")[:30])
    profs = {p.user_id: p for p in Profile.objects.filter(user_id__in=[n.from_user_id for n in rows if n.from_user_id])}
    items = []
    for n in rows:
        anon = n.kind == "like" and not show_who
        p = profs.get(n.from_user_id)
        items.append({"id": n.id, "kind": n.kind, "seen": n.seen, "at": n.created_at, "text": n.text,
                      "from": None if anon or not n.from_user else {"id": n.from_user_id, "name": service.display_name(n.from_user), "slug": p.slug if p else None, "photo": service.photo_url(n.from_user, me)}})
    return Response({"unseen": Notification.objects.filter(user=me, seen=False).exclude(from_user_id__in=hidden).count(), "items": items})


@api_view(["POST"])
@permission_classes([IsAuthenticated, module_required("profiles")])
def notifications_seen(request):
    qs = Notification.objects.filter(user=request.user, seen=False)
    ids = request.data.get("ids")
    if isinstance(ids, list):
        qs = qs.filter(pk__in=[i for i in ids if isinstance(i, int)])
    qs.update(seen=True)
    return Response({"ok": True})
