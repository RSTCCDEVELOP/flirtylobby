# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net


"""De waarschuwing dat betalen pas echt werkt met een betaalprovider (Stripe of Mollie): de webshop, de abonnementen en de donaties laten klanten betalen."""

# the plugins that let somebody pay (Financieel = Betalen, Orders, the Webshop, Abonnementen and donations)
PAY_PLUGINS = {"finance", "orders", "webshop", "subscriptions"}

NOTICE = ("Let op: koppel een betaalprovider zoals Stripe of Mollie bij Admin \u2192 API keys en vul de sleutels in. Zonder koppeling kunnen klanten niet echt betalen "
          "voor de webshop, abonnementen en donaties: dan werkt betalen alleen in de sandbox (gesimuleerd).")


def provider_linked():
    """Is a payment provider (Stripe or Mollie) linked and switched on, with its key?"""
    from apps.integrations.models import Integration

    for obj in Integration.objects.filter(provider__in=("stripe", "mollie"), enabled=True):
        c = obj.config or {}
        if c.get("secret_key") or c.get("api_key"):
            return True
    return False


def notice_for(plugin_names):
    """The warning when one of these plugins lets somebody pay and no provider is linked; else an empty text."""
    try:
        return NOTICE if set(plugin_names) & PAY_PLUGINS and not provider_linked() else ""
    except Exception:  # noqa: BLE001 - a warning must never stop a screen
        return ""
