from django.db import migrations


def clean(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for r in Role.objects.all():
        perms = [p for p in r.permissions if p != "members.manage"]
        if perms != r.permissions or r.slug == "moderator":
            r.permissions = perms
            if r.slug == "moderator":
                r.description = "Heeft toegang tot moderatie."
            r.save()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0007_user_photo_public")]
    operations = [migrations.RunPython(clean, migrations.RunPython.noop)]
