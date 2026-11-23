# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations


def on(apps, schema_editor):
    """Two-step verification (OTP) is ON by default in every implementation: an older installation that has it stored as off gets the default (on) back. A superadmin can switch it off again afterwards."""
    S = apps.get_model("security", "SecuritySettings")
    row = S.objects.filter(pk=1).first()
    if row and isinstance(row.data, dict) and isinstance(row.data.get("twofa"), dict) and row.data["twofa"].get("enabled") is False:
        row.data["twofa"].pop("enabled")
        row.save(update_fields=["data"])
    M = apps.get_model("core", "ModuleState")
    M.objects.filter(key__in=["twofa", "communication"], enabled=False).update(enabled=True)


class Migration(migrations.Migration):
    dependencies = [("security", "0001_initial"), ("core", "0060_entity_payments")]
    operations = [migrations.RunPython(on, migrations.RunPython.noop)]
