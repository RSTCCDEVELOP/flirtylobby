from django.db import models


class SecuritySettings(models.Model):
    """Singleton (pk=1). `data` holds only values that differ from defaults.py."""

    data = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Security settings"


class LoginThrottle(models.Model):
    key = models.CharField(max_length=300, unique=True)  # "<ip>|<email>"
    failures = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
