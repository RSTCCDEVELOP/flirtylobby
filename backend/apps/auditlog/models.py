# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.conf import settings
from django.db import models


class LogEntry(models.Model):
    """One line of the log (Logboek): who did what, when and from where. `level` is the rank of the person who did it (0 user, 1 admin, 2 superadmin, 3 superadmin+): a line is only
    shown to people of that rank or higher, so an admin never reads the lines of a superadmin."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    event = models.CharField(max_length=60, db_index=True)  # auth.login, auth.logout, auth.login_failed, user.created ... (see service.EVENTS)
    category = models.CharField(max_length=30, db_index=True, blank=True)
    level = models.PositiveSmallIntegerField(default=0, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    actor_email = models.CharField(max_length=254, blank=True)  # kept as text: the line stays readable when the account is gone
    actor_name = models.CharField(max_length=150, blank=True)
    ip = models.CharField(max_length=45, blank=True)
    target = models.CharField(max_length=200, blank=True)  # what it was about (an e-mail address, a module, a page ...)
    detail = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
