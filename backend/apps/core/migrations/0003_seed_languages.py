# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations

LANGUAGES = [
    ("nl", "Nederlands", "Nederlands", False),
    ("en", "Engels", "English", False),
    ("zh", "Chinees", "中文", False),
    ("ar", "Arabisch", "العربية", True),
    ("pt", "Portugees", "Português", False),
    ("es", "Spaans", "Español", False),
    ("de", "Duits", "Deutsch", False),
    ("fr", "Frans", "Français", False),
]


def seed(apps, schema_editor):
    Language = apps.get_model("core", "Language")
    for i, (code, name, native, rtl) in enumerate(LANGUAGES):
        Language.objects.get_or_create(
            code=code,
            defaults={"name": name, "native_name": native, "rtl": rtl, "order": i,
                      "enabled": code == "nl", "is_default": code == "nl"},
        )


class Migration(migrations.Migration):
    dependencies = [("core", "0002_language")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
