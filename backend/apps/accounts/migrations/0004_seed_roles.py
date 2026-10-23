# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations

from apps.accounts.perms import DEFAULT_ROLES


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for i, (slug, name, desc, perms) in enumerate(DEFAULT_ROLES):
        Role.objects.get_or_create(slug=slug, defaults={"name": name, "description": desc, "permissions": perms, "order": i})


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_roles")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
