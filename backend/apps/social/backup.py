"""Community settings (profiles, search, messages, chat)."""
from apps.core.settings_backup import register

from .models import SocialSettings


def _export(opts):
    return SocialSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}


def _apply(data, ctx):
    if not isinstance(data, dict):
        raise ValueError("Ongeldige community-instellingen.")
    obj, _ = SocialSettings.objects.get_or_create(pk=1)
    obj.data = data  # the community code merges stored values with its defaults and ignores unknown keys
    obj.save()
    return "Community-instellingen geladen (thema, profielvelden, zoeken, berichten, chat)."


register("community", "Community", _export, _apply, description="Profielthema en -velden, zoeken en swipen, berichten en chat.", order=35)
