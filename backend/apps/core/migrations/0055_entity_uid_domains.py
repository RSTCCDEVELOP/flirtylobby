# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A unique id, the domains and the id on the easy2edit server for entity."""
import uuid

from django.db import migrations, models


def fill(apps, schema_editor):
    M = apps.get_model("core", "Entity")
    for row in M.objects.filter(uid__isnull=True):
        M.objects.filter(pk=row.pk).update(uid=uuid.uuid4())  # one id per existing row (a default would give every row the same)


class Migration(migrations.Migration):

    dependencies = [("core", "0054_tags_and_colours")]

    operations = [
        migrations.AddField(model_name="entity", name="uid", field=models.UUIDField(null=True, editable=False)),
        migrations.AddField(model_name="entity", name="domains", field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name="entity", name="remote_id", field=models.CharField(blank=True, editable=False, max_length=40)),
        migrations.RunPython(fill, migrations.RunPython.noop),
        migrations.AlterField(model_name="entity", name="uid", field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
    ]
