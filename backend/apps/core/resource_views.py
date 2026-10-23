# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from . import resources


def _bad(msg, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": msg}, status=code)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def library(request):
    """The library (folder resource/): per kind what can be added or updated; only the parts the user may manage (all for a superadmin; others only what is allowed)."""
    kinds = [k for k in resources.KINDS if resources.can_use(request.user, k)]
    if not kinds:
        return _bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    data = resources.overview(request.user)
    return Response({"kinds": {k: data[k] for k in kinds}, "manage": request.user.is_staff, "titles": resources.TITLES, "folder": str(resources.root())})


@api_view(["PUT"])
@permission_classes([IsAdminUser])
def allowed(request):
    """Superadmin: which plugins, themes and languages others may install from the library without uploading (saved in resource/allowed.json)."""
    return Response(resources.set_allowed(request.data if isinstance(request.data, dict) else {}))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def install(request):
    d = request.data if isinstance(request.data, dict) else {}
    if d.get("kind") not in resources.KINDS:
        return _bad("Onbekend onderdeel.")
    try:
        done = resources.install(d["kind"], str(d.get("name") or ""), request.user)
    except resources.ResourceError as e:
        return _bad(str(e))
    return Response({"installed": done, "library": resources.overview(request.user)[d["kind"]]}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update(request):
    d = request.data if isinstance(request.data, dict) else {}
    if d.get("kind") not in resources.KINDS:
        return _bad("Onbekend onderdeel.")
    try:
        done = resources.update_all(d["kind"], request.user)
    except resources.ResourceError as e:
        return _bad(str(e))
    return Response({"updated": done, "library": resources.overview(request.user)[d["kind"]]})
