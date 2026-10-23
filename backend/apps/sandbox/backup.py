# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
