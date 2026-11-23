# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Payment details of a company AND of a user (tab Betaalgegevens): several ways to pay, kept ENCRYPTED in the database.

- The whole list is ONE blob (`Entity.payments_enc`): holder names, IBANs, mandate references, PayPal addresses, everything. Nothing of it is readable in the database, in a dump or in a backup.
- Fernet (AES-128-CBC + HMAC-SHA256, random IV per save) with a key of its own: `PAYMENT_ENCRYPTION_KEY` from the environment (advised, keep it outside the database), otherwise derived from SECRET_KEY.
  The key is derived per purpose (never the raw SECRET_KEY) and the blob is bound to its company (uid inside): a blob copied to another row is refused.
- Card numbers are NEVER stored (that needs PCI certification): pay by card goes through the payment provider (Stripe link).
- The screens get the sensitive values MASKED; the full values only come through `reveal()` (own request, needs edit rights, logged without data).
- Someone who has no edit right on the entity module (or the user module, for a user) gets nothing (see entity_views, accounts/payment_views).
- The owner is any model with `uid`, `payments_enc` and `save(update_fields)`: a company (Entity) or a person (User). The blob is bound to the kind AND the uid of its owner."""
import base64
import hashlib
import json
import logging
import re
import uuid
from datetime import date

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)

KINDS = [("bank", "Bankrekening"), ("sepa", "Automatische incasso (SEPA)"), ("paypal", "PayPal"), ("other", "Anders")]
KIND_KEYS = [k for k, _ in KINDS]
MAX_ITEMS = 10
FIELDS = {  # per kind: field -> max length
    "bank": {"holder": 120, "iban": 42, "bic": 11, "bank_name": 80},
    "sepa": {"holder": 120, "iban": 42, "bic": 11, "mandate_ref": 40, "mandate_date": 10},
    "paypal": {"email": 160},
    "other": {"value": 200},
}
SENSITIVE = ("iban", "email", "value", "mandate_ref")  # shown masked on the screens
IBAN_RE = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$")
BIC_RE = re.compile(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


class Locked(Exception):
    """The stored blob cannot be read (the key changed or the data was copied): it is never overwritten by accident."""


def _fernet():
    secret = getattr(settings, "PAYMENT_ENCRYPTION_KEY", "") or settings.SECRET_KEY
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("easy2edit-entity-payments|" + secret).encode()).digest()))


def _owner_key(owner):
    return f"{owner._meta.model_name}:{owner.uid}"


def seal(entity, items):
    """The list -> the encrypted text for the database ("" for an empty list)."""
    if not items:
        return ""
    return _fernet().encrypt(json.dumps({"uid": _owner_key(entity), "items": items}).encode()).decode()


def unseal(entity):
    """The stored list of this company (full values). Raises Locked when it cannot be read."""
    if not entity.payments_enc:
        return []
    try:
        data = json.loads(_fernet().decrypt(entity.payments_enc.encode()))
    except (InvalidToken, ValueError) as e:
        raise Locked("De betaalgegevens kunnen niet worden gelezen (andere sleutel?).") from e
    if data.get("uid") != _owner_key(entity):
        raise Locked("De betaalgegevens horen bij een ander bedrijf of een andere persoon.")
    return data.get("items") or []


# ── checks and display ──
def iban_ok(iban):
    """IBAN checksum (mod 97)."""
    if not IBAN_RE.match(iban):
        return False
    moved = iban[4:] + iban[:4]
    return int("".join(str(int(c, 36)) for c in moved)) % 97 == 1


def format_iban(iban):
    return " ".join(iban[i:i + 4] for i in range(0, len(iban), 4))


def hint(field, value):
    """The masked form of a sensitive value: NL91 •••• •••• 00, j•••@x.nl, ••••1234."""
    v = str(value or "")
    if not v:
        return ""
    if field == "iban":
        c = v.replace(" ", "")
        return f"{c[:4]} •••• •••• {c[-2:]}" if len(c) > 8 else "••••"
    if field == "email":
        name, _, dom = v.partition("@")
        return f"{name[:1]}•••@{dom}"
    return f"••••{v[-4:]}" if len(v) > 6 else "••••"


def masked(items):
    out = []
    for it in items:
        row = {k: v for k, v in it.items() if k not in SENSITIVE}
        for f in SENSITIVE:
            if it.get(f):
                row[f] = hint(f, it[f])
        out.append(row)
    return out


def _clean_item(raw, old):
    """One entry, checked. Sensitive fields that still hold the masked text keep their stored value."""
    kind = str(raw.get("kind") or "")
    if kind not in KIND_KEYS:
        raise ValueError("Kies een soort betaalgegeven.")
    label = re.sub(r"[\r\n\t]+", " ", str(raw.get("label") or "")).strip()[:80]
    if not label:
        raise ValueError("Geef elk betaalgegeven een naam.")
    item = {"id": str(raw.get("id") or "") if re.match(r"^[0-9a-f-]{36}$", str(raw.get("id") or "")) else str(uuid.uuid4()), "kind": kind, "label": label,
            "default": bool(raw.get("default")), "note": re.sub(r"[\r\t]+", " ", str(raw.get("note") or "")).strip()[:300]}
    for f, lim in FIELDS[kind].items():
        v = str(raw.get(f) or "").strip()[:lim]
        if f in SENSITIVE and old and v == hint(f, old.get(f)):
            v = old.get(f, "")  # not changed: the stored value stays
        item[f] = v
    if "iban" in item:
        item["iban"] = item["iban"].replace(" ", "").upper()
        if not item["iban"]:
            raise ValueError(f"Vul bij \"{label}\" het IBAN in.")
        if not iban_ok(item["iban"]):
            raise ValueError(f"Het IBAN bij \"{label}\" is niet geldig.")
        item["iban"] = format_iban(item["iban"])
    if "bic" in item:
        item["bic"] = item["bic"].replace(" ", "").upper()
        if item["bic"] and not BIC_RE.match(item["bic"]):
            raise ValueError(f"De BIC bij \"{label}\" is niet geldig.")
    if kind in ("bank", "sepa") and not item["holder"]:
        raise ValueError(f"Vul bij \"{label}\" de naam van de rekeninghouder in.")
    if kind == "paypal" and not EMAIL_RE.match(item["email"]):
        raise ValueError(f"Het PayPal-adres bij \"{label}\" is niet geldig.")
    if kind == "other" and not item["value"]:
        raise ValueError(f"Vul bij \"{label}\" de gegevens in.")
    if item.get("mandate_date"):
        try:
            date.fromisoformat(item["mandate_date"])
        except ValueError as e:
            raise ValueError(f"De datum van de machtiging bij \"{label}\" is niet geldig.") from e
    return item


def save(entity, incoming, actor=None):
    """Replace the list. incoming: [{id?, kind, label, default, note, ...fields}]. Raises ValueError (message) or Locked (when the old blob is unreadable and nothing is sent to replace it)."""
    if not isinstance(incoming, list):
        raise ValueError("Ongeldige betaalgegevens.")
    if len(incoming) > MAX_ITEMS:
        raise ValueError(f"Maximaal {MAX_ITEMS} betaalgegevens per bedrijf.")
    try:
        old = {it["id"]: it for it in unseal(entity)}
    except Locked:
        old = {}  # unreadable: what is sent now replaces it (the person types it again)
    items = [_clean_item(r if isinstance(r, dict) else {}, old.get(str(r.get("id") or "")) if isinstance(r, dict) else None) for r in incoming]
    if items:
        first = next((i for i, it in enumerate(items) if it["default"]), 0)
        for i, it in enumerate(items):
            it["default"] = i == first  # exactly one is the standard
    entity.payments_enc = seal(entity, items)
    entity.save(update_fields=["payments_enc"])
    logger.info("payment details of %s %s changed by user %s (%d entries)", entity._meta.model_name, entity.pk, getattr(actor, "pk", None), len(items))
    return items


def reveal(entity, actor=None):
    """The full values (the person asked for them). Logged without the data."""
    items = unseal(entity)
    logger.info("payment details of %s %s shown to user %s", entity._meta.model_name, entity.pk, getattr(actor, "pk", None))
    return items
