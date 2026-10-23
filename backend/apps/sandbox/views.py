# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import has_level, has_level_for
from apps.core.modules import module_required

from . import service
from .models import SandboxMessage, SandboxPayment

logger = logging.getLogger(__name__)
mod = module_required("sandbox")


def _payment(p):
    return {"ref": p.ref, "provider": p.provider, "amount": str(p.amount), "currency": p.currency, "description": p.description,
            "status": p.status, "events": p.events, "created_at": p.created_at, "checkout_path": f"/sandbox/checkout/{p.ref}"}


@api_view(["GET"])
@permission_classes([AllowAny])
def public_status(request):
    s = service.get()
    on = service.active()
    return Response({"enabled": on, "banner": on and s["banner"]})


@api_view(["GET", "PUT"])
@permission_classes([has_level_for("sandbox", {"GET": "use"}, default="edit"), mod])
def settings(request):
    if request.method == "PUT":
        try:
            service.save(request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        logger.info("Sandbox settings changed by %s: %s", request.user.email, service.get())
    from apps.security.countries import COUNTRY_CODES

    return Response({"settings": service.get(), "country_codes": sorted(COUNTRY_CODES), "payment_provider": service.payment_provider(), "payment_targets": service.payment_targets()})


@api_view(["GET"])
@permission_classes([has_level("sandbox", "use"), mod])
def messages(request):
    return Response([{"id": m.id, "kind": m.kind, "to": m.to, "sender": m.sender, "subject": m.subject, "body": m.body, "created_at": m.created_at}
                     for m in SandboxMessage.objects.all()[:200]])


@api_view(["POST"])
@permission_classes([has_level("sandbox", "manage"), mod])
def clear(request):
    what = request.data.get("what")
    if what == "messages":
        SandboxMessage.objects.all().delete()
    elif what == "payments":
        SandboxPayment.objects.all().delete()
    else:
        return Response({"detail": "Onbekend."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"ok": True})


@api_view(["GET", "POST"])
@permission_classes([has_level_for("sandbox", {"GET": "use"}, default="edit"), mod])
def payments(request):
    if request.method == "GET":
        return Response([_payment(p) for p in SandboxPayment.objects.all()[:100]])
    b = request.data
    try:
        p = service.create_payment(b.get("amount"), b.get("currency", "EUR"), b.get("description", ""), b.get("provider", "mollie"), b.get("return_url", ""))
        if b.get("outcome") in service.OUTCOMES:  # finish right away
            service.apply_outcome(p, b["outcome"])
    except (service.NotConfigured, ValueError) as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_payment(p), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([has_level("sandbox", "edit"), mod])
def payment_outcome(request, ref):
    p = SandboxPayment.objects.filter(ref=ref).first()
    if not p:
        return Response(status=status.HTTP_404_NOT_FOUND)
    try:
        service.apply_outcome(p, request.data.get("outcome"))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_payment(p))


# ── the simulated checkout page of a payment (public, only while the sandbox is on) ──
@api_view(["GET"])
@permission_classes([AllowAny])
def checkout(request, ref):
    p = SandboxPayment.objects.filter(ref=ref).first()
    if not p or not service.active("payments"):
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response({**_payment(p), "return_url": p.return_url})


@api_view(["POST"])
@permission_classes([AllowAny])
def checkout_pay(request, ref):
    p = SandboxPayment.objects.filter(ref=ref).first()
    if not p or not service.active("payments"):
        return Response(status=status.HTTP_404_NOT_FOUND)
    try:
        service.apply_outcome(p, request.data.get("outcome"))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({**_payment(p), "return_url": p.return_url})
