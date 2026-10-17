"""
Subscriptions and donations.

  Plan (what is sold, price, once or every period, what it gives)  ->  Subscription (one member's) -> Order per period (apps/shop Order, kind "subscription")
  DonationCampaign (a gift with a slider between min and max)      ->  Donation  ->  Order (kind "donation")

What a plan or donation gives is a list of grants: {"type", "ref", "value"}. Parts of the site ask `can()` / `entitlements()`:
chat, photos+video in chat, video chat, likes per day, own pages, exclusive content, services (products), and access to the whole site.
A part is only locked when the admin switches its gate on (Admin -> Subscription -> Instellingen): without gates everything stays free.
"""
import logging
import secrets
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from apps.core import modules

from .models import Donation, DonationCampaign, Plan, Subscription, SubscriptionSettings

logger = logging.getLogger(__name__)
CENT = Decimal("0.01")
INTERVAL_DAYS = {"week": 7, "month": 30, "quarter": 91, "year": 365}
LIVE = ("trial", "active", "past_due", "canceled")  # statuses that still give access (until period_end)

GRANT_TYPES = {
    "site": {"label": "Toegang tot de website", "ref": None, "help": "Zonder dit abonnement kom je niet verder dan de inlog- en abonnementspagina's (als de poort aan staat)."},
    "page": {"label": "Pagina", "ref": "page", "help": "Een eigen pagina die alleen voor leden met dit abonnement zichtbaar is."},
    "content": {"label": "Exclusieve content", "ref": "text", "help": "Een sleutel (bv. cursus-1) voor tekst of beeld dat je met de component Paywall afschermt."},
    "service": {"label": "Dienst of product", "ref": "product", "help": "Een product uit de webshop dat alleen met dit abonnement te bestellen is."},
    "chat": {"label": "Chat", "ref": None, "help": "Berichten sturen in de chat."},
    "chat_media": {"label": "Foto's en video's in de chat", "ref": None, "help": "Foto's en video's delen in de chat."},
    "video_chat": {"label": "Videochat", "ref": None, "help": "Videobellen via de chat en de directe verbinding."},
    "likes": {"label": "Likes per dag", "ref": None, "value": True, "help": "Aantal likes per dag bij zoeken en swipen. 0 = onbeperkt."},
}
DEFAULTS = {
    "gates": {"site": False, "chat": False, "chat_media": False, "video_chat": False, "likes": False},
    "free_likes_per_day": 10,  # only used when the likes gate is on
    "grace_days": 7,  # after a missed payment: access stays for this many days
    "invoice_activate": True,  # pay by invoice (no online payment): the subscription starts right away
    "site_message": "Voor deze website heb je een abonnement nodig.",
    "intro": "",
}


class SubError(Exception):
    pass


def money(v):
    return Decimal(str(v)).quantize(CENT, rounding=ROUND_HALF_UP)


def settings():
    stored = SubscriptionSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULTS.items()}
    for k, v in stored.items():
        if k == "gates" and isinstance(v, dict):
            out["gates"].update({g: bool(x) for g, x in v.items() if g in out["gates"]})
        elif k in out and k != "gates":
            out[k] = v
    return out


def save_settings(incoming):
    cur = settings()
    for g, x in (incoming.get("gates") or {}).items():
        if g in cur["gates"]:
            cur["gates"][g] = bool(x)
    for k, lo, hi in (("free_likes_per_day", 0, 10000), ("grace_days", 0, 90)):
        if k in incoming:
            try:
                cur[k] = max(lo, min(hi, int(incoming[k])))
            except (TypeError, ValueError):
                raise ValueError("Geef een geheel getal op.")
    if "invoice_activate" in incoming:
        cur["invoice_activate"] = bool(incoming["invoice_activate"])
    for k in ("site_message", "intro"):
        if k in incoming:
            cur[k] = str(incoming[k] or "").strip()[:500]
    obj, _ = SubscriptionSettings.objects.get_or_create(pk=1)
    obj.data = cur
    obj.save()
    return cur


# ── grants ───────────────────────────────────────────────────────────────────
def clean_grants(raw):
    """Validate the grants an admin entered; raises ValueError with a readable text."""
    from apps.pages.models import Page
    from apps.shop.models import Product

    out, seen = [], set()
    for g in raw or []:
        t = str((g or {}).get("type") or "")
        if t not in GRANT_TYPES:
            raise ValueError(f"Onbekend type toegang: {t or '?'}.")
        spec, ref, value = GRANT_TYPES[t], str(g.get("ref") or "").strip()[:80], 0
        if spec["ref"] == "page" and not Page.objects.filter(key=ref, kind="content").exists():
            raise ValueError("Kies een bestaande eigen pagina.")
        if spec["ref"] == "product" and not Product.objects.filter(pk=ref or 0).exists():
            raise ValueError("Kies een bestaand product.")
        if spec["ref"] == "text" and not ref:
            raise ValueError("Geef de sleutel van de content op.")
        if spec.get("value"):
            try:
                value = max(0, min(100000, int(g.get("value") or 0)))
            except (TypeError, ValueError):
                raise ValueError("Het aantal likes moet een geheel getal zijn.")
        if (t, ref) in seen:
            continue
        seen.add((t, ref))
        out.append({"type": t, "ref": ref if spec["ref"] else "", "value": value})
    return out


def describe(grants):
    from apps.pages.models import Page
    from apps.shop.models import Product

    out = []
    for g in grants or []:
        spec, label = GRANT_TYPES.get(g["type"]), ""
        if not spec:
            continue
        label = spec["label"]
        if g["type"] == "page":
            p = Page.objects.filter(key=g["ref"]).first()
            label += f": {(p.title.get('nl') or next(iter(p.title.values()), g['ref'])) if p else g['ref']}"
        elif g["type"] == "service":
            p = Product.objects.filter(pk=g["ref"] or 0).first()
            label += f": {p.name if p else g['ref']}"
        elif g["type"] == "content":
            label += f": {g['ref']}"
        elif g["type"] == "likes":
            label = "Onbeperkt likes" if not g.get("value") else f"{g['value']} likes per dag"
        out.append({"type": g["type"], "label": label})
    return out


# ── what does this user have? ────────────────────────────────────────────────
def _empty():
    return {"full": False, "site": False, "pages": set(), "content": set(), "services": set(), "chat": False, "chat_media": False, "video_chat": False,
            "likes": False, "plans": []}  # likes: False = nothing extra, None = unlimited, n = per day


def _add(ent, grants):
    for g in grants or []:
        t = g.get("type")
        if t == "page":
            ent["pages"].add(g.get("ref"))
        elif t == "content":
            ent["content"].add(g.get("ref"))
        elif t == "service":
            ent["services"].add(str(g.get("ref")))
        elif t == "likes":
            n = int(g.get("value") or 0)
            ent["likes"] = None if (n == 0 or ent["likes"] is None) else max(n, ent["likes"] or 0)
        elif t in ("site", "chat", "chat_media", "video_chat"):
            ent[t] = True


def entitlements(user):
    ent = _empty()
    if not user or not getattr(user, "is_authenticated", False):
        return ent
    if user.is_staff or user.is_superuser:
        ent.update(full=True, site=True, chat=True, chat_media=True, video_chat=True, likes=None)
        return ent
    now = timezone.now()
    for s in Subscription.objects.filter(user=user, status__in=LIVE).select_related("plan"):
        if s.period_end and s.period_end <= now:
            continue
        ent["plans"].append(s.plan_id)
        _add(ent, s.plan.grants)
    for d in Donation.objects.filter(user=user, status="paid", access_until__gt=now).select_related("campaign"):
        _add(ent, d.campaign.grants)
    return ent


def gate_on(key):
    return modules.enabled("subscriptions") and settings()["gates"].get(key, False)


def can(user, key):
    """May this user use the part `key` (site | chat | chat_media | video_chat)? Free as long as its gate is off."""
    if not gate_on(key):
        return True
    return bool(entitlements(user).get(key))


GATE_MESSAGE = {
    "site": "Voor deze website heb je een abonnement nodig.", "chat": "Chatten is er voor leden met een abonnement.",
    "chat_media": "Foto's en video's delen in de chat kan met een abonnement.", "video_chat": "Videobellen kan met een abonnement.",
    "likes": "Je dagelijkse likes zijn op. Met een abonnement krijg je er meer.",
}


def likes_left(user):
    """None = no limit, else how many likes are left today."""
    if not gate_on("likes"):
        return None
    ent = entitlements(user)
    if ent["likes"] is None:
        return None
    from apps.social.models import Like

    limit = max(settings()["free_likes_per_day"], ent["likes"] or 0)
    today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    return max(0, limit - Like.objects.filter(from_user=user, created_at__gte=today).count())


def locked_pages():
    """Pages that need a subscription: any page that a plan or a campaign lists."""
    if not modules.enabled("subscriptions"):
        return set()
    keys = set()
    for grants in list(Plan.objects.values_list("grants", flat=True)) + list(DonationCampaign.objects.values_list("grants", flat=True)):
        keys |= {g["ref"] for g in grants or [] if g.get("type") == "page"}
    return keys


def page_ok(user, key):
    return key not in locked_pages() or key in entitlements(user)["pages"] or entitlements(user)["full"]


def check_products(user, products):
    """Products that are only for subscribers (a 'service' grant lists them)."""
    if not modules.enabled("subscriptions"):
        return
    listed = set()
    for grants in Plan.objects.values_list("grants", flat=True):
        listed |= {str(g["ref"]) for g in grants or [] if g.get("type") == "service"}
    ent = entitlements(user)
    for p in products:
        if str(p.id) in listed and not (ent["full"] or str(p.id) in ent["services"]):
            raise SubError(f"'{p.name}' is alleen te bestellen met een abonnement.")


def locked_products():
    if not modules.enabled("subscriptions"):
        return set()
    out = set()
    for grants in Plan.objects.values_list("grants", flat=True):
        out |= {str(g["ref"]) for g in grants or [] if g.get("type") == "service"}
    return out


# ── orders ───────────────────────────────────────────────────────────────────
def _order(user, kind, ref_id, title, amount, vat_rate, period_no=1, contact=None):
    from apps.shop.models import Order, OrderItem
    from apps.shop.service import settings as shop_settings

    c = contact or {}
    amount = money(amount)
    vat = money(amount - amount / (1 + Decimal(str(vat_rate)) / 100)) if vat_rate else Decimal("0.00")
    name = c.get("name") or (user.get_full_name() or user.email or user.username if user else "") or "Onbekend"
    order = Order.objects.create(
        token=secrets.token_urlsafe(18), kind=kind, ref_id=ref_id, period_no=period_no, status="new", name=name[:150],
        email=(c.get("email") or (user.email if user else "") or "")[:254], phone=(getattr(user, "phone", "") or "")[:30],
        street=(c.get("street") or getattr(user, "address", "") or "-")[:200], postal_code=(getattr(user, "postal_code", "") or "-")[:20],
        city=(getattr(user, "city", "") or "-")[:100], country=(getattr(user, "country", "") or "NL")[:2], subtotal=amount, vat_total=vat, total=amount,
        currency=shop_settings()["currency"], user=user, shipping_method="-")
    order.number = f"{order.created_at.year}-{order.id:05d}"
    order.save(update_fields=["number"])
    OrderItem.objects.create(order=order, product=None, name=title[:200], sku=kind, unit_price=amount, quantity=1, line_total=amount, vat_rate=vat_rate or 0, vat_amount=vat)
    return order


def ensure_can_pay():
    """Fail before anything is created when online payment is required but not available."""
    from apps.sandbox import service as sandbox
    from apps.shop.service import settings as shop_settings

    if shop_settings()["pay_online"] and not sandbox.active("payments"):
        raise SubError("Online betalen is nog niet beschikbaar.")


def start_payment(order, return_base=""):
    """Online (sandbox) payment, or pay by invoice. Returns the checkout path or None."""
    from apps.sandbox import service as sandbox
    from apps.shop.service import settings as shop_settings

    if order.total <= 0:
        mark_paid(order)
        return None
    if shop_settings()["pay_online"]:
        if not sandbox.active("payments"):
            raise SubError("Online betalen is nog niet beschikbaar.")
        back = f"{return_base.rstrip('/')}/bestelling/{order.number}?t={order.token}" if return_base else ""
        payment = sandbox.create_payment(order.total, order.currency, f"Bestelling {order.number}", "mollie", back)
        order.status, order.payment_ref = "pending_payment", payment.ref
        order.save(update_fields=["status", "payment_ref"])
        return f"/sandbox/checkout/{payment.ref}"
    if settings()["invoice_activate"] or order.kind == "donation":
        mark_paid(order, note="op factuur")
    return None


def mark_paid(order, note=""):
    if order.status not in ("paid", "completed"):
        order.status = "paid"
        order.save(update_fields=["status"])
    on_order_status(order, "new")


def _plan_period(plan, start):
    if plan.recurring:
        return start + timedelta(days=INTERVAL_DAYS[plan.interval])
    return start + timedelta(days=plan.duration_days) if plan.duration_days else None


def interval_label(plan):
    return dict(__import__("apps.subscriptions.models", fromlist=["INTERVALS"]).INTERVALS).get(plan.interval, plan.interval)


def subscribe(user, plan, return_base=""):
    if not plan.active:
        raise SubError("Dit abonnement is niet meer te koop.")
    if plan.price > 0 and not (plan.trial_days):
        ensure_can_pay()
    if Subscription.objects.filter(user=user, plan=plan, status__in=LIVE).exclude(status="canceled").exists():
        raise SubError("Je hebt dit abonnement al.")
    for old in Subscription.objects.filter(user=user, plan=plan, status="pending"):  # an unfinished earlier try
        open_orders(old).update(status="canceled")
        old.status = "expired"
        old.save(update_fields=["status"])
    now = timezone.now()
    with transaction.atomic():
        sub = Subscription.objects.create(user=user, plan=plan, price=plan.price, status="pending")
        if plan.trial_days and plan.price > 0:
            sub.status, sub.started_at, sub.period_start, sub.period_end = "trial", now, now, now + timedelta(days=plan.trial_days)
            sub.save()
            logger.info("Subscription %s: trial for %s", sub.pk, user.pk)
            _mail(user, f"Je proefperiode van {plan.name} is gestart", f"Je kunt {plan.trial_days} dagen gratis gebruikmaken van {plan.name}. Daarna wordt het eerste bedrag in rekening gebracht.")
            return sub, None
        order = _order(user, "subscription", sub.pk, f"{plan.name} ({interval_label(plan).lower()})", plan.price, plan.vat_rate, 1)
    path = start_payment(order, return_base)
    sub.refresh_from_db()
    return sub, path or None


def _repeat_order(sub):
    return _order(sub.user, "subscription", sub.pk, f"{sub.plan.name} ({interval_label(sub.plan).lower()}), periode {sub.periods + 1}", sub.price, sub.plan.vat_rate, sub.periods + 1)


def on_order_status(order, old):
    """Called when an order changes status (payment, admin). Paid -> access starts or is extended; canceled -> pending things end."""
    if order.kind == "shop" or not modules.enabled("subscriptions"):
        return
    paid = order.status in ("paid", "processing", "shipped", "completed")
    if order.kind == "subscription":
        sub = Subscription.objects.filter(pk=order.ref_id).select_related("plan", "user").first()
        if not sub:
            return
        if paid and old not in ("paid", "processing", "shipped", "completed"):
            _activate(sub, order)
        elif order.status in ("canceled", "refunded") and old in ("new", "pending_payment") and sub.status == "pending":
            sub.status = "expired"
            sub.save(update_fields=["status"])


def on_payment(payment):
    """Donations are paid without an order (no webshop needed): the payment itself tells the outcome. Registered with the sandbox in apps.py."""
    d = Donation.objects.filter(payment_ref=payment.ref).select_related("campaign").first()
    if not d or not modules.enabled("donations"):
        return
    if payment.status == "paid" and d.status != "paid":
        now = timezone.now()
        d.status, d.paid_at = "paid", now
        if d.campaign.grants and d.amount >= d.campaign.min_for_grants:
            d.access_until = now + timedelta(days=d.campaign.grant_days)
        d.save()
        _mail_donation(d)
    elif payment.status in ("failed", "canceled", "expired") and d.status == "pending":
        d.status = "failed"
        d.save(update_fields=["status"])
    elif payment.status == "refunded":
        d.status, d.access_until = "failed", None
        d.save(update_fields=["status", "access_until"])


def _activate(sub, order):
    now = timezone.now()
    grace = timedelta(days=settings()["grace_days"])
    # a repeat continues where the last period ended (also when paid a little late); a long lapse starts fresh
    start = sub.period_end if sub.period_end and order.period_no > 1 and sub.period_end > now - grace else now
    sub.period_start, sub.period_end = start, _plan_period(sub.plan, start)
    sub.status = "canceled" if sub.cancel_at_period_end else "active"
    sub.started_at = sub.started_at or now
    sub.periods = max(sub.periods + 1, order.period_no)
    sub.save()
    first = sub.periods == 1
    if first:
        _mail(sub.user, f"Je abonnement {sub.plan.name} is actief", f"Bedankt! Je abonnement {sub.plan.name} loopt tot {sub.period_end:%d-%m-%Y}." if sub.period_end else f"Bedankt! Je abonnement {sub.plan.name} is actief.")
    logger.info("Subscription %s active until %s (period %s)", sub.pk, sub.period_end, sub.periods)


def cancel(sub, now_=False):
    """The member cancels: access stays until the end of the paid period. `now_` ends it immediately (admin)."""
    if sub.status in ("expired",):
        return sub
    if now_ or not sub.period_end:
        sub.status, sub.period_end = "expired", timezone.now() if sub.period_end else None
        sub.cancel_at_period_end = False
    else:
        sub.cancel_at_period_end, sub.status = True, ("canceled" if sub.status != "pending" else "expired")
    sub.save()
    open_orders(sub).update(status="canceled")  # an unpaid repeat is no longer needed
    return sub


def resume(sub):
    if sub.status == "canceled" and sub.period_end and sub.period_end > timezone.now():
        sub.cancel_at_period_end, sub.status = False, "active"
        sub.save()
    return sub


def open_orders(sub):
    from apps.shop.models import Order

    return Order.objects.filter(kind="subscription", ref_id=sub.pk, status__in=("new", "pending_payment"))


def process_due(user=None):
    """Repeat orders for periods that ended, grace for unpaid ones, expiry. Safe to run often (cron / command, and when a member opens their page)."""
    now, grace, done = timezone.now(), timedelta(days=settings()["grace_days"]), 0
    qs = Subscription.objects.filter(status__in=LIVE, period_end__lte=now).select_related("plan", "user")
    if user:
        qs = qs.filter(user=user)
    for sub in qs:
        if sub.cancel_at_period_end or not sub.plan.recurring or sub.status == "canceled":
            sub.status = "expired"
            sub.save(update_fields=["status"])
            open_orders(sub).update(status="canceled")
            done += 1
            continue
        pending = open_orders(sub).first()
        if sub.status == "past_due" and pending and now - sub.period_end > grace:
            sub.status = "expired"
            sub.save(update_fields=["status"])
            open_orders(sub).update(status="canceled")
            _mail(sub.user, f"Je abonnement {sub.plan.name} is verlopen", "We hebben geen betaling ontvangen. Je abonnement is beëindigd.")
            done += 1
        elif not pending:
            order = _repeat_order(sub)
            try:
                start_payment(order)
            except SubError:
                pass  # no online payment possible: the order stays open and the member sees it as unpaid
            sub.refresh_from_db()
            if sub.period_end and sub.period_end <= now and sub.status != "past_due":
                sub.status = "past_due"
                sub.save(update_fields=["status"])
                _mail(sub.user, f"Betaling voor {sub.plan.name}", f"Er staat een nieuwe betaling klaar ({sub.price} euro). Betaal binnen {settings()['grace_days']} dagen via je abonnementenpagina.")
            done += 1
    return done


def pay_open(sub, return_base=""):
    """The member pays an open repeat order: returns the checkout path."""
    order = open_orders(sub).order_by("-id").first()
    if not order:
        raise SubError("Er staat niets open.")
    return start_payment(order, return_base), order


# ── donations ────────────────────────────────────────────────────────────────
def donate(campaign, amount, user=None, name="", email="", message="", anonymous=False, return_base="", return_path=""):
    if not campaign.active:
        raise SubError("Deze actie is gesloten.")
    try:
        amount = money(amount)
    except Exception:  # noqa: BLE001
        raise SubError("Ongeldig bedrag.")
    if not campaign.min_amount <= amount <= campaign.max_amount:
        raise SubError(f"Het bedrag is tussen {campaign.min_amount} en {campaign.max_amount}.")
    if campaign.step > 0 and ((amount - campaign.min_amount) / campaign.step) % 1 != 0 and amount != campaign.max_amount:
        amount = campaign.min_amount + ((amount - campaign.min_amount) / campaign.step).to_integral_value(rounding=ROUND_HALF_UP) * campaign.step
        amount = min(max(amount, campaign.min_amount), campaign.max_amount)
    from apps.sandbox import service as sandbox

    if not sandbox.active("payments"):
        raise SubError("Online betalen is nog niet beschikbaar.")  # a gift needs a real (or simulated) payment: no paying by invoice
    if not user and not email:
        raise SubError("Vul je e-mailadres in, dan sturen we een bevestiging.")
    from apps.security.words import find_forbidden

    if message and find_forbidden(message):
        raise SubError("Je bericht bevat niet toegestane woorden.")
    who = name or ((user.get_full_name() or user.username) if user else "")
    d = Donation.objects.create(campaign=campaign, user=user, name=who[:120], email=(email or (user.email if user else ""))[:254], amount=amount,
                                message=(message if campaign.allow_message else "")[:300], anonymous=bool(anonymous and campaign.allow_anonymous))
    path = return_path if return_path.startswith("/") and not return_path.startswith("//") else "/doneren"
    back = f"{return_base.rstrip('/')}{path}{'&' if '?' in path else '?'}bedankt={campaign.id}" if return_base else ""
    payment = sandbox.create_payment(amount, "EUR", f"Donatie {campaign.name}", "mollie", back)
    d.payment_ref = payment.ref
    d.save(update_fields=["payment_ref"])
    return d, f"/sandbox/checkout/{payment.ref}"


def raised(campaign):
    from django.db.models import Count, Sum

    r = campaign.donations.filter(status="paid").aggregate(total=Sum("amount"), n=Count("id"))
    return {"total": r["total"] or Decimal("0.00"), "count": r["n"]}


def _mail(user, subject, body):
    try:
        from apps.communication import sending

        if user and user.email:
            sending.send_email(user.email, subject, body, purpose="notifications")
    except Exception as e:  # noqa: BLE001  e-mail problems never block a payment
        logger.warning("Subscription mail failed: %s", e)


def _mail_donation(d):
    try:
        from apps.communication import sending

        if d.email:
            sending.send_email(d.email, f"Bedankt voor je donatie aan {d.campaign.name}", f"Bedankt{(' ' + d.name) if d.name else ''}! We hebben je donatie van € {d.amount} ontvangen.", purpose="notifications")
    except Exception as e:  # noqa: BLE001
        logger.warning("Donation mail failed: %s", e)
