# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations


def allow_sms(apps, schema_editor):
    """A code by SMS is allowed by default now (it is only offered when an SMS link of the API keys is on and tested): an older stored "off" gets the default back."""
    S = apps.get_model("security", "SecuritySettings")
    row = S.objects.filter(pk=1).first()
    if row and isinstance(row.data, dict) and isinstance(row.data.get("twofa"), dict) and row.data["twofa"].get("allow_sms") is False:
        row.data["twofa"].pop("allow_sms")
        row.save(update_fields=["data"])


class Migration(migrations.Migration):
    dependencies = [("security", "0002_twofa_on_by_default")]
    operations = [migrations.RunPython(allow_sms, migrations.RunPython.noop)]
