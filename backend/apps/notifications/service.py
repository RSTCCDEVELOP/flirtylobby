import logging
from datetime import timedelta

from django.utils import timezone

from apps.core import modules

from . import registry
from .models import Notification, NotificationPref, NotificationSettings

logger = logging.getLogger(__name__)


def get_settings():
    row = NotificationSettings.objects.filter(pk=1).first()
    d = (row.data if row else {}) or {}
    out = {**registry.DEFAULTS, **{k: d[k] for k in registry.DEFAULTS if k in d and k != "kinds"}}
    out["kinds"] = {k: {**{"enabled": True, "show": v["show"], "email": v["email"]}, **((d.get("kinds") or {}).get(k) or {})} for k, v in registry.BY_KEY.items()}
    return clean_settings(out)


def clean_settings(d):
    out = dict(registry.DEFAULTS)
    out["layout"] = d.get("layout") if d.get("layout") in registry.LAYOUTS else "bell"
    out["toast_position"] = d.get("toast_position") if d.get("toast_position") in registry.TOAST_POS else "top-right"
    for k in ("toasts", "group", "email", "email_instant"):
        out[k] = bool(d.get(k, registry.DEFAULTS[k]))
    for k, lo, hi in (("toast_seconds", 2, 30), ("bell_max", 3, 30), ("keep_days", 0, 3650)):
        try:
            out[k] = min(max(int(d.get(k, registry.DEFAULTS[k])), lo), hi)
        except (TypeError, ValueError):
            out[k] = registry.DEFAULTS[k]
    kinds = {}
    for k, v in registry.BY_KEY.items():
        c = (d.get("kinds") or {}).get(k) or {}
        kinds[k] = {"enabled": bool(c.get("enabled", True)), "show": bool(c.get("show", v["show"])), "email": bool(c.get("email", v["email"]))}
    out["kinds"] = kinds
    return out


def save_settings(data):
    NotificationSettings.objects.update_or_create(pk=1, defaults={"data": clean_settings(data)})
    return get_settings()


def prefs_of(user):
    """What this user gets per kind: the choice of the user, else the default of the administrator."""
    cfg = get_settings()
    mine = {p.kind: p for p in NotificationPref.objects.filter(user=user)}
    out = {}
    for k, v in registry.BY_KEY.items():
        c = cfg["kinds"][k]
        p = mine.get(k)
        out[k] = {"show": (p.show if p and v["user_can_hide"] else c["show"]) , "email": (p.email if p else c["email"]) and cfg["email"], "enabled": c["enabled"] and modules.enabled(v["module"]) }
    return out


def notify(user, kind, title, body="", url="", level=None, from_user=None, data=None):
    """Send a notification to one user. Never raises: a broken notification must not break what the module is doing. Returns the Notification or None."""
    try:
        if not modules.enabled("notifications") or not user or not getattr(user, "pk", None):
            return None
        meta = registry.BY_KEY.get(kind)
        if not meta:
            return None
        pref = prefs_of(user)[kind]
        if not pref["enabled"]:
            return None
        n = None
        if pref["show"] or meta["level"] == "danger":
            n = Notification.objects.create(user=user, kind=kind, module=meta["module"], title=str(title)[:200], body=str(body or "")[:2000], url=str(url or "")[:300], level=level or meta["level"], from_user=from_user, data=data or {})
        if pref["email"] and get_settings()["email_instant"] and user.email:
            try:
                from apps.communication import sending

                sending.send_email(user.email, str(title)[:200], (str(body) if body else str(title)), purpose="notifications")
                if n:
                    Notification.objects.filter(pk=n.pk).update(emailed=True)
            except Exception:  # noqa: BLE001
                logger.warning("E-mail notification to %s failed", user.email, exc_info=True)
        return n
    except Exception:  # noqa: BLE001
        logger.warning("Notification failed", exc_info=True)
        return None


def broadcast(title, body="", url="", level="info", audience="all", group=None):
    """A message of the administrator to all users (or a user group). Returns how many people got it."""
    from django.contrib.auth import get_user_model

    qs = get_user_model().objects.filter(is_active=True)
    if audience == "staff":
        qs = qs.filter(is_staff=True)
    elif audience == "group" and group:
        qs = qs.filter(user_groups__id=group)
    n = 0
    for u in qs.distinct():
        if notify(u, "system", title, body, url, level):
            n += 1
    return n


def cleanup():
    days = get_settings()["keep_days"]
    if days:
        Notification.objects.filter(read_at__isnull=False, read_at__lt=timezone.now() - timedelta(days=days)).delete()
