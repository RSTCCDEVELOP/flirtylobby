# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Energy: how much data the pages of this website send and what that costs in energy and CO2 (measured by the visitors' browsers and by our own scan)."""
from django.db import models


class EnergyDay(models.Model):
    """What the visitors' browsers measured: per day and per page the number of views, and the sums of the transferred bytes and requests of those views (no person, no cookie)."""

    day = models.DateField(db_index=True)
    path = models.CharField(max_length=200)
    views = models.PositiveIntegerField(default=0)
    bytes_total = models.BigIntegerField(default=0)
    requests_total = models.BigIntegerField(default=0)
    bytes_max = models.BigIntegerField(default=0)

    class Meta:
        unique_together = [("day", "path")]
        ordering = ["-day", "path"]


class EnergyScan(models.Model):
    """A measurement made by the server itself (a scan of one page with all the files it loads): the page weight without having to wait for visitors."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    path = models.CharField(max_length=200)
    bytes = models.BigIntegerField(default=0)
    requests = models.PositiveIntegerField(default=0)
    breakdown = models.JSONField(default=dict, blank=True)  # {"html": bytes, "script": bytes, "style": ..., "image": ..., "font": ..., "other": ...}
    ok = models.BooleanField(default=True)
    error = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-created_at"]


class EnergySettings(models.Model):
    """One row: the calculation model, what the public API shows, and the pages that are scanned."""

    kwh_per_gb = models.DecimalField(max_digits=6, decimal_places=3, default=0.81)  # energy per GB of data over the whole chain (Sustainable Web Design model)
    g_per_kwh = models.DecimalField(max_digits=7, decimal_places=1, default=442)  # grams CO2 per kWh (world average grid); set the grid of your hosting country for a closer figure
    api_public = models.BooleanField(default=True)  # the figures (totals only, nothing personal) can be read through /api/energy/public/
    api_key = models.CharField(max_length=80, blank=True)  # filled: the API needs this key (X-Energy-Key header or ?key=)
    network_public = models.BooleanField(default=False)  # the combined figures of all connected sites can be read publicly (/api/energy/network/)
    network_title = models.CharField(max_length=120, blank=True)
    scan_paths = models.JSONField(default=list, blank=True)  # the pages that "Meet nu" scans; empty = the start page
    retention_days = models.PositiveSmallIntegerField(default=400)
    objects_seeded = models.BooleanField(default=False)  # the layouts (system objects) were made once; after that Admin → Energie decides which exist

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]


class EnergySite(models.Model):
    """The collector (superadmin): a website whose figures are read through its API, for the total picture."""

    name = models.CharField(max_length=120)
    url = models.CharField(max_length=300)  # the address of the website or of its API
    api_key = models.CharField(max_length=120, blank=True)
    enabled = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    last_fetched = models.DateTimeField(null=True, blank=True)
    last_ok = models.BooleanField(default=False)
    last_error = models.CharField(max_length=300, blank=True)
    data = models.JSONField(default=dict, blank=True)  # the last answer of the site

    class Meta:
        ordering = ["order", "name"]
