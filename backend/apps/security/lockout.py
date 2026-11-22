# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A person is blocked (too many wrong passwords or wrong verification codes): the administrator always gets an e-mail (there is no switch for this)."""
import logging

from apps.core import system

logger = logging.getLogger(__name__)


def recipients():
    """The administrator of the website: the admin address of the basic data, else the contact address, else the (first five) active superadmins."""
    s = system.get()
    for k in ("admin_email", "contact_email"):
        if str(s.get(k) or "").strip():
            return [s[k].strip()]
    from django.contrib.auth import get_user_model

    return list(get_user_model().objects.filter(is_staff=True, is_active=True).exclude(email="").values_list("email", flat=True))[:5]


def notify(email, ip="", reason="password", minutes=None):
    """Mail the administrator that `email` was blocked. reason: "password" | "code". Never raises (a mail that cannot be sent must not change the login). -> number of mails sent."""
    site = system.site_name() or "de website"
    why = "te veel foute wachtwoorden" if reason == "password" else "te veel foute verificatiecodes"
    lines = [f"Op {site} is een account geblokkeerd.", "", f"Account: {email}", f"Reden: {why}"]
    if ip:
        lines.append(f"IP-adres: {ip}")
    if minutes:
        lines.append(f"Geblokkeerd voor: {minutes} minuten")
    lines += ["", "Was dit niet de eigenaar van het account, dan kan het een aanval zijn. Controleer Beheer, Beveiliging."]
    sent = 0
    try:
        from apps.communication import sending

        for to in recipients():
            try:
                sending.send_email(to, f"Account geblokkeerd: {email}", "\n".join(lines), purpose="security")
                sent += 1
            except Exception:  # noqa: BLE001
                logger.exception("Lockout mail to %s failed", to)
    except Exception:  # noqa: BLE001
        logger.exception("Lockout mail could not be made")
    return sent
