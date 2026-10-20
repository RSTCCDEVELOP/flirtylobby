"""The products of the webshop, which live in the webshop plugin. The system (subscriptions, dashboard) asks for them here;
without the plugin (or when it is off) the catalog is simply empty."""
from types import SimpleNamespace


def _p():
    from apps.plugins import runtime

    return runtime.provider("catalog")


def active():
    """[{id, name}] of the products that can be ordered."""
    p = _p()
    return p.products() if p else []


def get(pk):
    p = _p()
    return p.product(pk) if p else None


def exists(pk):
    return get(pk) is not None


def objects(ids):
    """Simple objects with .id and .name, for checks on products (subscriptions)."""
    found = (get(i) for i in ids)
    return [SimpleNamespace(**x) for x in found if x]


def low_stock():
    p = _p()
    return p.low_stock() if p else []


def restock(order):
    p = _p()
    if p and order.kind == "shop":
        p.restock(order)


def sitemap():
    """[(path, name)] of the product pages for sitemap.xml."""
    p = _p()
    return p.sitemap() if p else []
