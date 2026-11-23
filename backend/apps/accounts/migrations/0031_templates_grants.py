# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The templates got their own module (Templates): whoever had access to the pages keeps access to the templates, with the same level."""
from django.db import migrations


def copy(apps, schema_editor):
    Grant = apps.get_model("accounts", "ModuleGrant")
    for g in list(Grant.objects.filter(module="pages")):
        for field in ("role", "group", "user"):
            if getattr(g, f"{field}_id"):
                Grant.objects.get_or_create(module="templates", **{field: getattr(g, field)}, defaults={"level": g.level})


class Migration(migrations.Migration):
    dependencies = [("accounts", "0030_phone_to_mobile")]
    operations = [migrations.RunPython(copy, migrations.RunPython.noop)]
