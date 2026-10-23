# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""File browser for the S3 link (Admin -> API keys -> S3 -> Bladeren): look around, upload, make folders, delete.
Works inside the 'map in de bucket' of the link; files that the media library uses can only be removed from the library."""
import logging
import mimetypes
import posixpath

from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import has_level
from apps.core.modules import module_required
from apps.medialib import s3
from apps.medialib.models import IMAGE_EXT, MediaItem

from .models import Integration

logger = logging.getLogger(__name__)
PERM = [has_level("integrations", "manage"), module_required("integrations")]
MAX_UPLOAD = 300 * 1024 * 1024
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


class Ctx:
    def __init__(self, pk, path):
        obj = Integration.objects.filter(pk=pk, provider="s3").first()
        if not obj:
            raise LookupError("Deze koppeling bestaat niet.")
        if not obj.enabled:
            raise PermissionError("De S3-koppeling staat uit.")
        self.cfg = obj.config
        self.client = s3.client(self.cfg)
        self.bucket = self.cfg["bucket"]
        self.base = (self.cfg.get("prefix") or "").strip("/")
        parts = [p for p in str(path or "").split("/") if p]
        if any(p in (".", "..") for p in parts):
            raise ValueError("Ongeldig pad.")
        self.path = "/".join(parts)

    def key(self, rel=""):
        return "/".join(p for p in (self.base, rel.strip("/")) if p)

    def rel(self, key):
        return key[len(self.base) + 1:] if self.base else key


def _ctx(pk, path):
    try:
        return Ctx(pk, path), None
    except LookupError as e:
        return None, bad(str(e), 404)
    except (PermissionError, ValueError) as e:
        return None, bad(str(e))
    except Exception as e:  # noqa: BLE001
        return None, bad(f"Geen verbinding met S3: {e}")


def _used(keys):
    return set(MediaItem.objects.filter(key__in=keys, storage="s3").values_list("key", flat=True))


@api_view(["GET"])
@permission_classes(PERM)
def listing(request, pk):
    c, err = _ctx(pk, request.query_params.get("path"))
    if err:
        return err
    prefix = c.key(c.path) + "/" if (c.base or c.path) and c.key(c.path) else ""
    kw = {"Bucket": c.bucket, "Prefix": prefix, "Delimiter": "/", "MaxKeys": 200}
    if request.query_params.get("next"):
        kw["ContinuationToken"] = request.query_params["next"]
    try:
        r = c.client.list_objects_v2(**kw)
    except Exception as e:  # noqa: BLE001
        return bad(f"S3-fout: {e}")
    folders = [{"name": p["Prefix"][len(prefix):].strip("/"), "path": c.rel(p["Prefix"]).strip("/")} for p in r.get("CommonPrefixes", [])]
    files = []
    objs = [o for o in r.get("Contents", []) if o["Key"] != prefix and not o["Key"].endswith("/")]
    in_library = _used([c.rel(o["Key"]) for o in objs])
    for o in objs:
        rel = c.rel(o["Key"])
        ext = posixpath.splitext(rel)[1].lower().lstrip(".")
        item = {"name": posixpath.basename(rel), "path": rel, "size": o["Size"], "modified": o["LastModified"], "image": ext in IMAGE_EXT, "in_library": rel in in_library}
        if item["image"] and o["Size"] < 8 * 1024 * 1024:
            item["thumb"] = c.client.generate_presigned_url("get_object", Params={"Bucket": c.bucket, "Key": o["Key"]}, ExpiresIn=600)
        files.append(item)
    return Response({"path": c.path, "base": c.base, "folders": folders, "files": files, "next": r.get("NextContinuationToken")})


@api_view(["GET"])
@permission_classes(PERM)
def file_url(request, pk):
    c, err = _ctx(pk, request.query_params.get("path"))
    if err:
        return err
    if not c.path:
        return bad("Geen bestand opgegeven.")
    name = posixpath.basename(c.path)
    params = {"Bucket": c.bucket, "Key": c.key(c.path)}
    if request.query_params.get("download"):
        params["ResponseContentDisposition"] = f'attachment; filename="{name}"'
    return Response({"url": c.client.generate_presigned_url("get_object", Params=params, ExpiresIn=300)})


@api_view(["POST"])
@permission_classes(PERM)
@parser_classes([MultiPartParser, FormParser])
def upload(request, pk):
    c, err = _ctx(pk, request.data.get("path"))
    if err:
        return err
    done = []
    for f in request.FILES.getlist("files"):
        if f.size > MAX_UPLOAD:
            return bad(f"{f.name} is te groot (maximaal 300 MB).")
        name = posixpath.basename(f.name).replace("/", "_")
        mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
        try:
            c.client.upload_fileobj(f, c.bucket, c.key("/".join(p for p in (c.path, name) if p)), ExtraArgs={"ContentType": mime})
        except Exception as e:  # noqa: BLE001
            return bad(f"Uploaden mislukt ({name}): {e}")
        done.append(name)
    logger.info("S3 browser: %s uploaded %s file(s) to %s", request.user.email, len(done), c.path or "/")
    return Response({"uploaded": done})


@api_view(["POST"])
@permission_classes(PERM)
def mkdir(request, pk):
    c, err = _ctx(pk, request.data.get("path"))
    if err:
        return err
    name = str(request.data.get("name") or "").strip().strip("/")
    if not name or "/" in name or name in (".", ".."):
        return bad("Geef een geldige mapnaam op (zonder /).")
    c.client.put_object(Bucket=c.bucket, Key=c.key("/".join(p for p in (c.path, name) if p)) + "/", Body=b"")
    return Response({"created": name})


@api_view(["POST"])
@permission_classes(PERM)
def delete(request, pk):
    """Delete files and (empty or full) folders. Files in the media library are refused: remove them there."""
    c, err = _ctx(pk, "")
    if err:
        return err
    paths = [str(p).strip("/") for p in (request.data.get("paths") or []) if str(p).strip("/")]
    if not paths or any(".." in p.split("/") for p in paths):
        return bad("Niets om te verwijderen.")
    keys = []
    for p in paths:
        full = c.key(p)
        if request.data.get("folders") and p in request.data["folders"]:
            for page in c.client.get_paginator("list_objects_v2").paginate(Bucket=c.bucket, Prefix=full + "/"):
                keys += [o["Key"] for o in page.get("Contents", [])]
        else:
            keys.append(full)
    used = _used([c.rel(k) for k in keys])
    if used:
        return bad(f"{len(used)} bestand(en) worden door de mediabibliotheek gebruikt en blijven staan (verwijder ze via Media): {', '.join(sorted(used)[:3])}")
    for i in range(0, len(keys), 1000):
        c.client.delete_objects(Bucket=c.bucket, Delete={"Objects": [{"Key": k} for k in keys[i:i + 1000]]})
    logger.info("S3 browser: %s deleted %s object(s)", request.user.email, len(keys))
    return Response({"deleted": len(keys)})
