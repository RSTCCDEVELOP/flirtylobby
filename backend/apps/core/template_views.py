# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The API of the web templates (see templatepacks.py): the choice screen for the admin, and adding or removing templates for the superadmin."""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.access import level as access_level

from . import templatepacks as tp


def _bad(text, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": text}, status=code)


@api_view(["GET", "POST"])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def templates(request):
    """GET: the templates. POST: {action: apply, key, mode: copy | replace | skip}; a superadmin also: a zip (file) to add one, or {action: remove, key}."""
    lvl = access_level(request.user, "pages")
    if lvl < 1:
        return _bad("Geen toegang.", status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        return Response({"templates": tp.listing(), "manage": bool(request.user.is_staff), "can_use": lvl >= 3})
    try:
        if request.FILES.get("file"):
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan templates toevoegen.", status.HTTP_403_FORBIDDEN)
            tp.add_upload(request.FILES["file"])
            return Response({"templates": tp.listing(), "manage": True, "can_use": True}, status=status.HTTP_201_CREATED)
        action, key = str(request.data.get("action") or ""), str(request.data.get("key") or "")
        if action == "remove":
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan templates verwijderen.", status.HTTP_403_FORBIDDEN)
            tp.remove(key)
            return Response({"templates": tp.listing(), "manage": True, "can_use": True})
        if action == "apply":
            if lvl < 3:
                return _bad("Geen rechten om pagina's te beheren.", status.HTTP_403_FORBIDDEN)
            return Response(tp.apply(key, request.user, str(request.data.get("mode") or "copy")))
    except tp.TemplateError as e:
        return _bad(str(e))
    return _bad("Onbekende actie.")


@api_view(["GET"])
@permission_classes([AllowAny])
def template_preview(request, key, n):
    """An example picture of a template (for the choice screen)."""
    try:
        data, ctype = tp.preview(key, int(n))
    except tp.TemplateError:
        return _bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    r = HttpResponse(data, content_type=ctype)
    r["Cache-Control"] = "public, max-age=3600"
    return r
