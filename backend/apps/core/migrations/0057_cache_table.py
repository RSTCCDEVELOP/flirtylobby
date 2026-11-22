# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The table of the database cache (the standard cache, shared by all workers): same layout as `manage.py createcache`, made here so it is always there (also when another cache is chosen first and the database cache later)."""
from django.db import migrations, models


def make(apps, schema_editor):
    if "django_cache" in schema_editor.connection.introspection.table_names():
        return

    class Entry(models.Model):
        cache_key = models.CharField(max_length=255, unique=True, primary_key=True)
        value = models.TextField()
        expires = models.DateTimeField(db_index=True)

        class Meta:
            app_label = "core"
            db_table = "django_cache"

    schema_editor.create_model(Entry)


class Migration(migrations.Migration):
    dependencies = [("core", "0056_component_requests")]
    operations = [migrations.RunPython(make, migrations.RunPython.noop)]
