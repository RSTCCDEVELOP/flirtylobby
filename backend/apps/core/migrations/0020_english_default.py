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
