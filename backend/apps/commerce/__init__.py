# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The link between the system and the plugins Orders and Payments (no models, no business logic).

Orders (bestellingen, btw, bevestigingsmail) and Payments (online betalen) are plugins. Subscriptions, donations, the dashboard and the webshop ask them here:
`orders()` / `payments()` give what the switched-on plugin offers (system.provide), or None when the plugin is missing or off.
Orders can work alone (pay by invoice); Payments and the Webshop need Orders (and the Webshop needs Payments too): see "requires" in their plugin.json.
"""
from decimal import Decimal

NO_ORDERS = "Hiervoor is de plugin Orders nodig. Installeer hem bij Admin → Plugins en zet hem aan."
NO_PAYMENTS = "Online betalen is nog niet beschikbaar: de plugin Betalen is niet aan."

DEFAULT_SETTINGS = {"pay_online": False, "currency": "EUR", "prices_include_vat": True, "default_vat": "21", "vat_rates": ["21", "9", "0"], "shipping_vat": "21"}


class Unavailable(Exception):
    """A function needs a plugin that is not there."""


def _p(what):
    from apps.plugins import runtime

    return runtime.provider(what)


def orders():
    return _p("orders")


def payments():
    return _p("payments")


def finance():
    """Payment options and terms, company data and the layout of the documents: the plugin Financieel."""
    return _p("finance")


def need_orders():
    o = orders()
    if o is None:
        raise Unavailable(NO_ORDERS)
    return o


def settings():
    """The order settings (currency, VAT ...); the defaults when the Orders plugin is off."""
    o = orders()
    return o.settings() if o else dict(DEFAULT_SETTINGS)


def can_pay_online():
    """True when the Payments plugin is on and can take payments."""
    p = payments()
    return bool(p and p.available())


def pay_online_wanted():
    """Orders are paid online: chosen in the Orders settings, and only possible with the Payments plugin."""
    return bool(orders() and settings().get("pay_online") and payments())


def payment_changed(payment):
    """Called by the payment engine after each status change: the Orders plugin updates the order that belongs to it."""
    o = orders()
    if o:
        o.on_payment(payment)


class Empty:
    """What an order query gives when the Orders plugin is off: nothing."""

    def update(self, **kw):
        return 0

    def first(self):
        return None

    def order_by(self, *a):
        return self

    def exists(self):
        return False


def open_orders(kind, ref_id):
    o = orders()
    return o.open_orders(kind, ref_id) if o else Empty()


def money(v):
    return Decimal(str(v or 0)).quantize(Decimal("0.01"))
