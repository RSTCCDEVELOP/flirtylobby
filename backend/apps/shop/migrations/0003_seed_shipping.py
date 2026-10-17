from decimal import Decimal

from django.db import migrations


def seed(apps, schema_editor):
    """The old single flat shipping cost becomes the first shipping method."""
    ShippingMethod = apps.get_model("shop", "ShippingMethod")
    ShopSettings = apps.get_model("shop", "ShopSettings")
    if ShippingMethod.objects.exists():
        return
    old = (ShopSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {})
    free = Decimal(str(old.get("free_shipping_from", "50.00")))
    ShippingMethod.objects.create(name="Standaard verzending", delivery_time="2-3 werkdagen", price=Decimal(str(old.get("shipping_cost", "4.95"))),
                                  free_from=free if free > 0 else None)


class Migration(migrations.Migration):
    dependencies = [("shop", "0002_vat_discounts_shipping")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
