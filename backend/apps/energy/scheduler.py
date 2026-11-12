# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The automatic measuring of the module Energie: which run is due now, and the run itself (scan of the pages, reading the connected websites, cleaning up)."""
import logging
from datetime import timedelta

from django.utils import timezone

from . import service
from .models import EnergySettings

logger = logging.getLogger(__name__)
EVERY = {"hourly": "Elk uur", "6h": "Elke 6 uur", "daily": "Elke dag", "weekly": "Elke week"}
STEP = {"hourly": timedelta(hours=1), "6h": timedelta(hours=6), "daily": timedelta(days=1), "weekly": timedelta(days=7)}


def last_slot(st, now):
    """The most recent moment (<= now) at which a run should have started."""
    local = timezone.localtime(now)
    if st.scan_every == "hourly":
        return local.replace(minute=0, second=0, microsecond=0)
    if st.scan_every == "6h":
        return local.replace(hour=local.hour - local.hour % 6, minute=0, second=0, microsecond=0)
    at = local.replace(hour=min(max(st.scan_hour, 0), 23), minute=0, second=0, microsecond=0)
    if st.scan_every == "weekly":
        slot = at - timedelta(days=(local.weekday() - st.scan_weekday) % 7)
        return slot if slot <= local else slot - timedelta(days=7)
    return at if at <= local else at - timedelta(days=1)


def next_run(st, now=None):
    now = now or timezone.now()
    return last_slot(st, now) + STEP.get(st.scan_every, STEP["daily"])


def is_due(st, now=None):
    now = now or timezone.now()
    return bool(st.auto_scan) and (st.last_run_at is None or st.last_run_at < last_slot(st, now))


def run(st=None, by_hand=False):
    """Measures the pages (and reads the connected websites). Returns (ok, error)."""
    st = st or EnergySettings.load()
    try:
        base = service.site_base(st.scan_origin)
        if not base:
            raise ValueError("Vul bij Admin → Basisgegevens het website-adres in, of voer één keer Meet nu uit.")
        scans = service.scan(base)
        if st.scan_sites:
            service.refresh_all()
        failed = [s for s in scans if not s.ok]
        if scans and len(failed) == len(scans):
            raise ValueError(failed[0].error or "De pagina's konden niet worden gemeten.")
        EnergySettings.objects.filter(pk=st.pk).update(last_status="ok", last_error="")
        return True, ""
    except Exception as e:  # noqa: BLE001
        logger.exception("energy scan")
        msg = str(e)[:300] if isinstance(e, ValueError) else "Het meten is niet gelukt."
        EnergySettings.objects.filter(pk=st.pk).update(last_status="failed", last_error=msg)
        return False, msg


def run_due():
    """Called every minute by the timer. Only one process measures: the run is claimed first."""
    st = EnergySettings.load()
    now = timezone.now()
    if not is_due(st, now):
        return False
    if not EnergySettings.objects.filter(pk=st.pk, last_run_at=st.last_run_at).update(last_run_at=now):
        return False  # another process was faster
    st.refresh_from_db()
    run(st)
    return True
