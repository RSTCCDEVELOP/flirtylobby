"""E-mail layout and the addresses / numbers the system may use."""
from apps.core.settings_backup import register

from .models import CommAddress, EmailSettings


def _export(opts):
    return {"email_layout": EmailSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {},
            "addresses": list(CommAddress.objects.values("kind", "label", "value", "purpose", "enabled", "is_default"))}


def _apply(data, ctx):
    data = data or {}
    if isinstance(data.get("email_layout"), dict):
        obj, _ = EmailSettings.objects.get_or_create(pk=1)
        obj.data = data["email_layout"]
        obj.save()
    n = 0
    for a in data.get("addresses", []):
        if a.get("kind") and a.get("value"):
            CommAddress.objects.update_or_create(kind=a["kind"], value=a["value"], defaults={k: a[k] for k in ("label", "purpose", "enabled", "is_default") if k in a})
            n += 1
    return f"E-mailopmaak geladen, {n} adres(sen)/nummer(s)."


register("communication", "Communicatie", _export, _apply, description="E-mailopmaak en de adressen en nummers voor berichten.", order=60)
