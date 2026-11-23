# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The gate before the API keys of the easy2edit server: checking and renewing the keys (and making the installation file) first needs a code, by e-mail or by SMS, that goes
to the superadmin or superadmin+ who asks. After a right code the gate stays open for 15 minutes for that person. The codes are kept apart from the two-step login (the fields of
the user are not touched). The code is kept hashed in the cache, with a short life, a resend wait and a number of tries."""
import hashlib
import hmac
import secrets

from django.conf import settings
from django.core.cache import cache

MINUTES_CODE = 10
MINUTES_OPEN = 15
RESEND_SECONDS = 30
MAX_TRIES = 5


class GateError(ValueError):
    pass


def _k(kind, user):
    return f"keygate:{kind}:{user.pk}"


def _hash(user, code):
    return hmac.new(settings.SECRET_KEY.encode(), f"keygate:{user.pk}:{code}".encode(), hashlib.sha256).hexdigest()


def granted(user):
    return bool(user and user.pk and cache.get(_k("ok", user)))


def grant(user):
    cache.set(_k("ok", user), 1, MINUTES_OPEN * 60)


def close(user):
    cache.delete(_k("ok", user))


def methods(user):
    """What can deliver the code to this person: e-mail (always when a mail link or the sandbox works) and SMS (only a tested link and a phone number)."""
    from apps.security import twofa

    av = twofa.availability()
    phone = str(getattr(user, "phone", "") or "").strip()
    return {"email": bool(av["email"]), "sms": bool(av["sms"] and phone), "email_hint": twofa.mask_email(user.email) if user.email else "", "sms_hint": (f"{phone[:3]}{'•' * 5}{phone[-2:]}" if phone else "")}


def _master(path, body):
    """POST to the easy2edit server (the master) with the key of this website. -> (status, answer)."""
    import json
    import urllib.error
    import urllib.request

    from apps.core import global_settings, sitemanager

    key = sitemanager._state().get("token") or ""
    if not key:
        raise GateError("Deze website is nog niet aangemeld bij de easy2edit-server.")
    req = urllib.request.Request(f"{global_settings.get()['api_url']}/api/easy2edit/verify/{path}/", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "X-Easy2edit-Key": key, "User-Agent": "easy2edit-site"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read(100_000).decode("utf-8", "ignore"))
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read(5000).decode("utf-8", "ignore")).get("detail")
        except Exception:  # noqa: BLE001
            msg = ""
        raise GateError(msg or "De easy2edit-server weigerde dit.")
    except Exception:  # noqa: BLE001
        raise GateError("De easy2edit-server is niet bereikbaar.")


def master_login(user, email, password):
    """Verify with an account on easy2edit.com (the master): password first, then the code of that account. -> {challenge, hint}."""
    if not user.is_staff:
        raise GateError("Alleen een superadmin kan dit doen.")
    return _master("login", {"email": str(email or "").strip(), "password": str(password or "")})


def master_verify(user, challenge, code):
    r = _master("code", {"challenge": str(challenge or ""), "code": str(code or "")})
    if not r.get("ok"):
        raise GateError("De code klopt niet.")
    grant(user)
    return True


def send(user, method):
    """Make and send a code. -> {sent, method, dev_code}. dev_code only in the sandbox or for a local superadmin without a mail link (testing)."""
    from apps.sandbox import service as sandbox
    from apps.security import twofa

    if not user.is_staff:
        raise GateError("Alleen een superadmin kan dit doen.")
    last = cache.get(_k("sent", user))
    if last:
        raise GateError(f"Wacht even voordat je een nieuwe code vraagt ({RESEND_SECONDS} seconden).")
    m = methods(user)
    method = "sms" if method == "sms" else "email"
    if not m[method]:
        raise GateError("SMS is niet beschikbaar (geen geteste SMS-koppeling of geen mobiel nummer)." if method == "sms" else "E-mail is niet beschikbaar: koppel eerst e-mail bij API keys.")
    code = (sandbox.get()["fixed_code"] if sandbox.active() else "") or f"{secrets.randbelow(10**6):06d}"
    text = f"Je code voor het controleren van de API-sleutels bij de easy2edit-server is: {code}\n\nDe code is {MINUTES_CODE} minuten geldig. Heb je dit niet zelf gevraagd, negeer dit bericht dan en neem contact op met de beheerder."
    on_screen = sandbox.code_on_screen()
    if not on_screen:
        try:
            if method == "sms":
                twofa.send_sms(user.phone, text.split("\n")[0])
            else:
                from apps.communication import sending

                sending.send_email(user.email, "Je code voor de API-sleutels", text, purpose="security", code=code)
        except Exception as e:  # noqa: BLE001
            raise GateError(f"De code kon niet worden verstuurd: {str(e)[:150]}")
    cache.set(_k("code", user), {"h": _hash(user, code), "tries": 0}, MINUTES_CODE * 60)
    cache.set(_k("sent", user), 1, RESEND_SECONDS)
    return {"sent": True, "method": method, "dev_code": code if (on_screen or sandbox.code_visible()) else None}


def verify(user, code):
    rec = cache.get(_k("code", user))
    if not rec:
        raise GateError("De code is verlopen. Vraag een nieuwe code aan.")
    if rec["tries"] >= MAX_TRIES:
        cache.delete(_k("code", user))
        raise GateError("Te veel pogingen. Vraag een nieuwe code aan.")
    rec["tries"] += 1
    cache.set(_k("code", user), rec, MINUTES_CODE * 60)
    if not hmac.compare_digest(rec["h"], _hash(user, str(code or "").strip())):
        raise GateError("De code klopt niet.")
    cache.delete(_k("code", user))
    grant(user)
    return True
