from django.db import models

from . import crypto


class Integration(models.Model):
    name = models.CharField(max_length=100)
    # Stable key that portal features refer to, e.g. is_active("anthropic")
    slug = models.SlugField(max_length=50, unique=True)
    provider = models.CharField(max_length=30)
    enabled = models.BooleanField(default=False)
    config_encrypted = models.TextField(blank=True)  # all settings incl. secrets, encrypted at rest
    last_test_ok = models.BooleanField(null=True, blank=True)
    last_test_at = models.DateTimeField(null=True, blank=True)
    last_test_message = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def config(self):
        return crypto.decrypt(self.config_encrypted)

    @config.setter
    def config(self, value):
        self.config_encrypted = crypto.encrypt(value)
