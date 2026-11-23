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
        if request.GET.get("pages") and request.user.is_staff:  # the screen that makes a template: the pages that will be in it (for the example pictures)
            return Response({"pages": tp.site_pages()})
        if request.GET.get("backup_pages") and request.user.is_staff:  # the pages of a backup that is saved as a template
            from apps.backups.models import Backup

            b = Backup.objects.filter(pk=request.GET["backup_pages"]).first()
            try:
                if b:
                    tp.ensure_fresh(b)
                return Response({"pages": tp.backup_pages(b) if b else []})
            except tp.TemplateError as e:
                return _bad(str(e))
            except Exception as e:  # noqa: BLE001
                return _bad(str(e))
        return Response({"templates": tp.listing(), "manage": bool(request.user.is_staff), "can_use": lvl >= 3})
    try:
        if request.FILES.get("file"):
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan templates toevoegen.", status.HTTP_403_FORBIDDEN)
            tp.add_upload(request.FILES["file"])
            return Response({"templates": tp.listing(), "manage": True, "can_use": True}, status=status.HTTP_201_CREATED)
        action, key = str(request.data.get("action") or ""), str(request.data.get("key") or "")
        if action == "create":  # a template from the website as it is now (settings of the system, pages, example pictures); no data of users
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan templates maken.", status.HTTP_403_FORBIDDEN)
            shots = [(f.name, f.read()) for f in request.FILES.getlist("previews")[:12]]
            m = tp.build_from_site(key, request.data.get("name"), request.data.get("description"), request.data.get("author"), request.data.get("version") or "1.0.0", shots, request.data.getlist("pages") or None)
            return Response({"templates": tp.listing(), "manage": True, "can_use": True, "made": {"key": m["key"], "name": m["name"], "version": m["version"], "skipped": m["skipped"], "errors": m["errors"]}}, status=status.HTTP_201_CREATED)
        if action == "create_from_backup":  # a backup saved as a template: only for demo content
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan templates maken.", status.HTTP_403_FORBIDDEN)
            if str(request.data.get("demo_only")).lower() not in ("1", "true", "yes", "on"):
                return _bad("Bevestig eerst dat de backup alleen demo-gegevens bevat en niet gebruikt is.")
            from apps.backups.models import Backup

            b = Backup.objects.filter(pk=request.data.get("backup")).first()
            if not b:
                return _bad("Deze backup bestaat niet.", status.HTTP_404_NOT_FOUND)
            shots = [(f.name, f.read()) for f in request.FILES.getlist("previews")[:12]]
            m = tp.build_from_backup(b, key, request.data.get("name"), request.data.get("description"), request.data.get("author"), request.data.get("version") or "1.0.0", shots)
            return Response({"templates": tp.listing(), "manage": True, "can_use": True, "made": {"key": m["key"], "name": m["name"], "version": m["version"]}}, status=status.HTTP_201_CREATED)
        if action == "suggest":  # the AI fills in the details of the new template
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan templates maken.", status.HTTP_403_FORBIDDEN)
            return Response(tp.suggest_details(str(request.data.get("lang") or "")))
        if action == "verify":
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan het systeem controleren.", status.HTTP_403_FORBIDDEN)
            return Response(tp.verify(key, fix=bool(request.data.get("fix", True)), user=request.user))
        if action == "remove":
            if not request.user.is_staff:
                return _bad("Alleen een superadmin kan templates verwijderen.", status.HTTP_403_FORBIDDEN)
            tp.remove(key)
            return Response({"templates": tp.listing(), "manage": True, "can_use": True})
        if action == "apply":
            if lvl < 3:
                return _bad("Geen rechten om pagina's te beheren.", status.HTTP_403_FORBIDDEN)
            scope = "system" if request.data.get("scope") == "system" else "pages"
            if scope == "system" and not request.user.is_staff:
                return _bad("Alleen een superadmin kan het hele systeem terugzetten.", status.HTTP_403_FORBIDDEN)
            return Response(tp.apply(key, request.user, str(request.data.get("mode") or "copy"), scope))
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
