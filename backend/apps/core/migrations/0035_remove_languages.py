# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations

# easy2edit offers 16 languages (nl, en, de, fr, es, it, pt, pl, tr, ar, uk, ru, hi, zh, ja, id). These 28 are no longer offered: the language is taken out of Admin -> Talen.
REMOVED = ["af", "bg", "bn", "ca", "cs", "da", "el", "et", "fa", "fi", "he", "hr", "hu", "ko", "lt", "lv", "ms", "no", "ro", "sk", "sl", "sr", "sv", "sw", "th", "tl", "ur", "vi"]


def remove(apps, schema_editor):
    Language = apps.get_model("core", "Language")
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first()
    Language.objects.filter(code__in=[c for c in REMOVED if c != default]).delete()  # the default language of a site always stays


class Migration(migrations.Migration):
    dependencies = [("core", "0034_sitesettings_component_set")]
    operations = [migrations.RunPython(remove, migrations.RunPython.noop)]
