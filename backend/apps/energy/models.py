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


class EnergyBucket(models.Model):
    """The same measurements per 10 minutes (for the live graph of the power use); kept for three days."""

    ts = models.DateTimeField(unique=True)
    views = models.PositiveIntegerField(default=0)
    bytes_total = models.BigIntegerField(default=0)
    requests_total = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["-ts"]


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
    prune_old = models.BooleanField(default=False)  # off (default): all measurements are kept, for the statistics; on: measurements older than retention_days are removed
    auto_scan = models.BooleanField(default=True)  # the measuring (scan of the pages) is done automatically
    scan_every = models.CharField(max_length=10, default="daily")  # hourly | 6h | daily | weekly
    scan_hour = models.PositiveSmallIntegerField(default=3)  # at which hour (daily and weekly)
    scan_weekday = models.PositiveSmallIntegerField(default=0)  # on which day (weekly): 0 = Monday
    scan_sites = models.BooleanField(default=True)  # the connected websites (collector) are read at the same time
    scan_origin = models.CharField(max_length=200, blank=True)  # the website address that the last manual measuring used (when Basisgegevens has none)
    last_run_at = models.DateTimeField(null=True, blank=True)  # when the automatic measuring was started (or measured by hand) for the last time
    last_status = models.CharField(max_length=10, blank=True)  # ok | failed
    last_error = models.CharField(max_length=300, blank=True)
    instance_id = models.CharField(max_length=40, blank=True)  # a random id of this installation: the collector uses it to see that a connected site is this site itself (so it is not counted twice)
    advice = models.JSONField(default=dict, blank=True)  # what the advice tab applied: {"applied": {"fonts": {"at", "before", "result"}, ...}}
    objects_seeded = models.BooleanField(default=False)  # the layouts (system objects) were made once; after that Admin → Energie decides which exist

    @classmethod
    def load(cls):
        st = cls.objects.get_or_create(pk=1)[0]
        if not st.instance_id:
            import uuid

            st.instance_id = uuid.uuid4().hex
            st.save(update_fields=["instance_id"])
        return st


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
