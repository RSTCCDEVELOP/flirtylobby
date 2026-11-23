# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Notes on users and on companies (Admin -> Users / Bedrijven -> Notities): text with pictures, videos and documents, linked to the user or the company.
A note is internal by default; with `visible` the user himself (or, for a company, the people linked to it) may read it too (Mijn profiel -> Notities).
The files are kept in the private storage and given out only here: an administrator with edit rights on users or companies always, the user only for a visible note that is his."""
import logging
import re
import uuid

from django.core.files.storage import default_storage
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.http import FileResponse
from django.utils.text import get_valid_filename
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.access import level
from apps.accounts.models import User
from apps.core.richtext import clean_small
from apps.core.system import limit_mb

from .models import Entity, Note, NoteFile

logger = logging.getLogger(__name__)
MODULE = {"user": "users", "entity": "entities"}
IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"}  # (no svg: it can carry scripts)
VIDEO_EXT = {"mp4", "webm", "mov", "m4v", "ogv"}
DOC_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "txt", "csv", "rtf", "md"}
DOC_MAX_MB = 25
MAX_FILES = 30
MIME = {"pdf": "application/pdf", "txt": "text/plain; charset=utf-8", "csv": "text/csv; charset=utf-8", "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime", "m4v": "video/mp4", "ogv": "video/ogg",
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp", "avif": "image/avif", "bmp": "image/bmp"}


def can_manage(user, kind):
    return bool(user.is_authenticated and kind in MODULE and (user.is_staff or level(user, MODULE[kind]) >= 2))


def _is_mine(user, note):
    """Is this note (when it is visible) for this person: a note on himself, or on a company he is linked to."""
    if note.kind == "user":
        return note.target_id == user.pk
    return Entity.objects.filter(pk=note.target_id, users=user).exists()


def _target_ok(kind, tid):
    return (User.objects.filter(pk=tid).exists() if kind == "user" else Entity.objects.filter(pk=tid).exists()) if kind in MODULE else False


def _json(n):
    return {"id": n.pk, "kind": n.kind, "target_id": n.target_id, "title": n.title, "body": n.body, "visible": n.visible, "by": (n.created_by.email if n.created_by else ""),
            "created_at": n.created_at.isoformat(), "updated_at": n.updated_at.isoformat(),
            "files": [{"id": f.pk, "name": f.name, "kind": f.kind, "size": f.size} for f in n.files.all()]}


def _deny():
    return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def notes(request):
    """GET ?kind=user|entity&id=<id>: the notes of that user or company (all, also the internal ones). POST {kind, id, title, body, visible}: a new note."""
    d = request.query_params if request.method == "GET" else request.data
    kind, tid = str(d.get("kind") or ""), d.get("id")
    try:
        tid = int(tid)
    except (TypeError, ValueError):
        return Response({"detail": "Geef een gebruiker of bedrijf."}, status=status.HTTP_400_BAD_REQUEST)
    if not can_manage(request.user, kind):
        return _deny()
    if not _target_ok(kind, tid):
        return Response({"detail": "Niet gevonden."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "POST":
        n = Note.objects.create(kind=kind, target_id=tid, title=str(d.get("title") or "")[:200], body=clean_small(d.get("body") or "", 20000), visible=bool(d.get("visible")), created_by=request.user)
        return Response(_json(n), status=status.HTTP_201_CREATED)
    return Response({"notes": [_json(n) for n in Note.objects.filter(kind=kind, target_id=tid).select_related("created_by").prefetch_related("files")]})


def _note_for_admin(request, pk):
    n = Note.objects.filter(pk=pk).first()
    if not n:
        return None, Response({"detail": "Niet gevonden."}, status=status.HTTP_404_NOT_FOUND)
    if not can_manage(request.user, n.kind):
        return None, _deny()
    return n, None


def _remove_files(note):
    for f in note.files.all():
        try:
            default_storage.delete(f.key)
        except Exception:  # noqa: BLE001
            logger.warning("note file %s could not be removed", f.key)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def note_detail(request, pk):
    n, bad = _note_for_admin(request, pk)
    if bad:
        return bad
    if request.method == "DELETE":
        _remove_files(n)
        n.delete()
        return Response({"ok": True})
    d = request.data
    if "title" in d:
        n.title = str(d.get("title") or "")[:200]
    if "body" in d:
        n.body = clean_small(d.get("body") or "", 20000)
    if "visible" in d:
        n.visible = bool(d.get("visible"))
    n.save()
    return Response(_json(n))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def note_files(request, pk):
    """Add files to a note (field `files`): pictures, videos and documents; the size limits of the system apply (documents 25 MB)."""
    n, bad = _note_for_admin(request, pk)
    if bad:
        return bad
    done, errors = [], []
    for f in request.FILES.getlist("files") or request.FILES.getlist("file"):
        if n.files.count() >= MAX_FILES:
            errors.append(f"{f.name}: er kunnen niet meer dan {MAX_FILES} bestanden bij een notitie.")
            continue
        ext = f.name.rsplit(".", 1)[-1].lower() if "." in f.name else ""
        kind = "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else "document" if ext in DOC_EXT else None
        if not kind:
            errors.append(f"{f.name}: bestandstype niet toegestaan.")
            continue
        cap = {"image": limit_mb("max_image_mb"), "video": limit_mb("max_video_mb"), "document": DOC_MAX_MB}[kind] * 2**20
        if f.size > cap:
            errors.append(f"{f.name}: te groot (max {cap // 2**20} MB).")
            continue
        if kind == "image":
            try:
                from PIL import Image

                Image.open(f).verify()
                f.seek(0)
            except Exception:  # noqa: BLE001
                errors.append(f"{f.name}: geen geldige afbeelding.")
                continue
        key = default_storage.save(f"notes/{n.kind}/{n.target_id}/{uuid.uuid4().hex[:10]}-{get_valid_filename(f.name)}", f)
        nf = NoteFile.objects.create(note=n, name=f.name[:255], key=key, kind=kind, mime=MIME.get(ext, "application/octet-stream"), size=f.size)
        done.append({"id": nf.pk, "name": nf.name, "kind": nf.kind, "size": nf.size})
    return Response({"files": done, "errors": errors, "note": _json(n)}, status=status.HTTP_201_CREATED if done else status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def note_file(request, pk):
    """GET: the file (inline for a picture or a video, a download for a document). DELETE: remove it from the note (administrators)."""
    f = NoteFile.objects.filter(pk=pk).select_related("note").first()
    if not f:
        return Response({"detail": "Niet gevonden."}, status=status.HTTP_404_NOT_FOUND)
    n = f.note
    admin = can_manage(request.user, n.kind)
    if request.method == "DELETE":
        if not admin:
            return _deny()
        try:
            default_storage.delete(f.key)
        except Exception:  # noqa: BLE001
            pass
        f.delete()
        return Response({"ok": True})
    if not (admin or (n.visible and _is_mine(request.user, n))):
        return Response({"detail": "Niet gevonden."}, status=status.HTTP_404_NOT_FOUND)  # (a hidden note is not revealed)
    try:
        fh = default_storage.open(f.key, "rb")
    except Exception:  # noqa: BLE001
        return Response({"detail": "Het bestand is niet meer beschikbaar."}, status=status.HTTP_404_NOT_FOUND)
    r = FileResponse(fh, content_type=f.mime or "application/octet-stream")
    safe = re.sub(r'[^\w.\- ]', "_", f.name)[:150]
    r["Content-Disposition"] = f'{"inline" if f.kind in ("image", "video") else "attachment"}; filename="{safe}"'
    r["X-Content-Type-Options"] = "nosniff"
    r["Cache-Control"] = "private, no-store"
    return r


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mine(request):
    """The notes that are for me (Mijn profiel -> Notities): the visible notes on my own account and on the companies I am linked to."""
    from django.db.models import Q

    ents = list(Entity.objects.filter(users=request.user).values_list("pk", flat=True))
    qs = Note.objects.filter(visible=True).filter(Q(kind="user", target_id=request.user.pk) | Q(kind="entity", target_id__in=ents)).select_related("created_by").prefetch_related("files")
    names = {e.pk: e.name for e in Entity.objects.filter(pk__in=ents)}
    out = []
    for n in qs:
        j = _json(n)
        j.pop("by", None)
        j["about"] = names.get(n.target_id, "") if n.kind == "entity" else ""
        out.append(j)
    return Response({"notes": out})


@receiver(post_delete, sender=User)
def _user_gone(sender, instance, **kwargs):
    _purge("user", instance.pk)


@receiver(post_delete, sender=Entity)
def _entity_gone(sender, instance, **kwargs):
    _purge("entity", instance.pk)


def _purge(kind, tid):
    """The notes (and their files) of a user or a company that is removed go with it."""
    for n in Note.objects.filter(kind=kind, target_id=tid):
        _remove_files(n)
        n.delete()
