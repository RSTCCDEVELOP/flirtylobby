# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Payment details of a user (tab Betaalgegevens of the user screen) and the switch "pays through a company / pays privately".

The details are encrypted in the database (see apps/core/entity_payments.py), the screens get them masked. Edit rights on the module Gebruikers are needed for everything, also for reading.
The switch + the chosen company decide who is billed: `billing_party(user)` (used by orders and invoices)."""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.core import entity_payments, payaccount
from apps.core.modules import module_required

from .models import User
from .permissions import has_level_for

PERM = [has_level_for("users", {}, default="edit"), module_required("users")]


def companies_of(user):
    """The companies this person belongs to (the own company of the website too, when he is linked to it): [{id, name, city}]."""
    return [{"id": e.pk, "name": e.name or "—", "city": e.city} for e in user.entities.order_by("name", "id")]


def billing_party(user):
    """Who pays for this person: {"mode": "private"} or {"mode": "company", "entity": <Entity>}. A company that is not linked any more counts as private."""
    if user.pays_via_company and user.billing_entity:
        e = user.entities.filter(pk=user.billing_entity).first()
        if e:
            return {"mode": "company", "entity": e}
    return {"mode": "private"}


def _target(request, pk):
    qs = User.objects.all() if request.user.is_staff else User.objects.exclude(is_staff=True)  # a delegated manager never sees the beheerders
    return qs.filter(pk=pk).first()


def _answer(u, items=None, locked=False, by=None):
    return Response({"account": payaccount.info(u), "account_manage": bool(by and by.is_staff), "items": entity_payments.masked(items or []), "locked": locked, "kinds": [{"key": k, "label": lb} for k, lb in entity_payments.KINDS], "max": entity_payments.MAX_ITEMS,
                     "pays_via_company": u.pays_via_company, "billing_entity": u.billing_entity, "companies": companies_of(u)})


def _set_payer(u, body):
    """The switch: pays through a company (and which one) or privately. Raises ValueError."""
    if "pays_via_company" not in body:
        return
    on = bool(body.get("pays_via_company"))
    if not on:
        u.pays_via_company = False
        u.save(update_fields=["pays_via_company"])
        return
    ids = [c["id"] for c in companies_of(u)]
    if not ids:
        raise ValueError("Koppel eerst een bedrijf aan deze gebruiker (tab Rechten, Entiteiten).")
    try:
        chosen = int(body.get("billing_entity") or u.billing_entity or 0)
    except (TypeError, ValueError):
        chosen = 0
    if chosen not in ids:
        chosen = ids[0] if len(ids) == 1 else 0
    if not chosen:
        raise ValueError("Kies het bedrijf waarlangs deze gebruiker betaalt.")
    u.pays_via_company, u.billing_entity = True, chosen
    u.save(update_fields=["pays_via_company", "billing_entity"])


@api_view(["GET", "PUT"])
@permission_classes(PERM)
def user_payments(request, pk):
    """GET = the payment details (sensitive values masked) and the payer switch; PUT {items?, pays_via_company?, billing_entity?}."""
    u = _target(request, pk)
    if not u:
        return Response({"detail": "Deze gebruiker bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PUT":
        try:
            _set_payer(u, request.data)
            payaccount.set_fields(u, request.data, request.user)
            if "items" in request.data:
                entity_payments.save(u, request.data.get("items"), request.user)
        except ValueError as x:
            return Response({"detail": str(x)}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return _answer(u, entity_payments.unseal(u), by=request.user)
    except entity_payments.Locked:
        return _answer(u, locked=True, by=request.user)


@api_view(["POST"])
@permission_classes(PERM)
def user_payments_reveal(request, pk):
    """The full values (the person pressed Tonen)."""
    u = _target(request, pk)
    if not u:
        return Response({"detail": "Deze gebruiker bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    try:
        return Response({"items": entity_payments.reveal(u, request.user)})
    except entity_payments.Locked as x:
        return Response({"detail": str(x)}, status=status.HTTP_409_CONFLICT)


@api_view(["POST"])
@permission_classes(PERM)
def user_account_settle(request, pk):
    """A superadmin marks what this person has open on account as paid."""
    u = _target(request, pk)
    if not u:
        return Response({"detail": "Deze gebruiker bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    return Response({"settled": payaccount.settle(u), "account": payaccount.info(u)})
