# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo mode: the settings screen of the superadmin (tab Demo mode in Standaard en globale instellingen)."""
import logging
import re
import threading

from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import demo
from .models import DemoEntity, DemoSettings, DemoUser

logger = logging.getLogger(__name__)
_bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


def _is_super(request):
    return bool(request.user.is_staff or request.user.is_superuser)


def _user(d):
    return {"id": d.id, "email": d.email, "first_name": d.first_name, "last_name": d.last_name, "password": d.password, "note": d.note, "roles": d.roles or [], "groups": d.groups or []}


ENTITY_FIELDS = ("name", "kind", "legal_name", "email", "phone", "website", "street", "house_number", "postal_code", "city", "country")


def _entity(e):
    return {"id": e.id, **{f: getattr(e, f) for f in ENTITY_FIELDS}, "members": e.members or []}


def _overview():
    from apps.accounts.models import Role, UserGroup
    from apps.backups.models import Backup

    from apps.core import presets

    cfg = demo.get()
    nxt = demo.next_slot(cfg)
    current = demo.current_installation()
    installs = [{"key": p["key"], "name": p["name"], "desc": p["desc"], "current": p["key"] == current, **demo.install_config(cfg, p["key"])} for p in presets.PRESETS]
    return {"installs": installs, "installation": current, "enabled": cfg.enabled, "backup": cfg.backup_id, "times": cfg.times or [], "warn_minutes": cfg.warn_minutes, "show_on_login": cfg.show_on_login,
            "last_restore_at": cfg.last_restore_at, "last_status": cfg.last_status, "last_error": cfg.last_error, "restoring": demo.restoring(), "problems": demo.problems(cfg),
            "next_restore_at": nxt.isoformat() if nxt and cfg.backup_id else None,
            "backups": [{"id": b.id, "file": b.file, "frequency": b.frequency, "created_at": b.created_at, "size": b.size, "note": b.note} for b in Backup.objects.all()],
            "users": [{**_user(d), "generated": d.generated} for d in DemoUser.objects.all()], "entities": [{**_entity(e), "generated": e.generated} for e in DemoEntity.objects.all()], "kinds": ["bedrijf", "vereniging", "club", "vrij"], "roles": list(Role.objects.values_list("name", flat=True)), "groups": list(UserGroup.objects.values_list("name", flat=True))}


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def settings(request):
    if not _is_super(request):
        return _bad("Alleen een superadmin kan de demo mode instellen.", status.HTTP_403_FORBIDDEN)
    if request.method == "PUT":
        from apps.backups.models import Backup

        cfg, d = demo.get(), request.data
        installs_changed = False
        if "times" in d:
            try:
                cfg.times = demo.clean_times(d["times"])
            except ValueError as e:
                return _bad(str(e))
        if "backup" in d:
            if d["backup"] in (None, "", 0):
                cfg.backup = None
            else:
                b = Backup.objects.filter(pk=d["backup"]).first()
                if not b:
                    return _bad("Deze backup bestaat niet.")
                cfg.backup = b
        if "installs" in d:
            cfg.installs = demo.clean_installs(cfg, d["installs"])
            installs_changed = True
        if "warn_minutes" in d:
            try:
                cfg.warn_minutes = min(max(int(d["warn_minutes"]), 0), 120)
            except (TypeError, ValueError):
                return _bad("Vul een geheel aantal minuten in.")
        if "show_on_login" in d:
            cfg.show_on_login = bool(d["show_on_login"])
        if "enabled" in d:
            want = bool(d["enabled"])
            if want and not cfg.enabled:
                cfg.save()  # (what was sent with it is kept)
                issues = demo.problems(cfg)
                if issues:  # only when everything is right
                    return Response({"detail": "De demo mode kan nog niet aan: " + " ".join(issues), "problems": issues}, status=status.HTTP_400_BAD_REQUEST)
            cfg.enabled = want
            if cfg.enabled and not cfg.last_restore_at:
                from django.utils import timezone

                cfg.last_restore_at = timezone.now()  # the first restore is at the next planned time (use "Nu terugzetten" for one now)
        cfg.save()
        if cfg.enabled and (installs_changed or ("enabled" in d and bool(d["enabled"]))):  # the demo users and companies are made when the demo mode goes on and when their settings change
            demo.generate()
            demo.sync_users()
            demo.sync_entities()
        logger.info("Demo mode settings changed by %s", request.user.email)
    return Response(_overview())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def make_backup(request):
    """A backup of the website as it is now, linked to the demo."""
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    from apps.backups import service

    try:
        b = service.create("manual", request.user, "Demo")
    except Exception as e:  # noqa: BLE001
        logger.exception("demo backup failed")
        return _bad(f"De backup is mislukt: {e}")
    DemoSettings.objects.filter(pk=1).update(backup=b)
    return Response(_overview())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def restore_now(request):
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    cfg = demo.get()
    if not cfg.backup_id:
        return _bad("Koppel eerst een backup aan de demo.")
    if demo.restoring():
        return _bad("Er wordt al teruggezet.")

    def run():
        from django.db import connection

        try:
            demo.restore_now(request.user)
        except Exception:  # noqa: BLE001
            pass
        finally:
            connection.close()

    if request.data.get("wait"):  # (tests and scripts: wait for the end)
        try:
            demo.restore_now(request.user)
        except Exception as e:  # noqa: BLE001
            return _bad(f"Terugzetten mislukt: {e}")
        return Response(_overview())
    demo._set_flag(True)  # the message is there before this answer is
    threading.Thread(target=run, daemon=True).start()
    return Response({**_overview(), "restoring": True})


def _fill(d, data, existing=None):
    """Check and set the fields of a demo user. Returns an error text or ''."""
    from apps.accounts.models import Role, User, UserGroup

    email = str(data.get("email", d.email) or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return "Vul een geldig e-mailadres in."
    clash = DemoUser.objects.filter(email__iexact=email).exclude(pk=d.pk)
    if clash.exists():
        return "Dit e-mailadres is al een demo gebruiker."
    real = User.objects.filter(email__iexact=email).first()
    if real and (real.is_staff or real.is_superuser):
        return "Dit is een superadmin: die kan geen demo gebruiker zijn."
    pw = str(data.get("password", d.password) or "")
    if len(pw) < 6 or len(pw) > 64:
        return "Het wachtwoord heeft 6 tot 64 tekens."
    d.email, d.password = email, pw
    for f in ("first_name", "last_name"):
        setattr(d, f, str(data.get(f, getattr(d, f)) or "").strip()[:60])
    d.note = str(data.get("note", d.note) or "").strip()[:120]
    if "roles" in data:
        d.roles = [r for r in (data["roles"] if isinstance(data["roles"], list) else []) if Role.objects.filter(name=r).exists()][:30]
    if "groups" in data:
        d.groups = [g for g in (data["groups"] if isinstance(data["groups"], list) else []) if UserGroup.objects.filter(name=g).exists()][:30]
    return ""


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def users(request):
    """A new demo user, or (with user_id) an existing user linked as demo user."""
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    from apps.accounts.models import User

    data = dict(request.data)
    d = DemoUser(order=DemoUser.objects.count())
    if data.get("user_id"):
        u = User.objects.filter(pk=data["user_id"]).first()
        if not u or u.is_staff or u.is_superuser:
            return _bad("Deze gebruiker kan niet gekoppeld worden.")
        data.setdefault("email", u.email)
        data.setdefault("first_name", u.first_name)
        data.setdefault("last_name", u.last_name)
        data.setdefault("roles", list(u.roles.values_list("name", flat=True)))
        data.setdefault("groups", list(u.user_groups.values_list("name", flat=True)))
    err = _fill(d, data)
    if err:
        return _bad(err)
    d.save()
    demo.sync_users()
    return Response(_overview(), status=status.HTTP_201_CREATED)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def user(request, pk):
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    d = DemoUser.objects.filter(pk=pk).first()
    if not d:
        return _bad("Onbekende demo gebruiker.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        d.delete()  # the account itself stays until the next restore
        return Response(_overview())
    err = _fill(d, request.data)
    if err:
        return _bad(err)
    d.save()
    demo.sync_users()
    return Response(_overview())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def candidates(request):
    """Existing (non-super) users to link as demo user: ?q=text."""
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    from django.db.models import Q

    from apps.accounts.models import User

    q = str(request.query_params.get("q", "")).strip()
    rows = User.objects.filter(is_staff=False, is_superuser=False)
    if q:
        rows = rows.filter(Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
    return Response([{"id": u.id, "email": u.email, "name": f"{u.first_name} {u.last_name}".strip()} for u in rows.order_by("email")[:15]])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def seed(request):
    """Make the demo users and companies of the installation that is on now (again), from the settings of that installation."""
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    demo.generate()
    demo.sync_users()
    demo.sync_entities()
    return Response(_overview())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def installation(request):
    """Choose another standard installation (one that is allowed in the demo): a superadmin, or a demo account while the demo mode is on."""
    if not (_is_super(request) or (demo.enabled() and demo.may_switch(request.user))):
        return _bad("Dit mag alleen in de demo.", status.HTTP_403_FORBIDDEN)
    try:
        demo.switch_installation(str(request.data.get("key") or ""), request.user)
    except (ValueError, KeyError) as e:
        return _bad(str(e) or "Onbekende installatie.")
    return Response(_overview() if _is_super(request) else {"ok": True, "installation": demo.current_installation()})


def _fill_entity(e, data):
    name = str(data.get("name", e.name) or "").strip()[:120]
    if not name:
        return "Vul een naam in."
    if DemoEntity.objects.filter(name=name).exclude(pk=e.pk).exists():
        return "Deze naam bestaat al."
    e.name = name
    for f in ENTITY_FIELDS[2:]:
        setattr(e, f, str(data.get(f, getattr(e, f)) or "").strip()[:200])
    kind = str(data.get("kind", e.kind) or "bedrijf")
    e.kind = kind if kind in ("bedrijf", "vereniging", "club", "vrij") else "bedrijf"
    if "members" in data:
        have = {m.lower() for m in DemoUser.objects.values_list("email", flat=True)}
        e.members = [m.lower() for m in (data["members"] if isinstance(data["members"], list) else []) if str(m).lower() in have]
    return ""


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def entities(request):
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    e = DemoEntity(order=DemoEntity.objects.count())
    err = _fill_entity(e, request.data)
    if err:
        return _bad(err)
    e.save()
    demo.sync_entities()
    return Response(_overview(), status=status.HTTP_201_CREATED)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def entity(request, pk):
    if not _is_super(request):
        return _bad("Alleen een superadmin.", status.HTTP_403_FORBIDDEN)
    e = DemoEntity.objects.filter(pk=pk).first()
    if not e:
        return _bad("Onbekend bedrijf.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        e.delete()
        return Response(_overview())
    err = _fill_entity(e, request.data)
    if err:
        return _bad(err)
    e.save()
    demo.sync_entities()
    return Response(_overview())
