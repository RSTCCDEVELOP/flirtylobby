from django.db import models


class Plugin(models.Model):
    """An installed plugin: a separate program that lives in <PLUGINS_DIR>/<name>/ and works together with the system."""

    name = models.SlugField(max_length=40, unique=True)  # folder name
    title = models.CharField(max_length=100)
    version = models.CharField(max_length=30, blank=True)
    description = models.TextField(blank=True)
    author = models.CharField(max_length=100, blank=True)
    manifest = models.JSONField(default=dict)
    enabled = models.BooleanField(default=False)  # switched on by a superadmin; off after every upload
    config = models.JSONField(default=dict, blank=True)  # settings; secret fields are stored encrypted (see installer.py)
    schema_version = models.PositiveIntegerField(default=0)  # version of the plugin's tables in the system database
    error = models.TextField(blank=True)  # last problem while loading or running
    installed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
