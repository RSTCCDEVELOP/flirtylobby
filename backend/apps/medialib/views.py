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

from . import areas, s3, service
import re

from django.db.models import Q

from .models import IMAGE_EXT, USER_PREFIXES, VIDEO_EXT, MediaItem, is_user_content, kind_of

logger = logging.getLogger(__name__)
MAX_IMAGE, MAX_VIDEO = 20 * 1024 * 1024, 300 * 1024 * 1024
mod_media = module_required("media")
use_media = has_level("media", "use")
edit_media = has_level("media", "edit")
manage_media = has_level("media", "manage")


TAG_RE = re.compile(r"[\w][\w \-]{0,29}", re.UNICODE)


def _item(i, usage):
    return {"id": i.id, "name": i.name, "key": i.key, "kind": i.kind, "mime": i.mime, "size": i.size, "storage": i.storage, "tags": i.tags or [],
            "url": default_storage.url(i.key), "created_at": i.created_at, "used_in": usage.get(i.key, []), "user_content": is_user_content(i.key)}


def clean_tags(raw):
    """'zomer, Strand ,zomer' -> ['zomer', 'strand'] (lower case, max 30 characters, max 15 per file)."""
    parts = raw.split(",") if isinstance(raw, str) else raw if isinstance(raw, list) else []
    out = []
    for t in parts:
        t = " ".join(str(t).strip().lower().split())
        if t and TAG_RE.fullmatch(t) and t not in out:
            out.append(t)
    return out[:15]


def _scope(request, user_data=None):
    """Library items this user may see: member files only for a superuser who switched 'gebruikersgegevens tonen' on."""
    show = request.user.is_staff and (request.query_params.get("user_data") == "1" if user_data is None else user_data)
    qs = MediaItem.objects.all()
    if not show:
        for p in areas.user_prefixes():
            qs = qs.exclude(key__startswith=p)
    return qs


def _ops(request):
    """Items that may be changed: everything for a superuser, the site library for everybody else."""
    return _scope(request, user_data=bool(request.user.is_staff))


@api_view(["GET"])
@permission_classes([use_media, mod_media])
def library(request):
    base = _scope(request)
    qs = base
    if request.query_params.get("kind") in ("image", "video"):
        qs = qs.filter(kind=request.query_params["kind"])
    if request.query_params.get("storage") in ("local", "s3"):
        qs = qs.filter(storage=request.query_params["storage"])
    q, tag = request.query_params.get("q", "").strip().lower(), request.query_params.get("tag", "").strip().lower()
    rows = [i for i in qs if (not tag or tag in (i.tags or [])) and (not q or q in i.name.lower() or any(q in t for t in (i.tags or [])))]  # tags live in a JSON list: filter here (works on every database)
    usage = service.usage_map()
    counts = {}
    for tags in base.values_list("tags", flat=True):
        for t in tags or []:
            counts[t] = counts.get(t, 0) + 1
    return Response({"items": [_item(i, usage) for i in rows[:1000]], "s3_available": s3.available(), "total": base.count(),
                     "tags": sorted(({"tag": t, "n": n} for t, n in counts.items()), key=lambda x: (-x["n"], x["tag"])), "can_user_data": request.user.is_staff})


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
        name = default_storage.save(areas.site_path("library", f"{today:%Y/%m}/{uuid.uuid4().hex[:8]}-{get_valid_filename(f.name)}"), f)
        item = MediaItem.objects.get(key=name)
        item.name, item.uploaded_by = f.name[:255], request.user
        item.tags = clean_tags(request.data.get("tags", ""))
        item.save(update_fields=["name", "uploaded_by", "tags"])
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
    for item in _ops(request).filter(id__in=request.data.get("ids", [])):
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
    for item in _ops(request).filter(id__in=request.data.get("ids", [])):
        if usage.get(item.key) and not force:
            errors.append(f"{item.name}: in gebruik ({', '.join(usage[item.key])}).")
            continue
        default_storage.delete(item.key)  # also removes it from S3 and the registry
        ok += 1
    return Response({"deleted": ok, "errors": errors})


@api_view(["PATCH"])
@permission_classes([edit_media, mod_media])
def rename(request, pk):
    item = _ops(request).filter(pk=pk).first()
    if not item:
        return Response({"detail": "Niet gevonden."}, status=status.HTTP_404_NOT_FOUND)
    if "tags" in request.data:
        item.tags = clean_tags(request.data["tags"])
        item.save(update_fields=["tags"])
    if "name" in request.data:
        name = str(request.data.get("name", "")).strip()[:255]
        if not name:
            return Response({"detail": "Ongeldige naam."}, status=status.HTTP_400_BAD_REQUEST)
        item.name = name
        item.save(update_fields=["name"])
    return Response(_item(item, service.usage_map()))


@api_view(["POST"])
@permission_classes([edit_media, mod_media])
def tag_many(request):
    """Add and/or remove tags on the selected files: {ids: [...], add: "a, b", remove: ["c"]}."""
    add, rem = clean_tags(request.data.get("add", "")), set(clean_tags(request.data.get("remove", "")))
    n = 0
    for item in _ops(request).filter(id__in=request.data.get("ids", [])):
        tags = [t for t in (item.tags or []) if t not in rem]
        for t in add:
            if t not in tags:
                tags.append(t)
        if tags[:15] != (item.tags or []):
            item.tags = tags[:15]
            item.save(update_fields=["tags"])
            n += 1
    return Response({"changed": n})


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
