# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models


class StatDay(models.Model):
    """One counter per day: what happened (event) in which module or plugin (source), with one detail (key: a page, a bot, a country …). Written by every module and plugin through apps.stats.service.record."""

    day = models.DateField(db_index=True)
    source = models.CharField(max_length=60)  # a module key ("users") or "plugin:<name>"
    event = models.CharField(max_length=40)
    key = models.CharField(max_length=200, blank=True)
    count = models.BigIntegerField(default=0)

    class Meta:
        unique_together = [("day", "source", "event", "key")]
        indexes = [models.Index(fields=["source", "event", "day"])]


class StatVisitor(models.Model):
    """A visitor of a day, as a hash (address and browser, with the day and the secret key): counts unique visitors without keeping who they are."""

    day = models.DateField()
    hash = models.CharField(max_length=32)

    class Meta:
        unique_together = [("day", "hash")]
