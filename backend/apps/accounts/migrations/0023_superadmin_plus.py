# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations, models

DEFAULT_EMAILS = ("ronald@rstcc.net", "admin@easy2edit.com")


def mark(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for email in DEFAULT_EMAILS:
        User.objects.filter(email__iexact=email).update(is_staff=True, is_superuser=True, is_superadmin_plus=True)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0022_password_reset")]
    operations = [
        migrations.AddField(model_name="user", name="is_superadmin_plus", field=models.BooleanField(default=False)),
        migrations.RunPython(mark, migrations.RunPython.noop),
    ]
