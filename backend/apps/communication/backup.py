# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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


def _add(data, ctx):
    have = set(CommAddress.objects.values_list("kind", "value"))
    return _apply({"addresses": [a for a in (data or {}).get("addresses", []) if (a.get("kind"), a.get("value")) not in have]}, ctx)


def _clear():
    CommAddress.objects.all().delete()


register("communication", "Communicatie", _export, _apply, description="E-mailopmaak en de adressen en nummers voor berichten.", order=60, add=_add, clear=_clear)
