"""The price of the licence: the base price plus the price (incl. VAT) of every module, plugin and game that is in use. Set by the superadmin; refreshed whenever it is looked at."""
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


def total(lic=None):
    lic = lic or License.objects.filter(pk=1).first()
    base = lic.base_price if lic else Decimal(0)
    return (base + sum((c["price"] for c in catalog() if c["active"]), Decimal(0))).quantize(TWO)


def refresh():
    """Bring the stored price of the licence in line with what is in use now. Returns the price."""
    lic, _ = License.objects.get_or_create(pk=1)
    price = total(lic)
    if lic.price != price:
        lic.price = price
        lic.save(update_fields=["price"])
    return price
