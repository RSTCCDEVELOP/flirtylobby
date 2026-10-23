# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models


class SeoSettings(models.Model):
    """Singleton (pk=1): site-wide SEO settings, only values that differ from defaults."""

    data = models.JSONField(default=dict, blank=True)


class SeoPage(models.Model):
    """Search/social settings of one page in one language."""

    path = models.CharField(max_length=200)  # "/" , "/privacy", ...
    lang = models.CharField(max_length=10)
    title = models.CharField(max_length=200, blank=True)
    description = models.CharField(max_length=400, blank=True)
    og_media = models.ForeignKey("medialib.MediaItem", null=True, blank=True, on_delete=models.SET_NULL)
    noindex = models.BooleanField(default=False)
    canonical = models.CharField(max_length=300, blank=True)

    class Meta:
        unique_together = ("path", "lang")
        ordering = ["path", "lang"]
