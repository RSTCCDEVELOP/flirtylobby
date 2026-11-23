# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations


def remove(apps, schema_editor):
    """The link "Google adressen" is gone: a link of that kind that was made is removed."""
    apps.get_model("integrations", "Integration").objects.filter(provider="google_adres").delete()


class Migration(migrations.Migration):
    dependencies = [("integrations", "0014_integration_locked")]
    operations = [migrations.RunPython(remove, migrations.RunPython.noop)]
