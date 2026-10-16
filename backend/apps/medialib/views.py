import logging
import uuid
from datetime import date

from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import has_level
from apps.core.modules import module_required

from . import s3, service
from .models import IMAGE_EXT, VIDEO_EXT, MediaItem, kind_of

logger = logging.getLogger(__name__)
MAX_IMAGE, MAX_VIDEO = 20 * 1024 * 1024, 300 * 1024 * 1024
mod_media = module_required("media")
use_media = has_level("media", "use")
edit_media = has_level("media", "edit")
manage_media = has_level("media", "manage")


def _item(i, usage):
    return {"id": i.id, "name": i.name, "key": i.key, "kind": i.kind, "mime": i.mime, "size": i.size, "storage": i.storage,
            "url": default_storage.url(i.key), "created_at": i.created_at, "used_in": usage.get(i.key, [])}


@api_view(["GET"])
@permission_classes([use_media, mod_media])
def library(request):
    qs = MediaItem.objects.all()
    if request.query_params.get("kind") in ("image", "video"):
        qs = qs.filter(kind=request.query_params["kind"])
    if request.query_params.get("storage") in ("local", "s3"):
        qs = qs.filter(storage=request.query_params["storage"])
    if q := request.query_params.get("q"):
        qs = qs.filter(name__icontains=q)
    usage = service.usage_map()
    return Response({"items": [_item(i, usage) for i in qs[:1000]], "s3_available": s3.available(),
                     "total": MediaItem.objects.count()})


@api_view(["POST"])
@permission_classes([edit_media, mod_media])
@parser_classes([MultiPartParser, FormParser])
def upload(request):
    results, errors = [], []
    for f in request.FILES.getlist("files") or request.FILES.getlist("file"):
        ext = f.name.rsplit(".", 1)[-1].lower() if "." in f.name else ""
        kind = "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else None
        if not kind:
            errors.append(f"{f.name}: bestandstype niet toegestaan.")
            continue
        if f.size > (MAX_IMAGE if kind == "image" else MAX_VIDEO):
            errors.append(f"{f.name}: te groot (max {MAX_IMAGE // 2**20 if kind == 'image' else MAX_VIDEO // 2**20} MB).")
            continue
        if kind == "image" and ext != "ico":
            try:
                from PIL import Image

                Image.open(f).verify()
                f.seek(0)
            except Exception:
                errors.append(f"{f.name}: geen geldige afbeelding.")
                continue
        today = date.today()
        name = default_storage.save(f"library/{today:%Y/%m}/{uuid.uuid4().hex[:8]}-{get_valid_filename(f.name)}", f)
        item = MediaItem.objects.get(key=name)
        item.name, item.uploaded_by = f.name[:255], request.user
        item.save(update_fields=["name", "uploaded_by"])
        results.append(_item(item, {}))
    logger.info("%s file(s) uploaded by %s", len(results), request.user.email)
    return Response({"items": results, "errors": errors}, status=status.HTTP_201_CREATED if results else status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([edit_media, mod_media])
def move(request):
    to = request.data.get("to")
    if to not in ("local", "s3"):
        return Response({"detail": "Ongeldige bestemming."}, status=status.HTTP_400_BAD_REQUEST)
    if to == "s3" and not s3.available():
        return Response({"detail": "S3 is niet gekoppeld of staat uit (Admin → API keys)."}, status=status.HTTP_400_BAD_REQUEST)
    ok, errors = 0, []
    for item in MediaItem.objects.filter(id__in=request.data.get("ids", [])):
        try:
            service.move(item, to)
            ok += 1
        except Exception as e:
            errors.append(f"{item.name}: {e}")
    return Response({"moved": ok, "errors": errors})


@api_view(["POST"])
@permission_classes([manage_media, mod_media])
def delete_many(request):
    usage, ok, errors = service.usage_map(), 0, []
    force = bool(request.data.get("force"))
    for item in MediaItem.objects.filter(id__in=request.data.get("ids", [])):
        if usage.get(item.key) and not force:
            errors.append(f"{item.name}: in gebruik ({', '.join(usage[item.key])}).")
            continue
        default_storage.delete(item.key)  # also removes it from S3 and the registry
        ok += 1
    return Response({"deleted": ok, "errors": errors})


@api_view(["PATCH"])
@permission_classes([edit_media, mod_media])
def rename(request, pk):
    item = MediaItem.objects.filter(pk=pk).first()
    name = str(request.data.get("name", "")).strip()[:255]
    if not item or not name:
        return Response({"detail": "Ongeldige naam."}, status=status.HTTP_400_BAD_REQUEST)
    item.name = name
    item.save(update_fields=["name"])
    return Response(_item(item, service.usage_map()))


@api_view(["POST"])
@permission_classes([edit_media, mod_media])
def scan(request):
    return Response({"added": service.scan()})


@api_view(["POST"])
@permission_classes([has_level("edit_mode", "edit"), use_media, mod_media, module_required("edit_mode")])
def replace(request):
    """Edit mode: point a website image at a library item. target = block:<key> | asset:<slot> | photo:<id>."""
    import re

    from apps.branding.models import SLOTS, HomePhoto, SiteAsset
    from apps.core.models import ContentBlock

    target, media_id = str(request.data.get("target", "")), request.data.get("media_id")
    item = None
    if media_id is not None:
        item = MediaItem.objects.filter(pk=media_id, kind="image").first()
        if not item:
            return Response({"detail": "Afbeelding niet gevonden."}, status=status.HTTP_400_BAD_REQUEST)
    kind, _, ref = target.partition(":")

    if kind == "block" and re.fullmatch(r"[a-z0-9._-]{1,100}", ref):
        if item:
            ContentBlock.objects.update_or_create(key=ref, lang="*", defaults={"text": f"media:{item.id}"})
        else:
            ContentBlock.objects.filter(key=ref, lang="*").delete()
    elif kind == "asset" and ref in SLOTS:
        if item:
            SiteAsset.objects.update_or_create(slot=ref, defaults={"image": item.key})
        else:
            SiteAsset.objects.filter(slot=ref).delete()
    elif kind == "photo" and item and ref.isdigit():
        n = HomePhoto.objects.filter(pk=int(ref)).update(image=item.key)
        if not n:
            return Response({"detail": "Foto niet gevonden."}, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response({"detail": "Ongeldig doel."}, status=status.HTTP_400_BAD_REQUEST)
    logger.info("Image %s changed by %s", target, request.user.email)
    return Response({"ok": True})
