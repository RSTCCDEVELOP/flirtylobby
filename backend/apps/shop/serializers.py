from decimal import Decimal

from django.core.files.storage import default_storage
from rest_framework import serializers

from apps.core import richtext
from apps.medialib.models import MediaItem
from apps.security.words import validate_no_forbidden_words

from . import service
from .models import DiscountCode, Order, OrderItem, Product, ProductGroup, ProductImage, ShippingMethod


def media_url(media):
    return default_storage.url(media.key) if media else None


class ProductGroupSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductGroup
        fields = ["id", "name", "slug", "description", "media", "image", "parent", "order", "active", "product_count"]
        read_only_fields = ["slug"]
        extra_kwargs = {"name": {"validators": [validate_no_forbidden_words]}}

    def get_image(self, obj):
        return media_url(obj.media)

    def validate_parent(self, value):
        if self.instance and value and (value.pk == self.instance.pk or value.parent_id == self.instance.pk):
            raise serializers.ValidationError("Een groep kan niet onder zichzelf vallen.")
        return value

    def create(self, validated):
        validated["slug"] = service.unique_slug(ProductGroup, validated["name"])
        return super().create(validated)


class ProductSerializer(serializers.ModelSerializer):
    images = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default="")

    class Meta:
        model = Product
        fields = ["id", "name", "slug", "sku", "summary", "description", "price", "stock", "vat_rate", "group", "group_name", "active", "images"]
        read_only_fields = ["slug"]
        extra_kwargs = {"name": {"validators": [validate_no_forbidden_words]}, "summary": {"validators": [validate_no_forbidden_words]}}

    def to_representation(self, obj):
        data = super().to_representation(obj)
        data["images"] = [{"media": i.media_id, "url": media_url(i.media), "alt": i.alt} for i in obj.images.select_related("media")]
        return data

    def validate_price(self, v):
        if v < 0 or v > Decimal("100000"):
            raise serializers.ValidationError("Prijs tussen 0 en 100.000.")
        return v

    def validate_stock(self, v):
        if v is not None and v < 0:
            raise serializers.ValidationError("Voorraad kan niet negatief zijn.")
        return v

    def validate_description(self, v):
        return richtext.clean(v)

    def _set_images(self, product, images):
        if images is None:
            return
        ProductImage.objects.filter(product=product).delete()
        for n, im in enumerate(images[:12]):
            if MediaItem.objects.filter(pk=im.get("media"), kind="image").exists():
                ProductImage.objects.create(product=product, media_id=im["media"], alt=str(im.get("alt", ""))[:200], order=n)

    def create(self, validated):
        images = validated.pop("images", None)
        validated["slug"] = service.unique_slug(Product, validated["name"])
        product = super().create(validated)
        self._set_images(product, images)
        return product

    def update(self, instance, validated):
        images = validated.pop("images", None)
        product = super().update(instance, validated)
        self._set_images(product, images)
        return product


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


class ShippingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingMethod
        fields = ["id", "name", "description", "delivery_time", "price", "free_from", "countries", "active", "order"]

    def validate_countries(self, v):
        from apps.security.countries import COUNTRY_CODES

        codes = [str(c).upper() for c in v]
        if any(c not in COUNTRY_CODES for c in codes):
            raise serializers.ValidationError("Onbekende landcode.")
        return codes

    def validate_price(self, v):
        if v < 0:
            raise serializers.ValidationError("Prijs kan niet negatief zijn.")
        return v


class DiscountCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountCode
        fields = ["id", "code", "description", "kind", "value", "min_subtotal", "max_uses", "used_count", "starts_at", "ends_at", "active"]
        read_only_fields = ["used_count"]

    def validate_code(self, v):
        v = v.strip().upper().replace(" ", "")
        if not v.replace("-", "").replace("_", "").isalnum():
            raise serializers.ValidationError("Alleen letters, cijfers, - en _.")
        return v

    def validate(self, a):
        kind, value = a.get("kind", getattr(self.instance, "kind", "percent")), a.get("value", getattr(self.instance, "value", 0))
        if kind == "percent" and not 0 < value <= 100:
            raise serializers.ValidationError({"value": "Percentage tussen 0 en 100."})
        if kind == "fixed" and value <= 0:
            raise serializers.ValidationError({"value": "Bedrag moet groter dan 0 zijn."})
        return a
