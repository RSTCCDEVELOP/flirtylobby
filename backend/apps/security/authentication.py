from datetime import timedelta

from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from . import service


def is_expired(token):
    hours = service.get()["basic"]["token_lifetime_hours"]
    return bool(hours) and token.created < timezone.now() - timedelta(hours=hours)


class ExpiringTokenAuthentication(TokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result:
            from .twofa import needs_setup

            if needs_setup(result[0]) and not request.path.startswith("/api/auth/"):
                raise PermissionDenied({"detail": "Stel eerst twee-staps verificatie in.", "code": "twofa_setup_required"})
        return result

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if is_expired(token):
            token.delete()
            raise AuthenticationFailed("Sessie verlopen, log opnieuw in.")
        return user, token
