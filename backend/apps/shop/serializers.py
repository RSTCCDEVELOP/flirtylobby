from rest_framework import serializers

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "name", "sku", "unit_price", "quantity", "line_total", "vat_rate", "vat_amount"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["id", "number", "status", "status_label", "name", "email", "phone", "street", "postal_code", "city", "country", "note",
                  "internal_note", "subtotal", "shipping", "shipping_method", "discount", "discount_code", "vat_total", "total", "currency", "payment_ref", "created_at", "items", "kind", "ref_id", "period_no"]
        read_only_fields = [f for f in fields if f not in ("status", "internal_note")]

    def get_status_label(self, obj):
        return dict(Order.STATUSES)[obj.status]
