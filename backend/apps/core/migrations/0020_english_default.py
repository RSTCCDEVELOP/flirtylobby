# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations


def english_default(apps, schema_editor):
    """English is the standard language of the system (and cannot be removed). Only when the default is still Dutch, i.e. nobody chose another one."""
    Language = apps.get_model("core", "Language")
    en = Language.objects.filter(code="en").first()
    if en and Language.objects.filter(is_default=True, code="nl").exists():
        Language.objects.update(is_default=False)
        en.is_default = en.enabled = True
        en.save(update_fields=["is_default", "enabled"])


class Migration(migrations.Migration):
    dependencies = [("core", "0019_component_prices")]
    operations = [migrations.RunPython(english_default, migrations.RunPython.noop)]
