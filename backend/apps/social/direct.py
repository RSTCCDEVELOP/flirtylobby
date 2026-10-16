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
KINDS = ("sdp", "ice", "call", "accept", "decline", "end")
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


def _ice():
    c = service.get()["chat"]
    ice = [{"urls": c["stun"]}] if c["stun"] else []
    if c["turn_url"]:
        ice.append({"urls": c["turn_url"], "username": c["turn_user"], "credential": c["turn_credential"]})
    return ice


def _enabled():
    c = service.get()["chat"]
    return service.module_on("chat") and c["method"] == "webrtc"


def _alive(room):
    return room and not room.closed and room.expires_at > timezone.now()


def _recent(t):
    return bool(t and timezone.now() - t < ONLINE)


def _state(room):
    return {"owner_online": _recent(room.owner_seen), "guest_online": _recent(room.guest_seen), "guest_name": room.guest_name,
            "owner_name": service.display_name(room.owner), "expires_at": room.expires_at}


def _role(request, room):
    """owner (logged in as the owner) | guest (knows the secret key given at join) | None."""
    if request.user.is_authenticated and request.user.id == room.owner_id:
        return "owner"
    key = request.data.get("key") if request.method == "POST" else request.query_params.get("key")
    if key and room.guest_key and secrets.compare_digest(str(key), room.guest_key):
        return "guest"
    return None


def _room(token):
    room = DirectRoom.objects.filter(token=token).select_related("owner").first()
    return room if _alive(room) and room.owner.is_active else None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, module_required("chat")])
def rooms(request):
    """List my open invitations / create a new one."""
    if request.method == "POST":
        if not _enabled():
            return bad("Directe verbinding staat uit.", status.HTTP_403_FORBIDDEN)
        DirectRoom.objects.filter(owner=request.user, expires_at__lt=timezone.now()).delete()
        if DirectRoom.objects.filter(owner=request.user, closed=False).count() >= MAX_ACTIVE:
            return bad(f"Je hebt al {MAX_ACTIVE} open uitnodigingen. Sluit er eerst een.")
        hours = service.get()["chat"]["direct_hours"]
        room = DirectRoom.objects.create(token=secrets.token_urlsafe(24), owner=request.user, expires_at=timezone.now() + timedelta(hours=hours))
    out = [{"token": r.token, **_state(r)} for r in DirectRoom.objects.filter(owner=request.user, closed=False, expires_at__gt=timezone.now()).order_by("-id")]
    return Response(out, status=status.HTTP_201_CREATED if request.method == "POST" else 200)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def room_close(request, token):
    DirectRoom.objects.filter(token=token, owner=request.user).update(closed=True)
    return Response(status=status.HTTP_204_NO_CONTENT)


def _reset_guest(room):
    """End the current connection: the guest is out; the invitation stays open for a new guest."""
    room.guest_name, room.guest_key, room.guest_seen = "", "", None
    room.save(update_fields=["guest_name", "guest_key", "guest_seen"])
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


@api_view(["GET"])
@permission_classes([AllowAny])
def room_info(request, token):
    """Public: what the invitation page needs (who invites, whether it is still valid)."""
    room = _room(token)
    if not room or not _enabled():
        return bad("Deze uitnodiging is verlopen of ingetrokken.", status.HTTP_404_NOT_FOUND)
    role = _role(request, room)
    return Response({**_state(room), "role": role, "taken": bool(room.guest_key) and role != "guest", "ice_servers": _ice(),
                     "chat": {k: service.get()["chat"][k] for k in ("photos", "videos", "video_chat", "max_image_mb", "max_video_mb")}})


@api_view(["POST"])
@permission_classes([AllowAny])
def room_join(request, token):
    room = _room(token)
    if not room or not _enabled():
        return bad("Deze uitnodiging is verlopen of ingetrokken.", status.HTTP_404_NOT_FOUND)
    if request.user.is_authenticated and request.user.id == room.owner_id:
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
    room.guest_name, room.guest_key, room.guest_seen = name, secrets.token_urlsafe(24), timezone.now()
    room.save(update_fields=["guest_name", "guest_key", "guest_seen"])
    return Response({"key": room.guest_key, "role": "guest"})


@api_view(["POST"])
@permission_classes([AllowAny])
def room_signal(request, token):
    room = _room(token)
    role = _role(request, room) if room else None
    kind, payload = request.data.get("kind"), request.data.get("payload") or {}
    if not role or kind not in KINDS or len(str(payload)) > 30000:
        return bad("Ongeldig signaal.")
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
