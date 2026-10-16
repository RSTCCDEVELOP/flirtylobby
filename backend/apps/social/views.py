import logging
import mimetypes
import os
import re
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.files.storage import default_storage
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.access import level
from apps.core.modules import module_required
from apps.medialib import service as media_service
from apps.security.words import find_forbidden

from . import discover as dsc
from . import service
from .models import Block, ChatMessage, Connection, ChatSignal, DirectMessage, Profile, ProfileAllow, ProfilePhoto

User = get_user_model()
logger = logging.getLogger(__name__)
AUTH = [IsAuthenticated]
PROFILES = [IsAuthenticated, module_required("profiles")]
MESSAGES = [IsAuthenticated, module_required("messages")]
CHAT = [IsAuthenticated, module_required("chat")]
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731
person = lambda u, viewer=None: {"id": u.id, "name": service.display_name(u), "photo": service.photo_url(u, viewer), "online": service.online(u), "verification": u.verification}  # noqa: E731


def _partner(request, uid):
    u = User.objects.filter(pk=uid, is_active=True).first()
    return u if u and service.can_interact(request.user, u) else None


# ═══ profile (own) ══════════════════════════════════════════════════════════
def _own(p):
    cfg = service.get()
    return {"enabled": p.enabled, "slug": p.slug, "headline": p.headline, "bio": p.bio, "visibility": p.visibility, "languages": p.languages,
            "searchable_local": p.searchable_local, "searchable_public": p.searchable_public, "accept_messages": p.accept_messages,
            "accept_chat": p.accept_chat, "discover": p.discover, "gender": p.gender, "birth_date": p.birth_date.isoformat() if p.birth_date else "",
            "city": p.city, "country": p.country, "interests": p.interests, "looking_for_genders": p.looking_for_genders, "aim": p.aim,
            "age_min": p.age_min, "age_max": p.age_max, "show_age": p.show_age, "show_city": p.show_city, "show_distance": p.show_distance,
            "location_found": p.lat is not None, "distance_enabled": cfg["discover"]["distance_enabled"], "min_age": cfg["discover"]["min_age"], "max_age": cfg["discover"]["max_age"],
            "require_photo": cfg["discover"]["require_photo"],
            "max_photos": cfg["profiles"]["max_photos"], "available_languages": service.active_languages(),
            "photos": [{"id": ph.id, "url": default_storage.url(ph.image.name), "caption": ph.caption, "visibility": ph.visibility, "private": ph.private} for ph in p.photos.all()],
            "profile_cfg": {"theme": cfg["profiles"]["theme"], "builtin": cfg["profiles"]["builtin"], "fields": cfg["profiles"]["fields"]}, "data": p.data or {},
            "private_photos": cfg["profiles"]["private_photos"], "max_private_photos": cfg["profiles"]["max_private_photos"],
            "allowed": [person(a.user, p.user) for a in p.allowed.select_related("user")]}


@api_view(["GET", "PUT"])
@permission_classes(PROFILES)
def profile_me(request):
    p = service.profile_of(request.user)
    if request.method == "PUT":
        b = request.data
        text = {"headline": str(b.get("headline", p.headline))[:150], "bio": str(b.get("bio", p.bio))[:4000]}
        words = find_forbidden(text["headline"] + " " + text["bio"])
        if words:
            return bad(f"Bevat niet toegestane woorden: {', '.join(words)}.")
        vis = b.get("visibility", p.visibility)
        if vis not in ("public", "members", "friends", "selected"):
            return bad("Ongeldige zichtbaarheid.")
        langs = [l for l in (b.get("languages", p.languages) or []) if l in service.active_languages()]
        slug = str(b.get("slug", p.slug)).strip().lower()
        if slug != p.slug:
            if not re.fullmatch(r"[a-z0-9-]{3,60}", slug) or Profile.objects.filter(slug=slug).exclude(pk=p.pk).exists():
                return bad("Dit adres is ongeldig of al in gebruik (3-60 tekens: a-z, 0-9 en -).")
            p.slug = slug
        for f in ("enabled", "searchable_local", "searchable_public", "accept_messages", "accept_chat"):
            if f in b:
                setattr(p, f, bool(b[f]))
        p.headline, p.bio, p.visibility, p.languages = text["headline"], text["bio"], vis, langs
        if err := dsc.validate_dating_fields(p, b):
            return bad(err)
        fields = service.get()["profiles"]["fields"]
        if "data" in b:
            data, err = service.clean_values(fields, b["data"], p.data)
            if err:
                return bad(err)
            p.data = data
        if p.enabled:
            for fl in fields:
                if fl["required"] and service.empty((p.data or {}).get(fl["key"])):
                    return bad(f"{fl['label']} is verplicht.")
        p.save()
    return Response(_own(p))


class PhotoUpload(serializers.Serializer):
    image = serializers.ImageField()
    caption = serializers.CharField(required=False, allow_blank=True, max_length=200)

    def validate_image(self, f):
        if f.size > 8 * 1024 * 1024:
            raise serializers.ValidationError("Foto is te groot (maximaal 8 MB).")
        return f


@api_view(["POST"])
@permission_classes(PROFILES)
@parser_classes([MultiPartParser, FormParser])
def profile_photo_add(request):
    p = service.profile_of(request.user)
    if p.photos.count() >= service.get()["profiles"]["max_photos"]:
        return bad(f"Maximaal {service.get()['profiles']['max_photos']} foto's.")
    up = PhotoUpload(data=request.data)
    if not up.is_valid():
        return bad(" ".join(str(m) for v in up.errors.values() for m in v))
    last = p.photos.order_by("-order").first()
    cfg = service.get()["profiles"]
    vis = str(request.data.get("visibility") or ("private" if str(request.data.get("private", "")).lower() in ("1", "true", "yes", "on") else "public"))
    if vis not in service.PHOTO_VISIBILITY:
        return bad("Ongeldige zichtbaarheid.")
    if vis == "private" and not cfg["private_photos"]:
        vis = "members"
    if vis == "private" and p.photos.filter(visibility="private").count() >= cfg["max_private_photos"]:
        return bad(f"Maximaal {cfg['max_private_photos']} afgeschermde foto's.")
    ph = ProfilePhoto(profile=p, image=up.validated_data["image"], visibility=vis, caption=up.validated_data.get("caption", ""), order=(last.order + 1) if last else 0)
    ph.save()
    try:
        service.make_blur(ph)
        ph.save(update_fields=["blurred"])
    except Exception:  # noqa: BLE001 - a missing blur must never break the upload; the photo then simply shows no preview
        logger.exception("Blur failed for photo %s", ph.pk)
    return Response(_own(p), status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes(PROFILES)
def profile_photo_edit(request, pk):
    """Own photo: caption and 'private' (blurred for everybody without access)."""
    ph = ProfilePhoto.objects.filter(pk=pk, profile__user=request.user).first()
    if not ph:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    cfg = service.get()["profiles"]
    if "visibility" in request.data or "private" in request.data:
        vis = request.data.get("visibility") or ("private" if request.data.get("private") else "public")
        if vis not in service.PHOTO_VISIBILITY:
            return bad("Ongeldige zichtbaarheid.")
        if vis == "private" and not cfg["private_photos"]:
            return bad("Wazige foto's zijn uitgezet.")
        if vis == "private" and ph.visibility != "private" and ph.profile.photos.filter(visibility="private").count() >= cfg["max_private_photos"]:
            return bad(f"Maximaal {cfg['max_private_photos']} afgeschermde foto's.")
        if vis == "private" and not ph.blurred:
            service.make_blur(ph)
        ph.visibility = vis
    if "caption" in request.data:
        cap = str(request.data["caption"])[:200]
        if words := find_forbidden(cap):
            return bad(f"Bevat niet toegestane woorden: {', '.join(words)}.")
        ph.caption = cap
    ph.save()
    return Response(_own(ph.profile))


@api_view(["DELETE"])
@permission_classes(PROFILES)
def profile_photo_delete(request, pk):
    photo = ProfilePhoto.objects.filter(pk=pk, profile__user=request.user).first()
    if photo:
        name = photo.image.name
        photo.delete()
        media_service.release(name)
    return Response(_own(service.profile_of(request.user)))


@api_view(["POST"])
@permission_classes(PROFILES)
def profile_photo_avatar(request, pk):
    """Make this photo the profile photo: it becomes the first photo and the account picture (menu, name)."""
    from django.core.files.base import ContentFile

    ph = ProfilePhoto.objects.filter(pk=pk, profile__user=request.user).first()
    if not ph:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    user, old = request.user, request.user.image.name
    ph.image.open("rb")
    try:
        data = ph.image.read()
    finally:
        ph.image.close()
    user.image.save(os.path.basename(ph.image.name), ContentFile(data), save=False)
    user.save(update_fields=["image"])
    if old:
        media_service.release(old)
    ids = [ph.id] + [x.id for x in ph.profile.photos.exclude(pk=ph.pk)]
    for n, i in enumerate(ids):
        ProfilePhoto.objects.filter(pk=i).update(order=n)
    return Response(_own(ph.profile))


@api_view(["POST"])
@permission_classes(PROFILES)
def profile_photo_order(request):
    p = service.profile_of(request.user)
    for n, pid in enumerate(request.data.get("ids", [])):
        p.photos.filter(pk=pid).update(order=n)
    return Response(_own(p))


@api_view(["GET", "PUT"])
@permission_classes(PROFILES)
def profile_allowed(request):
    p = service.profile_of(request.user)
    if request.method == "PUT":
        hidden = service.hidden_ids(request.user)
        ids = [i for i in request.data.get("users", []) if isinstance(i, int) and i != request.user.id and i not in hidden]
        ProfileAllow.objects.filter(profile=p).exclude(user_id__in=ids).delete()
        for u in User.objects.filter(pk__in=ids, is_active=True):
            ProfileAllow.objects.get_or_create(profile=p, user=u)
    return Response([person(a.user, request.user) for a in p.allowed.select_related("user")])


# ═══ directory / public profile ═════════════════════════════════════════════
def _card(p, viewer=None):
    return {"slug": p.slug, "id": p.user_id, "name": service.display_name(p.user), "headline": p.headline, "card_fields": service.visible_fields(p, viewer, only_card=True), "photo": service.photo_url(p.user, viewer), "verification": p.user.verification}


@api_view(["GET"])
@permission_classes([AllowAny, module_required("profiles")])
def profiles_directory(request):
    lang = request.query_params.get("lang")
    qs = Profile.objects.filter(enabled=True, searchable_local=True, user__is_active=True).select_related("user").prefetch_related("photos")
    if q := request.query_params.get("q", "").strip():
        qs = qs.filter(Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q) | Q(headline__icontains=q) | Q(bio__icontains=q))
    if request.user.is_authenticated:
        qs = qs.exclude(user_id__in=service.hidden_ids(request.user))
    cards = [_card(p, request.user) for p in qs[:300] if service.can_view(request.user, p, lang)][:100]
    if request.user.is_authenticated:  # pages for selected members: shown locked, so members can ask for access
        seen = {c["slug"] for c in cards}
        locked = Profile.objects.filter(enabled=True, searchable_local=True, visibility="selected", user__is_active=True).exclude(user=request.user) \
            .exclude(user_id__in=service.hidden_ids(request.user)).select_related("user").prefetch_related("photos")
        cards += [{**_card(p, request.user), "locked": True} for p in locked[:100] if p.slug not in seen]
    return Response(cards)


@api_view(["GET"])
@permission_classes([AllowAny, module_required("profiles")])
def profile_detail(request, slug):
    p = Profile.objects.filter(slug=slug).select_related("user").prefetch_related("photos").first()
    me, authed = request.user, request.user.is_authenticated
    # owner's preview: show the page exactly as a visitor who is not logged in sees it
    preview = bool(p and authed and request.query_params.get("preview") == "public" and p.user_id == me.id)
    if preview:
        me, authed = AnonymousUser(), False
        if not service.can_view(me, p, request.query_params.get("lang")):
            return Response({"preview_hidden": True, "enabled": p.enabled, "visibility": p.visibility, "name": service.display_name(p.user)})
    if p and authed and p.visibility == "selected" and p.enabled and p.user.is_active and not service.can_view(me, p, request.query_params.get("lang")) \
            and not service.is_blocked_between(me, p.user):
        # members see that this page is for selected members only, so they can ask for access
        return Response({**_card(p, me), "locked": True, "id": p.user_id, "photos": [], "relation": _relation(me, p.user)})
    if not p or not service.can_view(me, p, request.query_params.get("lang")):
        return Response(status=status.HTTP_404_NOT_FOUND)  # never reveal that a hidden profile exists
    if not preview:
        dsc.record_visit(me, p)
    likes, _, favs, matches = dsc._sets(me) if authed else (set(), set(), set(), set())
    return Response(service.mask({
        **_card(p, me), "age": dsc.age_of(p) if p.show_age else None, "city": p.city if p.show_city else "", "gender": p.gender, "aim": p.aim,
        "interests": p.interests, "discover": p.discover, "liked": p.user_id in likes, "favorite": p.user_id in favs, "match": p.user_id in matches,
        "can_like": authed and me.id != p.user_id and (p.discover or service.get()["discover"]["show_non_participants"]) and service.module_on("discover"), "bio": p.bio, "photos": [{"url": u, "caption": ph.caption, "blurred": bl} for ph in p.photos.all() for u, bl in [service.photo_for(ph, me, p.user_id)] if u],
        "fields": service.visible_fields(p, me), "builtin": service.get()["profiles"]["builtin"], "theme": service.get()["profiles"]["theme"],
        "has_private": any(ph.visibility == "private" for ph in p.photos.all()), "relation": _relation(me, p.user) if authed and me.id != p.user_id else None,
        "is_self": authed and me.id == p.user_id, "languages": p.languages,
        "can_message": authed and me.id != p.user_id and p.accept_messages and service.module_on("messages"),
        "can_chat": authed and me.id != p.user_id and p.accept_chat and service.module_on("chat"),
        "blocked_by_me": authed and Block.objects.filter(blocker=me, blocked=p.user).exists(),
        "indexable": p.visibility == "public" and p.searchable_public and p.enabled, "enabled": p.enabled,
    }))


@api_view(["GET"])
@permission_classes(PROFILES)
def people(request):
    """Members I may write to (for the pickers in messages and chat)."""
    qs = Profile.objects.filter(enabled=True, searchable_local=True, user__is_active=True).exclude(user=request.user).select_related("user")
    qs = qs.exclude(user_id__in=service.hidden_ids(request.user))
    if q := request.query_params.get("q", "").strip():
        qs = qs.filter(Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q))
    return Response([{**person(p.user, request.user), "slug": p.slug, "accept_messages": p.accept_messages, "accept_chat": p.accept_chat}
                     for p in qs[:200] if service.can_view(request.user, p)][:50])


# ═══ friends and requests (friend / see photos / see profile) ═══════════════
def _relation(me, other):
    """What exists between me and `other`: per kind my request status, whether we are friends, and whether I can ask."""
    from .models import Connection

    cfg = service.get()["profiles"]
    mine = {c.kind: c for c in Connection.objects.filter(from_user=me, to_user=other)}
    theirs = {c.kind: c for c in Connection.objects.filter(from_user=other, to_user=me)}
    friends = service.are_friends(me.id, other.id)
    now = timezone.now()

    def state(kind):
        c = mine.get(kind)
        if not c:
            return None
        if c.status == "declined" and cfg["decline_days"] and c.decided_at and now - c.decided_at > timedelta(days=cfg["decline_days"]):
            return None  # may ask again
        return c.status

    return {"friends": friends, "enabled": cfg["requests_enabled"],
            "friend": "accepted" if friends else (state("friend") if not theirs.get("friend") or theirs["friend"].status != "pending" else "incoming"),
            "photos": state("photos"), "profile": state("profile"),
            "incoming": {k: c.id for k, c in theirs.items() if c.status == "pending"},
            "incoming_friend_id": theirs["friend"].id if "friend" in theirs and theirs["friend"].status == "pending" else None}


def _conn(c, viewer):
    other = c.to_user if c.from_user_id == viewer.id else c.from_user
    prof = Profile.objects.filter(user=other).first()
    return {"id": c.id, "kind": c.kind, "status": c.status, "message": c.message, "at": c.created_at, "mine": c.from_user_id == viewer.id,
            "user": {**person(other, viewer), "slug": prof.slug if prof and prof.enabled else None}}


@api_view(["GET", "POST"])
@permission_classes(PROFILES)
def connections(request):
    from .models import Connection

    me = request.user
    if request.method == "POST":
        cfg = service.get()["profiles"]
        if not cfg["requests_enabled"]:
            return bad("Verzoeken zijn uitgezet.", status.HTTP_403_FORBIDDEN)
        kind = request.data.get("kind")
        target = User.objects.filter(pk=request.data.get("user"), is_active=True).first()
        if kind not in ("friend", "photos", "profile") or not target or target.id == me.id or service.is_blocked_between(me, target):
            return bad("Dit verzoek kan niet.")
        if not Profile.objects.filter(user=target, enabled=True).exists():
            return bad("Dit lid heeft geen actieve profielpagina.")
        rel = _relation(me, target)
        if kind == "friend" and rel["friends"]:
            return bad("Jullie zijn al vrienden.")
        if kind == "photos" and service.can_see_private(me, target.id):
            return bad("Je kunt de foto's al bekijken.")
        if kind == "profile" and rel["friends"]:
            return bad("Jullie zijn al vrienden.")
        # the other one already asked me for the same: that is a yes
        back = Connection.objects.filter(from_user=target, to_user=me, kind=kind, status="pending").first()
        if kind == "friend" and back:
            back.status, back.decided_at = "accepted", timezone.now()
            back.save()
            return Response({"relation": _relation(me, target)})
        c = Connection.objects.filter(from_user=me, to_user=target, kind=kind).first()
        if c and c.status in ("pending", "accepted"):
            return bad("Er staat al een verzoek open." if c.status == "pending" else "Dit is al toegestaan.")
        if c and c.status == "declined" and cfg["decline_days"] and c.decided_at and timezone.now() - c.decided_at < timedelta(days=cfg["decline_days"]):
            return bad(f"Dit verzoek is geweigerd. Je kunt het na {cfg['decline_days']} dagen opnieuw proberen.")
        msg = str(request.data.get("message") or "")[:300]
        if find_forbidden(msg):
            return bad("Je bericht bevat niet toegestane woorden.")
        c = c or Connection(from_user=me, to_user=target, kind=kind)
        c.status, c.message, c.decided_at, c.created_at = "pending", msg, None, timezone.now()
        c.save()
        return Response({"relation": _relation(me, target)}, status=status.HTTP_201_CREATED)

    hidden = service.hidden_ids(me)
    rows = Connection.objects.filter(Q(from_user=me) | Q(to_user=me)).select_related("from_user", "to_user").exclude(from_user_id__in=hidden).exclude(to_user_id__in=hidden)
    incoming = [_conn(c, me) for c in rows if c.to_user_id == me.id and c.status == "pending"]
    outgoing = [_conn(c, me) for c in rows if c.from_user_id == me.id and c.status in ("pending", "declined")]
    friends = [_conn(c, me) for c in rows if c.kind == "friend" and c.status == "accepted"]
    grants = [_conn(c, me) for c in rows if c.kind != "friend" and c.status == "accepted"]
    return Response({"incoming": incoming, "outgoing": outgoing, "friends": friends, "grants": grants})


@api_view(["POST"])
@permission_classes(PROFILES)
def connection_respond(request, pk):
    from .models import Connection

    c = Connection.objects.filter(pk=pk, to_user=request.user, status="pending").first()
    if not c or service.is_blocked_between(request.user, c.from_user):
        return bad("Verzoek niet gevonden.", status.HTTP_404_NOT_FOUND)
    action = request.data.get("action")
    if action not in ("accept", "decline"):
        return bad("Kies accepteren of weigeren.")
    c.status, c.decided_at = ("accepted" if action == "accept" else "declined"), timezone.now()
    c.save()
    return Response({"ok": True})


@api_view(["DELETE"])
@permission_classes(PROFILES)
def connection_delete(request, pk):
    """Withdraw my own request, or end an accepted friendship / access (either side for friends, the owner for access)."""
    from .models import Connection

    me = request.user
    c = Connection.objects.filter(Q(pk=pk), Q(from_user=me) | Q(to_user=me)).first()
    if not c:
        return Response(status=status.HTTP_204_NO_CONTENT)
    if c.status == "accepted" and c.kind != "friend" and c.to_user_id != me.id:
        return bad("Alleen de eigenaar kan toegang intrekken.", status.HTTP_403_FORBIDDEN)
    if c.status == "declined" and c.to_user_id == me.id:  # my refusal stays (cooldown), nothing to delete
        return Response(status=status.HTTP_204_NO_CONTENT)
    c.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ═══ blocking ═══════════════════════════════════════════════════════════════
@api_view(["GET", "POST"])
@permission_classes(PROFILES)
def blocks(request):
    if request.method == "POST":
        target = User.objects.filter(pk=request.data.get("user")).first()
        if not target or target.id == request.user.id:
            return bad("Onbekende user.")
        Block.objects.get_or_create(blocker=request.user, blocked=target)
        ProfileAllow.objects.filter(Q(profile__user=request.user, user=target) | Q(profile__user=target, user=request.user)).delete()
        logger.info("User %s blocked %s", request.user.id, target.id)
    return Response([{**person(b.blocked, request.user), "since": b.created_at} for b in Block.objects.filter(blocker=request.user).select_related("blocked")])


@api_view(["DELETE"])
@permission_classes(PROFILES)
def unblock(request, uid):
    Block.objects.filter(blocker=request.user, blocked_id=uid).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ═══ messages (mailbox) ═════════════════════════════════════════════════════
def _mine(user):
    return DirectMessage.objects.filter(Q(sender=user, hidden_sender=False) | Q(recipient=user, hidden_recipient=False))


@api_view(["GET"])
@permission_classes(MESSAGES)
def msg_conversations(request):
    me, hidden, convs = request.user, service.hidden_ids(request.user), {}
    for m in _mine(me).select_related("sender", "recipient").order_by("-created_at", "-id"):
        other = m.recipient if m.sender_id == me.id else m.sender
        if other.id in hidden:
            continue
        c = convs.setdefault(other.id, {"user": person(other, me), "last": {"body": m.body[:120], "subject": m.subject, "at": m.created_at, "from_me": m.sender_id == me.id}, "unread": 0})
        if m.recipient_id == me.id and not m.read_at:
            c["unread"] += 1
    return Response(list(convs.values()))


@api_view(["GET", "POST"])
@permission_classes(MESSAGES)
def msg_thread(request, uid):
    me = request.user
    other = _partner(request, uid)
    if not other:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "POST":
        body, subject = str(request.data.get("body", "")).strip(), str(request.data.get("subject", "")).strip()[:150]
        cfg = service.get()["messages"]
        prof = Profile.objects.filter(user=other).first()
        if prof and not prof.accept_messages:
            return bad("Deze user ontvangt geen berichten.", status.HTTP_403_FORBIDDEN)
        if not body or len(body) > cfg["max_length"]:
            return bad(f"Bericht is leeg of langer dan {cfg['max_length']} tekens.")
        if words := find_forbidden(body + " " + subject):
            return bad(f"Bevat niet toegestane woorden: {', '.join(words)}.")
        if DirectMessage.objects.filter(sender=me, created_at__gt=timezone.now() - timedelta(minutes=1)).count() >= cfg["rate_per_minute"]:
            return bad("Je verstuurt te snel. Probeer het zo opnieuw.", status.HTTP_429_TOO_MANY_REQUESTS)
        DirectMessage.objects.create(sender=me, recipient=other, subject=subject, body=body)
        try:
            from apps.communication import sending

            sending.send_email(other.email, f"Nieuw bericht van {service.display_name(me)}", f"{service.display_name(me)} heeft je een bericht gestuurd.\n\nLog in om het te lezen.", purpose="notifications")
        except Exception as e:
            logger.warning("Message notification failed: %s", e)
    qs = _mine(me).filter(Q(sender=other, recipient=me) | Q(sender=me, recipient=other))
    qs.filter(recipient=me, read_at__isnull=True).update(read_at=timezone.now())
    return Response({"user": person(other, request.user), "messages": [
        {"id": m.id, "subject": m.subject, "body": m.body, "at": m.created_at, "from_me": m.sender_id == me.id, "read": bool(m.read_at)} for m in qs[:300]]})


@api_view(["DELETE"])
@permission_classes(MESSAGES)
def msg_delete(request, pk):
    m = DirectMessage.objects.filter(pk=pk).first()
    if m and m.sender_id == request.user.id:
        m.hidden_sender = True
        m.save(update_fields=["hidden_sender"])
    elif m and m.recipient_id == request.user.id:
        m.hidden_recipient = True
        m.save(update_fields=["hidden_recipient"])
    return Response(status=status.HTTP_204_NO_CONTENT)


# ═══ chat ═══════════════════════════════════════════════════════════════════
IMG, VID = {"png", "jpg", "jpeg", "gif", "webp"}, {"mp4", "webm", "mov"}


def _chat_msg(m, me):
    return {"id": m.id, "body": m.body, "at": m.created_at, "from_me": m.sender_id == me.id, "kind": m.attachment_kind,
            "url": default_storage.url(m.attachment.name) if m.attachment else None, "filename": m.attachment_name}


@api_view(["GET"])
@permission_classes(CHAT)
def chat_conversations(request):
    me, hidden, convs = request.user, service.hidden_ids(request.user), {}
    service.touch(me)
    for m in ChatMessage.objects.filter(Q(sender=me) | Q(recipient=me)).select_related("sender", "recipient").order_by("-id")[:500]:
        other = m.recipient if m.sender_id == me.id else m.sender
        if other.id in hidden:
            continue
        c = convs.setdefault(other.id, {"user": person(other, me), "last": (m.body or ("📷 foto" if m.attachment_kind == "image" else "🎬 video"))[:80], "at": m.created_at, "unread": 0})
        if m.recipient_id == me.id and not m.read_at:
            c["unread"] += 1
    return Response(list(convs.values()))


@api_view(["GET", "POST"])
@permission_classes(CHAT)
@parser_classes([JSONParser, MultiPartParser, FormParser])
def chat_thread(request, uid):
    me, cfg = request.user, service.get()["chat"]
    service.touch(me)
    other = _partner(request, uid)
    if not other:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "POST":
        if cfg["method"] != "portal":
            return bad("Deze chat gebruikt een directe verbinding (WebRTC); berichten gaan niet via de portal.")
        prof = Profile.objects.filter(user=other).first()
        if prof and not prof.accept_chat:
            return bad("Deze user ontvangt geen chat.", status.HTTP_403_FORBIDDEN)
        body, f = str(request.data.get("body", "")).strip()[:4000], request.FILES.get("file")
        if not body and not f:
            return bad("Leeg bericht.")
        if words := find_forbidden(body):
            return bad(f"Bevat niet toegestane woorden: {', '.join(words)}.")
        m = ChatMessage(sender=me, recipient=other, body=body)
        if f:
            ext = f.name.rsplit(".", 1)[-1].lower() if "." in f.name else ""
            kind = "image" if ext in IMG else "video" if ext in VID else None
            if not kind or (kind == "image" and not cfg["photos"]) or (kind == "video" and not cfg["videos"]):
                return bad("Dit bestandstype mag niet gedeeld worden.")
            if f.size > (cfg["max_image_mb"] if kind == "image" else cfg["max_video_mb"]) * 1024 * 1024:
                return bad("Bestand is te groot.")
            m.attachment_kind, m.attachment_name = kind, f.name[:200]
            m.attachment.save(f"{uuid.uuid4().hex}.{ext}", f, save=False)
        m.save()
    after = int(request.query_params.get("after") or 0)
    qs = ChatMessage.objects.filter(Q(sender=me, recipient=other) | Q(sender=other, recipient=me), id__gt=after)
    ChatMessage.objects.filter(sender=other, recipient=me, read_at__isnull=True).update(read_at=timezone.now())
    return Response({"user": person(other, request.user), "messages": [_chat_msg(m, me) for m in qs.order_by("id")[:200]]})


@api_view(["POST"])
@permission_classes(CHAT)
def chat_signal(request):
    """WebRTC signaling through the portal. Only relays; the connection itself is device to device."""
    cfg = service.get()["chat"]
    if cfg["method"] != "webrtc" and not cfg["video_chat"]:
        return bad("WebRTC staat uit.")
    other = _partner(request, request.data.get("to"))
    kind, payload = request.data.get("kind"), request.data.get("payload") or {}
    if not other or kind not in ("sdp", "ice", "call", "accept", "decline", "end") or len(str(payload)) > 30000:
        return bad("Ongeldig signaal.")
    ChatSignal.objects.create(sender=request.user, recipient=other, kind=kind, payload=payload)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes(CHAT)
def chat_signals(request):
    me = request.user
    service.touch(me)
    ChatSignal.objects.filter(created_at__lt=timezone.now() - timedelta(minutes=5)).delete()
    after, hidden = int(request.query_params.get("after") or 0), service.hidden_ids(me)
    out = [{"id": s.id, "from": s.sender_id, "name": service.display_name(s.sender), "kind": s.kind, "payload": s.payload}
           for s in ChatSignal.objects.filter(recipient=me, id__gt=after).select_related("sender").order_by("id")[:100] if s.sender_id not in hidden]
    return Response(out)


@api_view(["GET"])
@permission_classes(CHAT)
def chat_presence(request):
    ids = [int(i) for i in request.query_params.get("ids", "").split(",") if i.isdigit()][:100]
    return Response({u.id: service.online(u) for u in User.objects.filter(pk__in=ids)})


# ═══ dashboard summary, config, admin ═══════════════════════════════════════
@api_view(["GET"])
@permission_classes(AUTH)
def summary(request):
    me, hidden = request.user, service.hidden_ids(request.user)
    p = Profile.objects.filter(user=me).first()
    return Response({
        "profile": {"enabled": bool(p and p.enabled), "slug": p.slug if p else None, "photos": p.photos.count() if p else 0, "visibility": p.visibility if p else None},
        "unread_messages": _mine(me).filter(recipient=me, read_at__isnull=True).exclude(sender_id__in=hidden).count() if service.module_on("messages") else 0,
        "unread_chat": ChatMessage.objects.filter(recipient=me, read_at__isnull=True).exclude(sender_id__in=hidden).count() if service.module_on("chat") else 0,
        "blocked": Block.objects.filter(blocker=me).count(),
        "requests": Connection.objects.filter(to_user=me, status="pending").exclude(from_user_id__in=hidden).count() if service.module_on("profiles") else 0,
        "friends": Connection.objects.filter(kind="friend", status="accepted").filter(Q(from_user=me) | Q(to_user=me)).count() if service.module_on("profiles") else 0,
        "discover": dsc.counts(me) if service.module_on("discover") else None,
    })


def swipe_on():
    """Is the swipe deck available: the admin setting (auto = on for the dating theme), and the discover module."""
    from . import themes

    d = service.get()["discover"]
    if not service.module_on("discover"):
        return False
    return d["swipe"] == "on" or (d["swipe"] == "auto" and themes.search_config(service.get()["profiles"]["theme"])["swipe"])


@api_view(["GET"])
@permission_classes(AUTH)
def config(request):
    c = service.get()["chat"]
    ice = [{"urls": c["stun"]}] if c["stun"] else []
    if c["turn_url"]:
        ice.append({"urls": c["turn_url"], "username": c["turn_user"], "credential": c["turn_credential"]})
    on = service.module_on("chat")
    d = service.get()["discover"]
    from . import themes

    return Response({"search": themes.search_config(service.get()["profiles"]["theme"]), "discover": {"distance_enabled": d["distance_enabled"], "radii": d["radii"], "max_distance_km": d["max_distance_km"], "suggestions": d["suggestions"],
                                  "show_visitors": d["show_visitors"], "show_likes_received": d["show_likes_received"], "default_sort": d["default_sort"],
                                  "require_to_search": d["require_to_search"], "require_photo": d["require_photo"], "swipe": swipe_on()},
                     "chat": {**{k: c[k] for k in ("method", "display", "style", "show_on", "photos", "videos", "video_chat", "max_image_mb", "max_video_mb", "direct_hours")}, "ice_servers": ice} if on else None,
                     "profile": {k: service.get()["profiles"][k] for k in ("theme", "builtin", "fields")},
                     "modules": {k: service.module_on(k) for k in ("profiles", "discover", "messages", "chat")}})


@api_view(["POST"])
@permission_classes(AUTH)
def apply_theme(request):
    """Admin: start from a ready-made community theme (replaces the profile fields; member data is kept)."""
    from . import themes

    if level(request.user, "profiles") < 2:
        return bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    key = request.data.get("theme")
    if key not in themes.THEMES:
        return bad("Onbekend thema.")
    cfg = service.save({"profiles": themes.theme_payload(key)}, ["profiles"])
    return Response({"settings": cfg, "themes": themes.public_list()})


SECTION_MODULE = {"profiles": "profiles", "discover": "discover", "messages": "messages", "chat": "chat"}


@api_view(["GET", "PUT"])
@permission_classes(AUTH)
def settings_admin(request):
    me = request.user
    can_use = [m for m in SECTION_MODULE.values() if level(me, m) >= 1]
    if not can_use:
        return bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    if request.method == "PUT":
        editable = [s for s, m in SECTION_MODULE.items() if level(me, m) >= 2]
        asked = [s for s in (request.data or {}) if s in SECTION_MODULE]
        if any(s not in editable for s in asked):
            return bad("Je mag dit onderdeel niet wijzigen.", status.HTTP_403_FORBIDDEN)
        try:
            service.save(request.data, editable)
        except service.Invalid as e:
            return bad(str(e))
        logger.info("Community settings changed by %s", me.email)
    from . import themes

    return Response({"settings": service.get(), "themes": themes.public_list(), "builtin_labels": themes.BUILTIN_LABELS, "sections": {s: level(me, m) for s, m in SECTION_MODULE.items()}, "counts": {
        "profiles": Profile.objects.filter(enabled=True).count(), "messages": DirectMessage.objects.count(), "chat_messages": ChatMessage.objects.count(),
        "blocks": Block.objects.count(), "online": User.objects.filter(last_seen__gt=timezone.now() - timedelta(seconds=45)).count()}})
