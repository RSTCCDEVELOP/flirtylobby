# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API for the settings backup (superusers only)."""
import logging

from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from . import settings_backup as backup

logger = logging.getLogger(__name__)


def _bundle(request):
    b = request.data.get("bundle")
    try:
        backup.check(b)
    except ValueError as e:
        return None, Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return b, None


@api_view(["GET"])
@permission_classes([IsAdminUser])
def sections(request):
    return Response({"sections": backup.listing()})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def export(request):
    keys = request.data.get("sections")
    secrets = bool(request.data.get("include_secrets"))
    bundle = backup.export(keys if isinstance(keys, list) else None, secrets, request.data.get("include_files", True) is not False,
                           {k: request.data[k] for k in ("plugins", "themes") if isinstance(request.data.get(k), list)} or None)
    logger.info("Settings exported by %s (%s parts, secrets=%s)", request.user.email, len(bundle["sections"]), secrets)
    return Response(bundle)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def inspect(request):
    b, err = _bundle(request)
    return err or Response(backup.inspect(b))


@api_view(["POST"])
@permission_classes([IsAdminUser])
def load(request):
    b, err = _bundle(request)
    if err:
        return err
    keys = request.data.get("sections")
    results = backup.load(b, keys if isinstance(keys, list) else None, request.data.get("mode"), request.data.get("phase"))
    logger.info("Settings loaded by %s: %s", request.user.email, ", ".join(f"{r['key']}={'ok' if r['ok'] else 'fail'}" for r in results))
    return Response({"results": results})


# ── zip: back-up and restore (see backup_zip) ───────────────────────────────
from django.http import HttpResponse  # noqa: E402
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser  # noqa: E402

from . import backup_zip  # noqa: E402


@api_view(["POST"])
@permission_classes([IsAdminUser])
def export_zip(request):
    keys = request.data.get("sections")
    secrets = bool(request.data.get("include_secrets"))
    password = str(request.data.get("password") or "")
    login = str(request.data.get("login_password") or "")
    if login:  # the password of the logged-in person is the zip password (checked here, it is not stored)
        if not request.user.check_password(login):
            return Response({"detail": "Het inlogwachtwoord klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
        password = login
    if request.data.get("use_saved") and not password:
        password = backup_zip.saved_password(request.user)
        if not password:
            return Response({"detail": "Er is geen wachtwoord opgeslagen voor jouw account."}, status=status.HTTP_400_BAD_REQUEST)
    elif password and request.data.get("remember") and not login:
        backup_zip.save_password(request.user, password)
    bundle = backup.export(keys if isinstance(keys, list) else None, secrets, request.data.get("include_files", True) is not False,
                           {k: request.data[k] for k in ("plugins", "themes") if isinstance(request.data.get(k), list)} or None)
    logger.info("Settings zip exported by %s (%s parts, secrets=%s, password=%s)", request.user.email, len(bundle["sections"]), secrets, bool(password))
    resp = HttpResponse(backup_zip.make_zip(bundle, password), content_type="application/zip")  # made in memory: no file is left on the server
    resp["Content-Disposition"] = f'attachment; filename="{backup_zip.filename()}"'
    resp["X-Backup-Errors"] = ",".join(bundle.get("errors", {}))
    resp["Access-Control-Expose-Headers"] = "Content-Disposition, X-Backup-Errors"
    return resp


@api_view(["POST"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def restore_open(request):
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "Kies een bestand."}, status=status.HTTP_400_BAD_REQUEST)
    given = str(request.data.get("password") or "")
    try:
        try:
            token, info = backup_zip.open_restore(f, given or backup_zip.saved_password(request.user))  # no password typed: try the remembered one
        except backup_zip.WrongPassword:
            if given:
                raise
            raise backup_zip.PasswordNeeded()
    except backup_zip.PasswordNeeded:
        return Response({"detail": "Deze zip is beveiligd met een wachtwoord.", "code": "password_required"}, status=status.HTTP_400_BAD_REQUEST)
    except backup_zip.WrongPassword:
        return Response({"detail": "Het wachtwoord klopt niet.", "code": "wrong_password"}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({**info, "token": token})


@api_view(["POST"])
@permission_classes([IsAdminUser])
@parser_classes([JSONParser])
def restore_load(request):
    key = str(request.data.get("section") or "")
    try:
        results = backup_zip.load_part(str(request.data.get("token") or ""), key, request.data.get("mode"), request.data.get("phase"))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    logger.info("Settings restore by %s: %s %s/%s", request.user.email, key, request.data.get("mode"), request.data.get("phase") or "all")
    return Response({"results": results})


@api_view(["POST"])
@permission_classes([IsAdminUser])
@parser_classes([JSONParser])
def restore_close(request):
    backup_zip.close(str(request.data.get("token") or ""))  # remove the temporary files of this restore
    return Response({"ok": True})


@api_view(["GET", "DELETE"])
@permission_classes([IsAdminUser])
def backup_password(request):
    """Is a back-up password remembered for this person? (the password itself never leaves the server). DELETE = forget it."""
    if request.method == "DELETE":
        backup_zip.forget_password(request.user)
    return Response({"saved": bool(backup_zip.saved_password(request.user))})
