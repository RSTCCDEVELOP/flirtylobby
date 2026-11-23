# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Demo mode: a website that people can try out. At planned times (several per day) a linked backup is put back, so everything a visitor did is gone again;
while that happens the visitors see a message. Demo users (with their rights and a readable password) are made again after every restore and are shown on the login page.
No e-mail or sms is sent in demo mode (the sandbox simulates them) and every verification code is filled in on the screen."""
import json
import logging
import re
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from .models import DemoEntity, DemoSettings, DemoUser

logger = logging.getLogger(__name__)
TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_TIMES = 24
STALE = timedelta(minutes=45)


def get():
    return DemoSettings.objects.get_or_create(pk=1)[0]


def enabled():
    try:
        return bool(DemoSettings.objects.filter(pk=1).values_list("enabled", flat=True).first())
    except Exception:  # noqa: BLE001 - e.g. while the database is being put back
        return False


def clean_times(raw):
    out = []
    for t in raw if isinstance(raw, list) else re.split(r"[\s,;]+", str(raw or "")):
        t = str(t).strip()
        if len(t) == 4 and t[1] == ":":
            t = "0" + t
        if t:
            if not TIME.match(t):
                raise ValueError(f"Geen geldige tijd: {t} (gebruik uu:mm, bijvoorbeeld 03:00).")
            out.append(t)
    return sorted(set(out))[:MAX_TIMES]


# ── the restoring flag: a file, because the database is being replaced while it is on ──
def _flag():
    from apps.backups import service

    return service.backups_dir() / "demo-restoring.json"


def restoring():
    p = _flag()
    try:
        if not p.is_file():
            return False
        if timezone.now() - datetime.fromisoformat(json.loads(p.read_text())["started"]) > STALE:
            p.unlink(missing_ok=True)  # a restore that never finished must not block the site for ever
            return False
        return True
    except Exception:  # noqa: BLE001
        return False


def _set_flag(on):
    p = _flag()
    if on:
        p.write_text(json.dumps({"started": timezone.now().isoformat()}))
    else:
        p.unlink(missing_ok=True)


def problems(cfg=None):
    """What is still wrong before the demo mode may be switched on (empty = everything is right)."""
    cfg = cfg or get()
    out = []
    if not cfg.backup_id:
        out.append("Koppel een backup aan de demo.")
    else:
        try:
            from apps.backups import service

            if not (service.backups_dir() / cfg.backup.file).is_file():
                out.append("Het bestand van de gekoppelde backup bestaat niet meer.")
        except Exception:  # noqa: BLE001
            out.append("De gekoppelde backup kan niet gelezen worden.")
    if not cfg.times:
        out.append("Vul minstens één tijd in waarop de demo wordt teruggezet.")
    if not DemoUser.objects.exists():
        out.append("Maak minstens één demo gebruiker aan.")
    return out


def may_switch(user):
    """In demo mode the demo accounts (never a superadmin) may switch every module and plugin on and off, to try them out (the licence steps still have to be gone through)."""
    if not user or not getattr(user, "is_authenticated", False) or user.is_staff or user.is_superuser or not enabled():
        return False
    return DemoUser.objects.filter(email__iexact=user.email).exists()


# ── the planned moments ──
def _slots(cfg, now):
    local = timezone.localtime(now)
    out = []
    for day in (-1, 0, 1):
        for t in cfg.times or []:
            h, m = int(t[:2]), int(t[3:])
            out.append((local + timedelta(days=day)).replace(hour=h, minute=m, second=0, microsecond=0))
    return sorted(out)


def last_slot(cfg, now=None):
    now = now or timezone.now()
    past = [s for s in _slots(cfg, now) if s <= timezone.localtime(now)]
    return past[-1] if past else None


def next_slot(cfg, now=None):
    now = now or timezone.now()
    nxt = [s for s in _slots(cfg, now) if s > timezone.localtime(now)]
    return nxt[0] if nxt else None


def is_due(cfg, now=None):
    now = now or timezone.now()
    if not cfg.enabled or not cfg.backup_id or not cfg.times:
        return False
    slot = last_slot(cfg, now)
    return bool(slot and (cfg.last_restore_at is None or cfg.last_restore_at < slot))


# ── the demo users ──
def sync_users():
    """Make the demo users again (after a restore the real users are those of the backup): same e-mail, password and rights. Never a superadmin: an existing staff account is left alone."""
    from apps.accounts.models import Role, User, UserGroup

    n = 0
    for d in DemoUser.objects.all():
        u = User.objects.filter(email__iexact=d.email).first()
        if u and (u.is_staff or u.is_superuser):
            logger.warning("Demo user %s is a superadmin: left alone", d.email)
            continue
        if not u:
            base, name, i = d.email.split("@")[0][:30] or "demo", "", 0
            name = base
            while User.objects.filter(username=name).exists():
                i += 1
                name = f"{base}{i}"
            u = User(username=name, email=d.email.lower())
        u.first_name, u.last_name, u.is_active, u.email_verified = d.first_name, d.last_name, True, True
        u.is_staff, u.is_superuser, u.is_superadmin_plus = False, False, False  # a demo user is never a superadmin or higher
        u.otp_active, u.twofa_required = False, False
        u.set_password(d.password)
        u.save()
        roles = Role.objects.filter(name__in=d.roles or [])
        if "Admin" in (d.roles or []) and not roles.filter(name="Admin").exists():  # the admin role of the system (all rights, but no superadmin)
            roles = list(Role.objects.filter(all_permissions=True)[:1]) or roles
        u.roles.set(roles)
        u.user_groups.set(UserGroup.objects.filter(name__in=d.groups or []))
        n += 1
    return n


DEFAULT_USERS = [
    {"email": "demo.gebruiker@example.com", "first_name": "Demi", "last_name": "Gebruiker", "password": "demo-gebruiker", "note": "Gebruiker", "roles": [], "groups": []},
    {"email": "demo.admin@example.com", "first_name": "Adam", "last_name": "Admin", "password": "demo-admin", "note": "Beheerder (admin)", "roles": ["Admin"], "groups": []},
]
DEFAULT_ENTITIES = [
    {"name": "Demo Bedrijf B.V.", "kind": "bedrijf", "legal_name": "Demo Bedrijf B.V.", "email": "info@demo-bedrijf.example", "phone": "+31 20 123 4567", "website": "https://demo-bedrijf.example", "street": "Voorbeeldstraat",
     "house_number": "1", "postal_code": "1011 AA", "city": "Amsterdam", "country": "Nederland", "members": ["demo.gebruiker@example.com", "demo.admin@example.com"]},
    {"name": "Demo Vereniging", "kind": "vereniging", "legal_name": "Vereniging Demo", "email": "info@demo-vereniging.example", "phone": "+31 30 765 4321", "website": "", "street": "Clublaan",
     "house_number": "12", "postal_code": "3511 AB", "city": "Utrecht", "country": "Nederland", "members": ["demo.admin@example.com"]},
]


def seed_defaults():
    """The standard demo data: ONE user and ONE admin (never a superadmin or higher), two companies and the links between them. Only what is not there yet is made."""
    n = 0
    for i, u in enumerate(DEFAULT_USERS):
        if not DemoUser.objects.filter(email__iexact=u["email"]).exists():
            DemoUser.objects.create(order=i, **u)
            n += 1
    for i, e in enumerate(DEFAULT_ENTITIES):
        if not DemoEntity.objects.filter(name=e["name"]).exists():
            DemoEntity.objects.create(order=i, **e)
            n += 1
    return n


def sync_entities():
    """The demo companies, made again after a restore: the same data, linked to their demo users."""
    from apps.accounts.models import User
    from apps.core.models import Entity

    n = 0
    for d in DemoEntity.objects.all():
        e = Entity.objects.filter(name=d.name, is_own=False).first() or Entity(name=d.name, is_own=False)
        e.kind = d.kind if d.kind in {k for k, _ in Entity.KINDS if k != "organisatie"} else "bedrijf"
        for f in ("legal_name", "email", "phone", "website", "street", "house_number", "postal_code", "city", "country"):
            setattr(e, f, getattr(d, f))
        e.save()
        e.users.set(User.objects.filter(email__in=[m.lower() for m in d.members or []], is_staff=False, is_superuser=False))
        n += 1
    return n


def restore_now(user=None):
    """Put the linked backup back. The visitors see the restore message until it is ready. Returns the settings row."""
    from apps.backups import service
    from apps.backups.models import Backup

    cfg = get()
    b = Backup.objects.filter(pk=cfg.backup_id).first() if cfg.backup_id else None
    if not b:
        raise ValueError("Er is geen backup aan de demo gekoppeld.")
    _set_flag(True)
    try:
        service.restore(b, None, user, safety=False)
        sync_users()
        sync_entities()
        DemoSettings.objects.filter(pk=1).update(last_restore_at=timezone.now(), last_status="ok", last_error="")
    except Exception as e:  # noqa: BLE001
        logger.exception("demo restore failed")
        DemoSettings.objects.filter(pk=1).update(last_restore_at=timezone.now(), last_status="failed", last_error=str(e)[:500])
        raise
    finally:
        _set_flag(False)
    return get()


def run_due():
    """Called every minute by the background controller: only one process restores (the moment is claimed first)."""
    now = timezone.now()
    cfg = get()
    if not is_due(cfg, now):
        return False
    if not DemoSettings.objects.filter(pk=1, last_restore_at=cfg.last_restore_at).update(last_restore_at=now):
        return False  # another process was faster
    try:
        restore_now()
    except Exception:  # noqa: BLE001
        return False
    return True


def public():
    """What every visitor may know: is this a demo, is it being restored, when is the next restore, and (if wanted) the demo users with their password."""
    if not enabled():
        return {"enabled": False}
    if restoring():
        return {"enabled": True, "restoring": True}
    cfg = get()
    nxt = next_slot(cfg)
    users = []
    if cfg.show_on_login:
        users = [{"email": d.email, "password": d.password, "name": f"{d.first_name} {d.last_name}".strip(), "note": d.note} for d in DemoUser.objects.all()]
    left = int((nxt - timezone.localtime(timezone.now())).total_seconds()) if nxt and cfg.backup_id else None
    return {"enabled": True, "restoring": False, "next_restore_at": nxt.isoformat() if nxt and cfg.backup_id else None, "seconds_left": left,
            "warn": bool(left is not None and left <= cfg.warn_minutes * 60), "users": users}
