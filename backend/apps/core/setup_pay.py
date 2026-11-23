# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The payment step of the set-up wizard (after the costs): a Stripe subscription (the Stripe account of the licence: Super admin > Licentie > Betalen; test keys sk_test_… = test mode).
The subscription starts on the 1st of the month: Stripe charges the days until the end of this month in proportion (the first payment), after that the price of the chosen period.
The customer pays on the Stripe page and comes back; `confirm` asks Stripe whether the session is paid (so it also works on your own computer, where the webhook cannot reach)."""
from datetime import date, datetime, timezone as dtz

from django.core.cache import cache

from . import license_price, license_stripe
from .models import License

OK_TTL = 3600


class PayError(ValueError):
    pass


def _key(user):
    return f"setup-pay-ok:{user.pk}"


def ok(user):
    """Paying has been confirmed (a superadmin and a superadmin+ always pass: see setup_consent.passes)."""
    from . import setup_consent

    if setup_consent.passes(user):
        return True
    return bool(cache.get(_key(user)))


def mark_ok(user):
    cache.set(_key(user), 1, OK_TTL)


def clear(user):
    cache.delete(_key(user))
    cache.delete(_skip_key(user))


TRIAL_DAYS = 14  # not paying: the licence is made for this many days, after that the website goes into free mode


def _skip_key(user):
    return f"setup-pay-skip:{user.pk}"


def mark_skipped(user):
    """The person chose not to pay: the wizard goes on, the licence is made for a short time only (TRIAL_DAYS)."""
    cache.set(_skip_key(user), 1, OK_TTL)
    mark_ok(user)


def skipped(user):
    return bool(cache.get(_skip_key(user)))


def provider():
    """'stripe' when the licence has its own Stripe account switched on, else ''."""
    return "stripe" if license_stripe.active() else ""


def mode():
    return license_stripe.public().get("mode", "") if provider() else ""


def required(price=None):
    """Paying is needed when Stripe is on and the licence costs something."""
    return bool(provider()) and float(price if price is not None else license_price.refresh()) > 0


def prepare(hosting, months):
    """Keep the choices that decide the price on the licence (hosting and period); returns the price of one period incl. VAT."""
    lic, _ = License.objects.get_or_create(pk=1)
    if months in (1, 3, 12):
        lic.renew_months = months
    if hosting is not None:
        lic.hosting = str(hosting)[:30]
    lic.save(update_fields=["renew_months", "hosting"])
    return license_price.refresh()


def _anchor():
    """The 1st of next month 00:00 UTC (None when today is the 1st: the subscription then simply starts now)."""
    t = date.today()
    if t.day == 1:
        return None
    y, m = (t.year + 1, 1) if t.month == 12 else (t.year, t.month + 1)
    return int(datetime(y, m, 1, tzinfo=dtz.utc).timestamp())


def checkout(user, base):
    """A Stripe Checkout (subscription) for the price of the chosen period, starting on the 1st of next month with the days until then in proportion. Returns its address."""
    lic, _ = License.objects.get_or_create(pk=1)
    price = license_price.refresh()
    if float(price) <= 0:
        raise PayError("De licentie heeft geen prijs: er valt niets te betalen.")
    c = license_stripe.config(lic)
    name = "Licentie" + (f" – {lic.client}" if lic.client else "")
    data = {"mode": "subscription", "line_items": [license_stripe._line(price, name, lic.renew_months)],
            "success_url": f"{base}/dashboard?setup_paid=1&session_id={{CHECKOUT_SESSION_ID}}", "cancel_url": f"{base}/dashboard?setup_cancel=1",
            "client_reference_id": "license-setup", "metadata": {"kind": "license_setup", "months": lic.renew_months}, "customer_email": getattr(user, "email", "") or None, "locale": "auto",
            "subscription_data": {"metadata": {"kind": "license"}}}
    if _anchor():
        data["subscription_data"].update({"billing_cycle_anchor": _anchor(), "proration_behavior": "create_prorations"})
    if c.get("payment_methods"):
        data["payment_method_types"] = c["payment_methods"]
    try:
        return license_stripe.call("POST", "checkout/sessions", data, lic)["url"]
    except license_stripe.StripeError as e:
        raise PayError(str(e))


def confirm(user, session_id):
    """The customer is back from Stripe: is the session paid? Then the subscription is recorded on the licence and paying is done."""
    sid = str(session_id or "")
    if not sid.startswith("cs_"):
        raise PayError("Geen geldige betaling.")
    try:
        paid, s = license_stripe.session_paid(sid)
    except license_stripe.StripeError as e:
        raise PayError(str(e))
    if (s.get("metadata") or {}).get("kind") != "license_setup":
        raise PayError("Deze betaling hoort niet bij de licentie.")
    if not paid:
        raise PayError("De betaling is nog niet gelukt.")
    lic, _ = License.objects.get_or_create(pk=1)
    lic.payment_method, lic.sub_status, lic.sub_provider, lic.sub_ref, lic.sub_amount = "auto", "active", "stripe", s.get("subscription") or "", lic.price
    from django.utils import timezone

    lic.sub_started_at = lic.sub_started_at or timezone.now()
    lic.save(update_fields=["payment_method", "sub_status", "sub_provider", "sub_ref", "sub_amount", "sub_started_at"])
    mark_ok(user)
    return True
