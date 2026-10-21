import logging

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import has_level, has_level_for
from apps.core.modules import module_required

from . import scheduler, service
from .models import Backup, BackupJob, BackupSettings

logger = logging.getLogger(__name__)
USE = [has_level("backups", "use"), module_required("backups")]
EDIT = [has_level("backups", "edit"), module_required("backups")]
MANAGE = [has_level("backups", "manage"), module_required("backups")]
FREQ = ("daily", "weekly", "monthly")
_bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731
_superadmin = lambda request: bool(request.user.is_staff or request.user.is_superuser)  # noqa: E731


def _out(b):
    import os

    return {"id": b.id, "frequency": b.frequency, "file": b.file, "size": b.size, "created_at": b.created_at, "created_by": (b.created_by.email if b.created_by_id else ""), "note": b.note,
            "parts": b.parts, "stats": b.stats, "system_version": b.system_version, "exists": (service.backups_dir() / b.file).is_file()}


def _job(frequency):
    j, _ = BackupJob.objects.get_or_create(frequency=frequency, defaults={"keep": {"daily": 7, "weekly": 4, "monthly": 6}[frequency]})
    return j


def _job_out(j, cfg):
    limit = cfg.limit(j.frequency)
    return {"frequency": j.frequency, "enabled": j.enabled, "hour": j.hour, "weekday": j.weekday, "day": j.day, "keep": min(j.keep, limit), "limit": limit,
            "last_run_at": j.last_run_at, "last_status": j.last_status, "last_error": j.last_error}


def _overview(request):
    cfg = BackupSettings.load()
    return {"backups": [_out(b) for b in Backup.objects.all()], "jobs": [_job_out(_job(f), cfg) for f in FREQ], "folder": str(service.backups_dir()),
            "limits": {"daily": cfg.max_daily, "weekly": cfg.max_weekly, "monthly": cfg.max_monthly, "manual": cfg.max_manual, "include_secrets": cfg.include_secrets},
            "superadmin": _superadmin(request)}


@api_view(["GET"])
@permission_classes(USE)
def overview(request):
    return Response(_overview(request))


@api_view(["POST"])
@permission_classes(EDIT)
def create_now(request):
    try:
        b = service.create("manual", request.user, str(request.data.get("note") or ""))
    except Exception as e:  # noqa: BLE001
        logger.exception("manual backup failed")
        return _bad(f"De backup is mislukt: {e}")
    return Response({**_overview(request), "made": _out(b)}, status=status.HTTP_201_CREATED)


@api_view(["PUT"])
@permission_classes(EDIT)
def job(request, frequency):
    if frequency not in FREQ:
        return _bad("Onbekende backupjob.", status.HTTP_404_NOT_FOUND)
    cfg, j, d = BackupSettings.load(), _job(frequency), request.data

    def num(name, lo, hi, cur):
        try:
            return min(max(int(d.get(name, cur)), lo), hi)
        except (TypeError, ValueError):
            return cur

    was = j.enabled
    j.enabled = bool(d.get("enabled", j.enabled))
    j.hour, j.weekday, j.day = num("hour", 0, 23, j.hour), num("weekday", 0, 6, j.weekday), num("day", 1, 28, j.day)
    j.keep = num("keep", 1, max(1, cfg.limit(frequency)), j.keep)  # never more than the superadmin allows
    if j.enabled and not was and j.last_run_at is None:
        from django.utils import timezone

        j.last_run_at = timezone.now()  # the first backup is at the next planned time (use "Nu uitvoeren" for one now)
    j.save()
    service.enforce_retention(frequency)
    return Response(_overview(request))


@api_view(["POST"])
@permission_classes(EDIT)
def job_run(request, frequency):
    if frequency not in FREQ:
        return _bad("Onbekende backupjob.", status.HTTP_404_NOT_FOUND)
    try:
        scheduler.run_job(_job(frequency), request.user)
    except Exception as e:  # noqa: BLE001
        return _bad(f"De backup is mislukt: {e}")
    return Response(_overview(request))


@api_view(["PUT"])
@permission_classes(MANAGE)
def limits(request):
    """Superadmins: how many backups there may be per kind, and whether secrets (API keys) go into them."""
    if not _superadmin(request):
        return _bad("Alleen een superadmin kan de limieten instellen.", status.HTTP_403_FORBIDDEN)
    cfg, d = BackupSettings.load(), request.data
    for name, field in (("daily", "max_daily"), ("weekly", "max_weekly"), ("monthly", "max_monthly"), ("manual", "max_manual")):
        if name in d:
            try:
                setattr(cfg, field, min(max(int(d[name]), 1), 365))
            except (TypeError, ValueError):
                return _bad("Vul een geheel getal in.")
    if "include_secrets" in d:
        cfg.include_secrets = bool(d["include_secrets"])
    cfg.save()
    service.enforce_retention()
    from apps.core import license_price

    license_price.refresh()  # the limits are part of the price of the licence
    return Response(_overview(request))


@api_view(["DELETE"])
@permission_classes(MANAGE)
def backup(request, pk):
    service.remove(get_object_or_404(Backup, pk=pk))
    return Response(_overview(request))


@api_view(["GET"])
@permission_classes(EDIT)
def download(request, pk):
    b = get_object_or_404(Backup, pk=pk)
    try:
        path = service.path_of(b)
    except service.BackupError as e:
        return _bad(str(e), status.HTTP_404_NOT_FOUND)
    return FileResponse(open(path, "rb"), as_attachment=True, filename=b.file, content_type="application/zip")


@api_view(["POST"])
@permission_classes(MANAGE)
def restore(request, pk):
    b = get_object_or_404(Backup, pk=pk)
    parts = request.data.get("parts")
    try:
        results, safety = service.restore(b, parts if isinstance(parts, list) and parts else None, request.user)
    except service.BackupError as e:
        return _bad(str(e))
    logger.info("Backup %s restored by %s", b.file, request.user.email)
    return Response({"results": results, "safety": _out(safety), **_overview(request)})


@api_view(["POST"])
@permission_classes(MANAGE)
@parser_classes([MultiPartParser, FormParser])
def upload(request):
    f = request.FILES.get("file")
    if not f or not f.name.lower().endswith(".zip"):
        return _bad("Kies een backupbestand (.zip).")
    try:
        b = service.import_file(f.read(), request.user)
    except service.BackupError as e:
        return _bad(str(e))
    return Response({**_overview(request), "made": _out(b)}, status=status.HTTP_201_CREATED)
