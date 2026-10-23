# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.accounts.access import SECURITY, level
from apps.accounts.permissions import has_level_any
from rest_framework.response import Response

from apps.core.models import Language

from . import geo, service
from . import twofa
from .countries import COUNTRY_CODES
from .words import find_forbidden

logger = logging.getLogger(__name__)


def _lang_codes():
    return set(Language.objects.values_list("code", flat=True))


@api_view(["GET"])
@permission_classes([AllowAny])
def public_settings(request):
    """Public: only what the website needs to render popups/banners and set headers."""
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first()
    langs = list(Language.objects.filter(enabled=True).values_list("code", flat=True))
    return Response({**service.public(), "default_language": default, "languages": langs})


@api_view(["GET"])
@permission_classes([AllowAny])
def check_visitor(request):
    """Called by the frontend middleware with the visitor's IP."""
    allowed, country = geo.check(request.query_params.get("ip", ""), request.query_params.get("country"))
    if not allowed:
        logger.info("Visitor blocked (country=%s)", country)
    return Response({"allowed": allowed, "country": country})


# which module each settings section belongs to (access is checked per section)
SECTION_MODULE = {"basic": "security_basic", "geo": "geo", "age": "age_gate", "gambling": "gambling",
                  "cookies": "cookies", "words": "word_filter", "twofa": "twofa", "email_verify": "security_basic", "registration": "security_basic", "passkeys": "security_basic", "social": "security_basic"}


@api_view(["GET", "PUT"])
@permission_classes([has_level_any(*[(m, "use") for m in SECURITY])])
def settings_admin(request):
    if request.method == "PUT":
        for section in (request.data or {}):
            module = SECTION_MODULE.get(section)
            if module and level(request.user, module) < 2:
                return Response({"detail": f"Je mag dit onderdeel ({section}) niet wijzigen."}, status=status.HTTP_403_FORBIDDEN)
        try:
            cleaned = service.clean(request.data, _lang_codes())
        except service.Invalid as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        service.save(cleaned)
        logger.info("Security settings updated by %s", request.user.email)
    languages = list(Language.objects.values("code", "name", "native_name", "enabled", "is_default"))
    return Response({"settings": service.raw(), "languages": languages, "country_codes": sorted(COUNTRY_CODES),
                     "twofa_availability": twofa.availability()})


@api_view(["POST"])
@permission_classes([has_level_any(("word_filter", "use"))])
def check_words(request):
    return Response({"found": find_forbidden(request.data.get("text", ""))})
