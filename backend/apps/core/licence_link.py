# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The tab Licentie of easy2edit admin setup: the licence of this website with the company and the person (the owner) that are linked to it, and the other companies and persons around it.
A change of the company or the owner is saved here (entity, user, licence and system settings stay in line) AND sent to the easy2edit master site (siteowners.push: the same company and
person there, their ids stay the same)."""
import re

from django.contrib.auth import get_user_model

from . import entity, phone, siteowners, sitemanager, system
from .models import Entity, License

COMPANY_KEYS = tuple(k for k in entity.FIELDS if k != "description")
OWNER_KEYS = ("first_name", "last_name", "email", "phone", "mobile")


def _owner_dict(u):
    return {k: str(getattr(u, k, "") or "") for k in OWNER_KEYS} | {"remote_id": str(u.remote_id or "")} if u else None


def master_state():
    st = sitemanager._state()
    is_master = sitemanager.server_enabled()
    return {"is_master": is_master, "connected": is_master or bool(st.get("token")), "synced": is_master or siteowners.synced(), "last_ok_at": st.get("last_ok_at") or "", "last_error": st.get("last_error") or "",
            "removed": bool(st.get("owner_removed"))}


def overview():
    lic = system.license_info()
    own = entity.own() if entity.filled() else None
    owner = siteowners.owner_user()
    company = ({**{k: str(getattr(own, k) or "") for k in COMPANY_KEYS}, "uid": str(own.uid), "remote_id": str(own.remote_id or ""), "kind": entity.kind_label(own)} if own else None)
    linked = {}
    if own:
        for u in own.users.all()[:100]:
            linked[u.pk] = u
    if owner:
        linked[owner.pk] = owner
    persons = [{"id": u.pk, "name": (u.get_full_name() or u.email or u.username or "")[:120], "email": u.email or "", "owner": bool(owner and u.pk == owner.pk)} for u in linked.values()]
    persons.sort(key=lambda p: (not p["owner"], p["name"].lower()))
    others = [{"id": e.pk, "name": e.name or e.legal_name or "", "kind": entity.kind_label(e), "city": e.city or "", "users": e.users.count()} for e in Entity.objects.filter(is_own=False).order_by("name")[:100]]
    return {"licence": {"has": lic["has"], "number": lic["number"], "client": lic["client"], "client_address": lic["client_address"], "valid_until": lic["valid_until"], "expired": lic["expired"], "reseller": lic["reseller"]},
            "company": company, "owner": _owner_dict(owner), "persons": persons, "companies": others, "master": master_state()}


def update(company=None, owner=None):
    """Save the company and the owner here and send them to the master site. Returns (overview, push_result). Raises ValueError (message for the person)."""
    own = entity.own()
    if company is not None:
        merged = {**{k: str(getattr(own, k) or "") for k in COMPANY_KEYS}, **{k: v for k, v in company.items() if k in COMPANY_KEYS}}
        if not str(merged.get("name") or "").strip():
            raise ValueError("De naam van het bedrijf is nodig.")
        cleaned = entity.clean(merged)
        for k in COMPANY_KEYS:
            setattr(own, k, cleaned[k])
        own.save()
    user = siteowners.owner_user()
    if owner is not None and user is not None:
        email = str(owner.get("email", user.email) or "").strip().lower()
        if not entity.EMAIL_RE.match(email):
            raise ValueError("Het e-mailadres van de persoon is niet geldig.")
        User = get_user_model()
        if email != str(user.email or "").lower():
            if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
                raise ValueError("Dit e-mailadres hoort al bij een andere gebruiker.")
            if str(user.username or "").lower() == str(user.email or "").lower():
                user.username = email[:150]
            user.email = email
        user.first_name = str(owner.get("first_name", user.first_name) or "").strip()[:60]
        user.last_name = str(owner.get("last_name", user.last_name) or "").strip()[:60]
        for k in ("phone", "mobile"):
            if k in owner:
                v, bad = phone.check(owner.get(k), 20)
                if bad:
                    raise ValueError(bad)
                setattr(user, k, re.sub(r"[^\d+]", "", v)[:20])
        user.save()
    _mirror(own, siteowners.owner_user())
    return push()


def _mirror(own, user):
    """The licence and the system settings (the form of the onboarding) follow the company and the contact person, so that every screen shows the same."""
    cleaned = {"company_name": own.name, "street": own.street, "house_number": own.house_number, "postal_code": own.postal_code, "city": own.city, "country": own.country, "kvk": own.registration_no, "vat_id": own.vat_no}
    if own.phone:
        cleaned["phone"] = own.phone
    if user:
        cleaned.update(contact_email=user.email, contact_first_name=user.first_name, contact_last_name=user.last_name, **({"mobile": user.mobile} if user.mobile else {}))
    system.save(cleaned)
    lic = License.objects.filter(pk=1).first()
    if lic:
        lic.client = (own.name or lic.client)[:200]
        lic.client_parts = {k: cleaned[k] for k in system.ADDRESS_PARTS}
        lic.client_address = (system.get().get("address") or lic.client_address or "")[:300]
        lic.save(update_fields=["client", "client_parts", "client_address"])
        system.license_changed()


def push():
    """Send the company and the owner to the master site now. -> {ok, error}: ok also when this installation is the master itself or there is nothing to send."""
    r = siteowners.push(force=True)
    return {"ok": bool(r.get("ok")), "error": str(r.get("error") or r.get("skipped") or "")}
