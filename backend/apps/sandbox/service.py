"""
Sandbox: when switched on, external APIs (e-mail, sms, payments, integration tests, geo lookup) are simulated.
Code that talks to the outside world asks `active("email")` first and, if true, calls `capture_*` / the payment simulator instead.
"""
import copy
import logging
import uuid
from decimal import Decimal, InvalidOperation

from django.utils import timezone

from apps.core import modules

from .models import SandboxMessage, SandboxPayment, SandboxSettings

logger = logging.getLogger(__name__)

DEFAULTS = {
    "enabled": False, "banner": True, "fixed_code": "", "geo_country": "NL",
    "simulate": {"email": True, "sms": True, "payments": True, "integrations": True, "geo": False},
}
OUTCOMES = {"paid", "failed", "canceled", "expired"}


class NotConfigured(Exception):
    pass


def get():
    d = copy.deepcopy(DEFAULTS)
    stored = SandboxSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    for k, v in stored.items():
        if k == "simulate" and isinstance(v, dict):
            d["simulate"].update({a: bool(b) for a, b in v.items() if a in d["simulate"]})
        elif k in d and k != "simulate":
            d[k] = v
    return d


def save(incoming):
    cur = get()
    for k, v in (incoming or {}).items():
        if k == "simulate" and isinstance(v, dict):
            cur["simulate"].update({a: bool(b) for a, b in v.items() if a in cur["simulate"]})
        elif k in ("enabled", "banner"):
            cur[k] = bool(v)
        elif k == "fixed_code":
            v = str(v or "").strip()
            if v and not v.isdigit():
                raise ValueError("De vaste code bestaat uit cijfers.")
            cur[k] = v[:8]
        elif k == "geo_country":
            from apps.security.countries import COUNTRY_CODES

            if str(v).upper() not in COUNTRY_CODES:
                raise ValueError("Onbekende landcode.")
            cur[k] = str(v).upper()
    obj, _ = SandboxSettings.objects.get_or_create(pk=1)
    obj.data = cur
    obj.save()
    return cur


def active(feature=None):
    """True when the sandbox is on (and, with `feature`, that kind of call is simulated)."""
    if not modules.enabled("sandbox"):
        return False
    s = get()
    return s["enabled"] and (feature is None or s["simulate"].get(feature, False))


def capture(kind, to, subject, body, sender=""):
    SandboxMessage.objects.create(kind=kind, to=to, subject=subject, body=body, sender=sender)
    logger.warning("SANDBOX %s to %s (not sent): %s", kind, to, subject or body[:60])


# ── simulated payments ──────────────────────────────────────────────────────
def _event(p, text):
    p.events = [*p.events, {"at": timezone.now().isoformat(timespec="seconds"), "text": text}]


def create_payment(amount, currency="EUR", description="", provider="mollie", return_url=""):
    """Create a payment. In the sandbox it is simulated and gets a fake checkout page (/sandbox/checkout/<ref>)."""
    if not active("payments"):
        raise NotConfigured("Betalingen zijn nog niet gekoppeld. Zet de sandbox aan om betalingen te simuleren.")
    try:
        amount = Decimal(str(amount)).quantize(Decimal("0.01"))
    except InvalidOperation:
        raise ValueError("Ongeldig bedrag.")
    if not Decimal("0.01") <= amount <= Decimal("100000"):
        raise ValueError("Bedrag tussen 0,01 en 100.000.")
    p = SandboxPayment(ref="tr_" + uuid.uuid4().hex[:12], provider=provider if provider in ("mollie", "stripe") else "mollie",
                       amount=amount, currency=(currency or "EUR").upper()[:3], description=description[:200], return_url=return_url[:500])
    _event(p, f"Betaling aangemaakt ({p.provider}, gesimuleerd)")
    p.save()
    return p


def apply_outcome(p, outcome):
    """open -> paid | failed | canceled | expired; paid -> refunded. Like a webhook from the provider."""
    if outcome == "refunded":
        if p.status != "paid":
            raise ValueError("Alleen een betaalde betaling kan worden terugbetaald.")
    elif outcome not in OUTCOMES or p.status != "open":
        raise ValueError("Deze betaling staat niet meer open.")
    p.status = outcome
    _event(p, f"Status: {outcome} (gesimuleerde webhook)")
    p.save()
    return p
