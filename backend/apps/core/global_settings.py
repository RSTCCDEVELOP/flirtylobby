# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Default and global settings: the data of the default easy2edit server (the base domain of the websites, the API of easy2edit, the website of easy2edit).

Only superadmins change them (Super admin -> Default and global settings). They go with every installation: "Instellingen als standaard" (site_defaults.py)
saves them with the other defaults, and a new installation, a reset or "Standaard toepassen" puts them back. Without saved values the standard below is used.
They are kept apart from the basic data of the site (Systeem -> Basisgegevens), which the administrators of a site can change."""
import re

from .models import SystemSettings

KEY = "global"  # where it is kept inside SystemSettings.data (the basic data of the site does not read this key)
DEFAULTS = {
    "base_domain": "easy2edit.com",  # the websites of easy2edit are <name>.<base domain>
    "api_url": "https://api.easy2edit.com",  # the API of the default easy2edit server
    "site_url": "https://easy2edit.com",  # the website of easy2edit (information, credit link)
    "grace_1": "14",  # a licence that is not active (ended): days of phase 1 (full control, a notice only), then phase 2 (no page editor), phase 3 (no administration, only updating the licence), phase 4 (website offline)
    "grace_2": "14",
    "grace_3": "14",
    "grace_4": "30",
    "grace_reminder": "1",
    "notify_rstcc": "",  # who gets an e-mail when a licence changes (one or more addresses, separated by a comma): RST CC, the reseller, invoicing and support
    "notify_reseller": "",  # empty: the reseller e-mail of the licence itself
    "notify_invoicing": "",
    "notify_support": "",  # a daily e-mail to the administrator while the licence has ended
    "source_mode": "local",  # where the library (the folder resource/: plugins, themes, languages, components) comes from: "local" = the folder of this installation, "easy2edit" = the easy2edit server (api address above)
}
SOURCE_MODES = ("local", "easy2edit")
GRACE = ("grace_1", "grace_2", "grace_3", "grace_4")
NOTIFY = ("notify_rstcc", "notify_reseller", "notify_invoicing", "notify_support")
EMAIL_RE = re.compile(r"^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$")
LABELS = {"notify_rstcc": "RST CC", "notify_reseller": "Reseller", "notify_invoicing": "Invoicing", "notify_support": "Support", "grace_1": "Fase 1 (dagen)", "grace_2": "Fase 2 (dagen)", "grace_3": "Fase 3 (dagen)", "grace_4": "Fase 4 (dagen)", "grace_reminder": "Dagelijkse herinnering", "base_domain": "Basisdomein", "api_url": "API van easy2edit", "site_url": "Website van easy2edit", "source_mode": "Bron"}
HOST_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$")
URL_RE = re.compile(r"^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{2,5})?$")


def get():
    stored = (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(KEY) or {}
    return {k: (str(stored.get(k)).strip() if isinstance(stored, dict) and str(stored.get(k) or "").strip() else v) for k, v in DEFAULTS.items()}


def clean(incoming):
    """-> (values, errors). The base domain is typed as easy2edit.com or .easy2edit.com; the addresses as https://host (api.easy2edit.com is completed)."""
    out, errors = {}, {}
    for k in DEFAULTS:
        if k not in incoming:
            continue
        v = str(incoming[k] or "").strip().lower()
        if k in GRACE:
            try:
                n = int(float(v or 0))
            except ValueError:
                n = -1
            if not 0 <= n <= 365:
                errors[k] = "Geef een aantal dagen tussen 0 en 365."
            v = str(max(0, min(365, n)))
        elif k in NOTIFY:
            items = [x.strip().lower() for x in re.split(r"[,;\s]+", str(incoming[k] or "")) if x.strip()]
            bad = [x for x in items if not EMAIL_RE.match(x)]
            if bad:
                errors[k] = f"{LABELS[k]}: {bad[0]} is geen geldig e-mailadres."
            if len(items) > 5:
                errors[k] = f"{LABELS[k]}: maximaal 5 e-mailadressen."
            v = ", ".join(dict.fromkeys(items))
        elif k == "grace_reminder":
            v = "1" if str(incoming[k]).strip().lower() in ("1", "true", "on", "yes") else "0"
        elif k == "source_mode":
            if v not in SOURCE_MODES:
                errors[k] = "Kies lokaal of de easy2edit-server als bron."
        elif k == "base_domain":
            v = v.lstrip(".").removeprefix("*.")
            if not HOST_RE.match(v):
                errors[k] = "Gebruik een domein als easy2edit.com (zonder https:// en zonder pad)."
        else:
            if v and "://" not in v:
                v = "https://" + v
            v = v.rstrip("/")
            if not URL_RE.match(v):
                errors[k] = "Gebruik een adres als https://api.easy2edit.com (zonder pad of slash erachter)."
        out[k] = v
    return out, errors


def save(values):
    """Keep the (cleaned) values; an empty or missing one falls back to the standard."""
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    data = dict(obj.data or {})
    data[KEY] = {k: v for k, v in {**(data.get(KEY) or {}), **values}.items() if k in DEFAULTS and v}
    obj.data = data
    obj.save()
    try:
        from . import system

        system.grace_changed()
    except Exception:  # noqa: BLE001
        pass
    return get()
