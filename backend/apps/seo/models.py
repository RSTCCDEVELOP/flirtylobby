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
