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
        ok, message = providers.PROVIDERS[obj.provider]["test"](obj.config)
        obj.last_test_ok, obj.last_test_message, obj.last_test_at = ok, message[:300], timezone.now()
        obj.save(update_fields=["last_test_ok", "last_test_message", "last_test_at"])
        logger.info("Integration test %s: %s", obj.slug, "ok" if ok else "failed")
        return Response(self.get_serializer(obj).data)
