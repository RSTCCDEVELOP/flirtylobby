"""Folder structure / encryption API (module "storage") and the download view for encrypted files."""
import logging
import mimetypes
import os

from django.core import signing
from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import has_level
from apps.core.modules import module_required

from . import areas, filecrypt, s3, service
from .models import FileKey, MediaItem

logger = logging.getLogger(__name__)
PERM = [has_level("storage", "manage"), module_required("storage")]


def _state():
    cfg = areas.config()
    counts = {a: {"files": 0, "encrypted": 0, "s3": 0} for a in cfg}
    for it in MediaItem.objects.only("key", "encrypted", "storage"):
        c = counts[areas.area_of(it.key, cfg)]
        c["files"] += 1
        c["encrypted"] += int(it.encrypted)
        c["s3"] += int(it.storage == "s3")
    return {"areas": [{"key": k, "label": areas.LABELS[k], **v, **counts[k]} for k, v in cfg.items()], "s3_available": s3.available(),
            "master": filecrypt.master_source(), "keys": FileKey.objects.count(),
            "example": {"users": f"{cfg['users']['folder']}/42/photos/…", "site": areas.site_path("library", "2026/05/…")}}


@api_view(["GET", "PUT"])
@permission_classes(PERM)
def settings_view(request):
    from .models import StorageSettings

    if request.method == "PUT":
        try:
            cfg = areas.clean(request.data.get("areas"), s3.available())
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        StorageSettings.objects.update_or_create(pk=1, defaults={"data": {"areas": cfg}})
    return Response(_state())


def conform(item, cfg):
    """Bring one existing file in line with its area: (de)crypt and move between local disk and S3."""
    area = areas.area_of(item.key, cfg)
    want_enc, want_store = cfg[area]["encrypt"], cfg[area]["storage"]
    if want_store == "s3" and not s3.available():
        want_store = item.storage
    if item.encrypted == want_enc and item.storage == want_store:
        return False
    was = item.storage
    if was == "s3":
        service.move(item, "local")
    if item.encrypted and not want_enc:
        filecrypt.decrypt_file(item.local_path, item.enc_scope)
        item.encrypted, item.enc_scope = False, ""
    elif want_enc and not item.encrypted:
        scope = areas.scope_of(item.key, item.owner_id, cfg)
        filecrypt.encrypt_file(item.local_path, scope)
        item.encrypted, item.enc_scope = True, scope
    item.size = os.path.getsize(item.local_path)
    item.save()
    if want_store == "s3":
        service.move(item, "s3")
    return True


@api_view(["POST"])
@permission_classes(PERM)
def apply_view(request):
    """Apply the current settings to all existing files (encrypt, decrypt, move)."""
    cfg, done, failed = areas.config(), 0, []
    for item in MediaItem.objects.all():
        if not item.owner_id:
            item.owner_id = areas.owner_of(item.key, cfg)
        try:
            done += int(conform(item, cfg))
        except Exception as e:  # noqa: BLE001  one broken file must not stop the rest
            logger.warning("Storage apply failed for %s: %s", item.key, e)
            failed.append({"key": item.key, "error": str(e)[:120]})
    return Response({"changed": done, "failed": failed[:20], **_state()})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def serve(request, token):
    """Decrypting download. The signed link is the permission (short-lived), so <img> and <video> tags work."""
    try:
        key = signing.loads(token, salt="file", max_age=6 * 3600)
    except signing.BadSignature:
        raise Http404
    item = MediaItem.objects.filter(key=key, encrypted=True).first()
    if not item:
        raise Http404
    mime = item.mime or mimetypes.guess_type(item.key)[0] or "application/octet-stream"
    try:
        if item.storage == "s3":
            from django.core.files.storage import default_storage

            resp = HttpResponse(default_storage.open(item.key).read(), content_type=mime)
        else:
            fh = open(item.local_path, "rb")
            fh.read(0)

            def gen():
                try:
                    yield from filecrypt.decrypt_iter(fh, item.enc_scope)
                finally:
                    fh.close()
            resp = StreamingHttpResponse(gen(), content_type=mime)
    except (OSError, ValueError):
        raise Http404
    resp["Cache-Control"] = "private, max-age=3600"
    resp["X-Content-Type-Options"] = "nosniff"
    return resp


# ── the master key for file encryption: Beveiliging → Bestanden (only when S3 is linked and on) ─────────────────────────────
def _s3_integration():
    from apps.integrations.models import Integration

    return Integration.objects.filter(provider="s3").order_by("-enabled", "id").first()


def _key_state():
    obj = _s3_integration()
    has = bool(obj and (obj.config.get("encryption_key") or "").strip())
    return {"available": s3.available(), "source": filecrypt.master_source(), "has_key": has, "env": bool(os.environ.get("FILE_ENCRYPTION_KEY")), "keys": FileKey.objects.count(),
            "files": MediaItem.objects.filter(encrypted=True).count()}


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def key_view(request):
    """GET: the state of the master key. POST {action: "generate"|"set"|"remove", value}: change it (superadmins). A new key is shown once, at once after it was made.
    Every file key is wrapped again with the new master first, so encrypted files stay readable."""
    import base64

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if not s3.available():
        return Response({"available": False})  # the key is only shown and changed when the S3 API is on
    if request.method == "GET":
        return Response(_key_state())
    obj = _s3_integration()
    action = str(request.data.get("action") or "")
    if action == "generate":
        value = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("=")
    elif action == "set":
        value = str(request.data.get("value") or "").strip()
        if len(value) < 32:
            return Response({"detail": "Een sleutel heeft minstens 32 tekens."}, status=status.HTTP_400_BAD_REQUEST)
    elif action == "remove":
        value = ""
    else:
        return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        filecrypt.rewrap_all(value)
    except Exception as e:  # noqa: BLE001 - nothing was changed yet
        return Response({"detail": f"De bestandssleutels konden niet opnieuw worden ingepakt: {str(e)[:150]}"}, status=status.HTTP_400_BAD_REQUEST)
    cfg = dict(obj.config)
    if value:
        cfg["encryption_key"] = value
    else:
        cfg.pop("encryption_key", None)
    obj.config = cfg
    obj.save()
    return Response({**_key_state(), **({"key": value} if action == "generate" else {})})
