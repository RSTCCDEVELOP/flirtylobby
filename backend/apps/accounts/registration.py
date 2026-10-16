"""Self sign-up. Follows the security rules: password rules, age limit, forbidden words and the e-mail / 2-step
verification the security page requires. The account is only created after all verifications are done."""
import hashlib
import hmac
import logging
import re
import secrets
from datetime import date, timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core import modules
from apps.core.models import Language
from apps.sandbox import service as sandbox
from apps.security import service as security
from apps.security import twofa
from apps.security.models import LoginThrottle
from apps.security.words import find_forbidden

from .models import PendingRegistration, User
from .serializers import ProfileSerializer

logger = logging.getLogger(__name__)
RESEND_SECONDS = 30
START_LIMIT = 10  # sign-up attempts per IP per hour


def _ip(request):
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")


def _cfg():
    return security.get()["registration"]


def _twofa_method_needed():
    """Which 2-step methods a new account must choose from (empty list = not required)."""
    cfg = security.get()["twofa"]
    if cfg["enabled"] and cfg["required_for"] == "all":
        return [m for m in twofa.allowed_methods() if m != "app"] or None  # None = required but impossible (the app is set up in the profile)
    return []


def _hash(p, code):
    from django.conf import settings

    return hashlib.sha256(f"reg:{p.pk}:{code}:{settings.SECRET_KEY}".encode()).hexdigest()


def _text(key):
    cfg = _cfg()["texts"]
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    for lang in (default, "nl", *cfg):
        if cfg.get(lang, {}).get(key):
            return cfg[lang][key]
    return ""


def _send(p):
    """Send a fresh code for the current step (steps[0])."""
    cfg = _cfg()
    if p.sent_at and (timezone.now() - p.sent_at).total_seconds() < RESEND_SECONDS:
        raise twofa.DeliveryError(f"Wacht even voordat je een nieuwe code aanvraagt ({RESEND_SECONDS} seconden).")
    code = (sandbox.get()["fixed_code"] if sandbox.active() else "") or f"{secrets.randbelow(10**6):06d}"
    fmt = lambda t: t.replace("{code}", code).replace("{minutes}", str(cfg["code_minutes"]))  # noqa: E731
    if p.steps[0] == "sms":
        twofa.send_sms(p.data["phone"], fmt(_text("sms_body")))
    else:
        from apps.communication import sending

        try:
            sending.send_email(p.email, fmt(_text("email_subject")), fmt(_text("email_body")), purpose="security")
        except sending.DeliveryError as e:
            raise twofa.DeliveryError(str(e))
    p.code_hash, p.code_expires, p.attempts, p.sent_at = _hash(p, code), timezone.now() + timedelta(minutes=cfg["code_minutes"]), 0, timezone.now()
    p.save(update_fields=["code_hash", "code_expires", "attempts", "sent_at"])
    from django.conf import settings

    if settings.DEBUG:
        logger.warning("Registration code for %s (DEBUG only): %s", p.email, code)


def _hint(p):
    if p.steps[0] == "sms":
        ph = p.data["phone"]
        return f"{ph[:3]}{'•' * 5}{ph[-2:]}"
    return twofa.mask_email(p.email)


def _step_info(p):
    return {"token": p.token, "step": p.steps[0], "destination": _hint(p), "steps_left": len(p.steps)}


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def config(request):
    """Public: what the sign-up form has to ask for."""
    on = modules.enabled("registration") and _cfg()["enabled"]
    if not on:
        return Response({"enabled": False})
    s, methods = security.get(), _twofa_method_needed()
    age = s["age"]
    return Response({
        "enabled": True, "verify_email": _cfg()["verify_email"], "require_phone": _cfg()["require_phone"],
        "birth_date": _cfg()["require_birth_date"] or bool(age["enabled"]),
        "min_age": age["min_age"] if age["enabled"] else None,
        "twofa_methods": methods or [], "twofa_required": methods is None or bool(methods),
        "unavailable": methods is None,
        "password_min_length": s["basic"]["password_min_length"], "password_complexity": s["basic"]["password_complexity"],
        "default_language": Language.objects.filter(is_default=True).values_list("code", flat=True).first(),
    })


def _fail(field, text, code=status.HTTP_400_BAD_REQUEST):
    return Response({field: [text]} if field != "detail" else {"detail": text}, status=code)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def start(request):
    if not (modules.enabled("registration") and _cfg()["enabled"]):
        return _fail("detail", "Aanmelden is niet beschikbaar.", status.HTTP_403_FORBIDDEN)
    cfg, d = _cfg(), request.data

    # rate limit per IP
    th, _ = LoginThrottle.objects.get_or_create(key=f"reg|{_ip(request)}"[:300])
    if timezone.now() - th.updated_at > timedelta(hours=1):
        th.failures, th.locked_until = 0, None
    th.failures += 1
    th.save()
    if th.failures > START_LIMIT:
        return _fail("detail", "Te veel aanmeldpogingen. Probeer het later opnieuw.", status.HTTP_429_TOO_MANY_REQUESTS)
    PendingRegistration.objects.filter(created_at__lt=timezone.now() - timedelta(hours=2)).delete()

    email = str(d.get("email") or "").strip().lower()
    first, last = str(d.get("first_name") or "").strip()[:150], str(d.get("last_name") or "").strip()[:150]
    display = str(d.get("display_name") or "").strip()[:60]
    password, phone = str(d.get("password") or ""), re.sub(r"[ \-()]", "", str(d.get("phone") or ""))
    gender, method = str(d.get("gender") or ""), str(d.get("method") or "")
    errors = {}
    try:
        validate_email(email)
    except DjangoValidationError:
        errors["email"] = ["Geef een geldig e-mailadres."]
    if not first:
        errors["first_name"] = ["Voornaam is verplicht."]
    if bad := find_forbidden(" ".join([first, last, display])):
        errors["first_name"] = [f"Bevat niet toegestane woorden: {', '.join(bad)}."]
    if gender not in ("", "m", "f", "x"):
        errors["gender"] = ["Ongeldig geslacht."]
    try:
        validate_password(password, User(email=email, first_name=first, last_name=last))
    except DjangoValidationError as e:
        errors["password"] = list(e.messages)
    s, bd = security.get(), None
    needs_birth = cfg["require_birth_date"] or s["age"]["enabled"]
    if d.get("birth_date") or needs_birth:
        try:
            bd = date.fromisoformat(str(d.get("birth_date") or ""))
            if bd > date.today() or bd.year < 1900:
                raise ValueError
        except ValueError:
            errors["birth_date"] = ["Geef een geldige geboortedatum."]
        else:
            if msg := security.underage_message(bd):
                errors["birth_date"] = [msg.replace("Met deze geboortedatum kun je geen gegevens opslaan.", "Je kunt je helaas niet aanmelden.")]
    methods = _twofa_method_needed()
    if methods is None:
        return _fail("detail", "Aanmelden is tijdelijk niet mogelijk (twee-staps verificatie is verplicht maar niet beschikbaar).", status.HTTP_503_SERVICE_UNAVAILABLE)
    tf_method = ""
    if methods:
        tf_method = method if method in methods else ""
        if not tf_method:
            errors["method"] = ["Kies hoe je de verificatiecode wilt ontvangen."]
    if (cfg["require_phone"] or tf_method == "sms") and not twofa.PHONE_RE.match(phone):
        errors["phone"] = ["Geef een telefoonnummer met landcode, bv. +31612345678."]
    elif phone and not twofa.PHONE_RE.match(phone):
        errors["phone"] = ["Geef een telefoonnummer met landcode, bv. +31612345678."]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    steps = []
    if cfg["verify_email"] or tf_method == "email":
        steps.append("email")
    if tf_method == "sms":
        steps.append("sms")
    p = PendingRegistration.objects.create(
        token=secrets.token_urlsafe(32), email=email, steps=steps, twofa_method=tf_method,
        decoy=User.objects.filter(email__iexact=email).exists(),
        data={"first_name": first, "last_name": last, "display_name": display, "password": make_password(password),
              "birth_date": bd.isoformat() if bd else None, "gender": gender, "phone": phone})
    if not steps:  # nothing to verify: create right away
        return _finish(request, p)
    if not p.decoy:  # an existing address gets no code, but the answer looks the same
        try:
            _send(p)
        except twofa.DeliveryError as e:
            p.delete()
            return _fail("detail", f"Code versturen mislukt: {e}", status.HTTP_502_BAD_GATEWAY)
    return Response(_step_info(p))


def _pending(request):
    return PendingRegistration.objects.filter(token=str(request.data.get("token") or "")).first()


def _finish(request, p):
    if p.decoy or User.objects.filter(email__iexact=p.email).exists():
        p.delete()
        return _fail("detail", "Aanmelden is niet gelukt. Gebruik inloggen of 'wachtwoord vergeten' als je al een account hebt.")
    d = p.data
    user = User(username=p.email, email=p.email, first_name=d["first_name"], last_name=d["last_name"], display_name=d["display_name"],
                gender=d["gender"], birth_date=date.fromisoformat(d["birth_date"]) if d["birth_date"] else None,
                phone=d["phone"], password=d["password"], is_active=True)
    user.email_verified = bool(p.twofa_method == "email" or security.get()["registration"]["verify_email"])
    if p.twofa_method:
        user.otp_active, user.twofa_method = True, p.twofa_method
    user.save()
    p.delete()
    token = Token.objects.create(user=user)
    logger.info("Registered: %s", user.email)
    return Response({"done": True, "token": token.key, "user": ProfileSerializer(user).data}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def verify(request):
    p = _pending(request)
    gone = _fail("detail", "Aanmelding verlopen, begin opnieuw.")
    if not p or p.created_at < timezone.now() - timedelta(hours=2):
        return gone
    wrong = _fail("detail", "Onjuiste of verlopen code.")
    max_attempts = security.get()["twofa"]["max_attempts"]
    if p.decoy or not p.code_hash or not p.code_expires or p.code_expires < timezone.now() or p.attempts >= max_attempts:
        return wrong
    if not hmac.compare_digest(p.code_hash, _hash(p, str(request.data.get("code") or "").strip())):
        p.attempts += 1
        p.save(update_fields=["attempts"])
        return wrong
    p.steps = p.steps[1:]
    p.code_hash, p.code_expires, p.attempts = "", None, 0
    p.save(update_fields=["steps", "code_hash", "code_expires", "attempts"])
    if p.steps:
        try:
            p.sent_at = None
            _send(p)
        except twofa.DeliveryError as e:
            return _fail("detail", f"Code versturen mislukt: {e}", status.HTTP_502_BAD_GATEWAY)
        return Response(_step_info(p))
    return _finish(request, p)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def resend(request):
    p = _pending(request)
    if not p or not p.steps:
        return _fail("detail", "Aanmelding verlopen, begin opnieuw.")
    if p.decoy:
        return Response({"ok": True})
    try:
        _send(p)
    except twofa.DeliveryError as e:
        return _fail("detail", str(e), status.HTTP_429_TOO_MANY_REQUESTS)
    return Response({"ok": True})
