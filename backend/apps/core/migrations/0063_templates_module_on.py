# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The module Templates is new and must be ON: a site where an installation was set before the module existed has it switched off (it was not in the list of that installation)."""
from django.db import migrations


def switch_on(apps, schema_editor):
    State = apps.get_model("core", "ModuleState")
    State.objects.update_or_create(key="templates", defaults={"enabled": True})


class Migration(migrations.Migration):
    dependencies = [("core", "0062_notes")]
    operations = [migrations.RunPython(switch_on, migrations.RunPython.noop)]
