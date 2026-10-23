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
