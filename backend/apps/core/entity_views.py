# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API of the entity module (see entity.py): the admin screen (GET and PUT) and the public data for the website."""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import has_level_for
from apps.core.modules import module_required

from . import entity, entity_payments
from .models import Entity


@api_view(["GET", "PUT"])
@permission_classes([has_level_for("entities", {"GET": "use"}, default="edit"), module_required("entities")])
def entity_admin(request):
    """GET = the entity with its kind, title and variables; PUT {name, legal_name, description, email, phone, website, street, house_number, postal_code, city, country, registration_no, vat_no}."""
    if request.method == "PUT":
        try:
            entity.save(request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    else:
        entity.ensure_from_licence()  # an older licence: the company of the licence becomes the entity
    return Response(entity.public())


@api_view(["GET"])
@permission_classes([AllowAny])
def entity_public(request):
    """What the website needs to fill the text variables and to name the tile: no login needed."""
    return Response(entity.public())


PERM = [has_level_for("entities", {"GET": "use", "POST": "manage", "DELETE": "manage"}, default="edit"), module_required("entities")]


@api_view(["GET", "POST"])
@permission_classes(PERM)
def entities(request):
    """GET = the list (the entity of the website first; ?q= searches name, city and e-mail), POST = a new entity with its users and user groups."""
    if request.method == "POST":
        try:
            e = entity.save_other(Entity(), request.data, request.user)
        except ValueError as x:
            return Response({"detail": str(x)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(entity.serialize(e, True, request.user), status=status.HTTP_201_CREATED)
    entity.ensure_from_licence()
    entity.own()
    q = (request.query_params.get("q") or "").strip()
    qs = Entity.objects.all()
    if q:
        from django.db.models import Q

        qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q) | Q(email__icontains=q))
    return Response([entity.serialize(e) for e in qs])


@api_view(["GET", "PUT", "DELETE"])
@permission_classes(PERM)
def entity_item(request, pk):
    """One entity with its users and user groups; PUT changes it (and the links when user_ids / group_ids are sent), DELETE removes it (never the entity of the website)."""
    e = Entity.objects.filter(pk=pk).first()
    if not e:
        return Response({"detail": "Deze entiteit bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        if e.is_own:
            return Response({"detail": "De entiteit van de website zelf kun je niet verwijderen."}, status=status.HTTP_400_BAD_REQUEST)
        e.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PUT":
        try:
            entity.save_other(e, request.data, request.user)
        except ValueError as x:
            return Response({"detail": str(x)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(entity.serialize(e, True, request.user))


PAY_PERM = [has_level_for("entities", {}, default="edit"), module_required("entities")]  # payment details: edit rights for everything, also for reading


def _pay_answer(e, items=None, locked=False):
    return Response({"items": entity_payments.masked(items or []), "locked": locked, "kinds": [{"key": k, "label": lb} for k, lb in entity_payments.KINDS], "max": entity_payments.MAX_ITEMS})


@api_view(["GET", "PUT"])
@permission_classes(PAY_PERM)
def entity_payments_item(request, pk):
    """The payment details of one company (encrypted in the database). GET = the list with the sensitive values masked, PUT {items} = replace the list."""
    e = Entity.objects.filter(pk=pk).first()
    if not e:
        return Response({"detail": "Deze entiteit bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PUT":
        try:
            items = entity_payments.save(e, request.data.get("items"), request.user)
        except ValueError as x:
            return Response({"detail": str(x)}, status=status.HTTP_400_BAD_REQUEST)
        return _pay_answer(e, items)
    try:
        return _pay_answer(e, entity_payments.unseal(e))
    except entity_payments.Locked:
        return _pay_answer(e, locked=True)


@api_view(["POST"])
@permission_classes(PAY_PERM)
def entity_payments_reveal(request, pk):
    """The full values of the payment details (the person pressed Tonen)."""
    e = Entity.objects.filter(pk=pk).first()
    if not e:
        return Response({"detail": "Deze entiteit bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    try:
        return Response({"items": entity_payments.reveal(e, request.user)})
    except entity_payments.Locked as x:
        return Response({"detail": str(x)}, status=status.HTTP_409_CONFLICT)
