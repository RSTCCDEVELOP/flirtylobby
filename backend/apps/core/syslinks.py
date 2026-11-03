# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The system links of the superadmin (e-mail, payment, AI): without them nothing can be mailed (codes, invoices) or paid. They must be installed and on in every installation.
The keys never go into git: they come from the environment of the server (see backend/.env.example) and are stored encrypted in the database (Super admin -> API keys)."""
import os

# provider -> (slug, name, {config field: environment variable}); a link is made when its main variable (the first) is set
ENV_LINKS = {
    "postmark": ("postmark-easy2edit", "Postmark Easy2edit", {"server_token": "EASY2EDIT_POSTMARK_TOKEN", "from_email": "EASY2EDIT_POSTMARK_FROM"}),
    "stripe": ("stripe-easy2edit", "Stripe Easy2edit", {"secret_key": "EASY2EDIT_STRIPE_KEY"}),
    "anthropic": ("claude-easy2edit", "Claude Easy2edit", {"api_key": "EASY2EDIT_ANTHROPIC_KEY"}),
}
SECRETS = ("api_key", "secret_key", "server_token", "access_key", "access_key_id", "secret_access_key", "token", "password")


def ensure_from_env():
    """Make (or switch on) the system links from the environment of the server; the module API keys is switched on. Returns the number of links that were made or switched on."""
    from apps.integrations.models import Integration

    from . import modules
    from .models import ModuleState

    ModuleState.objects.update_or_create(key="integrations", defaults={"enabled": True})
    modules.invalidate()
    n = 0
    for provider, (slug, name, fields) in ENV_LINKS.items():
        main = os.getenv(next(iter(fields.values())), "").strip()
        cfg = {k: os.getenv(v, "").strip() for k, v in fields.items() if os.getenv(v, "").strip()}
        obj = Integration.objects.filter(provider=provider, superadmin_only=True).first()
        if obj:
            have = obj.config or {}
            if main and not any(str(v).strip() for k, v in have.items() if k in SECRETS):  # a link without a key (e.g. after a reinstall) gets the key of the environment
                obj.config = {**have, **cfg}
                obj.enabled = True
                obj.save()
                n += 1
            elif not obj.enabled and any(str(v).strip() for k, v in have.items() if k in SECRETS):
                Integration.objects.filter(pk=obj.pk).update(enabled=True)
                n += 1
            continue
        if not main:
            continue
        obj = Integration(slug=slug, name=name, provider=provider, enabled=True, superadmin_only=True)
        obj.config = cfg
        obj.save()
        n += 1
    return n


def missing():
    """The system links that are not there or are off: [(key, label)] for mail and payment (the AI link is optional)."""
    from apps.integrations.models import Integration

    out = []
    for key, label, provs in (("mail", "E-mail (Postmark of SMTP)", ("postmark", "smtp")), ("payment", "Betalen (Stripe of Mollie)", ("stripe", "mollie"))):
        if not Integration.objects.filter(provider__in=provs, enabled=True).exists():
            out.append((key, label))
    return out


FILE_NAME = "easy2edit-api-koppelingen.json"
FILE_PROVIDERS = ("stripe", "postmark", "anthropic")


def file_path():
    from django.conf import settings

    return settings.RESOURCE_DIR / "api" / FILE_NAME


def _has_key(obj):
    return any(str(v).strip() for k, v in (obj.config or {}).items() if k in SECRETS)


def file_status():
    """{"file": the password-locked file with the Easy2edit links is there, "missing": [providers without a link that is on and has a key], "needed": file there and something missing}."""
    from apps.integrations.models import Integration

    missing = [p for p in FILE_PROVIDERS if not any(i.enabled and _has_key(i) for i in Integration.objects.filter(provider=p, superadmin_only=True))]
    there = file_path().is_file()
    return {"file": there, "missing": missing, "needed": there and bool(missing)}


def install_from_file(password):
    """Load Stripe, Postmark and Claude from the locked file in resource/api, as links of the superadmin that are on. Raises ValueError (nothing is installed) when the password is wrong or the file is not usable."""
    import json

    from apps.integrations import backup, transfer
    from apps.integrations.models import Integration

    try:
        bundle = json.loads(file_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise ValueError("Het bestand met de API-koppelingen is niet gevonden of beschadigd.")
    rows = [{**r, "superadmin_only": True, "enabled": True} for r in transfer.unpack(bundle, password or "") if r.get("provider") in FILE_PROVIDERS]  # a wrong password raises here, before anything is changed
    if not rows:
        raise ValueError("Er zitten geen Stripe-, Postmark- of Claude-koppelingen in het bestand.")
    backup._apply(rows, None)
    for r in rows:
        Integration.objects.filter(slug=r["slug"]).exclude(config_encrypted="").update(superadmin_only=True)
        obj = Integration.objects.filter(slug=r["slug"]).first()
        if obj and _has_key(obj) and not obj.enabled:
            Integration.objects.filter(pk=obj.pk).update(enabled=True)
    from . import modules
    from .models import ModuleState

    ModuleState.objects.update_or_create(key="integrations", defaults={"enabled": True})
    modules.invalidate()
    return sorted({r["provider"] for r in rows})
