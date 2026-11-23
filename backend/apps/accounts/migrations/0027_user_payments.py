# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0026_rights'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='billing_entity',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='payments_enc',
            field=models.TextField(blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='user',
            name='pays_via_company',
            field=models.BooleanField(default=False),
        ),
    ]
