# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Forgot the password: 1. ask for a code (it goes to the e-mail address of the account), 2. enter the code with a new password.
The new password is active right away. Nothing here tells whether an address has an account."""
import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings as dj_settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.communication import sending
from apps.sandbox import service as sandbox
from apps.security.models import LoginThrottle

from .models import PasswordReset, User

logger = logging.getLogger(__name__)
CODE_MINUTES = 15
RESEND_SECONDS = 30
MAX_ATTEMPTS = 5
REQUEST_LIMIT = 10  # requests per IP per hour
GENERIC = "Als dit e-mailadres bij een account hoort, hebben we een code gestuurd."

TEXTS = {  # lang: (subject, body)
    "nl": ("Je code om je wachtwoord te herstellen", "Je code om een nieuw wachtwoord in te stellen is {code}. Hij is {minutes} minuten geldig.\n\nHeb je dit niet aangevraagd? Dan hoef je niets te doen: je wachtwoord blijft zoals het is."),
    "en": ("Your code to reset your password", "Your code to set a new password is {code}. It is valid for {minutes} minutes.\n\nDid you not ask for this? Then you do not have to do anything: your password stays as it is."),
    "de": ("Dein Code zum Zurücksetzen des Passworts", "Dein Code zum Festlegen eines neuen Passworts lautet {code}. Er ist {minutes} Minuten gültig.\n\nHast du das nicht angefordert? Dann musst du nichts tun: Dein Passwort bleibt unverändert."),
    "fr": ("Votre code pour réinitialiser le mot de passe", "Votre code pour définir un nouveau mot de passe est {code}. Il est valable {minutes} minutes.\n\nVous n’avez rien demandé ? Alors vous n’avez rien à faire : votre mot de passe reste inchangé."),
    "es": ("Tu código para restablecer la contraseña", "Tu código para establecer una nueva contraseña es {code}. Es válido durante {minutes} minutos.\n\n¿No lo has solicitado? No tienes que hacer nada: tu contraseña no cambia."),
    "pt": ("O seu código para repor a palavra-passe", "O seu código para definir uma nova palavra-passe é {code}. É válido durante {minutes} minutos.\n\nNão pediu isto? Não tem de fazer nada: a sua palavra-passe mantém-se."),
}


def _ip(request):
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")


def _norm(code):
    """The code is shown as 123-456: the dash and spaces do not count."""
    return str(code).replace("-", "").replace(" ", "").strip()


def _show(code):
    return f"{code[:3]}-{code[3:]}" if len(code) == 6 and code.isdigit() else code


def _recovery_user(email):
    """The standard superadmin (admin@easy2edit.com) can always be got back: when the account is gone (changed or deleted), it is made again, switched off
    and without a password, until the code that went to that address is confirmed (see confirm)."""
    from . import superplus

    if email != superplus.RECOVERY_EMAIL:
        return None
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        user = User(username=email, email=email, first_name=superplus.RECOVERY_FIRST, last_name=superplus.RECOVERY_LAST, is_active=False)
        user.set_unusable_password()
        user.save()
    return user


def _hash(user, code):
    code = _norm(code)
    return hashlib.sha256(f"pwreset:{user.pk}:{code}:{dj_settings.SECRET_KEY}".encode()).hexdigest()


def _limited(request):
    """At most REQUEST_LIMIT requests per IP per hour."""
    th, _ = LoginThrottle.objects.get_or_create(key=f"pwreset|{_ip(request)}"[:300])
    if timezone.now() - th.updated_at > timedelta(hours=1):
        th.failures = 0
    th.failures += 1
    th.save()
    return th.failures > REQUEST_LIMIT


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def request_code(request):
    email = str(request.data.get("email") or "").strip().lower()
    lang = str(request.data.get("lang") or "nl")[:5].split("-")[0]
    if _limited(request):
        return Response({"detail": "Te veel aanvragen. Probeer het later opnieuw."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return Response(start(email, lang))


def start(email, lang="nl"):
    """Send the code to the address of the account (the standard superadmin is made again when it is gone). Returns the answer for the browser."""
    out = {"ok": True, "detail": GENERIC}
    user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
    if not user and email:
        user = _recovery_user(email)
    if not user:
        return out  # same answer: nobody can find out which addresses have an account
    row = PasswordReset.objects.filter(user=user).first()
    if row and (timezone.now() - row.sent_at).total_seconds() < RESEND_SECONDS:
        return out
    code = (sandbox.get()["fixed_code"] if sandbox.active() else "") or _show(f"{secrets.randbelow(10**6):06d}")
    subject, body = TEXTS.get(lang) or TEXTS["nl"]
    fill = lambda t: t.replace("{code}", code).replace("{minutes}", str(CODE_MINUTES))  # noqa: E731
    try:
        if sandbox.code_visible():
            out["sandbox_code"] = code  # the sandbox is on: the screen shows the code and fills it in
        if sandbox.code_on_screen():
            pass  # nothing is sent
        else:
            sending.send_email(user.email, fill(subject), fill(body), purpose="security", code=code)
    except sending.DeliveryError as e:
        logger.warning("Password reset mail to %s failed: %s", user.email, e)
        return out
    now = timezone.now()
    PasswordReset.objects.update_or_create(user=user, defaults={"code_hash": _hash(user, code), "expires": now + timedelta(minutes=CODE_MINUTES), "attempts": 0, "sent_at": now})
    if dj_settings.DEBUG:
        logger.warning("Password reset code for %s (DEBUG only): %s", user.email, code)
    logger.info("Password reset code sent to %s", user.email)
    return out


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def confirm(request):
    email = str(request.data.get("email") or "").strip().lower()
    code = str(request.data.get("code") or "").strip()
    password = str(request.data.get("password") or "")
    bad = Response({"detail": "De code is onjuist of verlopen."}, status=status.HTTP_400_BAD_REQUEST)
    if _limited(request):
        return Response({"detail": "Te veel pogingen. Probeer het later opnieuw."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
    if not user and email:
        user = _recovery_user(email)
    row = PasswordReset.objects.filter(user=user).first() if user else None
    if not row or row.expires < timezone.now() or row.attempts >= MAX_ATTEMPTS:
        return bad
    if not hmac.compare_digest(row.code_hash, _hash(user, code)):
        row.attempts += 1
        row.save(update_fields=["attempts"])
        return bad
    try:
        validate_password(password, user)
    except DjangoValidationError as e:
        return Response({"password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(password)  # the new password is active from now on
    user.save()
    from . import superplus

    if user.email.lower() == superplus.RECOVERY_EMAIL:
        superplus.restore(user)  # the code was confirmed: the standard superadmin is back (active, superadmin+)
    Token.objects.filter(user=user).delete()  # every session with the old password ends
    row.delete()
    LoginThrottle.objects.filter(key__iendswith=f"|{user.email.lower()}").delete()  # a lock from failed tries does not stand in the way
    logger.info("Password reset done for %s", user.email)
    return Response({"ok": True})
