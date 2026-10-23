# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.conf import settings
from django.db import models

U = settings.AUTH_USER_MODEL


class Notification(models.Model):
    """A message for one user (from the system or from a module): shown in the bell, on the notifications page and, if wanted, by e-mail."""

    LEVELS = [("info", "Info"), ("success", "Gelukt"), ("warning", "Let op"), ("danger", "Belangrijk")]
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="inbox")
    kind = models.CharField(max_length=60, db_index=True)  # key of a kind in registry.KINDS
    module = models.CharField(max_length=40, blank=True)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    url = models.CharField(max_length=300, blank=True)  # where a click leads (an address of the site)
    level = models.CharField(max_length=8, choices=LEVELS, default="info")
    from_user = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    data = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    emailed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class NotificationPref(models.Model):
    """What one user wants for one kind of notification (no row = the default of the administrator)."""

    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="notification_prefs")
    kind = models.CharField(max_length=60)
    show = models.BooleanField(default=True)  # see it in the bell and on the page
    email = models.BooleanField(default=False)  # also an e-mail

    class Meta:
        unique_together = ("user", "kind")


class NotificationSettings(models.Model):
    """Singleton (pk=1): how notifications work in this system (layout, toasts, retention, e-mail, defaults per kind)."""

    data = models.JSONField(default=dict, blank=True)
