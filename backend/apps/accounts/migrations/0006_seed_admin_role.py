from django.db import migrations


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.update_or_create(
        slug="admin",
        defaults={"name": "Admin", "description": "Alle beheerrechten. Kan geen superadmins zien of wijzigen.",
                  "permissions": [], "all_permissions": True, "locked": True, "order": 0},
    )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_role_flags")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
