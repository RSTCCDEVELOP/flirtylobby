# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models


class HelpTip(models.Model):
    """The explanation that pops up in help mode while editing a page (the "?" icon): an administrator can change the text per language. No row = the standard text."""

    key = models.CharField(max_length=60, unique=True)
    texts = models.JSONField(default=dict, blank=True)  # {"nl": "...", "en": "..."}
    updated_at = models.DateTimeField(auto_now=True)
