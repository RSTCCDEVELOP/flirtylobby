from django.db import migrations

OPTIONS = ["Heteroseksueel", "Homoseksueel", "Biseksueel", "Panseksueel", "Anders", "Liever niet zeggen"]


def add_field(apps, schema_editor):
    """The Dating theme gets "Seksuele geaardheid" (search filter on); sites that already use Dating get it too, unless the admin made a field with that key."""
    row = apps.get_model("social", "SocialSettings").objects.filter(pk=1).first()
    prof = (row.data or {}).get("profiles") if row else None
    if not prof or prof.get("theme") != "dating":
        return
    fields = prof.get("fields") or []
    if any(f.get("key") == "orientation" for f in fields):
        return
    at = next((i for i, f in enumerate(fields) if f.get("key") == "religion"), len(fields))
    fields.insert(at, {"key": "orientation", "label": "Seksuele geaardheid", "type": "select", "options": OPTIONS, "unit": "", "required": False,
                       "visibility": "members", "card": False, "filter": True, "group": "Over mij"})
    prof["fields"] = fields
    row.save(update_fields=["data"])


class Migration(migrations.Migration):
    dependencies = [("social", "0015_directroom_langs")]
    operations = [migrations.RunPython(add_field, migrations.RunPython.noop)]
