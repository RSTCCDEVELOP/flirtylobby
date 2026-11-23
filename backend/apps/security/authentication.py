# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from datetime import timedelta

from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from . import service


def is_expired(token):
    hours = service.get()["basic"]["token_lifetime_hours"]
    return bool(hours) and token.created < timezone.now() - timedelta(hours=hours)


IDLE_GRACE = 90  # seconds on top of the idle time: the question "stay logged in?" (60 s) and some slack for the clock of the browser


def idle_key(token_key):
    return f"idle:{token_key}"


def touch(token_key):
    """The person did something (the screen says so every half minute while he is active): the moment is kept per login. The polling of the pages does not call this."""
    from django.core.cache import cache

    cache.set(idle_key(token_key), timezone.now().timestamp(), 60 * 60 * 24 * 8)


def is_idle(token):
    """True when this login did nothing for longer than the idle time of the website (plus the grace). A login without a known moment (a restart, a cleared cache) starts now: never a surprise logout."""
    from django.core.cache import cache

    from apps.core import system

    minutes = system.idle()["minutes"]
    if not minutes:
        return False
    last = cache.get(idle_key(token.key))
    if last is None:
        touch(token.key)
        return False
    return timezone.now().timestamp() - float(last) > minutes * 60 + IDLE_GRACE


class ExpiringTokenAuthentication(TokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result:
            from .twofa import needs_setup

            result[0]._login_token = result[1].key  # (the bypass of the forced two-step set-up is kept per login)
            if needs_setup(result[0]) and not request.path.startswith("/api/auth/"):
                raise PermissionDenied({"detail": "Stel eerst twee-staps verificatie in.", "code": "twofa_setup_required"})
        return result

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if is_expired(token):
            token.delete()
            raise AuthenticationFailed("Sessie verlopen, log opnieuw in.")
        if is_idle(token):
            token.delete()
            raise AuthenticationFailed("Je bent uitgelogd omdat je een tijd niets hebt gedaan.")
        return user, token
