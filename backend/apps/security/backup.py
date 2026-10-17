"""Security settings."""
from apps.core.models import Language
from apps.core.settings_backup import register

from . import service
from .models import SecuritySettings


def _export(opts):
    return SecuritySettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}


def _apply(data, ctx):
    if not isinstance(data, dict):
        raise ValueError("Ongeldige beveiligingsinstellingen.")
    codes = set(Language.objects.values_list("code", flat=True))
    for sec in data.values():  # keep texts of languages that are off here but present in the file
        if isinstance(sec, dict) and isinstance(sec.get("texts"), dict):
            codes |= set(sec["texts"])
    cleaned = service.clean(data, codes)
    obj, _ = SecuritySettings.objects.get_or_create(pk=1)
    obj.data = cleaned  # replaced: what is not in the file falls back to the defaults
    obj.save()
    service.invalidate()
    return "Beveiligingsinstellingen geladen."


register("security", "Beveiliging", _export, _apply, description="Toegang, leeftijd, cookies, twee-staps verificatie, aanmelden.", order=15)
