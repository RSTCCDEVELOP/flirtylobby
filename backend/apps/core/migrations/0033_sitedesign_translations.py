# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0032_sitedesign_stop")]

    operations = [
        migrations.AddField(model_name="sitedesignjob", name="translations", field=models.JSONField(blank=True, default=dict)),
    ]
