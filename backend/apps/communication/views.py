import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import has_level_for
from apps.core.modules import module_required

from . import sending
from .models import CommAddress
from .serializers import CommAddressSerializer

logger = logging.getLogger(__name__)


class CommAddressViewSet(viewsets.ModelViewSet):
    queryset = CommAddress.objects.all()
    serializer_class = CommAddressSerializer
    permission_classes = [
        has_level_for("communication", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit"),
        module_required("communication"),
    ]

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.is_default and CommAddress.objects.filter(kind=obj.kind).count() > 1:
            return Response({"detail": "Maak eerst een ander adres de standaard."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def make_default(self, request, pk=None):
        obj = self.get_object()
        CommAddress.objects.filter(kind=obj.kind).update(is_default=False)
        obj.is_default, obj.enabled = True, True
        obj.save(update_fields=["is_default", "enabled"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        """Send a test e-mail from this address to the logged-in user."""
        obj = self.get_object()
        if obj.kind != "email_from":
            return Response({"detail": "Alleen een afzender-e-mailadres kan getest worden."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = sending.send_email(request.user.email, "Testbericht", f"Dit is een testbericht, verstuurd vanaf {obj.value}.",
                               purpose=obj.purpose if obj.purpose != "all" else None, from_addr=obj.value)
        except sending.DeliveryError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        if result == "sandbox":
            return Response({"detail": "Gesimuleerd (sandbox): het bericht staat in het sandbox-postvak, er is niets verstuurd."})
        if result == "logged":
            return Response({"detail": "Niet echt verstuurd: er is geen e-mailkoppeling (Postmark of SMTP) actief. Het bericht staat in het serverlog."})
        return Response({"detail": f"Testbericht verstuurd naar {request.user.email}."})
