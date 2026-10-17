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


# ── E-mail layout (Communicatie -> E-mailopmaak) ────────────────────────────
import re  # noqa: E402

from rest_framework.decorators import api_view, permission_classes  # noqa: E402

from apps.accounts.permissions import has_level  # noqa: E402

from . import layout  # noqa: E402

SAMPLE_SUBJECT = "Voorbeeldbericht"
SAMPLE_BODY = ("Hallo,\n\nDit is een voorbeeld van een e-mail van het systeem. Zo zien je berichten eruit, met de kleuren, het lettertype en "
               "het logo van je website.\n\nJe verificatiecode is:\n\n482915\n\n[Open de website](/login)\n\nHeb je dit niet aangevraagd? Negeer dit bericht dan.")


def _bases(request):
    origin = (request.headers.get("Origin") or "").rstrip("/")
    return origin or None, request.build_absolute_uri("/").rstrip("/")


def _sample(request, override=None):
    base, api = _bases(request)
    cfg = layout.merge_preview(override) if override else layout.get()
    return layout.build(SAMPLE_SUBJECT, SAMPLE_BODY, base, api, cfg), cfg


@api_view(["GET", "PUT"])
@permission_classes([has_level("communication", "use"), module_required("communication")])
def email_layout(request):
    if request.method == "PUT":
        from apps.accounts.access import level

        if level(request.user, "communication") < 2:
            return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
        try:
            layout.save(request.data)
        except layout.Invalid as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"settings": layout.get(), "fonts": list(layout.FONTS)})


@api_view(["POST"])
@permission_classes([has_level("communication", "use"), module_required("communication")])
def email_layout_preview(request):
    """HTML (or text) of a sample message, optionally with settings that are not saved yet."""
    try:
        (text, html_body), cfg = _sample(request, request.data.get("settings"))
    except (ValueError, layout.Invalid) as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"format": cfg["format"], "html": html_body, "text": text})


@api_view(["POST"])
@permission_classes([has_level("communication", "edit"), module_required("communication")])
def email_layout_test(request):
    """Send the sample message with the saved layout to the given address."""
    to = str(request.data.get("to") or "").strip()
    if not re.fullmatch(r"[^@\s]{1,64}@[^@\s]{1,200}\.[^@\s]{2,}", to):
        return Response({"detail": "Geef een geldig e-mailadres."}, status=status.HTTP_400_BAD_REQUEST)
    base, api = _bases(request)
    try:
        result = sending.send_email(to, SAMPLE_SUBJECT, SAMPLE_BODY, purpose="notifications", base_url=base, api_base=api)
    except sending.DeliveryError as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    logger.info("Layout test e-mail sent to %s by %s", to, request.user.email)
    if result == "sandbox":
        return Response({"detail": "Gesimuleerd (sandbox): het bericht staat in het sandbox-postvak, er is niets verstuurd."})
    if result == "logged":
        return Response({"detail": "Niet echt verstuurd: er is geen e-mailkoppeling (Postmark of SMTP) actief. Het bericht staat in het serverlog."})
    return Response({"detail": f"Testmail verstuurd naar {to}."})
