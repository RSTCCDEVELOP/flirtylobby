# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Paying on account (op rekening): a user or a company may buy AI credit that is invoiced later, up to a maximum open amount. A superadmin switches it on per user or company and sets the maximum;
only a superadmin+ (is_superuser) buys on account without a maximum. The purchase is booked at once (the credit is added); it stays 'open' until the superadmin marks it paid."""
from decimal import Decimal, InvalidOperation

from django.utils import timezone

MAX_LIMIT = Decimal("1000000")


def _open_qs(owner, is_entity):
    from apps.integrations.models import AiTopup

    qs = AiTopup.objects.filter(via="account", status="paid", settled=False)
    return qs.filter(payer_entity=owner.pk) if is_entity else qs.filter(user=owner, payer_entity__isnull=True)


def open_amount(owner, is_entity=False):
    return sum((t.amount for t in _open_qs(owner, is_entity)), Decimal("0"))


def info(owner, is_entity=False, plus=False):
    """{on, limit, open, may}: the switch, the maximum open amount, what is open now, and whether the person who looks may buy on account (the switch, or a superadmin+)."""
    return {"on": bool(owner.pay_on_account), "limit": float(owner.account_limit or 0), "open": float(open_amount(owner, is_entity)), "may": bool(owner.pay_on_account or plus)}


def check(owner, amount, is_entity=False, plus=False):
    """Raises ValueError (the reason) when this amount may not be bought on account."""
    if not (owner.pay_on_account or plus):
        raise ValueError("Betalen op rekening staat hier niet aan.")
    limit = Decimal(str(owner.account_limit or 0))
    if limit <= 0 and not plus:
        raise ValueError("Er is geen bedrag ingesteld dat op rekening open mag staan.")
    if not plus and open_amount(owner, is_entity) + Decimal(str(amount)) > limit:
        raise ValueError(f"Dat past niet binnen het maximum: er staat al € {open_amount(owner, is_entity):.2f} open van maximaal € {limit:.2f}.")


def set_fields(owner, body, by):
    """The switch and the maximum, from {pay_on_account, account_limit}: only a superadmin may change them. Raises ValueError for a wrong amount."""
    if not getattr(by, "is_staff", False):
        return
    if "pay_on_account" in body:
        owner.pay_on_account = bool(body.get("pay_on_account"))
    if "account_limit" in body:
        try:
            v = Decimal(str(body.get("account_limit") or 0)).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            raise ValueError("Geef het maximum als een bedrag.")
        if v < 0 or v > MAX_LIMIT:
            raise ValueError("Het maximum moet tussen 0 en 1.000.000 liggen.")
        owner.account_limit = v
    owner.save(update_fields=["pay_on_account", "account_limit"])


def settle(owner, is_entity=False):
    """The open amounts are paid: they are marked settled. Returns how many."""
    return _open_qs(owner, is_entity).update(settled=True, settled_at=timezone.now())
