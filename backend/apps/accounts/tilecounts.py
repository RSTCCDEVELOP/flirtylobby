# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The numbers on the tiles of the admin dashboards (Admin -> Users: how many users, groups, roles ...). One cheap call: counts only, and only of what the person may see
(access level 1 or higher on the module of the tile). The answer is {tile address: {"n": number, "unit": "<key>"}}; the screen turns the unit into a translated text."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core import modules

from .access import level
from .models import ModuleGrant, Role, User, UserGroup


def _users(u):
    qs = User.objects.all()
    return qs if u.is_staff else qs.exclude(is_staff=True)


def _entities(u):
    from apps.core.models import Entity

    return Entity.objects.count()


def _ai(u):
    from apps.integrations.models import AiUsage

    return AiUsage.objects.filter(created_at__gte=timezone.now() - timedelta(days=30)).count()


# tile address -> (module that gives access, how to count, unit)
COUNTS = {
    "/dashboard/admin/users": ("users", lambda u: _users(u).count(), "users"),
    "/dashboard/admin/groups": ("users", lambda u: UserGroup.objects.count(), "groups"),
    "/dashboard/admin/roles": ("roles", lambda u: Role.objects.count(), "roles"),
    "/dashboard/admin/rights": ("rights", lambda u: ModuleGrant.objects.count(), "grants"),
    "/dashboard/admin/entity": ("entities", _entities, "entity"),
    "/dashboard/admin/ai": ("ai", _ai, "ai"),
}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tile_counts(request):
    out = {}
    for href, (module, count, unit) in COUNTS.items():
        if not modules.enabled(module) or level(request.user, module) < 1:
            continue
        try:
            out[href] = {"n": count(request.user), "unit": unit}
        except Exception:  # noqa: BLE001 - a number that cannot be counted is left out, the tile stays
            continue
    return Response(out)
