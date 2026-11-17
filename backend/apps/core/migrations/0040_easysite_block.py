# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0039_easysite_api_callback")]
    operations = [
        migrations.AddField(model_name="easysite", name="blocked_offline", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="easysite", name="block_message", field=models.CharField(blank=True, max_length=500)),
    ]
