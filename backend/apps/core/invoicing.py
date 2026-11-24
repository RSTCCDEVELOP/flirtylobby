# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The invoices of the easy2edit server (the master site).

Everything a website owes the master (AI credit bought on account, later licence, hosting and other things) becomes a LINE on the invoice of that website for that month, made out to a company or
a person and linked to the reseller of the website.

Website side (`charge()`): the charge is put in the outbox and sent to the master at once (`send_pending()` is also run by the background controller until every charge is delivered). On the master
itself the charge goes straight into the invoices. The reference of a charge is unique, so a charge that arrives twice is one line.
Master side (`add_charge()`): finds or makes the open invoice of the website for the payer and the month, adds the line. `visible_to(user)` says which invoices a logged-in person may look at:
a superadmin+ all of them; a reseller (a login of the reseller on the master) those of the reseller's websites; a customer those that are made out to him or his company, or of his own website."""
import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from . import sitemanager, siteowners
from .models import ChargeOutbox, Entity, Invoice, InvoiceLine, ResellerLogin

logger = logging.getLogger(__name__)
KINDS = {k for k, _ in InvoiceLine.KINDS}
DEFAULT_VAT = Decimal("21")
DUE_DAYS = 14


def vat_rate():
    try:
        return Decimal(str(getattr(settings, "INVOICE_VAT_RATE", DEFAULT_VAT)))
    except InvalidOperation:
        return DEFAULT_VAT


# ── website side ──
def charge(ref, kind, description, amount_incl, payer=None):
    """Put a charge in the outbox and try to send it. payer = {kind: company|person, name, vat, email, address, is_own}. Returns the outbox row; never raises."""
    try:
        row, new = ChargeOutbox.objects.get_or_create(ref=str(ref)[:80], defaults={"payload": {
            "ref": str(ref)[:80], "kind": kind if kind in KINDS else "other", "description": str(description)[:200], "amount_incl": str(Decimal(str(amount_incl)).quantize(Decimal("0.01"))),
            "vat_rate": str(vat_rate()), "payer": payer or {}}})
        if new:
            send_pending()
        return row
    except Exception:  # noqa: BLE001 - a charge that can not be kept must never break the purchase itself
        logger.exception("invoicing: charge")
        return None


def _post_charge(payload):
    api = sitemanager.global_settings.get()["api_url"]
    key = sitemanager._state().get("token") or ""
    if not key:
        raise ValueError("Deze website is nog niet verbonden met de easy2edit server.")
    return sitemanager._post(f"{api}/api/easy2edit/invoices/charge/", payload, key)


def send_pending(limit=20):
    """Send the charges that are not delivered yet. Returns how many were delivered."""
    n = 0
    for row in ChargeOutbox.objects.filter(sent=False).order_by("id")[:limit]:
        try:
            if sitemanager.server_enabled():  # this installation is the master: the charge goes straight into its invoices
                site = sitemanager.EasySite.objects.filter(instance_id=sitemanager.instance_id()).first()
                number = add_charge(site, row.payload)
            else:
                number = str(_post_charge(row.payload).get("number") or "")
        except Exception as e:  # noqa: BLE001
            ChargeOutbox.objects.filter(pk=row.pk).update(tries=row.tries + 1, last_error=str(e)[:200])
            continue
        ChargeOutbox.objects.filter(pk=row.pk).update(sent=True, number=number[:20], last_error="")
        n += 1
    return n


def payer_from(user, entity=None):
    """The payer of a charge as it travels: a company of the website (its name, VAT number, address) or the person himself."""
    if entity is not None:
        return {"kind": "company", "name": entity.legal_name or entity.name or "", "vat": entity.vat_no or "", "email": entity.email or user.email or "", "is_own": bool(entity.is_own),
                "address": {k: getattr(entity, k) or "" for k in ("street", "house_number", "postal_code", "city", "country")}, "user_email": user.email or ""}
    return {"kind": "person", "name": (user.get_full_name() or user.email or user.username or "")[:160], "vat": "", "email": user.email or "", "is_own": False, "address": {}, "user_email": user.email or ""}


# ── master side ──
def _by_domain(model, host, **flt):
    for o in model.objects.filter(**flt):
        if host and host in (o.domains or []):
            return o
    return None


def _number(now):
    year = now.strftime("%Y")
    last = Invoice.objects.filter(number__startswith=f"{year}-").order_by("-number").values_list("number", flat=True).first()
    return f"{year}-{int(last.split('-')[1]) + 1 if last else 1:04d}"


@transaction.atomic
def add_charge(site, data):
    """A charge of a website comes in. Returns the number of the invoice it is on. The same reference twice is one line (idempotent)."""
    ref = str(data.get("ref") or "").strip()[:80]
    if not ref:
        raise ValueError("Een betaling heeft een kenmerk nodig.")
    old = InvoiceLine.objects.filter(ref=ref).select_related("invoice").first()
    if old:
        return old.invoice.number
    try:
        amount = Decimal(str(data.get("amount_incl"))).quantize(Decimal("0.01"))
        vr = Decimal(str(data.get("vat_rate") or vat_rate()))
    except (InvalidOperation, ValueError):
        raise ValueError("Het bedrag klopt niet.")
    if amount <= 0 or amount > Decimal("1000000") or not (0 <= vr <= 100):
        raise ValueError("Het bedrag of het btw-percentage klopt niet.")
    kind = data.get("kind") if data.get("kind") in KINDS else "other"
    p = data.get("payer") if isinstance(data.get("payer"), dict) else {}
    bill_kind = "company" if p.get("kind") == "company" else "person"
    name = str(p.get("name") or "")[:160]
    host = siteowners.host_of(site.url) if site else ""
    User = get_user_model()
    owner = _by_domain(User, host)  # the owner of the website on the master
    company = _by_domain(Entity, host, is_own=False)  # the company of the website on the master
    person = None
    if p.get("user_email"):
        person = User.objects.filter(email__iexact=str(p["user_email"])[:200]).first()
    person = person or owner
    entity = company if (bill_kind == "company" and (p.get("is_own") or (company and company.name.lower() == name.lower()))) else None
    period = timezone.now().strftime("%Y-%m")
    key = dict(site=site, bill_kind=bill_kind, bill_name=name, period=period, status="open")
    inv = Invoice.objects.filter(**key).order_by("-id").first()
    if not inv:
        now = timezone.now()
        inv = Invoice.objects.create(number=_number(now), reseller=site.reseller if site else None, entity=entity, person=person, bill_email=str(p.get("email") or "")[:160], bill_vat=str(p.get("vat") or "")[:40],
                                     bill_address=p.get("address") if isinstance(p.get("address"), dict) else {}, due_at=(now + timedelta(days=DUE_DAYS)).date(), **key)
    InvoiceLine.objects.create(invoice=inv, kind=kind, description=str(data.get("description") or "")[:200], amount_incl=amount, vat_rate=vr, ref=ref)
    return inv.number


def totals(inv):
    incl = ex = Decimal("0")
    for l in inv.lines.all():
        e = (l.amount_incl / (1 + l.vat_rate / 100)).quantize(Decimal("0.01"))
        incl += l.amount_incl
        ex += e
    return {"ex": float(ex), "vat": float(incl - ex), "incl": float(incl)}


def serialize(inv, detail=False):
    out = {"id": inv.pk, "number": inv.number, "status": inv.status, "period": inv.period, "issued_at": inv.issued_at.isoformat(), "due_at": inv.due_at.isoformat() if inv.due_at else "", "paid_at": inv.paid_at.isoformat() if inv.paid_at else "",
           "bill_kind": inv.bill_kind, "bill_name": inv.bill_name, "site": inv.site.name or inv.site.url if inv.site else "", "reseller": inv.reseller.name if inv.reseller else "", "currency": inv.currency, **totals(inv)}
    if detail:
        out.update({"bill_vat": inv.bill_vat, "bill_email": inv.bill_email, "bill_address": inv.bill_address,
                    "lines": [{"kind": l.kind, "kind_label": dict(InvoiceLine.KINDS).get(l.kind, l.kind), "description": l.description, "amount_incl": float(l.amount_incl), "vat_rate": float(l.vat_rate),
                               "amount_ex": float((l.amount_incl / (1 + l.vat_rate / 100)).quantize(Decimal("0.01"))), "at": l.created.isoformat()} for l in inv.lines.all()]})
    return out


def reseller_ids(user):
    """The resellers this person is a login of on the master (a login with 'host' on: may log in on the easy2edit site itself)."""
    if not user.email:
        return []
    return list(ResellerLogin.objects.filter(email__iexact=user.email, active=True, host=True).values_list("reseller_id", flat=True))


def visible_to(user):
    """The invoices this logged-in person may look at."""
    if not user.is_authenticated:
        return Invoice.objects.none()
    if user.is_superuser:
        return Invoice.objects.all()
    q = Q(person=user) | Q(entity__users=user)
    rids = reseller_ids(user)
    if rids:
        q |= Q(reseller_id__in=rids)
    host_sites = [s.pk for s in sitemanager.EasySite.objects.all() if siteowners.host_of(s.url) in (user.domains or [])] if user.domains else []
    if host_sites:
        q |= Q(site_id__in=host_sites)
    return Invoice.objects.filter(q).distinct()


def mark_paid(inv, paid=True):
    inv.status, inv.paid_at = ("paid", timezone.now()) if paid else ("open", None)
    inv.save(update_fields=["status", "paid_at"])
    return inv
