import logging
from datetime import timedelta

from django.core import signing
from django.contrib.auth.signals import user_logged_in
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.decorators import action, api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.security import service as security_service
from apps.security import twofa
from apps.security.authentication import is_expired
from apps.security.models import LoginThrottle

from .models import Role, User, UserGroup
from apps.core.modules import module_required

from .permissions import has_level_any, has_level_for
from .perms import catalog
from .serializers import (PasswordChangeSerializer, PhotoSerializer, ProfileSerializer, RoleSerializer, UserGroupSerializer,
                          UserSerializer)

logger = logging.getLogger(__name__)
CHALLENGE_SALT = "login-2fa"


def client_ip(request):
    # nginx sets X-Real-IP to the real peer address (not spoofable by the client)
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")


@api_view(["POST"])
@authentication_classes([])  # a stale token in the browser must not block logging in
@permission_classes([AllowAny])
def login(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    cfg = security_service.get()["basic"]
    throttle, _ = LoginThrottle.objects.get_or_create(key=f"{client_ip(request)}|{email}"[:300])

    if throttle.locked_until and throttle.locked_until > timezone.now():
        minutes = max(1, int((throttle.locked_until - timezone.now()).total_seconds() // 60) + 1)
        return Response({"detail": f"Te veel mislukte pogingen. Probeer het over {minutes} minuten opnieuw."},
                        status=status.HTTP_429_TOO_MANY_REQUESTS)

    user = User.objects.filter(email__iexact=email).first()
    if not user or not user.check_password(password):
        throttle.failures += 1
        if throttle.failures >= cfg["login_max_attempts"]:
            throttle.locked_until = timezone.now() + timedelta(minutes=cfg["lockout_minutes"])
            throttle.failures = 0
            logger.warning("Login locked for %s", email)
        throttle.save()
        logger.warning("Failed login for %s", email)
        return Response({"detail": "Onjuist e-mailadres of wachtwoord."}, status=status.HTTP_400_BAD_REQUEST)
    if not user.is_active:
        logger.warning("Blocked user tried to log in: %s", email)
        return Response({"detail": "Dit account is geblokkeerd."}, status=status.HTTP_403_FORBIDDEN)

    throttle.delete()
    if (blocked := _maintenance_block(user)):
        return blocked
    if twofa.email_verify_required(user):
        return _challenge_response(user, email_verify=True)
    if user.otp_active and security_service.get()["twofa"]["enabled"] and not twofa.exempt(user):
        return _challenge_response(user)
    return _finish_login(request, user)


def _challenge_response(user, email_verify=False):
    """Send a code and hand the browser a signed challenge. email_verify: confirm the address (always by e-mail) before anything else."""
    method = "email" if email_verify else user.twofa_method
    if method != "app":  # with an authenticator app there is nothing to send
        shown = None
        try:
            shown = twofa.issue_code(user, force_email=email_verify)
        except twofa.DeliveryError as e:
            return Response({"detail": f"Code versturen mislukt: {e}"}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({**({"sandbox_code": shown} if method != "app" and shown else {}), "twofa_required": True, "method": method, "email_verify": email_verify,
                     "destination": twofa.mask_email(user.email) if method == "email" else twofa.destination_hint(user),
                     "challenge": signing.dumps({"uid": user.pk, "ev": email_verify}, salt=CHALLENGE_SALT)})


def _maintenance_block(user):
    """Maintenance mode: only administrators log in. Returns the refusal, or None."""
    from apps.core import system

    from .access import can_admin

    if system.get()["maintenance"] and not can_admin(user):
        return Response({"detail": "De website is in onderhoud. Alleen beheerders kunnen nu inloggen."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return None


def _finish_login(request, user):
    if (blocked := _maintenance_block(user)):
        return blocked
    token, _ = Token.objects.get_or_create(user=user)
    if is_expired(token):
        token.delete()
        token = Token.objects.create(user=user)
    user_logged_in.send(sender=User, request=request, user=user)
    logger.info("Login: %s", user.email)
    __import__("apps.plugins.runtime", fromlist=["emit"]).emit("user_login", user=user)
    return Response({"token": token.key, "user": ProfileSerializer(user).data})


def _challenge_user(request):
    """(user, email_verify) from the signed challenge, or (None, False)."""
    try:
        data = signing.loads(request.data.get("challenge", ""), salt=CHALLENGE_SALT, max_age=900)
        return User.objects.get(pk=data["uid"], is_active=True), bool(data.get("ev"))
    except (signing.BadSignature, User.DoesNotExist):
        return None, False


@api_view(["POST"])
@authentication_classes([])  # a stale token in the browser must not block logging in
@permission_classes([AllowAny])
def login_verify(request):
    user, email_verify = _challenge_user(request)
    if not user:
        return Response({"detail": "Inlogsessie verlopen, log opnieuw in."}, status=status.HTTP_400_BAD_REQUEST)
    use_app = user.twofa_method == "app" and not email_verify
    if not (twofa.check_app_code if use_app else twofa.check_code)(user, request.data.get("code", "")):
        logger.warning("Failed 2FA code for %s", user.email)
        return Response({"detail": "Onjuiste of verlopen code."}, status=status.HTTP_400_BAD_REQUEST)
    if email_verify or user.twofa_method == "email":  # a code that arrived by e-mail proves the address
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
    if email_verify and user.otp_active and security_service.get()["twofa"]["enabled"]:
        return _challenge_response(user)  # address confirmed, now the normal 2FA step
    return _finish_login(request, user)


@api_view(["POST"])
@authentication_classes([])  # a stale token in the browser must not block logging in
@permission_classes([AllowAny])
def login_resend(request):
    user, email_verify = _challenge_user(request)
    if not user:
        return Response({"detail": "Inlogsessie verlopen, log opnieuw in."}, status=status.HTTP_400_BAD_REQUEST)
    if user.twofa_method == "app" and not email_verify:
        return Response({"detail": "Open je authenticator-app voor de code."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        shown = twofa.issue_code(user, force_email=email_verify)
    except twofa.DeliveryError as e:
        return Response({"detail": str(e)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    return Response({"ok": True, **({"sandbox_code": shown} if shown else {})})


@api_view(["POST"])
def twofa_start(request):
    """Logged-in user picks a method; a code is sent to verify it before 2FA is switched on."""
    method, user = request.data.get("method"), request.user
    if method not in twofa.allowed_methods():
        return Response({"detail": "Deze methode is niet beschikbaar."}, status=status.HTTP_400_BAD_REQUEST)
    if method == "app":  # QR code + key; the app is switched on once the first code is confirmed
        secret, uri = twofa.app_start(user)
        return Response({"app": True, "secret": secret, "uri": uri})
    phone = (request.data.get("phone") or "").replace(" ", "")
    if method == "sms" and not twofa.PHONE_RE.match(phone):
        return Response({"detail": "Geef een telefoonnummer met landcode, bv. +31612345678."}, status=status.HTTP_400_BAD_REQUEST)
    user.twofa_method = method
    if method == "sms":
        user.phone = phone
    user.save(update_fields=["twofa_method", "phone"])
    try:
        twofa.issue_code(user)
    except twofa.DeliveryError as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"destination": twofa.destination_hint(user)})


@api_view(["POST"])
def twofa_confirm(request):
    user = request.user
    if request.data.get("method") == "app":
        if "app" not in twofa.allowed_methods() or not twofa.check_app_code(user, request.data.get("code", "")):
            return Response({"detail": "Onjuiste of verlopen code."}, status=status.HTTP_400_BAD_REQUEST)
        user.twofa_method = "app"
        user.save(update_fields=["twofa_method"])
    elif not twofa.check_code(user, request.data.get("code", "")):
        return Response({"detail": "Onjuiste of verlopen code."}, status=status.HTTP_400_BAD_REQUEST)
    user.otp_active = True
    if user.twofa_method == "email":
        user.email_verified = True
    user.save(update_fields=["otp_active", "email_verified"])
    logger.info("2FA enabled for %s (%s)", user.email, user.twofa_method)
    return Response(ProfileSerializer(user).data)


@api_view(["POST"])
def twofa_disable(request):
    user = request.user
    if twofa.required_for(user):
        return Response({"detail": "Twee-staps verificatie is verplicht voor jouw account."}, status=status.HTTP_400_BAD_REQUEST)
    if not user.check_password(request.data.get("password", "")):
        return Response({"detail": "Wachtwoord onjuist."}, status=status.HTTP_400_BAD_REQUEST)
    user.otp_active, user.twofa_method, user.otp_token, user.totp_secret = False, "", "", ""
    user.save(update_fields=["otp_active", "twofa_method", "otp_token", "totp_secret"])
    logger.info("2FA disabled for %s", user.email)
    return Response(ProfileSerializer(user).data)


@api_view(["POST"])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
def me(request):
    if request.method == "PATCH":
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(ProfileSerializer(request.user).data)


@api_view(["POST"])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not request.user.check_password(serializer.validated_data["old_password"]):
        return Response({"old_password": ["Huidig wachtwoord is onjuist."]}, status=status.HTTP_400_BAD_REQUEST)
    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save()
    Token.objects.filter(user=request.user).delete()
    token = Token.objects.create(user=request.user)
    return Response({"token": token.key})


@api_view(["POST"])
def delete_me(request):
    """A member deletes their own account: after confirming with the password, everything of them is erased."""
    from .erasure import erase_user

    user = request.user
    if not user.check_password(str(request.data.get("password", ""))):
        return Response({"password": ["Wachtwoord is onjuist."]}, status=status.HTTP_400_BAD_REQUEST)
    if user.is_superuser and not User.objects.filter(is_superuser=True, is_active=True).exclude(pk=user.pk).exists():
        return Response({"detail": "Je bent de enige superadmin; maak eerst iemand anders superadmin."}, status=status.HTTP_400_BAD_REQUEST)
    erase_user(user)
    return Response(status=status.HTTP_204_NO_CONTENT)


def _set_photo(user, request):
    """Upload (POST) or remove (DELETE) a profile photo. Images only, max 5 MB."""
    from apps.medialib import service as media_service

    old = user.image.name
    if request.method == "DELETE":
        user.image = ""
    else:
        up = PhotoSerializer(data=request.data)
        if not up.is_valid():
            return Response({"detail": " ".join(str(m) for v in up.errors.values() for m in v)}, status=status.HTTP_400_BAD_REQUEST)
        user.image = up.validated_data["image"]
    user.save(update_fields=["image"])
    media_service.release(old)
    return Response(ProfileSerializer(user, context={"request": request}).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("email")
    serializer_class = UserSerializer
    permission_classes = [has_level_for("users", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit")]

    def get_queryset(self):
        qs = User.objects.prefetch_related("roles", "user_groups").order_by("email")
        # delegated managers cannot even see beheerders
        return qs if self.request.user.is_staff else qs.exclude(is_staff=True)

    def destroy(self, request, *args, **kwargs):
        if self.get_object() == request.user:
            return Response({"detail": "Je kunt jezelf niet verwijderen."}, status=status.HTTP_400_BAD_REQUEST)
        from .erasure import erase_user

        erase_user(self.get_object())  # files, keys, group/role links and records go too
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def block(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "Je kunt jezelf niet blokkeren."}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = False
        user.save(update_fields=["is_active"])
        Token.objects.filter(user=user).delete()
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser, FormParser], url_path="image")
    def image(self, request, pk=None):
        return _set_photo(self.get_object(), request)

    @action(detail=True, methods=["post"])
    def reset_2fa(self, request, pk=None):
        user = self.get_object()
        user.otp_active, user.twofa_method, user.otp_token, user.phone, user.totp_secret = False, "", "", "", ""
        user.save(update_fields=["otp_active", "twofa_method", "otp_token", "phone", "totp_secret"])
        Token.objects.filter(user=user).delete()
        logger.info("2FA reset for %s by %s", user.email, request.user.email)
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response(self.get_serializer(user).data)


class RoleViewSet(viewsets.ModelViewSet):
    serializer_class = RoleSerializer

    def get_queryset(self):
        from django.db.models import Count

        return Role.objects.annotate(user_count=Count("users"))

    def get_permissions(self):
        # reading roles is needed to assign them in the users module
        if self.action in ("list", "retrieve", "permission_catalog"):
            perm = has_level_any(("roles", "use"), ("users", "use"))
        else:
            perm = has_level_for("roles", {"create": "manage", "destroy": "manage"}, default="edit")
        return [perm(), module_required("roles")()]

    def perform_update(self, serializer):
        if serializer.instance.locked:
            raise ValidationError("Deze ingebouwde rol kan niet worden gewijzigd.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.locked:
            raise ValidationError("Deze ingebouwde rol kan niet worden verwijderd.")
        instance.delete()

    @action(detail=False, methods=["get"], url_path="catalog")
    def permission_catalog(self, request):
        return Response(catalog())


class UserGroupViewSet(viewsets.ModelViewSet):
    """Groups of users (module 'users'): members, linked roles, and module access via Admin -> Modules."""

    serializer_class = UserGroupSerializer
    permission_classes = [has_level_for("users", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit")]

    def get_queryset(self):
        from django.db.models import Count

        return UserGroup.objects.annotate(member_count=Count("members", distinct=True)).prefetch_related("roles", "members")


@api_view(["POST", "DELETE"])
@parser_classes([MultiPartParser, FormParser])
def my_photo(request):
    return _set_photo(request.user, request)


# ── Module access (Admin -> Modules -> poppetje): superadmins only ──────────
from rest_framework.permissions import IsAdminUser  # noqa: E402

from apps.core import modules as module_registry  # noqa: E402

from .access import LEVEL_NAMES  # noqa: E402
from .models import ModuleGrant  # noqa: E402


def _grant(g):
    return {"id": g.id, "module": g.module, "level": g.level, "level_name": LEVEL_NAMES[g.level],
            "type": "role" if g.role_id else "group" if g.group_id else "user", "subject_id": g.role_id or g.group_id or g.user_id,
            "subject": g.role.name if g.role_id else g.group.name if g.group_id else (f"{g.user.first_name} {g.user.last_name}".strip() or g.user.email),
            "email": g.user.email if g.user_id else ""}


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def module_grants(request):
    if request.method == "GET":
        qs = ModuleGrant.objects.select_related("role", "user", "group")
        qs = qs.filter(group_id=request.query_params["group"]) if request.query_params.get("group") else qs.filter(module=request.query_params.get("module", ""))
        return Response([_grant(g) for g in qs])
    d = request.data
    mod, level, kind = d.get("module"), d.get("level"), d.get("type")
    m = module_registry.BY_KEY.get(mod)
    if not m or m.get("acl") is False or level not in (1, 2, 3) or kind not in ("role", "user", "group"):
        return Response({"detail": "Ongeldige invoer."}, status=status.HTTP_400_BAD_REQUEST)
    subject = {"role": Role, "user": User, "group": UserGroup}[kind].objects.filter(pk=d.get("id")).first()
    if not subject:
        return Response({"detail": "Groep of gebruiker niet gevonden."}, status=status.HTTP_400_BAD_REQUEST)
    lookup = {"module": mod, kind: subject}
    grant, _ = ModuleGrant.objects.update_or_create(**lookup, defaults={"level": level})
    logger.info("Module %s: %s '%s' -> level %s by %s", mod, kind, subject, level, request.user.email)
    return Response(_grant(grant), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminUser])
def module_grant(request, pk):
    grant = ModuleGrant.objects.filter(pk=pk).first()
    if not grant:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        grant.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.data.get("level") not in (1, 2, 3):
        return Response({"detail": "Ongeldig niveau."}, status=status.HTTP_400_BAD_REQUEST)
    grant.level = request.data["level"]
    grant.save(update_fields=["level"])
    return Response(_grant(grant))
