from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0051_reseller_contacts_default")]

    operations = [
        migrations.AddField(model_name="resellerlogin", name="function", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="resellerlogin", name="phone", field=models.CharField(blank=True, max_length=30)),
        migrations.AddField(model_name="resellerlogin", name="mobile", field=models.CharField(blank=True, max_length=30)),
        migrations.AddField(model_name="resellerlogin", name="otp", field=models.CharField(default="email", max_length=5)),
        migrations.AddField(model_name="resellerlogin", name="all_sites", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="resellerlogin", name="site_ids", field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name="resellerlogin", name="host", field=models.BooleanField(default=True)),
    ]
