import logging
import re

from django.core.files.storage import default_storage
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import has_level, has_level_for
from apps.core.modules import module_required
from apps.sandbox import service as sandbox

from . import service
from .models import DiscountCode, Order, Product, ProductGroup, ShippingMethod
from .serializers import (DiscountCodeSerializer, OrderSerializer, ProductGroupSerializer, ProductSerializer, ShippingMethodSerializer,
                          media_url)

logger = logging.getLogger(__name__)
RULES = {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}


# ── admin: products and groups ──────────────────────────────────────────────
class ProductGroupViewSet(viewsets.ModelViewSet):
    serializer_class = ProductGroupSerializer
    permission_classes = [has_level_for("products", RULES, default="edit"), module_required("products")]

    def get_queryset(self):
        return ProductGroup.objects.annotate(product_count=Count("products"))


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [has_level_for("products", RULES, default="edit"), module_required("products")]

    def get_queryset(self):
        qs = Product.objects.select_related("group").prefetch_related("images__media")
        if q := self.request.query_params.get("q"):
            qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q))
        return qs


class ShippingMethodViewSet(viewsets.ModelViewSet):
    queryset = ShippingMethod.objects.all()
    serializer_class = ShippingMethodSerializer
    permission_classes = [has_level_for("orders", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit"), module_required("orders")]


class DiscountCodeViewSet(viewsets.ModelViewSet):
    queryset = DiscountCode.objects.all()
    serializer_class = DiscountCodeSerializer
    permission_classes = [has_level_for("orders", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit"), module_required("orders")]


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
        if q := p.get("q"):
            qs = qs.filter(Q(number__icontains=q) | Q(name__icontains=q) | Q(email__icontains=q))
        return qs

    def perform_update(self, serializer):
        old = serializer.instance.status
        order = serializer.save()
        if order.status == "canceled" and old not in ("canceled", "refunded"):
            service.restock(order)  # the reserved stock goes back
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


# ── public: products ────────────────────────────────────────────────────────
def _public_product(p, full=False):
    imgs = [{"url": media_url(i.media), "alt": i.alt or p.name} for i in p.images.all() if i.media_id]
    out = {"id": p.id, "name": p.name, "slug": p.slug, "price": str(p.price), "summary": p.summary, "image": imgs[0] if imgs else None,
           "stock": "out" if p.stock == 0 else ("low" if p.stock is not None and p.stock <= 5 else "in"),
           "group": {"name": p.group.name, "slug": p.group.slug} if p.group_id and p.group.active else None}
    if full:
        out.update(description=p.description, sku=p.sku, images=imgs, max_quantity=p.stock)
    return out


@api_view(["GET"])
@permission_classes([AllowAny, module_required("products")])
def public_groups(request):
    groups = ProductGroup.objects.filter(active=True).annotate(n=Count("products", filter=Q(products__active=True)))
    return Response([{"id": g.id, "name": g.name, "slug": g.slug, "description": g.description, "image": media_url(g.media),
                      "parent": g.parent.slug if g.parent_id else None, "count": g.n} for g in groups.select_related("parent", "media")])


@api_view(["GET"])
@permission_classes([AllowAny, module_required("products")])
def public_products(request):
    qs = Product.objects.filter(active=True).select_related("group").prefetch_related("images__media")
    if g := request.query_params.get("group"):
        group = ProductGroup.objects.filter(slug=g, active=True).first()
        ids = [group.id, *group.children.values_list("id", flat=True)] if group else []
        qs = qs.filter(group_id__in=ids)
    if q := request.query_params.get("q"):
        qs = qs.filter(Q(name__icontains=q) | Q(summary__icontains=q))
    return Response([_public_product(p) for p in qs[:200]])


@api_view(["GET"])
@permission_classes([AllowAny, module_required("products")])
def public_product(request, slug):
    p = Product.objects.filter(slug=slug, active=True).select_related("group").prefetch_related("images__media").first()
    if not p:
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response(_public_product(p, full=True))


@api_view(["POST"])
@permission_classes([AllowAny, module_required("products")])
def cart_lines(request):
    """Current price/stock of the products in a cart (the browser only stores ids and quantities)."""
    ids = [i for i in request.data.get("ids", []) if isinstance(i, int)][:50]
    prods = Product.objects.filter(id__in=ids, active=True).prefetch_related("images__media")
    return Response([_public_product(p, full=True) for p in prods])


# ── public: webshop / orders ────────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([AllowAny, module_required("orders")])
def public_config(request):
    s = service.settings()
    return Response({"currency": s["currency"], "prices_include_vat": s["prices_include_vat"], "pay_online": s["pay_online"],
                     "payment_available": sandbox.active("payments"), "discounts": DiscountCode.objects.filter(active=True).exists()})


@api_view(["GET"])
@permission_classes([AllowAny, module_required("orders")])
def public_methods(request):
    return Response([{"id": m.id, "name": m.name, "description": m.description, "delivery_time": m.delivery_time, "price": str(m.price),
                      "free_from": str(m.free_from) if m.free_from is not None else None} for m in service.methods_for(request.query_params.get("country", "NL"))])


@api_view(["POST"])
@permission_classes([AllowAny, module_required("orders", "products")])
def public_quote(request):
    """Totals for the cart (server side): lines, discount code, shipping method, VAT."""
    b = request.data
    try:
        method = b.get("method")
        qt = service.quote(b.get("items") or [], str(b.get("code") or ""), method if isinstance(method, int) else None, str(b.get("country") or "NL"))
    except service.OrderError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(service.quote_json(qt))


FIELDS = {"name": 150, "email": 254, "phone": 30, "street": 200, "postal_code": 20, "city": 100, "country": 2, "note": 1000}
REQUIRED = ["name", "email", "street", "postal_code", "city", "country"]


@api_view(["POST"])
@permission_classes([AllowAny, module_required("orders", "products")])
def create_order(request):
    from apps.security.countries import COUNTRY_CODES
    from apps.security.words import find_forbidden

    b = request.data
    data = {k: str(b.get(k, "")).strip()[:n] for k, n in FIELDS.items()}
    missing = [k for k in REQUIRED if not data[k]]
    if missing or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", data["email"]) or data["country"].upper() not in COUNTRY_CODES:
        return Response({"detail": "Controleer je gegevens: naam, e-mail en het volledige adres zijn verplicht."}, status=status.HTTP_400_BAD_REQUEST)
    data["country"] = data["country"].upper()
    if find_forbidden(data["note"]):
        return Response({"detail": "Je opmerking bevat niet toegestane woorden."}, status=status.HTTP_400_BAD_REQUEST)
    s = service.settings()
    online = s["pay_online"]
    if online and not sandbox.active("payments"):
        return Response({"detail": "Online betalen is nog niet beschikbaar."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    try:
        method = b.get("method")
        order = service.create_order(data, b.get("items") or [], method if isinstance(method, int) else None, str(b.get("code") or ""),
                                     user=request.user if request.user.is_authenticated else None)
    except service.OrderError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    payment = None
    if online:
        return_url = f"{str(b.get('return_base', '')).rstrip('/')}/bestelling/{order.number}?t={order.token}" if b.get("return_base") else ""
        payment = sandbox.create_payment(order.total, order.currency, f"Bestelling {order.number}", "mollie", return_url)
        order.status, order.payment_ref = "pending_payment", payment.ref
        order.save(update_fields=["status", "payment_ref"])
    else:
        service.confirmation_mail(order)  # pay by invoice: confirmed right away
    return Response({"number": order.number, "token": order.token, "status": order.status,
                     "checkout_path": f"/sandbox/checkout/{payment.ref}" if payment else None}, status=status.HTTP_201_CREATED)


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
