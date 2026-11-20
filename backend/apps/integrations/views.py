# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny

from apps.accounts.permissions import has_level, has_level_for
from apps.core import modules
from apps.core.modules import module_required
from rest_framework.response import Response

from . import lock, providers
from .models import Integration
from .serializers import IntegrationSerializer

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def active_integrations(request):
    """Public: only which integrations are switched on (no settings), so the UI can hide features."""
    if not modules.enabled("integrations"):
        return Response({"active": []})
    return Response({"active": list(Integration.objects.filter(enabled=True).values_list("slug", flat=True))})


@api_view(["GET"])
@permission_classes([has_level("integrations", "use"), module_required("integrations")])
def provider_catalog(request):
    return Response(providers.catalog())


class IntegrationViewSet(viewsets.ModelViewSet):
    queryset = Integration.objects.all()
    serializer_class = IntegrationSerializer
    permission_classes = [has_level_for("integrations", {"list": "use", "retrieve": "use", "create": "manage", "destroy": "manage"}, default="edit"), module_required("integrations")]

    def get_object(self):
        obj = super().get_object()
        # a link that is locked is closed to everything (change, test, sms test, delete) until it was opened with its password
        if obj.locked and self.action not in ("retrieve", "unlock", "lock") and not lock.is_open(self.request.user, obj):
            raise PermissionDenied("Open de koppeling eerst met het wachtwoord.")
        return obj

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        """Open a locked link with its password (30 minutes, only for this person)."""
        obj = self.get_object()
        if not obj.locked:
            return Response(self.get_serializer(obj).data)
        res = lock.try_open(request.user, obj, request.data.get("password"))
        if res == "blocked":
            return Response({"detail": "Te veel pogingen. Probeer het over 10 minuten opnieuw."}, status=429)
        if res != "ok":
            return Response({"detail": "Het wachtwoord is onjuist."}, status=400)
        logger.info("Link %s opened by %s", obj.slug, request.user.email)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        """Close a locked link again (before the 30 minutes are over)."""
        obj = self.get_object()
        lock.close(request.user, obj)
        return Response(self.get_serializer(obj).data)

    def get_queryset(self):
        """A link of the superadmins is only seen and changed by superadmins."""
        qs = Integration.objects.all()
        return qs if self.request.user.is_staff else qs.filter(superadmin_only=False)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.enabled:
            return Response({"detail": "Zet de koppeling eerst uit (Wijzig) voordat je hem verwijdert."}, status=400)
        if (obj.always_on or obj.in_installation) and not getattr(request.user, "is_superplus", False):
            return Response({"detail": "Alleen een superadmin+ kan een systeemkoppeling verwijderen."}, status=403)
        if obj.provider == "s3":
            from apps.medialib.models import MediaItem

            if MediaItem.objects.filter(storage="s3").exists():
                return Response({"detail": "Er staan nog bestanden op S3. Verplaats ze eerst naar lokaal (Admin → Media)."},
                                status=400)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        obj = self.get_object()
        from apps.sandbox import service as sandbox

        if sandbox.active("integrations"):
            ok, message = True, "Gesimuleerd (sandbox): er is geen echte verbinding gemaakt."
        else:
            ok, message = providers.PROVIDERS[obj.provider]["test"](obj.config)
        obj.last_test_ok, obj.last_test_message, obj.last_test_at = ok, message[:300], timezone.now()
        obj.save(update_fields=["last_test_ok", "last_test_message", "last_test_at"])
        logger.info("Integration test %s: %s", obj.slug, "ok" if ok else "failed")
        return Response(self.get_serializer(obj).data)

    # ── the SMS screens: send a test code to a phone and enter it (the same steps as a verification), for the SMS links ──
    SMS_SALT = "integration-sms-test"

    @action(detail=True, methods=["post"], url_path="sms-test")
    def sms_test(self, request, pk=None):
        """Step 1: send a test code by SMS through this link. {phone} -> {token, sandbox_code?}. The token (valid 10 minutes) goes back with the code in sms-verify."""
        import hashlib
        import secrets

        from django.core import signing
        from django.core.cache import cache

        from apps.sandbox import service as sandbox
        from apps.security import twofa

        from . import spryng

        obj = self.get_object()
        if obj.provider not in ("spryng", "seven", "bird"):
            return Response({"detail": "Deze koppeling verstuurt geen sms."}, status=400)
        if cache.get(f"smstest:{request.user.pk}"):
            return Response({"detail": "Wacht even voordat je opnieuw een code laat versturen."}, status=429)
        phone = str(request.data.get("phone") or "").strip()
        try:
            phone = spryng.number(phone)  # +31612345678
        except spryng.SpryngError as e:
            return Response({"detail": str(e)}, status=400)
        saved = ""
        if not str(getattr(request.user, "phone", "") or "").strip():  # a number that is typed here is kept in the profile of the login (only when there is none yet), so it is filled in next time
            request.user.phone = phone[:20]
            request.user.save(update_fields=["phone"])
            saved = request.user.phone
        code = (sandbox.get()["fixed_code"] if sandbox.active() else "") or f"{secrets.randbelow(10**6):06d}"
        shown = f"{code[:3]}-{code[3:]}" if len(code) == 6 and code.isdigit() else code
        text = f"easy2edit testcode: {shown}"
        out = {"phone_saved": saved} if saved else {}
        try:
            if sandbox.code_on_screen():
                out["sandbox_code"] = shown  # nothing is sent: the screen shows the code
            else:
                sent = twofa.send_via(obj, phone, text)  # this very link (not the first one that is on)
                if obj.provider == "seven" and isinstance(sent, dict):
                    from . import seven

                    state, err_code = seven.delivery(obj.config, sent.get("id"))
                    if state in ("REJECTED", "FAILED", "EXPIRED", "NOTDELIVERED", "UNDELIVERED"):
                        raise twofa.DeliveryError(f"seven.io heeft het bericht aangenomen, maar de operator heeft het niet bezorgd ({state}, foutcode {err_code or '?'}). Het tegoed kan toch afgeschreven zijn. Neem contact op met seven.io (support@seven.io) en noem het nummer {phone}.")
        except (spryng.SpryngError, twofa.DeliveryError) as e:
            # the reason is kept on the link too: the card shows it (red dot and the message)
            obj.last_test_ok, obj.last_test_message, obj.last_test_at = False, f"Sms-test mislukt: {e}"[:300], timezone.now()
            obj.save(update_fields=["last_test_ok", "last_test_message", "last_test_at"])
            return Response({"detail": str(e), **({"phone_saved": saved} if saved else {})}, status=502)
        cache.set(f"smstest:{request.user.pk}", 1, 30)
        digest = hashlib.sha256(f"{pk}:{code}:{request.user.pk}".encode()).hexdigest()
        out["token"] = signing.dumps({"id": obj.pk, "h": digest}, salt=self.SMS_SALT)
        logger.info("SMS test code sent through %s", obj.slug)
        return Response(out)

    @action(detail=True, methods=["post"], url_path="sms-verify")
    def sms_verify(self, request, pk=None):
        """Step 2: the code that arrived. {token, code} -> {ok}. Marks the link as tested when the code is right."""
        import hashlib
        import hmac

        from django.core import signing

        obj = self.get_object()
        try:
            data = signing.loads(str(request.data.get("token") or ""), salt=self.SMS_SALT, max_age=600)
        except signing.BadSignature:
            return Response({"detail": "De code is verlopen. Vraag een nieuwe aan."}, status=400)
        code = str(request.data.get("code") or "").replace("-", "").replace(" ", "").strip()
        want = hashlib.sha256(f"{pk}:{code}:{request.user.pk}".encode()).hexdigest()
        if data.get("id") != obj.pk or not hmac.compare_digest(str(data.get("h")), want):
            return Response({"detail": "De code is onjuist."}, status=400)
        obj.last_test_ok, obj.last_test_message, obj.last_test_at = True, "Sms-test gelukt: de code kwam aan.", timezone.now()
        obj.save(update_fields=["last_test_ok", "last_test_message", "last_test_at"])
        return Response({"ok": True, **{"integration": self.get_serializer(obj).data}})


@api_view(["POST"])
@permission_classes([has_level("integrations", "edit"), module_required("integrations")])
def model_list(request):
    """The models of a provider: with the key typed in the form, or with the key of a saved link (id)."""
    provider = str(request.data.get("provider") or "")
    cfg = {}
    if request.data.get("id"):
        obj = Integration.objects.filter(pk=request.data["id"], provider=provider, **({} if request.user.is_staff else {"superadmin_only": False})).first()
        cfg = dict(obj.config) if obj and lock.is_open(request.user, obj) else {}  # (a locked link only gives its key once it was opened)
    typed = str(request.data.get("api_key") or "")
    if typed and not typed.startswith("•"):
        cfg["api_key"] = typed
    try:
        return Response({"models": providers.list_models(provider, cfg)})
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([has_level("integrations", "manage"), module_required("integrations")])
def export_all(request):
    """All links including their keys, locked with a password."""
    from . import backup, transfer

    pw = str(request.data.get("password") or "")
    if len(pw) < 8:
        return Response({"detail": "Kies een wachtwoord van minstens 8 tekens om het bestand te beveiligen."}, status=400)
    rows = backup._export({"include_secrets": True, "hide_superadmin": not request.user.is_staff})
    closed = {o.slug for o in Integration.objects.filter(locked=True) if not lock.is_open(request.user, o)}  # a link that is locked is not exported before it was opened
    rows = [r for r in rows if r.get("slug") not in closed]
    logger.info("API links exported by %s (%s links)", request.user.email, len(rows))
    return Response(transfer.pack(rows, pw))


@api_view(["POST"])
@permission_classes([has_level("integrations", "manage"), module_required("integrations")])
def import_all(request):
    """Load an export file: new links are created, existing ones (same name) are updated, keys included."""
    from . import backup, transfer

    try:
        rows = transfer.unpack(request.data.get("bundle"), str(request.data.get("password") or ""))
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)
    if not request.user.is_staff:  # a non-superadmin cannot touch the links of the superadmins
        locked = set(Integration.objects.filter(superadmin_only=True).values_list("slug", flat=True))
        rows = [{k: v for k, v in r.items() if k != "superadmin_only"} for r in rows if r.get("slug") not in locked]
    msg = backup._apply(rows, None)
    logger.info("API links imported by %s (%s links)", request.user.email, len(rows))
    return Response({"detail": msg, "count": len(rows)})
