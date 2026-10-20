"""Direct (WebRTC) one-to-one connection by invitation link. Only active when chat method is "direct connection"."""
import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.modules import module_required

from . import service
from .models import DirectRoom, DirectSignal

ONLINE = timedelta(seconds=12)
MAX_ACTIVE = 5
KINDS = ("sdp", "ice", "call", "accept", "decline", "end", "chat", "ack", "text", "game")
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


def _ice():
    c = service.get()["chat"]
    ice = [{"urls": c["stun"]}] if c["stun"] else []
    if c["turn_url"]:
        ice.append({"urls": c["turn_url"], "username": c["turn_user"], "credential": c["turn_credential"]})
    return ice


def _enabled():
    c = service.get()["chat"]
    return service.module_on("directconnect")


def _min_age():
    from apps.core import modules
    from apps.security import service as sec

    return int(sec.get()["age"]["min_age"]) if modules.enabled("age_gate") else 18


def _profile_extra(data):
    """What the sign-in screen may ask on top of name and gender (Community -> Directe verbinding -> Gegevens): (languages, error)."""
    cfg = service.get()["direct"]
    langs = ""
    if cfg["ask_languages"]:
        valid = set(service.active_languages())
        langs = ",".join(c for c in dict.fromkeys(str(x) for x in (data.get("languages") or []) if isinstance(x, str)) if c in valid)[:60]
    if cfg["ask_birth"]:
        try:
            year, month = int(data.get("birth_year")), int(data.get("birth_month"))
            assert 1 <= month <= 12 and 1900 <= year <= timezone.now().year
        except (TypeError, ValueError, AssertionError):
            return "", "Vul je geboortemaand en geboortejaar in."
        now = timezone.now()
        if ((now.year - year) * 12 + (now.month - month) - 1) // 12 < _min_age():
            return "", f"Je moet minimaal {_min_age()} jaar zijn."
    return langs, None


@api_view(["GET"])
@permission_classes([AllowAny])
def config(request):
    """Public: what the sign-in screen asks (set in Community -> Directe verbinding)."""
    c = service.get()["direct"]
    return Response({"enabled": _enabled(), "couple": "k" in service.genders(), "ask_languages": c["ask_languages"], "ask_birth": c["ask_birth"], "min_age": _min_age()})


def _alive(room):
    return room and not room.closed and room.expires_at > timezone.now()


def _recent(t):
    return bool(t and timezone.now() - t < ONLINE)


CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I: easy to read out and type


def _new_code():
    while True:
        code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
        if not DirectRoom.objects.filter(code=code, closed=False, expires_at__gt=timezone.now()).exists():
            return code


def _state(room):
    return {"owner_online": _recent(room.owner_seen), "guest_online": _recent(room.guest_seen), "guest_name": room.guest_name, "guest_gender": room.guest_gender, "owner_gender": (getattr(room.owner, "gender", "") if room.owner else room.owner_gender) or "", "chat_request": room.chat_request,
            "owner_langs": [x for x in room.owner_langs.split(",") if x], "guest_langs": [x for x in room.guest_langs.split(",") if x],
            "owner_name": service.display_name(room.owner) if room.owner else room.owner_name, "expires_at": room.expires_at}


def _role(request, room):
    """owner (logged in as the owner) | guest (knows the secret key given at join) | None."""
    if request.user.is_authenticated and room.owner_id and request.user.id == room.owner_id:
        return "owner"
    key = request.data.get("key") if request.method == "POST" else request.query_params.get("key")
    if key and room.owner_key and secrets.compare_digest(str(key), room.owner_key):
        return "owner"
    if key and room.guest_key and secrets.compare_digest(str(key), room.guest_key):
        return "guest"
    return None


def _room(token):
    room = DirectRoom.objects.filter(token=token).select_related("owner").first()
    return room if _alive(room) and (room.owner is None or room.owner.is_active) else None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, module_required("directconnect")])
def rooms(request):
    """List my open invitations / create a new one."""
    if request.method == "POST":
        if not _enabled():
            return bad("Directe verbinding staat uit.", status.HTTP_403_FORBIDDEN)
        from apps.subscriptions import service as subs

        if not subs.can(request.user, "direct_connection"):
            return bad(subs.GATE_MESSAGE["direct_connection"], status.HTTP_402_PAYMENT_REQUIRED)
        subs.charge(request.user, "direct_connection")
        DirectRoom.objects.filter(owner=request.user, expires_at__lt=timezone.now()).delete()
        # one direct connection at a time: a new invitation replaces (closes) the open one
        DirectRoom.objects.filter(owner=request.user, closed=False).update(closed=True)
        hours = service.get()["direct"]["hours"]
        room = DirectRoom.objects.create(token=secrets.token_urlsafe(24), code=_new_code(), owner=request.user, expires_at=timezone.now() + timedelta(hours=hours))
    out = [{"token": r.token, "code": r.code, **_state(r)} for r in DirectRoom.objects.filter(owner=request.user, closed=False, expires_at__gt=timezone.now()).order_by("-id")]
    return Response(out, status=status.HTTP_201_CREATED if request.method == "POST" else 200)


@api_view(["POST"])
@permission_classes([AllowAny])
def room_anon(request):
    """A visitor without an account starts a chat (/directconnect): name and gender, then a code, link and QR code to hand out."""
    from django.core.cache import cache

    if not _enabled():
        return bad("Directe verbinding staat uit.", status.HTTP_403_FORBIDDEN)
    ip = request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")
    key = f"direct-anon:{ip}"
    n = cache.get(key, 0)
    if n >= 10:
        return bad("Even rustig aan: probeer het over een uur opnieuw.", status.HTTP_429_TOO_MANY_REQUESTS)
    cache.set(key, n + 1, 3600)
    name = str(request.data.get("name") or "").strip()[:60]
    if not name:
        return bad("Vul je naam in.")
    from apps.security.words import find_forbidden

    if find_forbidden(name):
        return bad("Deze naam is niet toegestaan.")
    gender = str(request.data.get("gender") or "")
    if gender not in service.genders():
        return bad("Kies je geslacht.")
    langs, err = _profile_extra(request.data)
    if err:
        return bad(err)
    hours = service.get()["direct"]["hours"]
    DirectRoom.objects.filter(owner__isnull=True, expires_at__lt=timezone.now()).delete()
    room = DirectRoom.objects.create(token=secrets.token_urlsafe(24), code=_new_code(), owner=None, owner_name=name, owner_gender=gender, owner_langs=langs,
                                     owner_key=secrets.token_urlsafe(24), expires_at=timezone.now() + timedelta(hours=hours))
    return Response({"token": room.token, "code": room.code, "key": room.owner_key}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def room_owner_leave(request, token):
    """The visitor who started the room: disconnect the guest (act="disconnect") or close the room (act="close")."""
    room = _room(token)
    if room and _role(request, room) == "owner" and room.owner_id is None:
        if request.data.get("act") == "close":
            room.closed = True
            room.save(update_fields=["closed"])
        else:
            _reset_guest(room)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def room_close(request, token):
    DirectRoom.objects.filter(token=token, owner=request.user).update(closed=True)
    return Response(status=status.HTTP_204_NO_CONTENT)


def _reset_guest(room):
    """End the current connection: the guest is out; the invitation stays open for a new guest."""
    room.guest_name, room.guest_gender, room.guest_key, room.guest_seen, room.chat_request, room.guest_langs = "", "", "", None, "", ""
    room.save(update_fields=["guest_name", "guest_gender", "guest_key", "guest_seen", "chat_request", "guest_langs"])
    room.signals.all().delete()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def room_disconnect(request, token):
    """Owner: disconnect the person who is connected (the link keeps working for someone else)."""
    room = DirectRoom.objects.filter(token=token, owner=request.user).first()
    if room:
        _reset_guest(room)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([AllowAny])
def room_leave(request, token):
    """Guest: leave the connection."""
    room = _room(token)
    if room and _role(request, room) == "guest":
        _reset_guest(room)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([AllowAny])
def room_by_code(request):
    """Connect without the link: a short code (shown next to the QR code) leads to the invitation. Limited per address against guessing."""
    from django.core.cache import cache

    ip = request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")
    key = f"direct-code:{ip}"
    tries = cache.get(key, 0)
    if tries >= 12:
        return bad("Te veel pogingen. Probeer het over een paar minuten opnieuw.", status.HTTP_429_TOO_MANY_REQUESTS)
    cache.set(key, tries + 1, 600)
    code = "".join(ch for ch in str(request.data.get("code") or "").upper() if ch.isalnum())
    room = DirectRoom.objects.filter(code=code, closed=False, expires_at__gt=timezone.now()).select_related("owner").first() if len(code) == 6 else None
    if not room or not _enabled() or not _alive(room) or not room.owner.is_active:
        return bad("Deze code klopt niet of is verlopen.", status.HTTP_404_NOT_FOUND)
    return Response({"token": room.token})


@api_view(["GET"])
@permission_classes([AllowAny])
def room_info(request, token):
    """Public: what the invitation page needs (who invites, whether it is still valid)."""
    room = _room(token)
    if not room or not _enabled():
        return bad("Deze uitnodiging is verlopen of ingetrokken.", status.HTTP_404_NOT_FOUND)
    role = _role(request, room)
    return Response({**_state(room), "role": role, "taken": bool(room.guest_key) and role != "guest", "code": room.code, "ice_servers": _ice(),
                     "chat": {k: service.get()["direct"][k] for k in ("chat", "photos", "videos", "video_chat", "max_image_mb", "max_video_mb")}})


@api_view(["POST"])
@permission_classes([AllowAny])
def room_join(request, token):
    room = _room(token)
    if not room or not _enabled():
        return bad("Deze uitnodiging is verlopen of ingetrokken.", status.HTTP_404_NOT_FOUND)
    if _role(request, room) == "owner":
        return bad("Dit is je eigen uitnodiging. Stuur de link naar iemand anders.")
    if room.guest_key:
        return bad("Er is al iemand verbonden met deze uitnodiging.", status.HTTP_409_CONFLICT)
    name = str(request.data.get("name") or "").strip()[:60]
    if request.user.is_authenticated and not name:
        name = service.display_name(request.user)
    if not name:
        return bad("Vul je naam in.")
    from apps.security.words import find_forbidden

    if find_forbidden(name):
        return bad("Deze naam is niet toegestaan.")
    gender = str(request.data.get("gender") or "")
    if gender not in service.genders():
        gender = getattr(request.user, "gender", "") if request.user.is_authenticated else ""
    if gender not in service.genders():
        return bad("Kies je geslacht.")
    langs, err = _profile_extra(request.data)
    if err:
        return bad(err)
    room.guest_name, room.guest_gender, room.guest_key, room.guest_seen, room.guest_langs = name, gender, secrets.token_urlsafe(24), timezone.now(), langs
    room.save(update_fields=["guest_name", "guest_gender", "guest_key", "guest_seen", "guest_langs"])
    return Response({"key": room.guest_key, "role": "guest"})


@api_view(["POST"])
@permission_classes([AllowAny])
def guest_chat_request(request, token):
    """Guest: 'I would like to chat'. The owner gets a notice and accepts or declines."""
    room = _room(token)
    if not room or not _enabled() or _role(request, room) != "guest":
        return bad("Niet toegestaan.", status.HTTP_403_FORBIDDEN)
    if room.chat_request != "asked":
        room.chat_request = "asked"
        room.save(update_fields=["chat_request"])
        if room.owner:
            from .models import Notification

            Notification.objects.filter(user=room.owner, kind="dchat", seen=False).delete()
            Notification.objects.create(user=room.owner, kind="dchat", text=room.guest_name[:60])
            try:
                from apps.notifications.service import notify

                notify(room.owner, "direct", f"{room.guest_name[:60]} vraagt een chat aan", url="/dashboard/community/direct")
            except Exception:  # noqa: BLE001
                pass
    return Response({"chat_request": room.chat_request})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def owner_chat_request(request, token):
    """Owner: accept or decline the guest's request to chat."""
    room = DirectRoom.objects.filter(token=token, owner=request.user).first()
    if not room:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    room.chat_request = "accepted" if request.data.get("accept") else "declined"
    room.save(update_fields=["chat_request"])
    from .models import Notification

    Notification.objects.filter(user=room.owner, kind="dchat").update(seen=True)
    return Response({"chat_request": room.chat_request})


@api_view(["POST"])
@permission_classes([AllowAny])
def room_signal(request, token):
    room = _room(token)
    role = _role(request, room) if room else None
    kind, payload = request.data.get("kind"), request.data.get("payload") or {}
    if not role or kind not in KINDS or len(str(payload)) > 30000:
        return bad("Ongeldig signaal.")
    if kind == "call" and getattr(room, "owner", None):  # the member who owns the room needs the video chat right
        from apps.subscriptions import service as subs

        row = subs.item_of("video_chat")
        if role == "guest" and not (row and row.share):  # the client may only call when the right also counts for the other party
            return bad("Videobellen kan alleen de uitnodiger starten.", status.HTTP_403_FORBIDDEN)
        if not subs.can(room.owner, "video_chat"):
            return bad(subs.GATE_MESSAGE["video_chat"], status.HTTP_402_PAYMENT_REQUIRED)
        subs.charge(room.owner, "video_chat")
    if kind == "chat" and role == "owner" and room.chat_request == "asked":  # the owner started the chat himself: that answers the request
        room.chat_request = "accepted"
        room.save(update_fields=["chat_request"])
    if kind == "text":  # chat text relayed through the server while the direct line is not (yet) open
        payload = {"body": str(payload.get("body", ""))[:2000]}
    DirectSignal.objects.create(room=room, to_role="guest" if role == "owner" else "owner", kind=kind, payload=payload)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([AllowAny])
def room_signals(request, token):
    """Poll: new signals for my role. Also marks me as present and tells whether the other one is."""
    room = _room(token)
    role = _role(request, room) if room else None
    if not role:
        return bad("Uitnodiging verlopen of niet toegestaan.", status.HTTP_404_NOT_FOUND)
    field = "owner_seen" if role == "owner" else "guest_seen"
    setattr(room, field, timezone.now())
    room.save(update_fields=[field])
    DirectSignal.objects.filter(room=room, created_at__lt=timezone.now() - timedelta(minutes=5)).delete()
    after = int(request.query_params.get("after") or 0)
    sig = [{"id": s.id, "kind": s.kind, "payload": s.payload} for s in DirectSignal.objects.filter(room=room, to_role=role, id__gt=after).order_by("id")[:100]]
    return Response({"signals": sig, **_state(room)})
