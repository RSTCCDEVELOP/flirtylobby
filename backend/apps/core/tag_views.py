# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API of the tag system (see tags.py)."""
from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from rest_framework.permissions import BasePermission, IsAuthenticated

from apps.accounts.access import can_admin
from apps.core.modules import module_required

from . import tags
from .models import Tag

class AdminAny(BasePermission):
    """Everybody who administers (an administrator up to a superadmin+) may make, change and use tags, also from the screens of the other modules."""

    message = "Alleen beheerders mogen tags beheren."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_staff or can_admin(u)))


PERM = [IsAuthenticated, AdminAny, module_required("tags")]


@api_view(["GET", "POST"])
@permission_classes(PERM)
def tag_list(request):
    """GET = every tag (with how many things carry it), POST = a new tag {name, color, description, scope, modules, plugins}."""
    if request.method == "POST":
        try:
            t = tags.save(None, request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(tags.serialize(t), status=status.HTTP_201_CREATED)
    return Response([tags.serialize(t, t.n) for t in Tag.objects.annotate(n=Count("links"))])


@api_view(["GET", "PUT", "DELETE"])
@permission_classes(PERM)
def tag_item(request, pk):
    t = Tag.objects.filter(pk=pk).first()
    if not t:
        return Response({"detail": "Deze tag bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        t.delete()  # (its links go with it; the things stay)
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PUT":
        try:
            t = tags.save(t, request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(tags.serialize(t))


@api_view(["GET", "PUT"])
@permission_classes(PERM)
def tag_links(request):
    """GET ?kind=&ref= = the tags on this thing and the tags that may be put on it; PUT {kind, ref, tag_ids} = put exactly these tags on it."""
    d = request.data if request.method == "PUT" else request.query_params
    kind, ref = str(d.get("kind") or ""), str(d.get("ref") or "")
    if request.method == "PUT":
        try:
            tags.set_tags(kind, ref, d.get("tag_ids") or [])
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"tag_ids": [t.pk for t in tags.tags_of(kind, ref)], "available": [tags.serialize(t) for t in tags.available_for(kind, ref)]})


@api_view(["GET"])
@permission_classes(PERM)
def tag_map(request):
    """GET ?kind= = {tags: [...], links: {ref: [tag id]}} for a list (the dots and chips next to the names)."""
    kind = str(request.query_params.get("kind") or "")
    return Response({"tags": [tags.serialize(t) for t in Tag.objects.all()], "links": tags.map_for(kind)})
