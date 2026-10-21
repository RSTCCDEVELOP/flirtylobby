from django.conf import settings
from django.db import models


class BackupSettings(models.Model):
    """Singleton (pk=1), set by a superadmin: how many backups there may be per kind, and whether API keys and other secrets go into a backup."""

    max_daily = models.PositiveSmallIntegerField(default=7)
    max_weekly = models.PositiveSmallIntegerField(default=4)
    max_monthly = models.PositiveSmallIntegerField(default=12)
    max_manual = models.PositiveSmallIntegerField(default=5)
    include_secrets = models.BooleanField(default=False)

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]

    def limit(self, frequency):
        return {"daily": self.max_daily, "weekly": self.max_weekly, "monthly": self.max_monthly, "manual": self.max_manual}.get(frequency, 3)


class BackupJob(models.Model):
    """One automatic backup per kind: every day, every week or every month. `keep` = how many of its backups are kept (never more than the limit of the superadmin)."""

    FREQ = [("daily", "Per dag"), ("weekly", "Per week"), ("monthly", "Per maand")]
    frequency = models.CharField(max_length=8, choices=FREQ, unique=True)
    enabled = models.BooleanField(default=False)
    hour = models.PositiveSmallIntegerField(default=3)  # 0-23, local time of the website
    weekday = models.PositiveSmallIntegerField(default=0)  # weekly: 0 = Monday
    day = models.PositiveSmallIntegerField(default=1)  # monthly: 1-28
    keep = models.PositiveSmallIntegerField(default=7)
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=10, blank=True)  # ok | failed
    last_error = models.TextField(blank=True)


class Backup(models.Model):
    """A backup file in the backups folder."""

    frequency = models.CharField(max_length=8)  # daily | weekly | monthly | manual | restore (made automatically just before a restore)
    file = models.CharField(max_length=200, unique=True)
    size = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    note = models.CharField(max_length=200, blank=True)
    parts = models.JSONField(default=list, blank=True)  # [{"key", "label"}] what is in it
    stats = models.JSONField(default=dict, blank=True)
    system_version = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
