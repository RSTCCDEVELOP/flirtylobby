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
            if main and not obj.enabled and any(str(v).strip() for k, v in (obj.config or {}).items() if k in SECRETS):
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
