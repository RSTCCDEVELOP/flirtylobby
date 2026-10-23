# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Paying the licence: how the administrator pays and what the licence subscription does.

    online    a payment every period (month / quarter / year): the administrator pays it in the licence screen
    auto      automatic collection: a subscription with Mollie or Stripe (mandate); a payment is made by itself a few days before the licence ends
    invoice   on account: the reseller sends an invoice; a superadmin records that it was paid and the licence is extended

The superadmin decides which methods are offered (License.allowed_methods). Collection runs through `run_due()` (every minute from the web server and
`manage.py renew_licenses` for a cron job). Without a live payment link the sandbox simulates it, like every other payment of the system."""
import logging
from datetime import timedelta

from django.utils import timezone

from . import license_price, system
from .models import License

logger = logging.getLogger(__name__)
METHODS = {"online": "Online betalen per periode", "auto": "Automatische incasso (abonnement)", "invoice": "Op rekening (factuur)"}
DAYS_AHEAD = 3  # an automatic payment is started this many days before the licence ends


class BillingError(ValueError):
    pass


def lic():
    return License.objects.get_or_create(pk=1)[0]


def provider_available():
    from . import license_stripe

    if license_stripe.active():
        return "stripe"  # the licence has its own Stripe account
    """The payment link that can collect: Mollie or Stripe that is switched on; the sandbox pretends to be one when it simulates payments."""
    from apps.integrations.models import Integration
    from apps.sandbox import service as sandbox

    on = list(Integration.objects.filter(provider__in=("mollie", "stripe"), enabled=True).values_list("provider", flat=True))
    if on:
        return on[0]
    return sandbox.payment_provider() if sandbox.active("payments") else ""


def allowed(l=None):
    l = l or lic()
    m = [x for x in (l.allowed_methods or ["online", "invoice"]) if x in METHODS]
    return m or ["online", "invoice"]


def state(l=None):
    l = l or lic()
    return {"method": l.payment_method if l.payment_method in allowed(l) else allowed(l)[0], "allowed": allowed(l), "methods": [{"key": k, "label": v, "offered": k in allowed(l)} for k, v in METHODS.items()],
            "sub_status": l.sub_status, "sub_provider": l.sub_provider, "sub_started_at": l.sub_started_at, "provider": provider_available(), "renew_months": l.renew_months}


def set_method(method, l=None):
    l = l or lic()
    if method not in allowed(l):
        raise BillingError("Deze betaalmethode wordt niet aangeboden. Vraag de superadmin of de reseller.")
    if method != "auto" and l.sub_status == "active":
        stop_subscription(l)  # collecting by itself ends when another way of paying is chosen
    l.payment_method = method
    l.save(update_fields=["payment_method"])
    return l


def start_subscription(user=None, l=None):
    """Automatic collection: the first payment is made now (it also gives the mandate); after that every period a payment is made by itself."""
    from apps.sandbox import service as sandbox

    from . import license_stripe

    l = l or lic()
    if "auto" not in allowed(l):
        raise BillingError("Automatische incasso wordt niet aangeboden.")
    if license_stripe.active(l):  # real: Stripe Checkout in subscription mode; the webhook makes the subscription active
        price = license_price.refresh()
        if float(price) <= 0:
            raise BillingError("De licentie heeft geen prijs: er valt niets te incasseren.")
        try:
            return {"url": license_stripe.checkout(user, price, l.renew_months, subscribe=True, l=l)}
        except license_stripe.StripeError as e:
            raise BillingError(str(e))
    provider = provider_available()
    if not provider:
        raise BillingError("Koppel Mollie of Stripe bij Admin → API keys (of zet de sandbox aan om te testen) voor automatische incasso.")
    price = license_price.refresh()
    if float(price) <= 0:
        raise BillingError("De licentie heeft geen prijs: er valt niets te incasseren.")
    try:
        p = sandbox.create_payment(price, "EUR", f"Licentie {l.number or ''} (abonnement, eerste periode)".strip(), provider=provider)
    except sandbox.NotConfigured:
        raise BillingError("Er is nog geen betaallink die automatisch kan incasseren. Zet de sandbox aan om het te testen; echte Mollie- en Stripe-abonnementen worden nog niet aangeroepen.")
    l.payment_method, l.sub_status, l.sub_provider, l.sub_ref, l.sub_started_at, l.payment_ref = "auto", "active", provider, p.ref, timezone.now(), p.ref
    l.save(update_fields=["payment_method", "sub_status", "sub_provider", "sub_ref", "sub_started_at", "payment_ref"])
    system.license_changed()
    return p


def stop_subscription(l=None):
    from . import license_stripe

    l = l or lic()
    try:
        license_stripe.cancel_subscription(l)
    except license_stripe.StripeError as e:
        raise BillingError(f"Stoppen bij Stripe mislukt: {e}")
    l.sub_status = "cancelled" if l.sub_status == "active" else l.sub_status
    l.save(update_fields=["sub_status"])
    system.license_changed()


def mark_invoice_paid(l=None):
    """A superadmin records that the invoice was paid: the licence runs one more period."""
    from datetime import date

    from .views import extend_license

    l = l or lic()
    extend_license(l)
    return l


def run_due(now=None):
    """Make the payment of every active subscription whose licence ends within DAYS_AHEAD days. Returns the references."""
    from apps.sandbox import service as sandbox

    from . import license_stripe

    l = lic()
    if l.sub_status == "active" and l.sub_provider == "stripe":  # Stripe collects by itself; only keep the amount in line with the price
        try:
            license_stripe.sync_price(l)
        except license_stripe.StripeError:
            logger.exception("licence: updating the subscription price failed")
        return []
    if l.sub_status != "active" or l.payment_method != "auto" or l.payment_ref:
        return []
    now = now or timezone.now()
    if l.valid_until and l.valid_until > (now + timedelta(days=DAYS_AHEAD)).date():
        return []
    price = license_price.refresh()
    if float(price) <= 0:
        return []
    try:
        p = sandbox.create_payment(price, "EUR", f"Licentie {l.number or ''} (automatische incasso)".strip(), provider=l.sub_provider or "mollie")
    except sandbox.NotConfigured:
        logger.warning("licence collection: no payment link")
        return []
    l.payment_ref = p.ref
    l.save(update_fields=["payment_ref"])
    sandbox.settle(p)  # with "betalingen meteen afronden" the sandbox pays it at once
    return [p.ref]
