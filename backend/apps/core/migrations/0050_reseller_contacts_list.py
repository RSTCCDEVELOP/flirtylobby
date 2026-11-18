from django.db import migrations


def to_list(apps, schema_editor):
    """The contact persons were {sales|financial|support: {...}}: now a list of persons (more than one is possible)."""
    Reseller = apps.get_model("core", "Reseller")
    for r in Reseller.objects.all():
        if isinstance(r.contacts, dict):
            r.contacts = [{**(v or {}), "id": f"{k}-{r.pk}", "role": k, "same_address": True, "address": {}} for k, v in r.contacts.items() if any(str((v or {}).get(f) or "").strip() for f in ("name", "email", "phone"))]
            r.save(update_fields=["contacts"])


class Migration(migrations.Migration):
    dependencies = [("core", "0049_reseller_email_phone")]

    operations = [migrations.RunPython(to_list, migrations.RunPython.noop)]
