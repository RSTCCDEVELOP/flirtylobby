from django.conf import settings
from django.db import models


class ShopSettings(models.Model):
    """Orders and payment: currency, VAT, pay online or by invoice. Used by the webshop plugin, subscriptions and donations."""
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
    product = models.PositiveIntegerField(null=True, blank=True)  # id of the product in the webshop plugin (None for subscriptions and donations)
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=60, blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=10, decimal_places=2)  # incl. VAT, after discount
    vat_rate = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
