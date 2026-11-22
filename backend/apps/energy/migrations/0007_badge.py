# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("energy", "0006_pruneold")]
    operations = [
        migrations.AddField(model_name="energysettings", name="badge_on", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="energysettings", name="badge_show", field=models.JSONField(blank=True, default=list)),
    ]
