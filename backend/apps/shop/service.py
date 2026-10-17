import logging
import secrets
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.text import slugify

from .models import DiscountCode, Order, OrderItem, Product, ShippingMethod, ShopSettings

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


# ── shipping ────────────────────────────────────────────────────────────────
def methods_for(country):
    return [m for m in ShippingMethod.objects.filter(active=True) if not m.countries or (country or "").upper() in m.countries]


def shipping_cost(method, subtotal):
    return Decimal("0.00") if method.free_from is not None and subtotal >= method.free_from else q(method.price)


# ── discount ────────────────────────────────────────────────────────────────
def check_discount(code, subtotal, lock=False):
    """The discount code object when it may be used for this subtotal, else raises OrderError with the reason."""
    if not code:
        return None
    qs = DiscountCode.objects.select_for_update() if lock else DiscountCode.objects
    d = qs.filter(code=code.strip().upper(), active=True).first()
    now = timezone.now()
    if not d or (d.starts_at and d.starts_at > now) or (d.ends_at and d.ends_at < now):
        raise OrderError("Deze kortingscode is ongeldig of verlopen.")
    if d.max_uses is not None and d.used_count >= d.max_uses:
        raise OrderError("Deze kortingscode is niet meer beschikbaar.")
    if subtotal < d.min_subtotal:
        raise OrderError(f"Deze code geldt vanaf een bestelling van € {d.min_subtotal}.")
    return d


# ── totals ──────────────────────────────────────────────────────────────────
def quote(items, code="", method_id=None, country="NL", lock=False, user=None):
    """
    The one place where prices are calculated (cart, checkout and order use it). Everything comes from the database.
    Line totals are always gross (incl. VAT). With prices_include_vat=False the entered price is net and VAT is added.
    """
    s = settings()
    if not items or len(items) > 50:
        raise OrderError("Je winkelwagen is leeg.")
    qs = Product.objects.select_for_update() if lock else Product.objects
    products = {p.id: p for p in qs.filter(id__in=[i.get("product") for i in items], active=True)}
    if user is not None or lock:
        from apps.subscriptions import service as subs

        try:
            subs.check_products(user, products.values())
        except subs.SubError as e:
            raise OrderError(str(e))
    lines, gross_sum = [], Decimal("0.00")
    for it in items:
        p, qty = products.get(it.get("product")), it.get("quantity")
        if not p or not isinstance(qty, int) or isinstance(qty, bool) or not 1 <= qty <= 99:
            raise OrderError("Een product in je winkelwagen bestaat niet meer.")
        if p.stock is not None and qty > p.stock:
            raise OrderError(f"Van '{p.name}' is nog maar {p.stock} op voorraad." if p.stock else f"'{p.name}' is uitverkocht.")
        rate = Decimal(str(p.vat_rate)) if p.vat_rate is not None else Decimal(s["default_vat"])
        base = p.price * qty
        gross = q(base * (1 + rate / 100)) if not s["prices_include_vat"] else q(base)
        lines.append({"product": p, "qty": qty, "rate": rate, "gross": gross})
        gross_sum += gross

    discount_obj = check_discount(code, gross_sum, lock)
    discount = Decimal("0.00")
    if discount_obj:
        discount = q(gross_sum * discount_obj.value / 100) if discount_obj.kind == "percent" else q(min(discount_obj.value, gross_sum))
        discount = min(discount, gross_sum)
    ratio = (gross_sum - discount) / gross_sum if gross_sum else Decimal(1)
    vat_total = Decimal("0.00")
    for ln in lines:
        ln["line_total"] = q(ln["gross"] * ratio)
        ln["vat"] = q(ln["line_total"] - ln["line_total"] / (1 + ln["rate"] / 100))
        vat_total += ln["vat"]

    method, shipping = None, Decimal("0.00")
    if method_id is not None:
        method = next((m for m in methods_for(country) if m.id == method_id), None)
        if not method:
            raise OrderError("Kies een verzendmethode die beschikbaar is voor jouw land.")
        shipping = shipping_cost(method, gross_sum - discount)
        srate = Decimal(s["shipping_vat"])
        vat_total += q(shipping - shipping / (1 + srate / 100))
    return {"lines": lines, "subtotal": gross_sum, "discount": discount, "discount_obj": discount_obj, "shipping": shipping, "method": method,
            "vat_total": vat_total, "total": gross_sum - discount + shipping}


def quote_json(qt):
    return {"subtotal": str(qt["subtotal"]), "discount": str(qt["discount"]), "shipping": str(qt["shipping"]), "vat_total": str(qt["vat_total"]),
            "total": str(qt["total"]), "code": qt["discount_obj"].code if qt["discount_obj"] else "", "method": qt["method"].name if qt["method"] else ""}


@transaction.atomic
def create_order(data, items, method_id, code="", user=None):
    qt = quote(items, code, method_id, data["country"], lock=True, user=user)
    if qt["method"] is None:
        raise OrderError("Kies een verzendmethode.")
    order = Order.objects.create(token=secrets.token_urlsafe(18), subtotal=qt["subtotal"], discount=qt["discount"], discount_code=qt["discount_obj"].code if qt["discount_obj"] else "",
                                 shipping=qt["shipping"], shipping_method=qt["method"].name, vat_total=qt["vat_total"], total=qt["total"],
                                 currency=settings()["currency"], user=user, **data)
    order.number = f"{order.created_at.year}-{order.id:05d}"
    order.save(update_fields=["number"])
    for ln in qt["lines"]:
        p = ln["product"]
        OrderItem.objects.create(order=order, product=p, name=p.name, sku=p.sku, unit_price=p.price, quantity=ln["qty"], line_total=ln["line_total"],
                                 vat_rate=ln["rate"], vat_amount=ln["vat"])
        if p.stock is not None:
            p.stock -= ln["qty"]
            p.save(update_fields=["stock"])
    if qt["discount_obj"]:
        DiscountCode.objects.filter(pk=qt["discount_obj"].pk).update(used_count=F("used_count") + 1)
    return order


def restock(order):
    for it in order.items.select_related("product"):
        if it.product and it.product.stock is not None:
            it.product.stock += it.quantity
            it.product.save(update_fields=["stock"])
    if order.discount_code:
        DiscountCode.objects.filter(code=order.discount_code, used_count__gt=0).update(used_count=F("used_count") - 1)


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
