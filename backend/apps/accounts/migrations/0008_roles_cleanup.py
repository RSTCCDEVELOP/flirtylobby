# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations


def clean(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for r in Role.objects.all():
        perms = [p for p in r.permissions if p != "members.manage"]
        if perms != r.permissions or r.slug == "moderator":
            r.permissions = perms
            if r.slug == "moderator":
                r.description = "Heeft toegang tot moderatie."
            r.save()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0007_user_photo_public")]
    operations = [migrations.RunPython(clean, migrations.RunPython.noop)]
