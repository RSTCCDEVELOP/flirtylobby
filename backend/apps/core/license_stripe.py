# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Stripe for the LICENCE. It uses its own Stripe account and keys (set by the superadmin: the account of whoever sells the licence), never the Stripe link of
the website's own shop (Admin -> API keys). Plain REST calls, no extra library.

    config (encrypted in License.stripe_config_encrypted): {"enabled", "secret_key", "webhook_secret", "payment_methods": [], "descriptor"}
    online payment   Checkout Session in payment mode      -> webhook checkout.session.completed extends the licence
    subscription     Checkout Session in subscription mode -> checkout.session.completed (first period) + invoice.paid (every next period)
    webhook          POST /api/system/license/stripe-webhook/ (set it up in Stripe with the events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted)"""
import hashlib
import hmac
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

from apps.integrations import crypto

from .models import License

logger = logging.getLogger(__name__)
API = "https://api.stripe.com/v1"
METHODS = [("card", "Creditcard"), ("ideal", "iDEAL"), ("sepa_debit", "SEPA-incasso"), ("bancontact", "Bancontact")]
TOLERANCE = 300


class StripeError(ValueError):
    pass


def lic():
    return License.objects.get_or_create(pk=1)[0]


def config(l=None):
    return crypto.decrypt((l or lic()).stripe_config_encrypted)


def save_config(patch, l=None):
    """Update the settings; a secret that is left empty keeps its old value."""
    l = l or lic()
    cur = config(l)
    for k in ("secret_key", "webhook_secret"):
        v = str(patch.get(k) or "").strip()
        if v:
            if k == "secret_key" and v.startswith("pk_"):
                raise StripeError("Dit is een publiceerbare sleutel (pk_…). Gebruik de geheime sleutel (sk_…) of een beperkte sleutel (rk_…).")
            if k == "webhook_secret" and not v.startswith("whsec_"):
                raise StripeError("Een webhook-geheim begint met whsec_.")
            cur[k] = v
    if "enabled" in patch:
        cur["enabled"] = bool(patch["enabled"])
    if "payment_methods" in patch:
        cur["payment_methods"] = [m for m in (patch["payment_methods"] or []) if m in dict(METHODS)]
    if "descriptor" in patch:
        cur["descriptor"] = str(patch["descriptor"] or "").strip()[:22]
    if patch.get("clear_keys"):
        cur.pop("secret_key", None)
        cur.pop("webhook_secret", None)
        cur["enabled"] = False
    l.stripe_config_encrypted = crypto.encrypt(cur)
    l.save(update_fields=["stripe_config_encrypted"])
    return cur


def public(l=None):
    """What the screen may see: never the keys themselves."""
    c = config(l)
    key = c.get("secret_key", "")
    return {"enabled": bool(c.get("enabled")), "has_secret_key": bool(key), "secret_key_hint": f"…{key[-4:]}" if key else "", "mode": "test" if key.startswith(("sk_test", "rk_test")) else "live" if key else "",
            "has_webhook_secret": bool(c.get("webhook_secret")), "payment_methods": c.get("payment_methods") or [], "descriptor": c.get("descriptor", ""), "methods": [{"key": k, "label": v} for k, v in METHODS]}


def active(l=None):
    c = config(l)
    return bool(c.get("enabled") and c.get("secret_key"))


def _flat(data, prefix=""):
    out = []
    for k, v in data.items():
        key = f"{prefix}[{k}]" if prefix else str(k)
        if isinstance(v, dict):
            out += _flat(v, key)
        elif isinstance(v, (list, tuple)):
            for i, x in enumerate(v):
                out += _flat(x, f"{key}[{i}]") if isinstance(x, dict) else [(f"{key}[{i}]", str(x))]
        elif v is not None:
            out.append((key, "true" if v is True else "false" if v is False else str(v)))
    return out


def call(method, path, data=None, l=None, key=None):
    key = key or config(l).get("secret_key")
    if not key:
        raise StripeError("Er is nog geen Stripe-sleutel ingesteld voor de licentie.")
    body = urllib.parse.urlencode(_flat(data or {})).encode() if data and method != "GET" else None
    url = f"{API}/{path}" + (f"?{urllib.parse.urlencode(_flat(data))}" if data and method == "GET" else "")
    req = urllib.request.Request(url, data=body, method=method, headers={"Authorization": f"Bearer {key}", "User-Agent": "easy2edit-license", "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read()).get("error", {}).get("message", "")
        except Exception:  # noqa: BLE001
            msg = ""
        raise StripeError(msg or f"Stripe antwoordde met HTTP {e.code}.")
    except (urllib.error.URLError, TimeoutError) as e:
        raise StripeError(f"Geen verbinding met Stripe: {e}")


def test(l=None):
    """(ok, message): can the key read the account."""
    try:
        acc = call("GET", "account", None, l)
        return True, f"Verbonden met {acc.get('business_profile', {}).get('name') or acc.get('settings', {}).get('dashboard', {}).get('display_name') or acc.get('id')}."
    except StripeError as e:
        try:  # a restricted key may not read the account: try what we need
            call("GET", "checkout/sessions", {"limit": 1}, l)
            return True, "Verbinding gelukt (beperkte sleutel)."
        except StripeError:
            return False, str(e)


def _site():
    from . import system

    return (system.get().get("frontend_url") or "").rstrip("/")


def _line(amount, name, months=None):
    price = {"currency": "eur", "unit_amount": int((Decimal(amount) * 100).quantize(Decimal("1"))), "product_data": {"name": name}}
    if months:
        price["recurring"] = {"interval": "year" if months == 12 else "month", "interval_count": 1 if months == 12 else months}
    return {"price_data": price, "quantity": 1}


def checkout(user, amount, months, subscribe=False, l=None):
    """A Stripe Checkout page for the licence. Returns its address."""
    l = l or lic()
    c = config(l)
    base = _site() or "http://localhost:5173"
    name = f"Licentie {l.number}".strip() + (f" – {l.client}" if l.client else "")
    data = {"mode": "subscription" if subscribe else "payment", "line_items": [_line(amount, name, months if subscribe else None)], "success_url": f"{base}/dashboard/license?paid=1", "cancel_url": f"{base}/dashboard/license",
            "client_reference_id": "license", "metadata": {"kind": "license", "months": months}, "customer_email": getattr(user, "email", "") or None, "locale": "auto"}
    if c.get("payment_methods"):
        data["payment_method_types"] = c["payment_methods"]
    if subscribe:
        data["subscription_data"] = {"metadata": {"kind": "license"}}
    elif c.get("descriptor"):
        data["payment_intent_data"] = {"statement_descriptor": c["descriptor"], "metadata": {"kind": "license"}}
    return call("POST", "checkout/sessions", data, l)["url"]


def ai_checkout(user, amount, currency, ref, l=None, key=None):
    """A Stripe Checkout page (the system Stripe account of the superadmin) for AI credit. Returns (address, session id)."""
    c = config(l)
    base = _site() or "http://localhost:5173"
    data = {"mode": "payment", "line_items": [{"price_data": {"currency": (currency or "eur").lower(), "unit_amount": int((Decimal(str(amount)) * 100).quantize(Decimal("1"))), "product_data": {"name": "AI-tegoed"}}, "quantity": 1}],
            "success_url": f"{base}/dashboard/ai?paid=1&ref={ref}", "cancel_url": f"{base}/dashboard/ai?cancelled=1", "client_reference_id": ref, "metadata": {"kind": "ai_credit", "ref": ref, "user": getattr(user, "pk", "")},
            "customer_email": getattr(user, "email", "") or None, "locale": "auto"}
    if c.get("payment_methods"):
        data["payment_method_types"] = c["payment_methods"]
    elif c.get("descriptor"):
        data["payment_intent_data"] = {"statement_descriptor": c["descriptor"], "metadata": {"kind": "ai_credit", "ref": ref}}
    s = call("POST", "checkout/sessions", data, l, key)
    return s["url"], s["id"]


def session_paid(session_id, l=None, key=None):
    """Is this Checkout session paid? (asked when the customer comes back, so the credit also arrives where the webhook cannot reach, e.g. on your own computer)."""
    s = call("GET", f"checkout/sessions/{session_id}", None, l, key)
    return s.get("payment_status") in ("paid", "no_payment_required"), s


def cancel_subscription(l=None):
    l = l or lic()
    if l.sub_ref.startswith("sub_") and active(l):
        try:
            call("DELETE", f"subscriptions/{l.sub_ref}", None, l)
        except StripeError as e:
            if "No such subscription" not in str(e):
                raise


def sync_price(l=None):
    """The price of the licence changed (a module was switched on or off): the subscription at Stripe collects the new amount from the next period."""
    l = l or lic()
    if not (l.sub_status == "active" and l.sub_ref.startswith("sub_") and active(l)) or l.sub_amount == l.price:
        return False
    sub = call("GET", f"subscriptions/{l.sub_ref}", None, l)
    item = sub["items"]["data"][0]
    new = {"currency": "eur", "product": item["price"]["product"], "unit_amount": int((Decimal(l.price) * 100).quantize(Decimal("1"))), "recurring": item["price"]["recurring"] and {"interval": item["price"]["recurring"]["interval"], "interval_count": item["price"]["recurring"]["interval_count"]}}
    call("POST", f"subscriptions/{l.sub_ref}", {"items": [{"id": item["id"], "price_data": new}], "proration_behavior": "none"}, l)
    l.sub_amount = l.price
    l.save(update_fields=["sub_amount"])
    return True


# ── webhook ─────────────────────────────────────────────────────────────────
def verify(payload: bytes, header: str, secret: str):
    """The signature of Stripe: t=…,v1=… (HMAC-SHA256 of "t.payload"). Raises StripeError."""
    parts = dict(p.split("=", 1) for p in (header or "").split(",") if "=" in p)
    t = parts.get("t", "")
    if not t.isdigit() or abs(time.time() - int(t)) > TOLERANCE:
        raise StripeError("De handtekening is te oud of ongeldig.")
    want = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    sigs = [v for k, v in (p.split("=", 1) for p in header.split(",") if "=" in p) if k == "v1"]
    if not any(hmac.compare_digest(want, s) for s in sigs):
        raise StripeError("De handtekening klopt niet.")


def handle(event, l=None):
    """One event from Stripe. Returns a short text. Repeated events are ignored."""
    from .views import extend_license

    l = l or lic()
    c = config(l)
    seen = c.get("events") or []
    if event.get("id") in seen:
        return "al verwerkt"
    obj = (event.get("data") or {}).get("object") or {}
    kind, out = event.get("type", ""), "genegeerd"
    if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded") and (obj.get("metadata") or {}).get("kind") == "ai_credit":  # AI credit that was bought
        from apps.integrations import aiusage

        paid = obj.get("payment_status") in ("paid", "no_payment_required")
        out = "tegoed bijgeschreven" if paid and aiusage.settle_topup(str((obj.get("metadata") or {}).get("ref") or ""), True, "Stripe") else "tegoed niet bijgeschreven"
    elif kind == "checkout.session.completed" and (obj.get("metadata") or {}).get("kind") == "license" and obj.get("payment_status") in ("paid", "no_payment_required"):
        if obj.get("mode") == "subscription":
            l.payment_method, l.sub_status, l.sub_provider, l.sub_ref, l.sub_amount = "auto", "active", "stripe", obj.get("subscription") or "", l.price
            l.sub_started_at = l.sub_started_at or __import__("django.utils.timezone", fromlist=["now"]).now()
            l.save(update_fields=["payment_method", "sub_status", "sub_provider", "sub_ref", "sub_amount", "sub_started_at"])
        extend_license(l)
        out = "licentie verlengd"
    elif kind == "invoice.paid" and obj.get("subscription") and obj.get("subscription") == l.sub_ref and obj.get("billing_reason") == "subscription_cycle":
        extend_license(l)
        out = "licentie verlengd (abonnement)"
    elif kind == "invoice.payment_failed" and obj.get("subscription") == l.sub_ref:
        logger.warning("licence: the automatic payment failed")
        out = "betaling mislukt"
    elif kind == "customer.subscription.deleted" and obj.get("id") == l.sub_ref:
        l.sub_status = "cancelled"
        l.save(update_fields=["sub_status"])
        out = "abonnement gestopt"
    c["events"] = (seen + [event.get("id")])[-30:]
    l.stripe_config_encrypted = crypto.encrypt(c)
    l.save(update_fields=["stripe_config_encrypted"])
    return out
