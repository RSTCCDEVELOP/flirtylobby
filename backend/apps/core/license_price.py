"""The price of the licence. Every price is PER MONTH (incl. VAT): the base price, plus the price of every module, plugin and game that is in use, plus the backups
(the limits of the backup module added up, above the number that is in the base price). The superadmin chooses how long a payment lasts (month, quarter or year);
what a renewal costs is the monthly price times those months. Set by the superadmin; refreshed whenever it is looked at."""
from decimal import Decimal

from . import modules
from .models import ComponentPrice, License

TWO = Decimal("0.01")


def _prices():
    return {(p.kind, p.key): p.price for p in ComponentPrice.objects.all()}


def catalog():
    """Every module, plugin and game with its price and whether it is in use now: [{kind, key, label, group, price, active}]."""
    from apps.plugins import installer
    from apps.plugins.models import Plugin

    pr, on, out = _prices(), modules.states(), []
    for m in modules.MODULES:
        out.append({"kind": "module", "key": m["key"], "label": m["label"], "group": m["group"], "price": pr.get(("module", m["key"]), Decimal(0)), "active": bool(on.get(m["key"], True))})
    for pk in modules.PACKAGES:  # the add-on packages: a package is in use while one of its modules is on
        out.append({"kind": "package", "key": pk["key"], "label": "Pakket: " + pk["label"], "group": "Pakketten", "price": pr.get(("package", pk["key"]), Decimal(0)),
                    "active": any(bool(on.get(k, True)) for k in pk["modules"])})
    lic = License.objects.filter(pk=1).first()
    out.append({"kind": "backup", "key": "slots", "label": f"Backups bewaren ({backup_slots()} in totaal, {lic.backup_included if lic else 0} inbegrepen)", "group": "Systeem", "price": backup_cost(lic),
                "active": bool(on.get("backups", True)), "computed": True})
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
    base = lic.base_price if lic else Decimal(0)
    return (base + sum((c["price"] for c in catalog() if c["active"]), Decimal(0))).quantize(TWO)


def for_period(months, lic=None):
    return (monthly(lic) * months).quantize(TWO)


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
