# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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

    OPEN = ("/api/auth/", "/api/site/", "/api/pages/aliases/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/") and not path.startswith(self.OPEN):
            try:
                from . import system

                on = system.maintenance_on()
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


class ClosedSiteMiddleware:
    """Closed website (an intranet, Beveiliging -> Algemeen): without logging in nothing is answered, only what the login screen itself needs
    (the login and password steps, the look of the site, the languages and the module list). Everything else gives 401."""

    OPEN = ("/api/auth/", "/api/site/", "/api/invite/", "/api/modules/", "/api/theme/", "/api/branding/", "/api/languages/", "/api/security/public/", "/api/security/check/",
            "/api/sandbox/status/", "/api/pages/state/", "/api/pages/setup/", "/api/pages/aliases/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/") and not path.startswith(self.OPEN) and request.method != "OPTIONS" and not request.META.get("HTTP_AUTHORIZATION"):
            try:
                from apps.security import service

                closed = bool(service.get()["basic"].get("closed_site"))
            except Exception:  # noqa: BLE001  (before the first migration)
                closed = False
            if closed:
                from django.http import JsonResponse

                return JsonResponse({"detail": "Deze website is besloten: log eerst in.", "closed_site": True}, status=401)
        return self.get_response(request)
