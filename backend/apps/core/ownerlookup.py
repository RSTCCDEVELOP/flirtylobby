# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Licence form: the contact e-mail address is known on the master site already -> offer to download the person and company data.

Three steps, always through the key of an approved website (see sitemanager_views):
  1. `lookup`  {email}              -> {exists}                  (nothing else is told); or `company` {name} -> {exists, hint} (hint = the masked e-mail address of the contact of that company)
  2. `send`    {email} or {company} -> {challenge, hint}         (a code goes to that address (the contact person of the company), also when the person uses SMS for the login)
  1b. `search` {q}                  -> {results: [{id, name, city}]}   (part of the name, the address, the postcode or an e-mail address; never an e-mail address back)
  1c. `contacts` {entity}           -> {contacts: [{id, name}]}        (the linked persons of that company: names only, to choose the contact person)
  3. `fetch`   {challenge, code}    -> {fields}                  (only after the right code: the data of the person and of the company, in the names of the licence form)

Server side (the master site): `lookup()`, `send()`, `fetch()`. Client side (this website): `ask()`, which calls the master site; on the master site itself there is nothing to ask."""
import re
import secrets

from django.contrib.auth import get_user_model
from django.core.cache import cache

from . import entity, sitemanager

TRIES = 5
LIFETIME = 600  # seconds: a challenge lives 10 minutes
NOTHING = {"search": {"results": []}, "contacts": {"contacts": []}}  # what a step answers when the master site cannot be asked
FORM_COMPANY = {"name": "company_name", "street": "street", "house_number": "house_number", "postal_code": "postal_code", "city": "city", "country": "country", "phone": "phone"}


def _email(v):
    e = str(v or "").strip().lower()[:254]
    return e if entity.EMAIL_RE.match(e) else ""


def _user(email):
    return get_user_model().objects.filter(email__iexact=email, is_active=True).first() if email else None


# ── server side: the master site ──
def _norm(name):
    """A company name to compare: lower case, no punctuation or spaces, without a legal form at the end ("RST Coaching en Consultancy B.V." = "rstcoachingenconsultancy")."""
    n = re.sub(r"[^a-z0-9]", "", str(name or "").lower())
    for form in ("bv", "nv", "vof", "llc", "ltd", "gmbh", "inc"):
        if n.endswith(form) and len(n) > len(form) + 2:
            return n[: -len(form)]
    return n


def _contact_of(e):
    return e.users.filter(is_active=True).exclude(email="").order_by("pk").first()


def find_company(name):
    """(company, contact user) of a company that has this name (or when only one company has this word in its name) and a person with a login; (None, None) when there is none. The own company of the master site is never found."""
    from .models import Entity

    key = _norm(name)
    if len(key) < 3:
        return None, None
    word = re.sub(r"[^A-Za-z0-9]", "", str(name or "").split()[0])[:4]
    part = []
    for e in Entity.objects.filter(is_own=False, name__icontains=word).order_by("pk")[:200]:
        n = _norm(e.name)
        if n == key:
            u = _contact_of(e)
            if u:
                return e, u
        elif key in n:
            part.append(e)
    contacts = [(e, _contact_of(e)) for e in part]
    contacts = [c for c in contacts if c[1]]
    return contacts[0] if len(contacts) == 1 else (None, None)


def search(site, q):
    """Companies that have a person with a login and match the words in the name, the address, the postcode or an e-mail address. -> {results: [{id, name, city}]} (at most 10; no e-mail address is given back)."""
    from django.db.models import Q

    from .models import Entity

    q = re.sub(r"\s+", " ", str(q or "")).strip()[:80]
    squeezed = re.sub(r"[^a-z0-9@.]", "", q.lower())
    if len(squeezed) < 3:
        return {"results": []}
    found = {}
    cond = Q(name__icontains=q) | Q(legal_name__icontains=q) | Q(street__icontains=q) | Q(city__icontains=q) | Q(postal_code__icontains=q) | Q(email__icontains=q) | Q(users__email__icontains=q)
    for e in Entity.objects.filter(is_own=False).filter(cond).distinct().order_by("name")[:60]:
        found[e.pk] = e
    key = _norm(q)
    if len(key) >= 3:  # spelling, spaces and the legal form do not matter ("rstcc", "1234ab")
        for e in Entity.objects.filter(is_own=False).order_by("name")[:2000]:
            if e.pk not in found and (key in _norm(e.name) or key in _norm(e.legal_name) or key in re.sub(r"[^a-z0-9]", "", str(e.postal_code or "").lower())):
                found[e.pk] = e
    out = []
    for e in found.values():
        if _contact_of(e):
            out.append({"id": e.pk, "name": e.name or e.legal_name, "city": e.city})
        if len(out) >= 10:
            break
    return {"results": out}


def contacts(site, entity_id):
    """The persons linked to a company, by name only (the contact person chooses who is the one). -> {contacts: [{id, name}]}."""
    from .models import Entity

    try:
        e = Entity.objects.filter(pk=int(entity_id), is_own=False).first()
    except (TypeError, ValueError):
        e = None
    if not e:
        return {"contacts": []}
    out = []
    for u in e.users.filter(is_active=True).exclude(email="").order_by("first_name", "last_name", "pk")[:25]:
        out.append({"id": u.pk, "name": (f"{u.first_name} {u.last_name}").strip() or "—"})
    return {"contacts": out}


def lookup_company(site, name):
    """-> {exists, hint}: only the fact and the masked address the code would go to."""
    from apps.security import twofa

    e, u = find_company(name)
    return {"exists": bool(u), "hint": twofa.mask_email(u.email) if u else ""}


def lookup(site, email):
    """-> {exists: bool}. Only the fact that the address is known."""
    return {"exists": bool(_user(_email(email)))}


def send(site, email, company="", entity=None, user_id=None):
    """A code to the e-mail address (always by e-mail: the person must be able to read that mailbox); with `company` it goes to the contact person of that company. -> {challenge, hint}. Raises ValueError (message)."""
    from apps.security import twofa

    entity_pk = None
    if entity and user_id:  # the contact person was chosen from the names that are linked to the company
        from .models import Entity

        try:
            comp = Entity.objects.filter(pk=int(entity), is_own=False).first()
            user = comp.users.filter(pk=int(user_id), is_active=True).exclude(email="").first() if comp else None
        except (TypeError, ValueError):
            comp, user = None, None
        email = user.email if user else ""
        entity_pk = comp.pk if comp else None
        key = f"ownerlookup:try:{site.pk}:e:{entity_pk}:{user.pk if user else 0}"
    elif company:
        comp, user = find_company(company)
        email = user.email if user else ""
        entity_pk = comp.pk if comp else None
        key = f"ownerlookup:try:{site.pk}:c:{_norm(company)}"
    else:
        email = _email(email)
        user = _user(email)
        key = f"ownerlookup:try:{site.pk}:{email}"
    if (cache.get(key) or 0) >= TRIES:
        raise ValueError("Te veel pogingen. Probeer het over 10 minuten opnieuw.")
    cache.set(key, (cache.get(key) or 0) + 1, LIFETIME)
    if not user:
        raise ValueError("Dit bedrijf is niet bekend." if (company or entity) else "Dit e-mailadres is niet bekend.")
    try:
        twofa.issue_code(user, force_email=True)  # (the code is never given back to the website that asks, also not in a sandbox: that would make the verification pointless)
    except twofa.DeliveryError as e:
        raise ValueError(str(e)) from e
    token = secrets.token_urlsafe(24)
    cache.set(f"ownerlookup:ch:{token}", {"user": user.pk, "site": site.pk, "entity": entity_pk, "tries": 0}, LIFETIME)
    return {"challenge": token, "hint": twofa.mask_email(user.email)}


def fields_of(user, entity_pk=None):
    """The data of the person and of the company (the chosen one, else the first of the person), in the field names of the licence form."""
    out = {"contact_first_name": user.first_name, "contact_last_name": user.last_name, "contact_email": user.email, "mobile": user.phone}
    comp = (user.entities.filter(pk=entity_pk, is_own=False).first() if entity_pk else None) or Entity_of(user)
    if comp:
        for src, dst in FORM_COMPANY.items():
            out[dst] = str(getattr(comp, src) or "")
    return {k: str(v or "") for k, v in out.items() if str(v or "").strip()}


def Entity_of(user):  # noqa: N802 - the company of this person: the first one that is not the own entity of the master site
    return user.entities.filter(is_own=False).order_by("pk").first() if hasattr(user, "entities") else None


def fetch(site, challenge, code):
    """The right code -> {fields}. Raises ValueError (message)."""
    from apps.security import twofa

    key = f"ownerlookup:ch:{challenge or ''}"
    ch = cache.get(key)
    if not ch or ch["site"] != site.pk or ch["tries"] >= TRIES:
        cache.delete(key)
        raise ValueError("De verificatie is verlopen. Begin opnieuw.")
    ch["tries"] += 1
    cache.set(key, ch, LIFETIME)
    user = get_user_model().objects.filter(pk=ch["user"]).first()
    if not user or not twofa.check_code(user, re.sub(r"\D", "", str(code or ""))):
        raise ValueError("De code klopt niet.")
    cache.delete(key)
    return {"fields": fields_of(user, ch.get("entity"))}


# ── client side: this website asks the master site ──
def ask(step, body):
    """Call the master site for one step. Raises ValueError (message) when it is not possible. On the master site itself there is nothing to ask: lookup says no."""
    if sitemanager.server_enabled():
        if step in ("lookup", "company", "search", "contacts"):
            return NOTHING.get(step, {"exists": False})
        raise ValueError("Dit is de easy2edit server zelf.")
    state = sitemanager._state()
    key = state.get("token") or ""
    api = (sitemanager.global_settings.get().get("api_url") or "").rstrip("/")
    if not key or not api:
        if step in ("lookup", "company", "search", "contacts"):
            return NOTHING.get(step, {"exists": False})  # not linked: nothing to download from
        raise ValueError("Deze website is niet gekoppeld aan easy2edit.")
    import json
    import urllib.error

    try:
        return sitemanager._post(f"{api}/api/easy2edit/owner/{step}/", body, key)
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read(20_000).decode("utf-8", "ignore")).get("detail")
        except Exception:  # noqa: BLE001
            detail = ""
        if step in ("lookup", "company", "search", "contacts"):
            return NOTHING.get(step, {"exists": False})
        raise ValueError(str(detail or "De easy2edit server geeft geen antwoord.")[:200]) from e
    except Exception as e:  # noqa: BLE001 - a master that cannot be reached never blocks the licence form
        if step in ("lookup", "company", "search", "contacts"):
            return NOTHING.get(step, {"exists": False})
        raise ValueError("De easy2edit server is niet bereikbaar.") from e
