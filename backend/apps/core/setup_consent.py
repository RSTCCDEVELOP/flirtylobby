# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Consent for the licence (last step of the set-up wizard): the person who agrees gets a code (000-000) by e-mail or SMS (the services that are linked in the
API keys) and fills it in. A code lives 10 minutes and may be tried 5 times. Once it is right, `ok(user)` is true for half an hour: the licence can then be made."""
import hashlib
import re
import secrets

from django.conf import settings
from django.core.cache import cache

TTL = 600
OK_TTL = 1800
RESEND = 30
MAX_TRIES = 5


class ConsentError(Exception):
    pass


def _key(user, what):
    return f"setup-consent:{what}:{user.pk}"


def _hash(user, code):
    return hashlib.sha256(f"{user.pk}:{code}:{settings.SECRET_KEY}".encode()).hexdigest()


def methods():
    """What can deliver a code now: {'email': bool, 'sms': bool} (only linked and switched-on services; the sandbox counts)."""
    from apps.security import twofa

    a = twofa.availability()
    return {"email": bool(a["email"]), "sms": bool(a["sms"])}


def normalize(code):
    d = re.sub(r"\D", "", str(code or ""))
    return f"{d[:3]}-{d[3:]}" if len(d) == 6 else ""


def start(user, method, to):
    """Make a code and send it to this address / number. Returns (code, on_screen): on_screen is true when the sandbox shows the code instead of sending it. Raises ConsentError."""
    from apps.communication import sending
    from apps.sandbox import service as sandbox
    from apps.security import twofa

    if cache.get(_key(user, "wait")):
        raise ConsentError(f"Wacht even voordat je een nieuwe code aanvraagt ({RESEND} seconden).")
    to = str(to or "").strip()
    if method == "email":
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", to):
            raise ConsentError("Vul eerst een geldig e-mailadres in (stap Contact).")
    elif method == "sms":
        to = re.sub(r"[ \-()]", "", to)
        if not twofa.PHONE_RE.match(to):
            raise ConsentError("Vul eerst een geldig mobiel nummer met landcode in (stap Contact).")
    else:
        raise ConsentError("Kies e-mail of SMS.")
    code = f"{secrets.randbelow(1000):03d}-{secrets.randbelow(1000):03d}"
    on_screen = sandbox.code_on_screen()
    if not on_screen:
        text = f"Je code voor akkoord met de licentie: {code}. Deze is 10 minuten geldig."
        try:
            if method == "email":
                sending.send_email(to, "Code voor akkoord met de licentie", text, purpose="security", code=code)
            else:
                twofa.send_sms(to, text)
        except Exception as e:  # noqa: BLE001
            if not settings.DEBUG:
                raise ConsentError(str(e) or "Verzenden mislukt.")
    cache.set(_key(user, "code"), {"hash": _hash(user, code), "tries": 0, "sent": 1}, TTL)
    cache.set(_key(user, "wait"), 1, RESEND)
    cache.delete(_key(user, "ok"))
    return code, on_screen


def verify(user, code):
    """True when the code is right (then `ok` is set). Raises ConsentError when it is wrong or the tries are used up."""
    st = cache.get(_key(user, "code"))
    if not st:
        raise ConsentError("Er is geen geldige code: vraag een nieuwe aan.")
    if st["tries"] >= MAX_TRIES:
        cache.delete(_key(user, "code"))
        raise ConsentError("Te vaak geprobeerd: vraag een nieuwe code aan.")
    c = normalize(code)
    if not c or _hash(user, c) != st["hash"]:
        st["tries"] += 1
        cache.set(_key(user, "code"), st, TTL)
        raise ConsentError("Deze code klopt niet.")
    cache.delete(_key(user, "code"))
    cache.set(_key(user, "ok"), 1, OK_TTL)
    return True


def passes(user):
    """A superadmin and a superadmin+ (both is_staff) always pass the consent with a code and the confirmation of the payment: they need no code (it also works when no e-mail or SMS link is on)."""
    return bool(getattr(user, "is_staff", False))


def ok(user):
    """The consent with a code has been given (or the person passes anyway: see passes)."""
    if passes(user):
        return True
    return bool(cache.get(_key(user, "ok")))


def mark_ok(user):  # for tests
    cache.set(_key(user, "ok"), 1, OK_TTL)


def clear(user):
    for w in ("ok", "code", "wait"):
        cache.delete(_key(user, w))
