from django.conf import settings
from django.db import models


class ProductGroup(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.CharField(max_length=500, blank=True)
    media = models.ForeignKey("medialib.MediaItem", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    sku = models.CharField(max_length=60, blank=True)
    summary = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)  # sanitized HTML
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(null=True, blank=True)  # None = unlimited
    vat_rate = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)  # None = default rate of the shop
    group = models.ForeignKey(ProductGroup, null=True, blank=True, on_delete=models.SET_NULL, related_name="products")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    media = models.ForeignKey("medialib.MediaItem", null=True, on_delete=models.SET_NULL, related_name="+")
    alt = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class ShippingMethod(models.Model):
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=200, blank=True)
    delivery_time = models.CharField(max_length=60, blank=True)  # e.g. "1-2 werkdagen"
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)  # incl. VAT
    free_from = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # free above this subtotal
    countries = models.JSONField(default=list, blank=True)  # empty = all countries
    active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]


class DiscountCode(models.Model):
    KINDS = [("percent", "Percentage"), ("fixed", "Vast bedrag")]
    code = models.CharField(max_length=40, unique=True)
    description = models.CharField(max_length=200, blank=True)
    kind = models.CharField(max_length=10, choices=KINDS, default="percent")
    value = models.DecimalField(max_digits=8, decimal_places=2)
    min_subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ShopSettings(models.Model):
    data = models.JSONField(default=dict, blank=True)


class Order(models.Model):
    STATUSES = [
        ("new", "Nieuw"), ("pending_payment", "Wacht op betaling"), ("paid", "Betaald"), ("processing", "In behandeling"),
        ("shipped", "Verzonden"), ("completed", "Afgerond"), ("canceled", "Geannuleerd"), ("refunded", "Terugbetaald"),
    ]
    number = models.CharField(max_length=20, unique=True, blank=True)
    token = models.CharField(max_length=40)
    status = models.CharField(max_length=20, choices=STATUSES, default="new")
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    street = models.CharField(max_length=200)
    postal_code = models.CharField(max_length=20)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=2, default="NL")
    note = models.TextField(blank=True)
    internal_note = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping_method = models.CharField(max_length=100, blank=True)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_code = models.CharField(max_length=40, blank=True)
    vat_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="EUR")
    payment_ref = models.CharField(max_length=30, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    KINDS = [("shop", "Webshop"), ("subscription", "Abonnement"), ("donation", "Donatie")]
    kind = models.CharField(max_length=12, choices=KINDS, default="shop", db_index=True)
    ref_id = models.PositiveIntegerField(null=True, blank=True)  # subscription / donation this order belongs to
    period_no = models.PositiveIntegerField(default=1)  # 1 = first order of a subscription, 2+ = repeats
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, null=True, on_delete=models.SET_NULL, related_name="+")
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=60, blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=10, decimal_places=2)  # incl. VAT, after discount
    vat_rate = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
