from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0047_reseller")]

    operations = [migrations.AddField(model_name="resellerlogin", name="access", field=models.CharField(default="admin", max_length=10))]
