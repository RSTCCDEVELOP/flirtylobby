# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.update_or_create(
        slug="admin",
        defaults={"name": "Admin", "description": "Alle beheerrechten. Kan geen superadmins zien of wijzigen.",
                  "permissions": [], "all_permissions": True, "locked": True, "order": 0},
    )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_role_flags")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
