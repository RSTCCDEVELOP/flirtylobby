import logging

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import has_level_for
from apps.core.modules import module_required

from . import service
from .models import Order
from .serializers import OrderSerializer

logger = logging.getLogger(__name__)


# ── admin: orders ───────────────────────────────────────────────────────────
class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [has_level_for("orders", {"list": "use", "retrieve": "use", "destroy": "manage"}, default="edit"), module_required("orders")]

    def get_queryset(self):
        qs = Order.objects.prefetch_related("items")
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("kind"):
            qs = qs.filter(kind=p["kind"])
        if q := p.get("q"):
            qs = qs.filter(Q(number__icontains=q) | Q(name__icontains=q) | Q(email__icontains=q))
        return qs

    def perform_update(self, serializer):
        old = serializer.instance.status
        order = serializer.save()
        if order.status == "canceled" and old not in ("canceled", "refunded") and order.kind == "shop":
            service.restock(order)  # the reserved stock goes back
        if order.status != old:
            from apps.subscriptions import service as subs

            subs.on_order_status(order, old)
        logger.info("Order %s: %s -> %s by %s", order.number, old, order.status, self.request.user.email)


@api_view(["GET", "PUT"])
@permission_classes([has_level_for("orders", {"GET": "use"}, default="edit"), module_required("orders")])
def settings_admin(request):
    if request.method == "PUT":
        try:
            service.save_settings(request.data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(service.settings())


@api_view(["GET"])
@permission_classes([AllowAny, module_required("orders")])
def public_order(request, number):
    order = Order.objects.filter(number=number, token=request.query_params.get("t", "-")).prefetch_related("items").first()
    if not order:
        return Response(status=status.HTTP_404_NOT_FOUND)
    d = OrderSerializer(order).data
    for k in ("internal_note", "id", "payment_ref"):
        d.pop(k, None)
    return Response(d)
