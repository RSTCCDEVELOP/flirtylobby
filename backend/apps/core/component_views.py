# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The API of the component sets (see componentpacks.py): what the website and the editor need of the set in use, and the admin of the sets."""
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.access import level as access_level

from . import componentpacks as cp


@api_view(["GET"])
@permission_classes([AllowAny])
def active(request):
    """The set in use (or ?key=...): its css and script (for every page that shows a component), and with ?full=1 its components (for the editor)."""
    try:
        s = cp.get(request.GET.get("key") or None)
    except cp.ComponentError as e:
        return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
    out = {k: s[k] for k in ("key", "name", "version", "css", "runtime")}
    if request.GET.get("full") == "1":
        out["components"] = s["components"]
    return Response(out)


@api_view(["GET", "POST"])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def sets(request):
    """GET: the installed sets and the library. POST {action: install | activate | remove, key} or a zip (file) to add a set that was made elsewhere."""
    lvl = access_level(request.user, "theme")
    if lvl < 1:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        return Response(cp.listing())
    if lvl < 2:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    try:
        if request.FILES.get("file"):
            cp.install_upload(request.FILES["file"])
        else:
            action, key = str(request.data.get("action") or ""), str(request.data.get("key") or "")
            if action == "install":
                cp.install(key)
            elif action == "activate":
                cp.activate(key)
            elif action == "remove":
                cp.remove(key)
            else:
                return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
    except cp.ComponentError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(cp.listing())
