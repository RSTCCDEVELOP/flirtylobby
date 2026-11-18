# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A licence that has ended: one e-mail a day to the administrator (the admin e-mail of the basic data, else the contact e-mail, else the superadmins) that the licence has to be
updated, with what happens now and next (the phases are set in Default and global settings). Switched off with the setting "Dagelijkse herinnering"."""
import logging
from datetime import date, datetime

from django.utils import timezone

from . import global_settings, system
from .models import SystemSettings

logger = logging.getLogger(__name__)
KEY = "licence_reminder"

NOW = {1: "Je hebt nog volledige toegang.", 2: "De pagina-editor is gesloten.", 3: "De administratie is gesloten: alleen de licentie kan nog worden bijgewerkt.", 4: "De website staat offline."}
NEXT = {1: "de pagina-editor wordt gesloten", 2: "de administratie wordt gesloten (alleen de licentie kan nog worden bijgewerkt)", 3: "de website gaat offline"}


def recipients():
    s = system.get()
    for k in ("admin_email", "contact_email"):
        if str(s.get(k) or "").strip():
            return [s[k].strip()]
    from django.contrib.auth import get_user_model

    return list(get_user_model().objects.filter(is_staff=True, is_active=True).exclude(email="").values_list("email", flat=True))[:5]


def text(ph):
    s = system.get()
    site = system.site_name() or s.get("company_name") or "de website"
    when = datetime.strptime(ph["valid_until"], "%Y-%m-%d").strftime("%d-%m-%Y")
    base = (s.get("frontend_url") or "").rstrip("/")
    lines = [f"De licentie van {site} is verlopen op {when} ({ph['days_over']} dagen geleden).", "", f"Nu: {NOW[ph['phase']]}"]
    if ph["phase"] in NEXT and ph["days_left"] is not None:
        lines.append(f"Over {ph['days_left']} dagen: {NEXT[ph['phase']]}.")
    lines += ["", "Werk de licentie zo snel mogelijk bij" + (f": {base}/dashboard/license" if base else " (Beheer, Licentie)."), "", "Je krijgt deze herinnering elke dag zolang de licentie niet is bijgewerkt."]
    return f"Licentie verlopen: {site}", "\n".join(lines)


def run():
    """One round: sends the reminder when the licence has ended and it was not sent today. Returns True when a mail was sent."""
    ph = system.license_phase()
    if not ph["phase"] or global_settings.get().get("grace_reminder") != "1":
        return False
    today = timezone.localdate().isoformat()
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    if (obj.data or {}).get(KEY) == today:
        return False
    to = recipients()
    if not to:
        return False
    from apps.communication import sending

    subject, body = text(ph)
    sent = 0
    for addr in to:
        try:
            sending.send_email(addr, subject, body, purpose="security")
            sent += 1
        except Exception:  # noqa: BLE001
            logger.exception("licence reminder to %s", addr)
    if sent:  # tried again tomorrow when nothing could be sent today? No: tried again at the next round (an hour), until it works
        data = dict(obj.data or {})
        data[KEY] = today
        obj.data = data
        obj.save(update_fields=["data"])
    return bool(sent)
