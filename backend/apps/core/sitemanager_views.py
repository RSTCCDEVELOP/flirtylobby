# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The API of the site manager: the calls of the websites (register, ping) and the list for a superadmin+ (see sitemanager.py)."""
from django.http import Http404
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import sitemanager
from .models import EasySite


def _seen_ip(request):
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_register(request):
    """A website reports itself for the first time. Only on the installation that is the easy2edit server; open to the world, so limited per address."""
    if not sitemanager.server_enabled():
        raise Http404
    ip = _seen_ip(request)
    if not sitemanager.rate_ok(ip):
        return Response({"detail": "Te veel aanmeldingen."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    try:
        site, key = sitemanager.register(request.data if isinstance(request.data, dict) else {}, ip)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except PermissionError as e:
        return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
    return Response({"key": key, "url": site.url, "id": site.pk}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_ping(request):
    """A known website calls with its key (header X-Easy2edit-Key), for example at the login of an administrator: its record is updated."""
    if not sitemanager.server_enabled():
        raise Http404
    try:
        site = sitemanager.ping(request.META.get("HTTP_X_EASY2EDIT_KEY", ""), request.data if isinstance(request.data, dict) else {}, _seen_ip(request))
    except PermissionError as e:
        return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
    return Response({"ok": True, "url": site.url})


def _source_site(request):
    """The website that asks for the library: it must be known (its key) and this installation must be the easy2edit server."""
    if not sitemanager.server_enabled():
        raise Http404
    return sitemanager.site_for_key(request.META.get("HTTP_X_EASY2EDIT_KEY", ""))


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def source_list(request):
    """The library of this installation (the folder resource/) for the websites that use the easy2edit server as their source: ?kind=plugins|themas|languages|components|templates."""
    from . import resources

    if not _source_site(request):
        return Response({"detail": "Onbekende of geblokkeerde website."}, status=status.HTTP_403_FORBIDDEN)
    kind = request.query_params.get("kind")
    if kind not in resources.KINDS:
        return Response({"detail": "Onbekend onderdeel."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"items": resources.local_catalog(kind, site=False)})  # only the library of the product, not what a superadmin made on this installation


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def source_file(request):
    """One zip of the library: ?kind=&file=name.zip."""
    import re

    from django.http import HttpResponse

    from . import resources

    if not _source_site(request):
        return Response({"detail": "Onbekende of geblokkeerde website."}, status=status.HTTP_403_FORBIDDEN)
    kind, file = request.query_params.get("kind"), str(request.query_params.get("file") or "")
    if kind not in resources.KINDS or not re.fullmatch(r"[A-Za-z0-9._+-]+\.zip", file):
        return Response({"detail": "Onbekend bestand."}, status=status.HTTP_400_BAD_REQUEST)
    folder = resources.root() / kind
    path = folder / file
    if not path.is_file() or path.resolve().parent != folder.resolve():
        raise Http404
    return HttpResponse(path.read_bytes(), content_type="application/zip")


def _plus_only(request):
    if not request.user.is_superplus:
        return Response({"detail": "Alleen een superadmin+."}, status=status.HTTP_403_FORBIDDEN)
    return None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def sites_admin(request):
    """Superadmin+: GET = this installation and (when it is the server) the list of websites. POST {action: "server", on} | {action: "sync"} (report this website now)."""
    if (deny := _plus_only(request)):
        return deny
    if request.method == "POST":
        action = request.data.get("action")
        if action == "server":
            sitemanager.set_server(bool(request.data.get("on")))
        elif action == "sync":
            result = sitemanager.report("sync", sitemanager.role_of(request.user))
            if not result["ok"]:
                return Response({"detail": f"Melden is niet gelukt: {result['error']}", **{"info": sitemanager.info()}}, status=status.HTTP_502_BAD_GATEWAY)
        else:
            return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
    me = sitemanager.info()
    return Response({"me": me, "sites": [sitemanager.public(s) for s in EasySite.objects.all()] if me["server"] else []})


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def site_admin(request, pk):
    """Superadmin+: change the name, address, notes or status (active | blocked) of a website in the list, or remove it from the list."""
    if (deny := _plus_only(request)):
        return deny
    site = EasySite.objects.filter(pk=pk).first()
    if not site:
        raise Http404
    if request.method == "DELETE":
        site.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data if isinstance(request.data, dict) else {}
    if "name" in d:
        site.name = str(d["name"] or "").strip()[:150]
    if "notes" in d:
        site.notes = str(d["notes"] or "").strip()[:2000]
    if "status" in d:
        if d["status"] not in ("active", "blocked"):
            return Response({"detail": "Onbekende status."}, status=status.HTTP_400_BAD_REQUEST)
        site.status = d["status"]
    if "url" in d:
        url = sitemanager._clean_url(d["url"])
        if not url:
            return Response({"detail": "Gebruik een adres als https://naam.easy2edit.com (zonder pad)."}, status=status.HTTP_400_BAD_REQUEST)
        site.url, site.url_generated = url, False
    site.save()
    return Response(sitemanager.public(site))
