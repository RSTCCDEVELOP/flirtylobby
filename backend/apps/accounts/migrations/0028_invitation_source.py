# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0027_user_payments'),
    ]

    operations = [
        migrations.AddField(
            model_name='invitation',
            name='after_path',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='invitation',
            name='context',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='invitation',
            name='source',
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
