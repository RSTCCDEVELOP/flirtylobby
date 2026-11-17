# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The price of the licence. Every price is PER MONTH (incl. VAT): the base price, plus the price of every module, plugin and game that is in use, plus the backups
(the limits of the backup module added up, above the number that is in the base price). The superadmin chooses how long a payment lasts (month, quarter or year);
what a renewal costs is the monthly price times those months. Set by the superadmin; refreshed whenever it is looked at."""
from decimal import Decimal

from . import modules
from .models import ComponentPrice, License

TWO = Decimal("0.01")


def config_base():
    """The base price per month incl. VAT, from apps/core/pricing.json (the price list that goes to every site)."""
    from . import pricing

    cfg = pricing.load()
    return (Decimal(str(cfg["base_price"])) * (100 + Decimal(str(cfg["vat_rate"]))) / 100).quantize(TWO)


def _prices():
    """Price per component incl. VAT: everything comes from pricing.json (the DB rows are only a fallback for what the file does not know)."""
    from . import pricing

    out = {(p.kind, p.key): p.price for p in ComponentPrice.objects.all()}
    cfg = pricing.load()
    vat = (100 + Decimal(str(cfg["vat_rate"]))) / 100
    for k, v in cfg["items"].items():
        kind, _, key = k.partition(":")
        out[(kind, key)] = (Decimal(str(v)) * vat).quantize(TWO)
    return out


def catalog():
    """Every module, plugin and game with its price and whether it is in use now: [{kind, key, label, group, price, active}]."""
    from apps.plugins import installer
    from apps.plugins.models import Plugin

    pr, on, out = _prices(), modules.states(), []
    in_pkg = {k for p in modules.PACKAGES for k in p["modules"]}
    for m in modules.MODULES:
        if m.get("plugin") and m["key"] not in in_pkg:  # (a part that is a plugin is priced as that plugin)
            continue
        out.append({"kind": "module", "key": m["key"], "label": m["label"], "group": m["group"], "price": pr.get(("module", m["key"]), Decimal(0)), "active": bool(on.get(m["key"], True))})
    for pk in modules.PACKAGES:  # the add-on packages: a package is in use while one of its modules is on
        out.append({"kind": "package", "key": pk["key"], "label": "Pakket: " + pk["label"], "group": "Pakketten", "price": pr.get(("package", pk["key"]), Decimal(0)),
                    "active": any(bool(on.get(k, True)) for k in pk["modules"])})
    lic = License.objects.filter(pk=1).first()
    out.append({"kind": "backup", "key": "slots", "label": f"Backups bewaren ({backup_slots()} in totaal, {lic.backup_included if lic else 0} inbegrepen)", "group": "Systeem", "price": backup_cost(lic),
                "active": bool(on.get("backups", True)), "computed": True})
    host = hosting_line(lic)
    if host:
        out.append(host)
    for p in Plugin.objects.order_by("name"):
        out.append({"kind": "plugin", "key": p.name, "label": p.title or p.name, "group": "Plugins", "price": pr.get(("plugin", p.name), Decimal(0)), "active": bool(p.enabled)})
        try:
            items = installer.content_items(p) or []
        except Exception:  # noqa: BLE001
            items = []
        for i in items:
            if i.get("problem"):
                continue
            k = f"{p.name}:{i['name']}"
            out.append({"kind": "game", "key": k, "label": i["title"], "group": f"{p.title or p.name}: " + "spelletjes", "price": pr.get(("game", k), Decimal(0)),
                        "active": bool(p.enabled and i.get("enabled", True))})
    return out


def hosting_options():
    """The hosting choices of the price list with their price per month incl. VAT: [{key, label, desc, price}]."""
    from . import pricing

    vat = (100 + Decimal(str(pricing.load()["vat_rate"]))) / 100
    return [{"key": o["key"], "label": o["label"], "desc": o.get("desc", ""), "price": str((Decimal(o["price"]) * vat).quantize(TWO))} for o in pricing.hosting_options()]


def hosting_line(lic):
    """The hosting that is paid with the licence, as a line of the price: None when there is none."""
    key = (lic.hosting if lic else "") or ""
    o = next((x for x in hosting_options() if x["key"] == key and Decimal(x["price"]) > 0), None)
    return {"kind": "hosting", "key": o["key"], "label": "Hosting: " + o["label"], "group": "Hosting", "price": Decimal(o["price"]), "active": True} if o else None


def backup_slots():
    """How many backups the superadmin allows: the limits of the backup module added up."""
    from apps.backups.models import BackupSettings

    c = BackupSettings.load()
    return c.max_daily + c.max_weekly + c.max_monthly + c.max_manual


def backup_cost(lic):
    """Per month: every backup above the included number costs the slot price."""
    if not lic:
        return Decimal(0)
    return (Decimal(max(0, backup_slots() - lic.backup_included)) * lic.backup_slot_price).quantize(TWO)


def monthly(lic=None):
    """The price per month: base + everything in use (modules, plugins, games, backups)."""
    lic = lic or License.objects.filter(pk=1).first()
    base = config_base()
    return (base + sum((c["price"] for c in catalog() if c["active"]), Decimal(0))).quantize(TWO)


def discount(months):
    """The discount (percent) for a payment of this many months: set by the superadmin in the price list (Subscriptions): month, quarter, year. 0 when there is none."""
    from . import pricing

    for p in (pricing.load().get("periods") or {}).values():
        if int(p.get("months", 0)) == int(months):
            return Decimal(str(p.get("discount", 0)))
    return Decimal(0)


def for_period(months, lic=None):
    """What a payment of this many months costs: the monthly price times the months, less the discount of that period."""
    return (monthly(lic) * months * (Decimal(100) - discount(months)) / 100).quantize(TWO)


def period_overview(lic=None):
    """[{months, discount, price, per_month}] for month, quarter and year: what the subscriptions cost now."""
    return [{"months": m, "discount": str(discount(m)), "price": str(for_period(m, lic)), "per_month": str((for_period(m, lic) / m).quantize(TWO))} for m in (1, 3, 12)]


def total(lic=None):
    """What a renewal costs: the price per month times the months that are paid at once."""
    lic = lic or License.objects.filter(pk=1).first()
    return for_period(lic.renew_months if lic else 12, lic)


def refresh():
    """Bring the stored price of the licence (a renewal) in line with what is in use now. Returns that price."""
    lic, _ = License.objects.get_or_create(pk=1)
    price = total(lic)
    if lic.price != price:
        lic.price = price
        lic.save(update_fields=["price"])
    return price
