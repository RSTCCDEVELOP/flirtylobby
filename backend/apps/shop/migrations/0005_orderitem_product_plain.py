from django.db import migrations, models


class Migration(migrations.Migration):
    """The products moved to the webshop plugin: an order line only remembers the product number (no link to a table of the system)."""

    dependencies = [("shop", "0004_order_kind_order_period_no_order_ref_id")]

    operations = [
        migrations.AlterField(model_name="orderitem", name="product", field=models.PositiveIntegerField(blank=True, null=True)),
    ]
