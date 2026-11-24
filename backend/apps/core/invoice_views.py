# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The invoices of the easy2edit server: the charge of a website (with its key) and the screens of the reseller, the customer and the superadmin+ (see invoicing.py)."""
from django.http import Http404
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import invoicing, sitemanager


def _ip(request):
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_charge(request):
    """An approved website (with its key) puts a charge on its invoice: {ref, kind, description, amount_incl, vat_rate, payer}. Returns {number}."""
    if not sitemanager.server_enabled():
        raise Http404
    site = sitemanager.site_for_key(request.META.get("HTTP_X_EASY2EDIT_KEY", ""))
    if not site or site.status != "active":
        return Response({"detail": "Onbekende, geblokkeerde of nog niet goedgekeurde website."}, status=status.HTTP_403_FORBIDDEN)
    if not sitemanager.rate_ok(_ip(request), 60):
        return Response({"detail": "Te veel aanvragen."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    try:
        return Response({"number": invoicing.add_charge(site, request.data if isinstance(request.data, dict) else {})})
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def invoice_list(request):
    """The invoices this person may look at (a superadmin+ all, a reseller those of the websites, a customer his own)."""
    qs = invoicing.visible_to(request.user).select_related("site", "reseller")
    role = "superadmin" if request.user.is_superuser else "reseller" if invoicing.reseller_ids(request.user) else "customer"
    return Response({"role": role, "can_settle": bool(request.user.is_superuser), "invoices": [invoicing.serialize(i) for i in qs[:500]]})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def invoice_detail(request, pk):
    inv = invoicing.visible_to(request.user).filter(pk=pk).first()
    if not inv:
        return Response({"detail": "Deze factuur bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    return Response(invoicing.serialize(inv, True))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invoice_paid(request, pk):
    """A superadmin+ records that an invoice is paid ({paid: false} puts it back to open)."""
    if not request.user.is_superuser:
        return Response({"detail": "Alleen een superadmin+."}, status=status.HTTP_403_FORBIDDEN)
    inv = invoicing.visible_to(request.user).filter(pk=pk).first()
    if not inv:
        return Response({"detail": "Deze factuur bestaat niet."}, status=status.HTTP_404_NOT_FOUND)
    return Response(invoicing.serialize(invoicing.mark_paid(inv, request.data.get("paid", True) is not False), True))
