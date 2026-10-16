from rest_framework.permissions import BasePermission

from .models import Integration


def is_active(slug):
    """True when the integration exists and is switched on. Use this to gate portal functionality."""
    from apps.core import modules

    return modules.enabled("integrations") and Integration.objects.filter(slug=slug, enabled=True).exists()


def get_config(slug):
    """Decrypted settings of an active integration, or None when missing/off."""
    return Integration.objects.get(slug=slug).config if is_active(slug) else None


def integration_active(slug):
    """DRF permission: `permission_classes = [integration_active("anthropic")]`."""

    class _Active(BasePermission):
        message = "Deze functie is uitgeschakeld."

        def has_permission(self, request, view):
            return is_active(slug)

    return _Active
