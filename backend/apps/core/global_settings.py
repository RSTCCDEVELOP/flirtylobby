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
    # the standard reseller (who sells easy2edit): goes with every installation, is noted in the licence and is the reseller of a new website on the easy2edit server
    "reseller_company": "Studio2 Communications BV", "reseller_contact": "Ronald Stolk", "reseller_email": "", "reseller_phone": "+31 85 201 77 85", "reseller_mobile": "",
    "reseller_street": "Ambachtsweg", "reseller_house_number": "46", "reseller_postal_code": "3542 DH", "reseller_city": "Utrecht", "reseller_country": "Nederland", "reseller_website": "https://www.studio2.nl",
    # per tab of Standaard en globale instellingen: "1" = do not overwrite on THIS installation: the settings are carried with new installations, but an update (or the website list of the easy2edit server) leaves this tab alone unless it is forced
    "keep_server": "0", "keep_settings": "0", "keep_licence": "0", "keep_mails": "0", "keep_reseller": "0", "keep_twofa": "0",
    "energy_badge": "0",  # the energy label at the bottom of the website ("1" = on): a click shows the insights and the green status (module Energie)
    "energy_badge_show": "rating,co2,size,views",  # what its window shows: rating, co2, size, energy, views, live, compare
    # tree planting (module easy2edit: bomen planten): the standard for every website and new installation; "1" = on. e2e = trees per month that easy2edit plants, cap = the monthly maximum of the automatic settlement
    "trees_auto": "1", "trees_visitors": "1", "trees_machine": "1", "trees_show": "1", "trees_test": "1", "trees_e2e": "1", "trees_cap": "20", "trees_name": "site",
    "source_mode": "local",  # where the library (the folder resource/: plugins, themes, languages, components) comes from: "local" = the folder of this installation, "easy2edit" = the easy2edit server (api address above)
}
SOURCE_MODES = ("local", "easy2edit")
TREES = ("trees_auto", "trees_visitors", "trees_machine", "trees_show", "trees_test", "trees_e2e", "trees_cap", "trees_name")
TREE_FIELDS = {"trees_auto": "auto_on", "trees_visitors": "visitors_on", "trees_machine": "machine_on", "trees_show": "show_on_site", "trees_test": "test_mode"}
LOCAL = ("keep_server", "keep_settings", "keep_licence", "keep_mails", "keep_reseller", "keep_twofa")
GRACE = ("grace_1", "grace_2", "grace_3", "grace_4")
NOTIFY = ("notify_rstcc", "notify_reseller", "notify_invoicing", "notify_support")
RESELLER = ("reseller_company", "reseller_contact", "reseller_email", "reseller_phone", "reseller_mobile", "reseller_street", "reseller_house_number", "reseller_postal_code", "reseller_city", "reseller_country", "reseller_website")
RESELLER_MAX = {"reseller_company": 120, "reseller_contact": 100, "reseller_email": 254, "reseller_phone": 30, "reseller_mobile": 30, "reseller_street": 100, "reseller_house_number": 12, "reseller_postal_code": 12,
                "reseller_city": 100, "reseller_country": 60, "reseller_website": 300}
EMAIL_RE = re.compile(r"^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$")
LABELS = {"notify_rstcc": "RST CC", "notify_reseller": "Reseller", "notify_invoicing": "Invoicing", "notify_support": "Support", "grace_1": "Fase 1 (dagen)", "grace_2": "Fase 2 (dagen)", "grace_3": "Fase 3 (dagen)", "grace_4": "Fase 4 (dagen)", "grace_reminder": "Dagelijkse herinnering", "base_domain": "Basisdomein", "api_url": "API van easy2edit", "site_url": "Website van easy2edit", "source_mode": "Bron"}
HOST_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$")
URL_RE = re.compile(r"^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{2,5})?$")


def get():
    stored = (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(KEY) or {}
    out = {k: (str(stored.get(k)).strip() if isinstance(stored, dict) and str(stored.get(k) or "").strip() else v) for k, v in DEFAULTS.items()}
    out.update(_trees_live())
    out.update(_energy_badge_live())  # the label is kept in the settings of the module Energie: that is what this installation really does
    return out


def _trees_live():
    """The tree planting settings as this installation has them now (the module easy2edit: bomen planten); empty when it has no settings yet."""
    try:
        from apps.ecologi.models import EcologiSettings

        row = EcologiSettings.objects.filter(pk=1).first()
        if not row:
            return {}
        out = {k: "1" if getattr(row, f) else "0" for k, f in TREE_FIELDS.items()}
        out.update({"trees_e2e": str(row.e2e_trees), "trees_cap": str(row.cap_trees_month), "trees_name": "easy2edit" if row.name == "easy2edit" else "site"})
        return out
    except Exception:  # noqa: BLE001
        return {}


def apply_trees(values):
    """Put the tree planting standard on this installation. Never raises."""
    try:
        from apps.ecologi.models import EcologiSettings

        st = EcologiSettings.load()
        for k, f in TREE_FIELDS.items():
            if k in values:
                setattr(st, f, str(values[k]) == "1")
        if "trees_e2e" in values:
            st.e2e_trees = int(values["trees_e2e"])
        if "trees_cap" in values:
            st.cap_trees_month = int(values["trees_cap"])
        if "trees_name" in values:
            st.name = "easy2edit" if values["trees_name"] == "easy2edit" else "site"
        st.save()
    except Exception:  # noqa: BLE001
        pass


def _energy_badge_live():
    """{energy_badge, energy_badge_show} as this installation has them now (empty when the module has no settings yet)."""
    try:
        from apps.energy import service as es
        from apps.energy.models import EnergySettings

        row = EnergySettings.objects.filter(pk=1).first()
        if not row:
            return {}
        return {"energy_badge": "1" if row.badge_on else "0", "energy_badge_show": ",".join(es.badge_items(row))}
    except Exception:  # noqa: BLE001
        return {}


def apply_energy_badge(values):
    """Put the energy label settings on this installation (module Energie). Never raises."""
    try:
        from apps.energy import service as es
        from apps.energy.models import EnergySettings

        st = EnergySettings.load()
        if "energy_badge" in values:
            st.badge_on = str(values["energy_badge"]) == "1"
        if "energy_badge_show" in values:
            st.badge_show = [k for k in str(values["energy_badge_show"]).split(",") if k in es.BADGE_ITEMS]
        st.save()
    except Exception:  # noqa: BLE001
        pass


def clean(incoming):
    """-> (values, errors). The base domain is typed as easy2edit.com or .easy2edit.com; the addresses as https://host (api.easy2edit.com is completed)."""
    out, errors = {}, {}
    for k in DEFAULTS:
        if k not in incoming:
            continue
        if k in RESELLER:  # (typed as it is: names and addresses keep their capitals)
            v = " ".join(str(incoming[k] or "").split())[:RESELLER_MAX[k]]
            if k == "reseller_email" and v and not EMAIL_RE.match(v):
                errors[k] = "Het e-mailadres van de reseller is ongeldig."
            if k == "reseller_website" and v:
                v = v if "://" in v else "https://" + v
                if not re.match(r"^https?://[^\s]{3,290}$", v):
                    errors[k] = "Gebruik een adres als https://www.voorbeeld.nl."
            if k in ("reseller_phone", "reseller_mobile"):
                from . import phone

                v, bad = phone.check(v)
                if bad:
                    errors[k] = bad
            out[k] = v
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
        elif k == "energy_badge":
            v = "1" if str(incoming[k]).strip().lower() in ("1", "true", "on", "yes") else "0"
        elif k == "energy_badge_show":
            from apps.energy.service import BADGE_ITEMS

            raw = incoming[k] if isinstance(incoming[k], list) else str(incoming[k] or "").split(",")
            v = ",".join(dict.fromkeys(x.strip() for x in raw if x.strip() in BADGE_ITEMS))
        elif k in TREE_FIELDS:
            v = "1" if str(incoming[k]).strip().lower() in ("1", "true", "on", "yes") else "0"
        elif k in ("trees_e2e", "trees_cap"):
            try:
                n = int(float(str(incoming[k] or "0").strip()))
            except ValueError:
                n = 0
                errors[k] = "Geef een aantal."
            v = str(max(0, min(1000 if k == "trees_e2e" else 250000, n)))
        elif k == "trees_name":
            v = "easy2edit" if str(incoming[k]).strip().lower() == "easy2edit" else "site"
        elif k in LOCAL:
            v = "1" if str(incoming[k]).strip().lower() in ("1", "true", "on", "yes") else "0"
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
    if "energy_badge" in values or "energy_badge_show" in values:
        apply_energy_badge(values)
    if any(k in values for k in TREES):
        apply_trees(values)
    try:
        from . import system

        system.grace_changed()
    except Exception:  # noqa: BLE001
        pass
    return get()


def reseller():
    """The standard reseller: {company, contact, email, phone, mobile, street, house_number, postal_code, city, country, website, address (one line)}."""
    g = get()
    r = {k[len("reseller_"):]: g[k] for k in RESELLER}
    r["address"] = ", ".join(x for x in (f"{r['street']} {r['house_number']}".strip(), f"{r['postal_code']} {r['city']}".strip(), r["country"]) if x)
    return r


def apply_reseller_to_licence(force=False):
    """The licence of this installation notes the standard reseller when it has none yet (force: always). Never raises. -> True when it was filled."""
    try:
        from .models import License

        r = reseller()
        if not r["company"] and not r["contact"]:
            return False
        lic, _ = License.objects.get_or_create(pk=1)
        if lic.reseller_name and not force:
            return False
        lic.reseller_name = (r["company"] or r["contact"])[:120]
        lic.reseller_email = r["email"] or lic.reseller_email
        lic.reseller_url = r["website"][:300]
        lic.save(update_fields=["reseller_name", "reseller_email", "reseller_url"])
        return True
    except Exception:  # noqa: BLE001
        return False
