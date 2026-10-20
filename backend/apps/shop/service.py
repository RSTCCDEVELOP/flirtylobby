import logging
from decimal import ROUND_HALF_UP, Decimal

from django.utils.text import slugify

from .models import Order, ShopSettings

logger = logging.getLogger(__name__)
DEFAULTS = {"pay_online": True, "currency": "EUR", "prices_include_vat": True, "default_vat": "21", "vat_rates": ["21", "9", "0"], "shipping_vat": "21"}
TWO = Decimal("0.01")
q = lambda v: Decimal(v).quantize(TWO, rounding=ROUND_HALF_UP)  # noqa: E731


def settings():
    d = dict(DEFAULTS)
    d.update(ShopSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {})
    return d


def _rate(v):
    r = Decimal(str(v))
    if not 0 <= r <= 50:
        raise ValueError("Btw-percentage tussen 0 en 50.")
    return r


def save_settings(incoming):
    cur = settings()
    if "pay_online" in incoming:
        cur["pay_online"] = bool(incoming["pay_online"])
    if "prices_include_vat" in incoming:
        cur["prices_include_vat"] = bool(incoming["prices_include_vat"])
    for k in ("default_vat", "shipping_vat"):
        if k in incoming:
            cur[k] = str(_rate(incoming[k]).normalize())
    if "vat_rates" in incoming:
        rates = sorted({str(_rate(r).normalize()) for r in incoming["vat_rates"]}, key=Decimal, reverse=True)
        if not rates:
            raise ValueError("Minimaal één btw-percentage.")
        cur["vat_rates"] = rates
    if cur["default_vat"] not in cur["vat_rates"]:
        cur["vat_rates"] = sorted({*cur["vat_rates"], cur["default_vat"]}, key=Decimal, reverse=True)
    obj, _ = ShopSettings.objects.get_or_create(pk=1)
    obj.data = cur
    obj.save()
    return cur


def unique_slug(model, text, exclude_pk=None):
    base = slugify(text) or "item"
    slug, n = base, 2
    while model.objects.filter(slug=slug).exclude(pk=exclude_pk).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


class OrderError(Exception):
    pass


def restock(order):
    """A cancelled webshop order: the webshop plugin puts the stock (and the discount code) back."""
    from . import catalog

    catalog.restock(order)


def confirmation_mail(order):
    """Order confirmation to the customer (captured by the sandbox when it is on)."""
    from apps.communication import sending

    lines = [f"- {i.quantity} × {i.name}: € {i.line_total}" for i in order.items.all()]
    extra = (f"Korting ({order.discount_code}): -€ {order.discount}\n" if order.discount else "") + f"Verzending ({order.shipping_method}): € {order.shipping}\n"
    body = (f"Bedankt voor je bestelling, {order.name}.\n\nBestelnummer: {order.number}\n\n" + "\n".join(lines) + "\n\n" + extra +
            f"Totaal: € {order.total} (waarvan € {order.vat_total} btw)\n\nBezorgadres:\n{order.street}\n{order.postal_code} {order.city}\n")
    try:
        sending.send_email(order.email, f"Bevestiging van je bestelling {order.number}", body, purpose="notifications")
    except Exception as e:  # an e-mail problem must never fail the order
        logger.warning("Order mail failed for %s: %s", order.number, e)


def on_payment(payment):
    """Called by the payment (simulator) after each status change."""
    order = Order.objects.filter(payment_ref=payment.ref).first()
    if not order:
        return
    before = order.status
    if payment.status == "paid" and before in ("new", "pending_payment"):
        order.status = "paid"
        order.save(update_fields=["status"])
        if order.kind == "shop":
            confirmation_mail(order)
    elif payment.status in ("failed", "canceled", "expired") and before == "pending_payment":
        order.status = "canceled"
        order.save(update_fields=["status"])
        if order.kind == "shop":
            restock(order)
    elif payment.status == "refunded":
        order.status = "refunded"
        order.save(update_fields=["status"])
    logger.info("Order %s: %s -> %s (payment %s)", order.number, before, order.status, payment.status)
    if order.status != before:
        from apps.subscriptions import service as subs

        subs.on_order_status(order, before)
        try:
            from apps.notifications.service import notify

            if order.user_id:
                notify(order.user, "order", f"Bestelling {order.number}: {order.status}", url="/dashboard/mijn-bestellingen")
        except Exception:  # noqa: BLE001
            pass
