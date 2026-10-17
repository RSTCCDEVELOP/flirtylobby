"""API for the settings backup (superusers only)."""
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
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
    bundle = backup.export(keys if isinstance(keys, list) else None, secrets, request.data.get("include_files", True) is not False)
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
    results = backup.load(b, keys if isinstance(keys, list) else None)
    logger.info("Settings loaded by %s: %s", request.user.email, ", ".join(f"{r['key']}={'ok' if r['ok'] else 'fail'}" for r in results))
    return Response({"results": results})
