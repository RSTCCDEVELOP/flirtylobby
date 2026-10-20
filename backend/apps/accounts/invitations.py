"""Invitations: an administrator sends a link; the invited person sets a password, accepts the terms, confirms the e-mail address and ends in the dashboard."""
import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core import modules as module_registry
from apps.sandbox import service as sandbox
from apps.security import service as security
from apps.security.models import LoginThrottle
from apps.security.words import find_forbidden

from .access import level
from .models import Invitation, ModuleGrant, Role, User, UserGroup
from .serializers import ProfileSerializer

logger = logging.getLogger(__name__)
MAX_HOURS = 24 * 365
CODE_MINUTES = 15
RESEND_SECONDS = 30


def _hash(t):
    return hashlib.sha256(t.encode()).hexdigest()


def _bad(text, code=status.HTTP_400_BAD_REQUEST, field="detail"):
    return Response({field: [text]} if field != "detail" else {"detail": text}, status=code)


def _status(i):
    if i.used_at:
        return "accepted"
    return "expired" if i.expires_at < timezone.now() else "open"


def _out(i):
    return {"id": i.id, "email": i.email, "first_name": i.first_name, "last_name": i.last_name, "status": _status(i), "expires_at": i.expires_at, "created_at": i.created_at, "used_at": i.used_at,
            "roles": list(i.roles.values_list("id", flat=True)), "groups": list(i.groups.values_list("id", flat=True)), "grants": i.grants,
            "require_terms": i.require_terms, "require_email_verify": i.require_email_verify, "terms_url": i.terms_url, "invited_by": (i.created_by.email if i.created_by_id else "")}


def _can(request, need=3):
    return level(request.user, "users") >= need


def _link_base(request):
    from apps.communication import layout

    return (layout._site_url() or request.headers.get("Origin") or "").rstrip("/")  # noqa: SLF001


def _send_invite(request, i, token):
    from apps.communication import sending

    url = f"{_link_base(request)}/uitnodiging/{token}"
    who = f"{i.first_name} {i.last_name}".strip()
    inviter = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email
    body = (f"Hallo {i.first_name},\n\n{inviter} nodigt je uit om een account aan te maken.\n\n[Account aanmaken]({url})\n\n"
            f"Of open deze link in je browser: {url}\n\nDe link is geldig tot {timezone.localtime(i.expires_at):%d-%m-%Y %H:%M}.")
    sending.send_email(i.email, "Je bent uitgenodigd", body, purpose="notifications", base_url=_link_base(request))
    i.sent_at = timezone.now()
    i.save(update_fields=["sent_at"])
    return who, url


def _clean_grants(actor, raw):
    out = []
    if not actor.is_staff:  # only superadmins hand out module access directly
        return out
    for g in raw or []:
        m = module_registry.BY_KEY.get(g.get("module"))
        if m and m.get("acl") is not False and g.get("level") in (1, 2, 3):
            out.append({"module": g["module"], "level": g["level"]})
    return out


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def invitations(request):
    if not _can(request, 3 if request.method == "POST" else 1):
        return _bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        return Response({"items": [_out(i) for i in Invitation.objects.select_related("created_by").prefetch_related("roles", "groups")[:500]],
                         "modules": [{"key": m["key"], "label": m["label"], "group": m["group"]} for m in module_registry.MODULES if m.get("acl") is not False],
                         "can_grants": request.user.is_staff})
    d = request.data
    email = str(d.get("email") or "").strip().lower()
    first, last = str(d.get("first_name") or "").strip()[:150], str(d.get("last_name") or "").strip()[:150]
    errors = {}
    try:
        validate_email(email)
    except DjangoValidationError:
        errors["email"] = ["Geef een geldig e-mailadres."]
    if not first:
        errors["first_name"] = ["Voornaam is verplicht."]
    if not last:
        errors["last_name"] = ["Achternaam is verplicht."]
    if not errors and User.objects.filter(email__iexact=email).exists():
        errors["email"] = ["Er bestaat al een account met dit e-mailadres."]
    try:
        hours = min(max(int(d.get("valid_hours") or 168), 1), MAX_HOURS)
    except (TypeError, ValueError):
        hours = 168
    terms_url = str(d.get("terms_url") or "").strip()[:300]
    if terms_url and not re.fullmatch(r"/[^\s]*|https?://[^\s]{3,290}", terms_url):
        errors["terms_url"] = ["Geef een geldige link (/pad of https://…)."]
    roles = list(Role.objects.filter(pk__in=[r for r in d.get("roles") or [] if isinstance(r, int)]))
    groups = list(UserGroup.objects.filter(pk__in=[g for g in d.get("groups") or [] if isinstance(g, int)]))
    if not request.user.is_staff:  # no escalation: not more than you have yourself
        mine = request.user.permission_keys()
        if any(not r.keys() <= mine for r in roles) or any(not r.keys() <= mine for g in groups for r in g.roles.all()):
            errors["roles"] = ["Je mag geen rollen toekennen met meer rechten dan jijzelf."]
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    Invitation.objects.filter(email__iexact=email, used_at__isnull=True).delete()  # a new invitation replaces the open one
    token = secrets.token_urlsafe(32)
    i = Invitation.objects.create(token_hash=_hash(token), email=email, first_name=first, last_name=last, grants=_clean_grants(request.user, d.get("grants")),
                                  require_terms=bool(d.get("require_terms", True)), terms_url=terms_url, require_email_verify=bool(d.get("require_email_verify", True)),
                                  expires_at=timezone.now() + timedelta(hours=hours), created_by=request.user)
    i.roles.set(roles)
    i.groups.set(groups)
    try:
        _send_invite(request, i, token)
    except Exception as e:  # noqa: BLE001
        i.delete()
        return _bad(f"De uitnodiging kon niet worden verstuurd: {e}", status.HTTP_502_BAD_GATEWAY)
    return Response(_out(i), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def invitation(request, pk):
    if not _can(request, 3):
        return _bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    Invitation.objects.filter(pk=pk).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invitation_resend(request, pk):
    """A new link (the old one stops working) with a new validity."""
    if not _can(request, 3):
        return _bad("Je hebt hier geen rechten voor.", status.HTTP_403_FORBIDDEN)
    i = Invitation.objects.filter(pk=pk, used_at__isnull=True).first()
    if not i:
        return _bad("Uitnodiging niet gevonden.", status.HTTP_404_NOT_FOUND)
    try:
        hours = min(max(int(request.data.get("valid_hours") or 168), 1), MAX_HOURS)
    except (TypeError, ValueError):
        hours = 168
    token = secrets.token_urlsafe(32)
    i.token_hash, i.expires_at, i.pending, i.code_hash = _hash(token), timezone.now() + timedelta(hours=hours), {}, ""
    i.save(update_fields=["token_hash", "expires_at", "pending", "code_hash"])
    try:
        _send_invite(request, i, token)
    except Exception as e:  # noqa: BLE001
        return _bad(f"Versturen mislukt: {e}", status.HTTP_502_BAD_GATEWAY)
    return Response(_out(i))


# ── the invited person (no login yet) ──

def _find(token):
    i = Invitation.objects.filter(token_hash=_hash(str(token))).first()
    if not i or i.used_at or i.expires_at < timezone.now():
        return None
    return i


GONE = "Deze uitnodiging is verlopen of al gebruikt. Vraag een nieuwe aan bij de beheerder."


def _throttle(request, key):
    ip = request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")
    th, _ = LoginThrottle.objects.get_or_create(key=f"{key}|{ip}"[:300])
    if timezone.now() - th.updated_at > timedelta(hours=1):
        th.failures = 0
    th.failures += 1
    th.save()
    return th.failures > 60


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def invite(request, token):
    if _throttle(request, "invite"):
        return _bad("Te veel pogingen. Probeer het later opnieuw.", status.HTTP_429_TOO_MANY_REQUESTS)
    i = _find(token)
    if not i:
        return _bad(GONE, status.HTTP_410_GONE)
    s = security.get()
    if request.method == "GET":
        return Response({"first_name": i.first_name, "last_name": i.last_name, "email": i.email, "require_terms": i.require_terms, "terms_url": i.terms_url or "/voorwaarden",
                        "require_email_verify": i.require_email_verify, "password_min_length": s["basic"]["password_min_length"], "password_complexity": s["basic"]["password_complexity"], "expires_at": i.expires_at})
    d = request.data
    password = str(d.get("password") or "")
    if i.require_terms and not d.get("accept_terms"):
        return _bad("Je moet de voorwaarden accepteren om verder te gaan.", field="accept_terms")
    try:
        validate_password(password, User(email=i.email, first_name=i.first_name, last_name=i.last_name))
    except DjangoValidationError as e:
        return Response({"password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=i.email).exists():
        return _bad(GONE, status.HTTP_410_GONE)
    i.pending = {"password": make_password(password)}
    i.terms_accepted_at = timezone.now() if i.require_terms else None
    i.save(update_fields=["pending", "terms_accepted_at"])
    if i.require_email_verify and not sandbox.skips_verification(i.email):
        err = _send_code(i)
        if err:
            return _bad(err, status.HTTP_502_BAD_GATEWAY)
        return Response({"step": "verify", "destination": __import__("apps.security.twofa", fromlist=["mask_email"]).mask_email(i.email), **({"sandbox_code": i._sandbox_code} if getattr(i, "_sandbox_code", None) else {})})
    return _finish(i, verified=False)


def _code_hash(i, code):
    from django.conf import settings

    return hashlib.sha256(f"inv:{i.pk}:{code}:{settings.SECRET_KEY}".encode()).hexdigest()


def _send_code(i):
    """Send a 6-digit code to the invited address. Returns an error text or None."""
    if i.code_sent_at and (timezone.now() - i.code_sent_at).total_seconds() < RESEND_SECONDS:
        return f"Wacht even voordat je een nieuwe code aanvraagt ({RESEND_SECONDS} seconden)."
    code = (sandbox.get()["fixed_code"] if sandbox.active() else "") or f"{secrets.randbelow(10**6):06d}"
    if sandbox.code_on_screen():
        i._sandbox_code = code
    else:
        from apps.communication import sending

        try:
            sending.send_email(i.email, "Je verificatiecode", f"Je code is {code}. Hij is {CODE_MINUTES} minuten geldig.", purpose="security", code=code)
        except Exception as e:  # noqa: BLE001
            return f"Code versturen mislukt: {e}"
    i.code_hash, i.code_expires, i.attempts, i.code_sent_at = _code_hash(i, code), timezone.now() + timedelta(minutes=CODE_MINUTES), 0, timezone.now()
    i.save(update_fields=["code_hash", "code_expires", "attempts", "code_sent_at"])
    from django.conf import settings

    if settings.DEBUG:
        logger.warning("Invitation code for %s (DEBUG only): %s", i.email, code)
    return None


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def invite_verify(request, token):
    if _throttle(request, "invite"):
        return _bad("Te veel pogingen. Probeer het later opnieuw.", status.HTTP_429_TOO_MANY_REQUESTS)
    i = _find(token)
    if not i or not i.pending.get("password"):
        return _bad(GONE, status.HTTP_410_GONE)
    wrong = _bad("Onjuiste of verlopen code.")
    if not i.code_hash or not i.code_expires or i.code_expires < timezone.now() or i.attempts >= security.get()["twofa"]["max_attempts"]:
        return wrong
    if not hmac.compare_digest(i.code_hash, _code_hash(i, str(request.data.get("code") or "").strip())):
        i.attempts += 1
        i.save(update_fields=["attempts"])
        return wrong
    return _finish(i, verified=True)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def invite_resend(request, token):
    i = _find(token)
    if not i or not i.pending.get("password"):
        return _bad(GONE, status.HTTP_410_GONE)
    err = _send_code(i)
    if err:
        return _bad(err, status.HTTP_429_TOO_MANY_REQUESTS)
    return Response({"ok": True, **({"sandbox_code": i._sandbox_code} if getattr(i, "_sandbox_code", None) else {})})


def _finish(i, verified):
    if User.objects.filter(email__iexact=i.email).exists():
        return _bad(GONE, status.HTTP_410_GONE)
    user = User(username=i.email, email=i.email, first_name=i.first_name, last_name=i.last_name, display_name=__import__("apps.accounts.registration", fromlist=["unique_display_name"]).unique_display_name(i.first_name),
                password=i.pending["password"], is_active=True, email_verified=bool(verified))
    user.save()
    user.roles.set(i.roles.all())
    user.user_groups.set(i.groups.all())
    for g in i.grants or []:
        ModuleGrant.objects.update_or_create(module=g["module"], user=user, defaults={"level": g["level"]})
    i.used_at, i.user, i.pending, i.code_hash = timezone.now(), user, {}, ""
    i.save(update_fields=["used_at", "user", "pending", "code_hash"])
    token = Token.objects.create(user=user)
    logger.info("Invitation accepted: %s", user.email)
    __import__("apps.plugins.runtime", fromlist=["emit"]).emit("user_registered", user=user)
    return Response({"done": True, "token": token.key, "user": ProfileSerializer(user).data}, status=status.HTTP_201_CREATED)
