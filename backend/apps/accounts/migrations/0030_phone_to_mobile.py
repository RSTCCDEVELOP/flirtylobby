# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations
from django.db.models import F


def copy(apps, schema_editor):
    """Two-step verification and every code by SMS now go to the mobile number: the number that was kept in the phone field (the number for SMS) is copied to it, so nobody loses the SMS code."""
    apps.get_model("accounts", "User").objects.filter(mobile="").exclude(phone="").update(mobile=F("phone"))


class Migration(migrations.Migration):
    dependencies = [("accounts", "0029_user_mobile")]
    operations = [migrations.RunPython(copy, migrations.RunPython.noop)]
