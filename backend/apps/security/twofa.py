# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Two-step verification: code generation, delivery (e-mail via Postmark/SMTP, SMS via Spryng or Bird) and checking."""
import hashlib
import hmac
import json
import logging
import re
import secrets
import smtplib
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta
from email.message import EmailMessage

from django.conf import settings as dj_settings
from django.utils import timezone

from apps.core.models import Language
from apps.integrations.models import Integration

from apps.communication import sending

from . import service, totp

logger = logging.getLogger(__name__)
PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")
RESEND_SECONDS = 30


class DeliveryError(Exception):
    pass


# ── which methods can actually deliver ──────────────────────────────────────
def _integration(providers, tested_only=False):
    """The first link of these providers that is on. tested_only: it must also have passed its online test (and so has credit): see sms_link()."""
    from apps.core import modules

    if not modules.enabled("integrations"):
        return None
    for p in providers:
        qs = Integration.objects.filter(enabled=True, provider=p)
        if tested_only:
            qs = qs.filter(last_test_ok=True)
        obj = qs.first()
        if obj:
            return obj
    return None


def sms_link(tested_only=True):
    """THE standard rule for SMS: SMS (a code by SMS, or messages) is only offered or allowed when an SMS link is on AND its last online test passed (the test also checks that there is
    credit). Without that nothing about SMS is shown anywhere. tested_only=False is only for sending a code to a person who already uses SMS (so nobody is locked out)."""
    return _integration(SMS_PROVIDERS, tested_only=tested_only)


def availability():
    """{'email': 'Postmark'|None, 'sms': 'Bird'|None}: only what is really linked and switched on (API keys). With the sandbox on,
    mails/sms are simulated and count as available. Nothing is offered for a service that is not in use."""
    from apps.sandbox import service as sandbox

    email, sms = _integration(["postmark", "smtp"]), sms_link()  # (SMS: only a link that is on and tested online, with credit)
    return {"email": email.name if email else ("Sandbox" if sandbox.active("email") else None),
            "sms": sms.name if sms else ("Sandbox" if sandbox.active("sms") else None)}


def allowed_methods():
    cfg, avail = service.get()["twofa"], availability()
    if not cfg["enabled"]:
        return []
    # the app needs no delivery channel (works offline), e-mail / sms need a linked service
    return [m for m in ("email", "sms", "app") if cfg.get(f"allow_{m}") and (m == "app" or avail[m])]


def is_admin(user):
    """Superadmin or someone with the Admin role."""
    return user.is_staff or user.roles.filter(all_permissions=True).exists()


def exempt(user):
    """Sandbox override: this address is excused from every verification."""
    from apps.sandbox import service as sandbox

    return sandbox.skips_verification(getattr(user, "email", ""))


def needs_setup(user):
    """Policy says this user must have 2FA but has not set it up yet."""
    if exempt(user):
        return False
    cfg = service.get()["twofa"]
    if not cfg["enabled"] or user.otp_active or not allowed_methods():
        return False
    return bool(user.twofa_required) or cfg["required_for"] == "all" or (cfg["required_for"] == "admins" and is_admin(user))


def email_verify_required(user):
    """Policy asks every user to confirm the e-mail address, this one has not yet, and a mail can be sent."""
    return bool(not exempt(user) and service.get()["email_verify"]["enabled"] and not user.email_verified and availability()["email"])


def required_for(user):
    if exempt(user):
        return False
    cfg = service.get()["twofa"]
    return cfg["enabled"] and (bool(user.twofa_required) or cfg["required_for"] == "all" or (cfg["required_for"] == "admins" and is_admin(user)))


def state(user):
    return {
        "enabled_system": service.get()["twofa"]["enabled"],
        "active": user.otp_active, "method": user.twofa_method,
        "destination": destination_hint(user) if user.twofa_method else "",
        "email_verified": user.email_verified, "email_verify_required": bool(service.get()["email_verify"]["enabled"]),
        "available": allowed_methods(), "required": required_for(user), "setup_required": needs_setup(user),
    }


# ── codes ───────────────────────────────────────────────────────────────────
def _hash(user, code):
    return hashlib.sha256(f"{user.pk}:{code}:{dj_settings.SECRET_KEY}".encode()).hexdigest()


def mask_email(e):
    name, _, domain = e.partition("@")
    return f"{name[:1]}{'•' * max(2, len(name) - 1)}@{domain}"


def destination_hint(user):
    if user.twofa_method == "app":
        return "Authenticator"
    if user.twofa_method == "sms":
        return f"{user.phone[:3]}{'•' * 5}{user.phone[-2:]}" if user.phone else ""
    return mask_email(user.email)


def _text(key):
    cfg = service.get()["twofa"]["texts"]
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    for lang in (default, "nl", *cfg):
        if cfg.get(lang, {}).get(key):
            return cfg[lang][key]
    return ""


def issue_code(user, force_email=False):
    """Create + send a fresh code via the user's chosen method. Raises DeliveryError."""
    cfg = service.get()["twofa"]
    if user.otp_sent_at and (timezone.now() - user.otp_sent_at).total_seconds() < RESEND_SECONDS:
        raise DeliveryError(f"Wacht even voordat je een nieuwe code aanvraagt ({RESEND_SECONDS} seconden).")
    from apps.sandbox import service as sandbox

    code = (sandbox.get()["fixed_code"] if sandbox.active() else "") or f"{secrets.randbelow(10**6):06d}"
    fmt = lambda t: t.replace("{code}", code).replace("{minutes}", str(cfg["code_minutes"]))  # noqa: E731
    on_screen = sandbox.code_on_screen()  # sandbox: nothing is sent, the screen shows the code
    if not on_screen:
        deliver(user, fmt(_text("email_subject")), fmt(_text("email_body")), fmt(_text("sms_body")), force_email, code=code)
    user.otp_token = _hash(user, code)
    user.otp_expires = timezone.now() + timedelta(minutes=cfg["code_minutes"])
    user.otp_attempts = 0
    user.otp_sent_at = timezone.now()
    user.save(update_fields=["otp_token", "otp_expires", "otp_attempts", "otp_sent_at"])
    if dj_settings.DEBUG:
        logger.warning("2FA code for %s (DEBUG only): %s", user.email, code)
    return code if on_screen else None


def app_start(user):
    """New pending secret for the authenticator app. Returns (secret, otpauth uri); nothing changes for the user until confirmed."""
    secret = totp.new_secret()
    user.totp_secret = totp.seal(secret)
    user.save(update_fields=["totp_secret"])
    issuer = service.get()["twofa"].get("app_issuer") or __import__("apps.core.system", fromlist=["site_name"]).site_name()
    return secret, totp.uri(secret, user.email, issuer)


def _blocked(user, cfg):
    """The last allowed wrong code was just used: the code is blocked, the administrator gets a mail (once)."""
    if user.otp_attempts == cfg["max_attempts"]:
        from . import lockout

        lockout.notify(user.email, "", "code", cfg["code_minutes"])


def check_app_code(user, code):
    """Check an authenticator code against the user's secret; a code can be used once."""
    cfg = service.get()["twofa"]
    if user.otp_attempts >= cfg["max_attempts"] and user.otp_expires and user.otp_expires > timezone.now():
        return False
    step = totp.verify(totp.unseal(user.totp_secret), code, user.totp_last_step)
    if step is None:
        user.otp_attempts += 1
        user.otp_expires = user.otp_expires if user.otp_expires and user.otp_expires > timezone.now() else timezone.now() + timedelta(minutes=cfg["code_minutes"])
        user.save(update_fields=["otp_attempts", "otp_expires"])
        _blocked(user, cfg)
        return False
    user.totp_last_step, user.otp_attempts, user.otp_expires = step, 0, None
    user.save(update_fields=["totp_last_step", "otp_attempts", "otp_expires"])
    return True


def check_code(user, code):
    """True/False. Wrong codes count; too many wrong tries invalidate the code."""
    cfg = service.get()["twofa"]
    if not user.otp_token or not user.otp_expires or user.otp_expires < timezone.now():
        return False
    if user.otp_attempts >= cfg["max_attempts"]:
        return False
    ok = hmac.compare_digest(user.otp_token, _hash(user, str(code).strip()))
    if ok:
        user.otp_token, user.otp_expires, user.otp_attempts = "", None, 0
        user.save(update_fields=["otp_token", "otp_expires", "otp_attempts"])
    else:
        user.otp_attempts += 1
        user.save(update_fields=["otp_attempts"])
        _blocked(user, cfg)
    return ok


# ── delivery ────────────────────────────────────────────────────────────────
def _post_json(url, headers, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Accept": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=10):
            return
    except urllib.error.HTTPError as e:
        raise DeliveryError(f"Verzenden mislukt (HTTP {e.code}).")
    except Exception as e:
        raise DeliveryError(f"Verzenden mislukt: {e}")


SMS_PROVIDERS = ["spryng", "seven", "bird"]  # the first one that is linked and on sends the text messages


def sms_usage():
    """{'provider': name or None, 'verification': bool, 'messages': bool}: what the linked SMS service may be used for (Spryng and seven.io have a setting for it; Bird is for verification only)."""
    from apps.integrations import spryng

    obj = sms_link()
    if not obj:
        return {"provider": None, "verification": False, "messages": False}
    return {"provider": obj.name, "verification": True, "messages": obj.provider in ("spryng", "seven") and spryng.usage(obj.config) == "messages"}


def send_via(obj, phone, text, purpose="verification"):
    """Send through one SMS link (also used by the SMS test screens). Raises DeliveryError."""
    from apps.integrations import seven, spryng

    c = obj.config
    if obj.provider in ("spryng", "seven"):
        mod, err = (spryng, spryng.SpryngError) if obj.provider == "spryng" else (seven, seven.SevenError)
        if not mod.allows(c, purpose):
            raise DeliveryError(f"Deze SMS-koppeling ({obj.name}) mag alleen voor verificatiecodes gebruikt worden. Zet het gebruik op berichten bij API keys.")
        try:
            return mod.send(c, phone, text, purpose)
        except err as e:
            raise DeliveryError(str(e))
    if purpose != "verification":
        raise DeliveryError("Bird is alleen gekoppeld voor verificatiecodes.")
    if not c.get("sms_channel_id"):
        raise DeliveryError("Bird: SMS-kanaal-ID ontbreekt in de koppeling.")
    ws = urllib.parse.quote(c["workspace_id"], safe="")
    ch = urllib.parse.quote(c["sms_channel_id"], safe="")
    _post_json(f"https://api.bird.com/workspaces/{ws}/channels/{ch}/messages",
               {"Authorization": f"AccessKey {c['access_key']}"},
               {"receiver": {"contacts": [{"identifierKey": "phonenumber", "identifierValue": phone}]},
                "body": {"type": "text", "text": {"text": text}}})


def send_sms(phone, text, purpose="verification"):
    """purpose: 'verification' (a code) or 'message' (any other text message: only when the link is set to that)."""
    from apps.sandbox import service as sandbox

    if sandbox.active("sms"):
        sandbox.capture("sms", phone, "", text)
        return
    obj = sms_link() or (sms_link(tested_only=False) if purpose == "verification" else None)  # a code still goes out to someone who uses SMS already; messages need a tested link
    if not obj:
        if dj_settings.DEBUG:
            return
        raise DeliveryError("SMS is niet gekoppeld of niet getest." if purpose != "verification" else "SMS is niet gekoppeld.")
    try:
        send_via(obj, phone, text, purpose)
    except DeliveryError as e:
        # a real send that fails takes the link out of the offer until it is tested again (red on the card)
        from django.utils import timezone

        Integration.objects.filter(pk=obj.pk).update(last_test_ok=False, last_test_message=f"Verzenden mislukt: {e}"[:300], last_test_at=timezone.now())
        raise


def deliver(user, subject, email_body, sms_body, force_email=False, code=None):
    from apps.sandbox import service as sandbox

    if user.twofa_method == "sms" and not force_email:
        return send_sms(user.phone, sms_body)

    try:
        sending.send_email(user.email, subject, email_body, purpose="security", code=code)
    except sending.DeliveryError as e:
        raise DeliveryError(str(e))
