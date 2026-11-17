# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0036_modulestate_owner_only")]
    operations = [
        migrations.CreateModel(
            name="EasySite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("instance_id", models.CharField(max_length=40, unique=True)),
                ("name", models.CharField(blank=True, max_length=150)),
                ("url", models.CharField(blank=True, max_length=300)),
                ("url_generated", models.BooleanField(default=False)),
                ("ip", models.GenericIPAddressField(blank=True, null=True)),
                ("seen_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("version", models.CharField(blank=True, max_length=30)),
                ("build", models.CharField(blank=True, max_length=20)),
                ("token_hash", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(default="active", max_length=10)),
                ("first_seen", models.DateTimeField(auto_now_add=True)),
                ("last_seen", models.DateTimeField(blank=True, null=True)),
                ("last_login_at", models.DateTimeField(blank=True, null=True)),
                ("last_login_role", models.CharField(blank=True, max_length=20)),
                ("login_count", models.PositiveIntegerField(default=0)),
                ("notes", models.TextField(blank=True)),
            ],
            options={"ordering": ["-last_seen", "-first_seen"]},
        ),
    ]
