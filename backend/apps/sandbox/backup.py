"""Sandbox settings."""
from apps.core.settings_backup import register

from .models import SandboxSettings


def _export(opts):
    return SandboxSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}


def _apply(data, ctx):
    if not isinstance(data, dict):
        raise ValueError("Ongeldige sandbox-instellingen.")
    obj, _ = SandboxSettings.objects.get_or_create(pk=1)
    obj.data = data
    obj.save()
    return "Sandbox-instellingen geladen."


register("sandbox", "Sandbox", _export, _apply, description="Testomgeving: welke koppelingen worden gesimuleerd.", order=80)
