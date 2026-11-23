# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models


class SandboxSettings(models.Model):
    """Singleton (pk=1)."""

    data = models.JSONField(default=dict, blank=True)


class SandboxMessage(models.Model):
    """An e-mail or sms that was NOT sent because the sandbox is on (the 'sandbox inbox')."""

    kind = models.CharField(max_length=10)  # email | sms
    to = models.CharField(max_length=254)
    sender = models.CharField(max_length=254, blank=True)
    subject = models.CharField(max_length=300, blank=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class SandboxPayment(models.Model):
    """A simulated payment (no money, no external API)."""

    STATUSES = ["open", "paid", "failed", "canceled", "expired", "refunded"]

    ref = models.CharField(max_length=20, unique=True)
    provider = models.CharField(max_length=20, default="mollie")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    description = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, default="open")
    return_url = models.CharField(max_length=500, blank=True)
    events = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class DemoSettings(models.Model):
    """Demo mode (singleton, pk=1). NOT part of a backup, so a restore of the demo never changes the demo settings themselves."""

    enabled = models.BooleanField(default=False)
    backup = models.ForeignKey("backups.Backup", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")  # the backup that is put back at the planned times
    times = models.JSONField(default=list, blank=True)  # ["03:00", "13:00"]: local time of the website, several per day
    warn_minutes = models.PositiveSmallIntegerField(default=2)  # how long before a restore the visitors see a message
    show_on_login = models.BooleanField(default=True)  # the demo users (with password) are shown on the login page
    last_restore_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=10, blank=True)  # ok | failed
    last_error = models.TextField(blank=True)


class DemoUser(models.Model):
    """A demo user: kept apart from the real users (and out of the backups) so it can be made again after every restore, with the same password and rights."""

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    password = models.CharField(max_length=128)  # readable on purpose: it is shown on the login page of the demo
    note = models.CharField(max_length=120, blank=True)  # what this user can do ("Beheerder", "Lid" ...), shown on the login page
    roles = models.JSONField(default=list, blank=True)  # names of roles
    groups = models.JSONField(default=list, blank=True)  # names of groups
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class DemoEntity(models.Model):
    """A demo company (entity): made again after every restore with the same data and the same demo users linked to it. Not part of a backup."""

    name = models.CharField(max_length=120, unique=True)
    kind = models.CharField(max_length=20, default="bedrijf")
    legal_name = models.CharField(max_length=160, blank=True)
    email = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    website = models.CharField(max_length=200, blank=True)
    street = models.CharField(max_length=120, blank=True)
    house_number = models.CharField(max_length=20, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, blank=True)
    members = models.JSONField(default=list, blank=True)  # e-mail addresses of demo users that belong to it
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
