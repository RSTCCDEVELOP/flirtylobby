from django.db import models


class SiteSettings(models.Model):
    """Singleton (pk=1) holding site-wide settings. `theme` stores only values that differ from the defaults."""

    theme = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name_plural = "Site settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Language(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)  # Dutch name, for the admin
    native_name = models.CharField(max_length=100)
    rtl = models.BooleanField(default=False)
    enabled = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.name


class ContentBlock(models.Model):
    """Editable website text (see the bewerkmodus). One row per key + language."""

    key = models.CharField(max_length=100)
    lang = models.CharField(max_length=10)
    text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("key", "lang")


class ModuleState(models.Model):
    """Switch for a module (see apps/core/modules.py). No row = default (on)."""

    key = models.CharField(max_length=50, unique=True)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
