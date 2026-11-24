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
An address that is no reseller is said so ("niet bekend"), so nobody waits for a mail that never comes; asking is limited per address and per ip."""
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


def find_owner(email):
    """On the master site itself: the superadmin+ with this e-mail address (the owner of the easy2edit server works on this installation and can always get in). Else None."""
    from django.contrib.auth import get_user_model

    e = _email(email)
    if not e or not sitemanager.server_enabled():
        return None
    return get_user_model().objects.filter(email__iexact=e, is_active=True, is_staff=True, is_superadmin_plus=True).first()


def _code_hash(challenge, code):
    return hashlib.sha256(f"{challenge}:{code}".encode()).hexdigest()


def _hit(key, limit, seconds):
    n = cache.get(key, 0)
    if n >= limit:
        return False
    cache.set(key, n + 1, seconds)
    return True


# ── master side ──
def send(email, ip="", show_code=False):
    from apps.communication import sending

    e = _email(email)
    if not e:
        raise ValueError("Vul een geldig e-mailadres in.")
    if not show_code and (not _hit(f"rsignup:ip:{ip}", IP_TRIES, 3600) or not _hit(f"rsignup:em:{e}", EMAIL_TRIES, LIFETIME)):  # (not on the development computer: there you try as often as you like)
        raise ValueError("Te veel pogingen. Probeer het over 10 minuten opnieuw.")
    reseller, person = find(e)
    owner = None if reseller else find_owner(e)
    if owner:  # the owner of this master installation: a code to his own address, then he is logged in as himself
        person = {"name": (owner.get_full_name() if hasattr(owner, "get_full_name") else "") or owner.email, "email": owner.email.lower(), "phone": ""}
    if not reseller and not owner:  # said, like the licence lookup does ("Dit e-mailadres is niet bekend"): the person must know why no mail comes
        raise ValueError("Dit e-mailadres is niet bekend als reseller bij easy2edit. Gebruik het e-mailadres van je reseller-account.")
    challenge = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(10**6):06d}"
    cache.set(f"rsignup:ch:{challenge}", {"rid": reseller.pk if reseller else None, "owner": owner.email.lower() if owner else None, "person": person, "hash": _code_hash(challenge, code), "tries": 0}, LIFETIME)
    if reseller or owner:
        try:  # in this phase the e-mail must always go out (also in the sandbox): a code that never arrives stops the onboarding
            sending.send_email(e, "Je code om je als reseller aan te melden bij easy2edit",
                               f"Hallo {person['name'] or e},\n\nJe code om je installatie aan te melden als {'beheerder van deze easy2edit server' if owner else f'reseller van easy2edit ({reseller.name})'}: {code}\n\n"
                               f"De code is {LIFETIME // 60} minuten geldig. Heb je dit niet aangevraagd, dan kun je deze e-mail negeren.", force_real=True)
        except Exception as ex:  # noqa: BLE001 - not linked, not reachable ...: said on the screen, not pretended
            cache.delete(f"rsignup:ch:{challenge}")
            raise ValueError(f"De e-mail met de code kon niet worden verstuurd: {str(ex)[:150] or 'de e-mail is niet ingesteld op de easy2edit server'}.") from ex
    return {"challenge": challenge, "hint": mask(e), **({"sandbox_code": code} if show_code else {})}  # (show_code: only on the development computer, see views.first_run_send)


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
    if not (ch["rid"] or ch.get("owner")) or not hmac.compare_digest(ch["hash"], _code_hash(str(challenge), str(code or "").strip())):
        raise ValueError("Deze code klopt niet.")
    if ch.get("owner"):  # the owner of the master: no reseller, no grant, no password to take over: he logs in as himself
        cache.delete(key)
        return {"owner": ch["owner"], "person": ch["person"], "grant": "", "login": None, "reseller": None}
    r = Reseller.objects.filter(pk=ch["rid"], active=True).first()
    if not r:
        raise ValueError("Deze reseller is niet meer actief.")
    cache.delete(key)
    login = login_of(r, ch["person"])
    grant = secrets.token_urlsafe(32)
    cache.set(f"rsignup:grant:{grant}", {"rid": r.pk}, 1800)
    return {"grant": grant, "person": ch["person"], "login": login, "reseller": {"id": r.pk, "name": r.name, "email": r.email, "phone": r.phone, "website": r.website, "address": r.address or {}, "kvk": r.kvk, "vat_id": r.vat_id}}


def login_of(reseller, person):
    """After the code: the login of this person at the reseller (made when there is none: the password is made and sent by e-mail). -> {password_hash, name, access}.
    The installation takes this password over, so the reseller logs in everywhere with the same password (the sync of the logins keeps it the same when it is changed)."""
    from . import resellers
    from .models import ResellerLogin

    email = person["email"]
    x = ResellerLogin.objects.filter(reseller=reseller, email__iexact=email, active=True).first()
    if not x:
        x, _pw = resellers.add_login(reseller, email, {"name": person.get("name") or email.split("@")[0], "access": "superadmin"}, send=False)
        try:  # the reseller must get the password: when the e-mail cannot be sent the login is not kept (it would be a login that nobody can use)
            resellers.mail_password(x, _pw, force=True)
        except Exception as ex:  # noqa: BLE001
            x.delete()
            resellers.sync_host()
            raise ValueError(f"De e-mail met je wachtwoord kon niet worden verstuurd: {str(ex)[:150]}.") from ex
    return {"password_hash": x.password_hash, "name": x.name or person.get("name") or "", "access": x.access}


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
def ask(step, body, ip="", show_code=False):
    """Call the master (or answer here when this installation IS the master). Raises ValueError (message)."""
    if sitemanager.server_enabled():
        return send(body.get("email"), ip, show_code) if step == "send" else verify(body.get("challenge"), body.get("code"))
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


def make_user(person, login):
    """The superuser: the verified person, with the password of the reseller login on the master (its hash: the password itself never travels). An account with that address gets that password too
    (after the code, never before). The account is the one of the sync of the reseller logins, so a password that changes on the master changes here. Only while the installation is open."""
    from django.contrib.auth import get_user_model
    from django.db import transaction

    from .resellers import MARKER

    User = get_user_model()
    email = _email((person or {}).get("email"))
    h = str((login or {}).get("password_hash") or "")
    if not email:
        raise ValueError("Het e-mailadres van de reseller is onbekend.")
    if not h.startswith(("pbkdf2_", "argon2", "bcrypt", "scrypt")):
        raise ValueError("De easy2edit server gaf geen wachtwoord.")
    with transaction.atomic():
        if not is_empty():
            raise PermissionError("Deze installatie is al ingericht.")
        name = str((login or {}).get("name") or (person or {}).get("name") or "").strip()
        first, _, last = name.partition(" ")
        user = User.objects.filter(email__iexact=email).first() or User.objects.filter(username__iexact=email).first()
        if not user:
            user = User(username=email, email=email)
        user.username, user.email = user.username or email, email
        user.first_name, user.last_name = (first[:60], last[:60]) if name else (user.first_name, user.last_name)
        user.is_staff, user.is_superuser, user.is_active, user.email_verified, user.function = True, True, True, True, MARKER
        user.password = h
        user.save()
    return user
