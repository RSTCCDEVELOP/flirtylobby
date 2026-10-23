# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations


def to_users(apps, schema_editor):
    """Members are now users with a public profile: convert any existing rows (no login possible)."""
    Members = apps.get_model("members", "Members")
    User = apps.get_model("accounts", "User")
    for m in Members.objects.all():
        email = f"member-{m.pk}@members.invalid"
        parts = m.name.split(" ", 1)
        User.objects.get_or_create(email=email, defaults={
            "username": email, "first_name": parts[0][:150], "last_name": (parts[1] if len(parts) > 1 else "")[:150],
            "description": m.description, "image": m.image.name if m.image else "", "show_public": True, "password": "!",
        })


class Migration(migrations.Migration):
    dependencies = [("members", "0001_initial"), ("accounts", "0008_roles_cleanup")]
    operations = [migrations.RunPython(to_users, migrations.RunPython.noop), migrations.DeleteModel(name="Members")]
