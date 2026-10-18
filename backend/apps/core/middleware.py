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


class MaintenanceMiddleware:
    """Maintenance mode (Basisgegevens): while it is on, only administrators use the system. Visitors and members get 503 for everything that changes data
    (except logging in, which itself refuses non-administrators); a member who is still logged in gets 503 for the whole API (except /api/auth/ and /api/site/)."""

    OPEN = ("/api/auth/", "/api/site/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/") and not path.startswith(self.OPEN):
            try:
                from . import system

                on = system.get()["maintenance"]
            except Exception:  # noqa: BLE001
                on = False
            if on and not self._admin(request) and (request.method not in ("GET", "HEAD", "OPTIONS") or request.META.get("HTTP_AUTHORIZATION")):
                from django.http import JsonResponse

                return JsonResponse({"detail": "De website is in onderhoud."}, status=503)
        return self.get_response(request)

    @staticmethod
    def _admin(request):
        from rest_framework.authentication import TokenAuthentication

        from apps.accounts.access import can_admin

        try:
            res = TokenAuthentication().authenticate(request)  # (user, token) or None
        except Exception:  # noqa: BLE001
            return False
        return bool(res and can_admin(res[0]))
