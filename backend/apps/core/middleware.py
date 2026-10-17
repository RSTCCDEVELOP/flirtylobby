import logging
from zoneinfo import ZoneInfo

from django.utils import timezone

logger = logging.getLogger(__name__)


class SiteTimezoneMiddleware:
    """Dates and times follow the time zone set at Systeem -> Basisgegevens."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            from . import system

            timezone.activate(ZoneInfo(system.get()["timezone"]))
        except Exception:  # noqa: BLE001  (before the first migration, bad value): the project time zone stays
            timezone.deactivate()
        return self.get_response(request)
