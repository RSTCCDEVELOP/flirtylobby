# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Onboarding of an EMPTY installation (no users yet): sign up as a reseller of easy2edit.
The master site (the easy2edit server) knows the resellers. The person gives an e-mail address; when it belongs to a reseller (the company or one of its contact persons) a code goes
to that address. With the right code the master gives the data of the reseller and the person, and a grant: the installation then makes the first superuser (the person) and reports
itself to the master with that grant, so the master links the website to that reseller.

Master side:   send(email, ip) -> {challenge, hint}      verify(challenge, code) -> {grant, reseller, person}      apply_grant(site, grant)
Installation:  ask(step, body) calls the master (or answers itself when this installation IS the master); make_user() makes the first superuser after a verified code.
Nothing tells whether an address is a reseller: an unknown address gets a challenge too (the code just never comes)."""
import hashlib
import hmac
import secrets

from django.core.cache import cache

from . import sitemanager
from .models import Reseller

LIFETIME = 600
TRIES = 5
EMAIL_TRIES = 5  # codes per address per 10 minutes
IP_TRIES = 20    # asks per address (ip) per hour


def _email(v):
    e = str(v or "").strip().lower()[:254]
    return e if "@" in e and "." in e.split("@")[-1] and " " not in e else ""


def mask(e):
    name, _, domain = e.partition("@")
    return f"{name[:1]}{'•' * max(2, len(name) - 1)}@{domain}"


def find(email):
    """(reseller, person) for an e-mail address of an active reseller (the company address or a contact person), else (None, None)."""
    e = _email(email)
    if not e:
        return None, None
    for r in Reseller.objects.filter(active=True):
        for p in r.contacts or []:
            if isinstance(p, dict) and _email(p.get("email")) == e:
                return r, {"name": str(p.get("name") or "")[:120], "email": e, "phone": str(p.get("phone") or "")[:30]}
        if _email(r.email) == e:
            return r, {"name": "", "email": e, "phone": r.phone or ""}
    return None, None


def _code_hash(challenge, code):
    return hashlib.sha256(f"{challenge}:{code}".encode()).hexdigest()


def _hit(key, limit, seconds):
    n = cache.get(key, 0)
    if n >= limit:
        return False
    cache.set(key, n + 1, seconds)
    return True


# ── master side ──
def send(email, ip=""):
    from apps.communication import sending

    e = _email(email)
    if not e:
        raise ValueError("Vul een geldig e-mailadres in.")
    if not _hit(f"rsignup:ip:{ip}", IP_TRIES, 3600) or not _hit(f"rsignup:em:{e}", EMAIL_TRIES, LIFETIME):
        raise ValueError("Te veel pogingen. Probeer het over 10 minuten opnieuw.")
    reseller, person = find(e)
    challenge = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(10**6):06d}"
    cache.set(f"rsignup:ch:{challenge}", {"rid": reseller.pk if reseller else None, "person": person, "hash": _code_hash(challenge, code), "tries": 0}, LIFETIME)
    if reseller:
        sending.send_email(e, "Je code om je als reseller aan te melden bij easy2edit",
                           f"Hallo {person['name'] or e},\n\nJe code om je installatie aan te melden als reseller van easy2edit ({reseller.name}): {code}\n\n"
                           f"De code is {LIFETIME // 60} minuten geldig. Heb je dit niet aangevraagd, dan kun je deze e-mail negeren.")
    return {"challenge": challenge, "hint": mask(e)}


def verify(challenge, code):
    key = f"rsignup:ch:{str(challenge or '')[:80]}"
    ch = cache.get(key)
    if not ch:
        raise ValueError("De code is verlopen. Vraag een nieuwe aan.")
    ch["tries"] += 1
    if ch["tries"] > TRIES:
        cache.delete(key)
        raise ValueError("Te veel pogingen. Vraag een nieuwe code aan.")
    cache.set(key, ch, LIFETIME)
    if not ch["rid"] or not hmac.compare_digest(ch["hash"], _code_hash(str(challenge), str(code or "").strip())):
        raise ValueError("Deze code klopt niet.")
    r = Reseller.objects.filter(pk=ch["rid"], active=True).first()
    if not r:
        raise ValueError("Deze reseller is niet meer actief.")
    cache.delete(key)
    grant = secrets.token_urlsafe(32)
    cache.set(f"rsignup:grant:{grant}", {"rid": r.pk}, 1800)
    return {"grant": grant, "person": ch["person"], "reseller": {"id": r.pk, "name": r.name, "email": r.email, "phone": r.phone, "website": r.website, "address": r.address or {}, "kvk": r.kvk, "vat_id": r.vat_id}}


def apply_grant(site, grant):
    """The website reported itself with a grant: it is sold by that reseller now. Returns True when the grant was good (it works once)."""
    g = str(grant or "")[:80]
    if not g:
        return False
    data = cache.get(f"rsignup:grant:{g}")
    if not data:
        return False
    cache.delete(f"rsignup:grant:{g}")
    r = Reseller.objects.filter(pk=data["rid"], active=True).first()
    if not r:
        return False
    site.reseller = r
    return True


# ── installation side ──
def ask(step, body, ip=""):
    """Call the master (or answer here when this installation IS the master). Raises ValueError (message)."""
    if sitemanager.server_enabled():
        return send(body.get("email"), ip) if step == "send" else verify(body.get("challenge"), body.get("code"))
    import json
    import urllib.error

    from . import global_settings

    api = (global_settings.get().get("api_url") or "").rstrip("/")
    if not api:
        raise ValueError("Er is geen easy2edit server ingesteld.")
    try:
        return sitemanager._post(f"{api}/api/easy2edit/reseller-signup/{step}/", body)
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read(20_000).decode("utf-8", "ignore")).get("detail")
        except Exception:  # noqa: BLE001
            detail = ""
        raise ValueError(str(detail or "De easy2edit server geeft geen antwoord.")[:200]) from e
    except Exception as e:  # noqa: BLE001
        raise ValueError("De easy2edit server is niet bereikbaar.") from e


def is_empty():
    """Is this installation still to be done, so that the onboarding as a reseller may start? True when no standard installation is set and the onboarding is not complete, and the only
    users are the standard superadmin(s) (a clean installation after a reset has one, nobody knows its password) or there are none. A website that has other users is never open."""
    from django.contrib.auth import get_user_model

    from . import onboarding, presets, reset
    from .models import SystemSettings

    if presets.active() or (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(onboarding.COMPLETE_KEY):
        return False
    std = reset.standard_email()
    return all(u.is_superadmin_plus or (std and u.email.lower() == std) for u in get_user_model().objects.all())


def make_user(person, reseller, password):
    """The superuser: the verified person (made, or an account with that address becomes a superuser with this password). Only while the installation is still open (checked again inside the transaction)."""
    from django.contrib.auth import get_user_model
    from django.db import transaction

    User = get_user_model()
    email = _email((person or {}).get("email"))
    if not email:
        raise ValueError("Het e-mailadres van de reseller is onbekend.")
    if len(str(password or "")) < 10:
        raise ValueError("Kies een wachtwoord van minstens 10 tekens.")
    with transaction.atomic():
        if not is_empty():
            raise PermissionError("Deze installatie is al ingericht.")
        name = str((person or {}).get("name") or "").strip()
        first, _, last = name.partition(" ")
        user = User.objects.filter(email__iexact=email).first()
        if user:
            user.is_staff, user.is_superuser, user.is_active = True, True, True
            user.set_password(password)
            user.save()
        else:
            user = User.objects.create_user(email.split("@")[0][:30] or "reseller", email, password, is_staff=True, is_superuser=True, first_name=first[:60], last_name=last[:60])
    return user
