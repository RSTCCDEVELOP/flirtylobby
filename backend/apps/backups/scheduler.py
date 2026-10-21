"""The automatic backups: which job is due now."""
import calendar
import logging
from datetime import datetime, timedelta

from django.utils import timezone

from . import service
from .models import BackupJob

logger = logging.getLogger(__name__)


def last_slot(job, now):
    """The most recent moment (<= now) at which this job should have run."""
    local = timezone.localtime(now)
    at = local.replace(hour=job.hour, minute=0, second=0, microsecond=0)
    if job.frequency == "daily":
        return at if at <= local else at - timedelta(days=1)
    if job.frequency == "weekly":
        back = (local.weekday() - job.weekday) % 7
        slot = at - timedelta(days=back)
        return slot if slot <= local else slot - timedelta(days=7)
    day = min(max(job.day, 1), 28)
    slot = at.replace(day=day)
    if slot <= local:
        return slot
    y, m = (local.year - 1, 12) if local.month == 1 else (local.year, local.month - 1)
    return slot.replace(year=y, month=m, day=min(day, calendar.monthrange(y, m)[1]))


def is_due(job, now=None):
    now = now or timezone.now()
    if not job.enabled:
        return False
    return job.last_run_at is None or job.last_run_at < last_slot(job, now)


def run_job(job, user=None):
    """Make the backup of this job now. Returns the Backup or raises."""
    try:
        row = service.create(job.frequency, user)
        BackupJob.objects.filter(pk=job.pk).update(last_status="ok", last_error="")
        return row
    except Exception as e:  # noqa: BLE001
        logger.exception("backup job %s failed", job.frequency)
        BackupJob.objects.filter(pk=job.pk).update(last_status="failed", last_error=str(e)[:500])
        raise


def run_due():
    """Called every minute. Only one process makes a backup: the job is claimed first."""
    now = timezone.now()
    ran = []
    for job in BackupJob.objects.filter(enabled=True):
        if not is_due(job, now):
            continue
        if not BackupJob.objects.filter(pk=job.pk, last_run_at=job.last_run_at).update(last_run_at=now):
            continue  # another process was faster
        try:
            run_job(job)
            ran.append(job.frequency)
        except Exception:  # noqa: BLE001
            pass
    return ran
