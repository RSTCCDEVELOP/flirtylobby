# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A licence changes (made, renewed, changed, a new number, removed, a subscription started or stopped): an e-mail goes to the groups that are set in Default and global settings
(Licence e-mails): RST CC, Reseller, Invoicing and Support. The reseller group falls back to the reseller e-mail of the licence itself. Sent in the background."""
import logging
import os
import threading

from django.utils import timezone

from . import global_settings, system

logger = logging.getLogger(__name__)

GROUPS = (("notify_rstcc", "RST CC"), ("notify_reseller", "Reseller"), ("notify_invoicing", "Invoicing"), ("notify_support", "Support"))
EVENTS = {"created": "Licentie aangemaakt", "renewed": "Licentie verlengd", "changed": "Licentie gewijzigd", "number": "Nieuw licentienummer", "removed": "Licentie verwijderd",
          "sub_started": "Abonnement gestart", "sub_stopped": "Abonnement gestopt"}
TRACKED = {"client": "Opdrachtgever", "client_address": "Adres opdrachtgever", "main_url": "Hoofd-URL", "valid_until": "Verlengdatum", "renew_months": "Abonnement (maanden)", "hosting": "Hosting",
           "base_price": "Basisprijs", "reseller_name": "Reseller", "reseller_email": "E-mail reseller", "reseller_url": "Link reseller", "payment_method": "Betaalmethode", "backup_included": "Backups inbegrepen", "backup_slot_price": "Prijs extra backup"}


def snapshot(lic):
    """The tracked fields of a licence as text, to see afterwards what changed."""
    return {k: str(getattr(lic, k, "") or "") for k in TRACKED} if lic else {}


def diff(before, after):
    return [f"{TRACKED[k]}: {before.get(k) or '–'} → {after.get(k) or '–'}" for k in TRACKED if before.get(k, "") != after.get(k, "")]


def recipients(lic=None):
    """{group label: [addresses]} for the groups that have an address (reseller: the licence's own reseller e-mail when the group is empty)."""
    from .models import License

    g = global_settings.get()
    lic = lic or License.objects.filter(pk=1).first()
    out = {}
    for key, label in GROUPS:
        items = [x.strip() for x in str(g.get(key) or "").split(",") if x.strip()]
        if not items and key == "notify_reseller" and lic and lic.reseller_email:
            items = [lic.reseller_email]
        if items:
            out[label] = items
    return out


def _body(event, lines, by):
    from . import license_price
    from .models import License

    lic = License.objects.filter(pk=1).first()
    s = system.get()
    out = [f"{EVENTS[event]}", "", f"Website: {system.site_name() or s.get('company_name') or '-'}", f"Adres: {s.get('frontend_url') or '-'}"]
    if lic:
        out += [f"Licentienummer: {lic.number or '-'}", f"Opdrachtgever: {lic.client or '-'}", f"Geldig tot: {lic.valid_until.strftime('%d-%m-%Y') if lic.valid_until else '-'}",
                f"Abonnement: {lic.renew_months} maanden · prijs per periode € {license_price.total(lic)} (incl. btw)"]
    if lines:
        out += ["", "Wat er veranderd is:"] + [f"- {x}" for x in lines]
    out += ["", f"Door: {by or 'het systeem'}", f"Tijd: {timezone.localtime().strftime('%d-%m-%Y %H:%M')}"]
    return "\n".join(out)


def _send(event, lines, by):
    from apps.communication import sending

    to = recipients()
    if not to:
        return 0
    subject = f"{EVENTS[event]}: {system.site_name() or system.get().get('company_name') or 'website'}"
    body = _body(event, lines, by)
    sent = 0
    for addr in dict.fromkeys(a for group in to.values() for a in group):  # everybody once, also when an address is in two groups
        try:
            sending.send_email(addr, subject, body, purpose="security")
            sent += 1
        except Exception:  # noqa: BLE001
            logger.exception("licence mail to %s", addr)
    return sent


def notify(event, lines=None, by=None):
    """Tell the groups that the licence changed. event is a key of EVENTS; lines = what changed; by = who did it (an e-mail address or a user). In the background (at once in tests)."""
    by = getattr(by, "email", by) or ""
    try:
        if not recipients():
            return 0
    except Exception:  # noqa: BLE001 (before the first migration)
        return 0
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return _send(event, list(lines or []), by)
    threading.Thread(target=_send, args=(event, list(lines or []), by), daemon=True, name="licence-mail").start()
    return 1
