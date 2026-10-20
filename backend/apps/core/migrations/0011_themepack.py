from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0010_usershortcuts")]

    operations = [
        migrations.CreateModel(
            name="ThemePack",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.SlugField(max_length=40, unique=True)),
                ("enabled", models.BooleanField(default=False)),
                ("manifest", models.JSONField(blank=True, default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["key"]},
        ),
    ]
