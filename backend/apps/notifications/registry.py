# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The kinds of notifications that modules can send. A module adds its kinds here; the administrator sees them in Admin → Notificaties and decides the defaults.
(key, module, label, description, level, default: show, default: e-mail, may the user switch it off)"""

KINDS = [
    ("system", "notifications", "Bericht van de beheerder", "Een bericht van de beheerders van deze website aan alle gebruikers of een groep.", "info", True, False, False),
    ("message", "messages", "Nieuw bericht", "Iemand stuurt je een bericht in je postvak.", "info", True, True, True),
    ("chat", "chat", "Nieuw chatbericht", "Iemand stuurt je een chatbericht terwijl je er niet bent.", "info", True, False, True),
    ("like", "discover", "Nieuwe like", "Iemand vindt je leuk.", "success", True, False, True),
    ("match", "discover", "Nieuwe match", "Jullie vinden elkaar allebei leuk.", "success", True, True, True),
    ("request", "profiles", "Verzoek", "Iemand wil vrienden worden of je foto's zien.", "info", True, True, True),
    ("direct", "directconnect", "Verzoek om te chatten", "Iemand wil via de directe verbinding met je chatten.", "warning", True, False, True),
    ("donation", "donations", "Donatie", "Je donatie is ontvangen, of er is een donatie voor je gedaan.", "success", True, True, True),
    ("subscription", "subscriptions", "Abonnement", "Je abonnement start, wordt verlengd of loopt bijna af.", "info", True, True, True),
    ("order", "orders", "Bestelling", "De status van je bestelling is gewijzigd.", "info", True, True, True),
    ("security", "security_basic", "Beveiliging", "Belangrijke meldingen over de beveiliging van je account.", "danger", True, True, False),
    ("agenda", "plugins", "Agenda", "Uitnodigingen, antwoorden, wijzigingen en herinneringen van je afspraken.", "info", True, True, True),
    ("plugin", "plugins", "Plugin", "Berichten van plugins, zoals de spelletjes en de webshop.", "info", True, False, True),
]
BY_KEY = {k[0]: {"key": k[0], "module": k[1], "label": k[2], "desc": k[3], "level": k[4], "show": k[5], "email": k[6], "user_can_hide": k[7]} for k in KINDS}

# how the notifications look and work (Admin → Notificaties → Instellingen)
LAYOUTS = ("bell", "panel", "toasts", "page")  # bell: a list under the bell · panel: a side panel · toasts: only pop-ups · page: the bell goes to the notifications page
TOAST_POS = ("top-right", "top-center", "bottom-right", "bottom-left")
DEFAULTS = {
    "layout": "bell",
    "toasts": True,  # a new notification also pops up for a moment
    "toast_position": "top-right",
    "toast_seconds": 6,
    "bell_max": 8,  # how many in the bell or panel
    "group": True,  # many of the same kind are shown as one line (3 new messages)
    "keep_days": 90,  # read notifications are cleaned after this many days (0 = never)
    "email": True,  # e-mail on or off for the whole system
    "email_instant": True,
    "kinds": {},  # per kind: {"enabled": bool, "show": bool, "email": bool}
}
