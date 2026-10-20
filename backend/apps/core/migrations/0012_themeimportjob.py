import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("core", "0011_themepack")]

    operations = [
        migrations.CreateModel(
            name="ThemeImportJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("url", models.CharField(max_length=500)),
                ("status", models.CharField(default="running", max_length=10)),
                ("progress", models.PositiveSmallIntegerField(default=0)),
                ("step", models.CharField(blank=True, max_length=120)),
                ("error", models.TextField(blank=True)),
                ("draft", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
