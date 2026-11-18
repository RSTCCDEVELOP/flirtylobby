from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0048_reseller_login_access")]

    operations = [
        migrations.AddField(model_name="reseller", name="email", field=models.EmailField(blank=True, max_length=254)),
        migrations.AddField(model_name="reseller", name="phone", field=models.CharField(blank=True, max_length=30)),
    ]
