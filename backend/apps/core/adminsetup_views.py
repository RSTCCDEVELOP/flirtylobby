# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API of easy2edit admin setup: everybody who is logged in reads the starting values (GET); an administrator changes them (PUT) or puts them back (DELETE)."""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.accounts.access import level as access_level

from . import adminsetup


@api_view(["GET", "PUT", "DELETE"])
def admin_setup(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_401_UNAUTHORIZED)
    if request.method == "GET":
        return Response({"settings": adminsetup.get(), "can_edit": request.user.is_staff or access_level(request.user, "system") >= 3})
    if not (request.user.is_staff or access_level(request.user, "system") >= 3):
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "DELETE":
        return Response({"settings": adminsetup.reset(), "can_edit": True})
    clean, errors = adminsetup.validate(request.data if isinstance(request.data, dict) else {})
    if errors:
        return Response({"detail": next(iter(errors.values())), "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"settings": adminsetup.save(clean), "can_edit": True})
