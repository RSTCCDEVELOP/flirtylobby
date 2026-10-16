import logging

from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    logger.info("Health check OK (db vendor: %s)", connection.vendor)
    return Response({"status": "ok", "database": connection.vendor})


# ── Theme / "Vormgeving" ────────────────────────────────────────────────────
from rest_framework import status  # noqa: E402
from rest_framework.permissions import IsAdminUser  # noqa: E402

from . import theme  # noqa: E402
from .models import SiteSettings  # noqa: E402


def _theme_payload(values, with_schema=False):
    css, fonts_url = theme.build(values)
    payload = {"values": values, "css": css, "fonts_url": fonts_url}
    if with_schema:
        payload["schema"] = theme.SCHEMA
    return payload


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def theme_settings(request):
    """GET: public (the site needs it to render). PUT: staff only, partial values allowed."""
    if request.method == "GET":
        values = theme.merged(SiteSettings.load().theme)
        return Response(_theme_payload(values, with_schema=request.user.is_authenticated and request.user.is_staff))

    if not (request.user.is_authenticated and request.user.is_staff):
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    clean, errors = theme.validate(request.data.get("values"))
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    settings_obj = SiteSettings.load()
    settings_obj.theme = {k: v for k, v in clean.items() if v != theme.DEFAULTS[k]}
    settings_obj.save()
    logger.info("Theme updated by %s", request.user.email)
    return Response(_theme_payload(theme.merged(settings_obj.theme)))


@api_view(["POST"])
@permission_classes([IsAdminUser])
def theme_preview(request):
    clean, errors = theme.validate(request.data.get("values"))
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(_theme_payload(theme.merged(clean)))


@api_view(["POST"])
@permission_classes([IsAdminUser])
def theme_reset(request):
    settings_obj = SiteSettings.load()
    settings_obj.theme = {}
    settings_obj.save()
    return Response(_theme_payload(theme.merged({}), with_schema=True))
