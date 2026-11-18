import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0046_license_billed_monthly")]

    operations = [
        migrations.CreateModel(
            name="Reseller",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150)),
                ("active", models.BooleanField(default=True)),
                ("website", models.CharField(blank=True, max_length=300)),
                ("websites", models.JSONField(blank=True, default=list)),
                ("info", models.TextField(blank=True)),
                ("address", models.JSONField(blank=True, default=dict)),
                ("kvk", models.CharField(blank=True, max_length=40)),
                ("vat_id", models.CharField(blank=True, max_length=40)),
                ("contacts", models.JSONField(blank=True, default=dict)),
                ("rst_share", models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="ResellerLogin",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254)),
                ("name", models.CharField(blank=True, max_length=120)),
                ("password_hash", models.CharField(blank=True, max_length=200)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reseller", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="logins", to="core.reseller")),
            ],
            options={"ordering": ["email"]},
        ),
        migrations.AddConstraint(model_name="resellerlogin", constraint=models.UniqueConstraint(fields=("reseller", "email"), name="uniq_reseller_login")),
        migrations.AddField(model_name="easysite", name="reseller", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sites", to="core.reseller")),
    ]
