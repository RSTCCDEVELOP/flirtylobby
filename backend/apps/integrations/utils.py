# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
