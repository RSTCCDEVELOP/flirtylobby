from django.db import migrations


class Migration(migrations.Migration):
    """Products, groups, shipping methods and discount codes now belong to the webshop plugin. Their tables stay in the database untouched:
    the plugin copies the rows (with the same numbers) to its own tables the first time it starts."""

    dependencies = [("shop", "0005_orderitem_product_plain")]

    operations = [
        migrations.SeparateDatabaseAndState(state_operations=[
            migrations.DeleteModel("ProductImage"),
            migrations.DeleteModel("Product"),
            migrations.DeleteModel("ProductGroup"),
            migrations.DeleteModel("ShippingMethod"),
            migrations.DeleteModel("DiscountCode"),
        ]),
    ]
