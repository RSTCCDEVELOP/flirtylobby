# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.accounts.permissions import has_level, has_level_for
from apps.core import modules
from apps.core.modules import module_required
from rest_framework.response import Response

from . import providers
from .models import Integration
from .serializers import IntegrationSerializer

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def active_integrations(request):
    """Public: only which integrations are switched on (no settings), so the UI can hide features."""
    if not modules.enabled("integrations"):
        return Response({"active": []})
    return Response({"active": list(Integration.objects.filter(enabled=True).values_list("slug", flat=True))})


@api_view(["GET"])
@permission_classes([has_level("integrations", "use"), module_required("integrations")])
def provider_catalog(request):
    return Response(providers.catalog())


class IntegrationViewSet(viewsets.ModelViewSet):
    queryset = Integration.objects.all()
    serializer_class = IntegrationSerializer
    permission_classes = [has_level_for("integrations", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit"), module_required("integrations")]

    def get_queryset(self):
        """A link of the superadmins is only seen and changed by superadmins."""
        qs = Integration.objects.all()
        return qs if self.request.user.is_staff else qs.filter(superadmin_only=False)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.provider == "s3":
            from apps.medialib.models import MediaItem

            if MediaItem.objects.filter(storage="s3").exists():
                return Response({"detail": "Er staan nog bestanden op S3. Verplaats ze eerst naar lokaal (Admin → Media)."},
                                status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        obj = self.get_object()
        from apps.sandbox import service as sandbox

        if sandbox.active("integrations"):
            ok, message = True, "Gesimuleerd (sandbox): er is geen echte verbinding gemaakt."
        else:
            ok, message = providers.PROVIDERS[obj.provider]["test"](obj.config)
        obj.last_test_ok, obj.last_test_message, obj.last_test_at = ok, message[:300], timezone.now()
        obj.save(update_fields=["last_test_ok", "last_test_message", "last_test_at"])
        logger.info("Integration test %s: %s", obj.slug, "ok" if ok else "failed")
        return Response(self.get_serializer(obj).data)


@api_view(["POST"])
@permission_classes([has_level("integrations", "edit"), module_required("integrations")])
def model_list(request):
    """The models of a provider: with the key typed in the form, or with the key of a saved link (id)."""
    provider = str(request.data.get("provider") or "")
    cfg = {}
    if request.data.get("id"):
        obj = Integration.objects.filter(pk=request.data["id"], provider=provider, **({} if request.user.is_staff else {"superadmin_only": False})).first()
        cfg = dict(obj.config) if obj else {}
    typed = str(request.data.get("api_key") or "")
    if typed and not typed.startswith("•"):
        cfg["api_key"] = typed
    try:
        return Response({"models": providers.list_models(provider, cfg)})
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([has_level("integrations", "manage"), module_required("integrations")])
def export_all(request):
    """All links including their keys, locked with a password."""
    from . import backup, transfer

    pw = str(request.data.get("password") or "")
    if len(pw) < 8:
        return Response({"detail": "Kies een wachtwoord van minstens 8 tekens om het bestand te beveiligen."}, status=400)
    rows = backup._export({"include_secrets": True, "hide_superadmin": not request.user.is_staff})
    logger.info("API links exported by %s (%s links)", request.user.email, len(rows))
    return Response(transfer.pack(rows, pw))


@api_view(["POST"])
@permission_classes([has_level("integrations", "manage"), module_required("integrations")])
def import_all(request):
    """Load an export file: new links are created, existing ones (same name) are updated, keys included."""
    from . import backup, transfer

    try:
        rows = transfer.unpack(request.data.get("bundle"), str(request.data.get("password") or ""))
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)
    if not request.user.is_staff:  # a non-superadmin cannot touch the links of the superadmins
        locked = set(Integration.objects.filter(superadmin_only=True).values_list("slug", flat=True))
        rows = [{k: v for k, v in r.items() if k != "superadmin_only"} for r in rows if r.get("slug") not in locked]
    msg = backup._apply(rows, None)
    logger.info("API links imported by %s (%s links)", request.user.email, len(rows))
    return Response({"detail": msg, "count": len(rows)})
