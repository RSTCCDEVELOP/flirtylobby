# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net


# The website FAQ (FaqEntry) is the plugin FAQ now: the table is not dropped (the plugin renames it and keeps the questions), only Django forgets the model.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("faq", "0002_helptip"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(state_operations=[migrations.DeleteModel(name="FaqEntry")]),
    ]
