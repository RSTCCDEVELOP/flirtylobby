# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models

KINDS = [("email_from", "Afzender-e-mailadres"), ("email_reply", "Antwoord-e-mailadres"), ("mobile", "Mobiel nummer")]
PURPOSES = [("all", "Alles"), ("security", "Beveiliging (inlogcodes)"), ("notifications", "Meldingen"),
            ("contact", "Contact en support"), ("marketing", "Marketing")]


class CommAddress(models.Model):
    """An e-mail address or mobile number the system may use to communicate."""

    kind = models.CharField(max_length=15, choices=KINDS)
    label = models.CharField(max_length=100)
    value = models.CharField(max_length=254)  # e-mail address, or +E.164 phone number
    purpose = models.CharField(max_length=15, choices=PURPOSES, default="all")
    enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)  # one default per kind

    class Meta:
        ordering = ["kind", "-is_default", "label"]
        constraints = [models.UniqueConstraint(fields=["kind", "value"], name="uniq_comm_value")]

    def __str__(self):
        return f"{self.label} <{self.value}>"


class EmailSettings(models.Model):
    """How system e-mails look (one row): HTML or plain text, and the design (follow the theme, or own settings)."""

    data = models.JSONField(default=dict, blank=True)  # only values that differ from the defaults
