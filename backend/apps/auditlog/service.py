# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The log (Logboek): a standard module on every installation. Logins, logouts and the important things that happen (users, installations, resets, modules, backups ...) are written down:
who, what, when, from where.

Rank (level) of a person: 0 user, 1 admin, 2 superadmin, 3 superadmin+. A line gets the rank of the person who did it and is only SHOWN to people of that rank or higher: an admin never reads
the lines of a superadmin. Only a superadmin may remove lines. Lines older than the retention that is set (days; 0 = unlimited) are removed by themselves.

Use `service.log("event.name", user, detail="...", target="...", request=request)` anywhere something important happens. It never raises."""
import logging

from django.core.cache import cache
from django.utils import timezone

from .models import LogEntry

logger = logging.getLogger(__name__)

# event -> (label, category). A new event can be written without being listed here; it then shows its own name.
EVENTS = {
    "auth.login": ("Ingelogd", "Inloggen"), "auth.logout": ("Uitgelogd", "Inloggen"), "auth.login_failed": ("Inloggen mislukt", "Inloggen"),
    "auth.password_changed": ("Wachtwoord gewijzigd", "Inloggen"), "auth.password_reset": ("Wachtwoord opnieuw ingesteld", "Inloggen"),
    "user.created": ("Gebruiker aangemaakt", "Gebruikers"), "user.deleted": ("Gebruiker verwijderd", "Gebruikers"), "user.changed": ("Gebruiker gewijzigd", "Gebruikers"),
    "installation.applied": ("Installatie ingesteld", "Systeem"), "installation.removed": ("Installatie verwijderd", "Systeem"),
    "system.reset": ("Website gereset", "Systeem"), "system.log_cleared": ("Logboek geleegd", "Systeem"), "system.log_settings": ("Logboek-instelling gewijzigd", "Systeem"),
    "module.changed": ("Module aan of uit gezet", "Systeem"), "backup.created": ("Backup gemaakt", "Systeem"), "backup.restored": ("Backup teruggezet", "Systeem"),
    "reseller.onboarding": ("Onboarding als reseller", "Inloggen"),
    "system.error": ("Storing", "Storingen"),  # errors of the server (see handler.py): for superadmins
}
CATEGORIES = ["Inloggen", "Gebruikers", "Systeem", "Storingen", "Overig"]
RANKS = {0: "Gebruiker", 1: "Admin", 2: "Superadmin", 3: "Superadmin+"}
RETENTION_CHOICES = [30, 90, 180, 365, 730, 0]  # days; 0 = unlimited
DEFAULT_RETENTION = 365
SETTINGS_KEY = "log_settings"


def rank_of(user):
    """0 user, 1 admin, 2 superadmin, 3 superadmin+ (anonymous = 0)."""
    if not user or not getattr(user, "is_authenticated", False):
        return 0
    if user.is_staff:
        return 3 if getattr(user, "is_superadmin_plus", False) else 2
    try:
        from apps.accounts.access import can_admin

        if user.all_roles().filter(slug="admin").exists() or can_admin(user):
            return 1
    except Exception:  # noqa: BLE001
        pass
    return 0


def log(event, actor=None, detail="", target="", request=None, level=None, ip="", actor_email="", actor_name=""):
    """Write one line. `level` = the rank of the person (found from `actor` when not given). Never raises: the log must not stop what it logs."""
    try:
        if request is not None and not ip:
            from apps.accounts.views import client_ip

            ip = client_ip(request)
        if actor is not None and not getattr(actor, "is_authenticated", True):
            actor = None
        label, cat = EVENTS.get(event, (event, "Overig"))
        LogEntry.objects.create(
            event=event[:60], category=cat, level=rank_of(actor) if level is None else int(level), actor=actor if getattr(actor, "pk", None) else None,
            actor_email=(actor_email or getattr(actor, "email", "") or "")[:254], actor_name=(actor_name or getattr(actor, "display_name", "") or (getattr(actor, "get_full_name", lambda: "")() if actor else ""))[:150],
            ip=str(ip or "")[:45], target=str(target or "")[:200], detail=str(detail or "")[:500])
        _purge_now_and_then()
    except Exception:  # noqa: BLE001
        logger.exception("Log line could not be written: %s", event)


def on_login(sender, request=None, user=None, **kw):
    log("auth.login", user, request=request)


def visible_to(user):
    """The lines this person may read: the ones of their own rank and lower."""
    return LogEntry.objects.filter(level__lte=rank_of(user))


# ── settings: how long the lines are kept ──
def _data():
    from apps.core.models import SystemSettings

    return (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(SETTINGS_KEY) or {}


def settings():
    d = _data()
    days = d.get("retention_days", DEFAULT_RETENTION)
    return {"retention_days": days if days in RETENTION_CHOICES else DEFAULT_RETENTION}


def save_settings(retention_days):
    from apps.core.models import SystemSettings

    days = int(retention_days)
    if days not in RETENTION_CHOICES:
        raise ValueError("Ongeldige bewaartermijn.")
    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**(row.data or {}), SETTINGS_KEY: {"retention_days": days}}
    row.save()
    purge()
    return settings()


def purge():
    """Remove the lines that are older than the retention (nothing when it is unlimited). Returns how many."""
    days = settings()["retention_days"]
    if not days:
        return 0
    n, _ = LogEntry.objects.filter(created_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()
    return n


def _purge_now_and_then():
    if cache.add("auditlog:purge", 1, 3600):  # at most once an hour, as a side effect of writing
        purge()


def clear(user=None):
    """Remove all lines (superadmin only: the caller checks). One line says that it was done. Returns how many were removed."""
    n, _ = LogEntry.objects.all().delete()
    log("system.log_cleared", user, detail=f"{n} regels verwijderd")
    return n
