from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0050_reseller_contacts_list")]

    operations = [migrations.AlterField(model_name="reseller", name="contacts", field=models.JSONField(blank=True, default=list))]
