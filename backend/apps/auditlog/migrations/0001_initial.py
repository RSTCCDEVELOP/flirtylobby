from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="LogEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("event", models.CharField(db_index=True, max_length=60)),
                ("category", models.CharField(blank=True, db_index=True, max_length=30)),
                ("level", models.PositiveSmallIntegerField(db_index=True, default=0)),
                ("actor_email", models.CharField(blank=True, max_length=254)),
                ("actor_name", models.CharField(blank=True, max_length=150)),
                ("ip", models.CharField(blank=True, max_length=45)),
                ("target", models.CharField(blank=True, max_length=200)),
                ("detail", models.CharField(blank=True, max_length=500)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
