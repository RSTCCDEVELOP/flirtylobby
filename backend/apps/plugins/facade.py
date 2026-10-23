# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""How the system (and other plugins) lean on the plugins Community and Abonnementen.

Those two are plugins: their code is not in the system. A part of the system that needs them asks here: `community.x` / `subs.x` give what the plugin
offers when it is on, and a harmless standard when it is not (nothing is gated, there are no profiles). `mod("community", "models")` gives a module of the plugin or None."""
from . import runtime


def provider(name):
    return runtime.provider(name)


def mod(plugin, name):
    """A part of a plugin that is on (its `service`, `models`, `themes` ...), or None."""
    p = runtime.provider(plugin)
    return getattr(p, name, None) if p is not None else None


def model(plugin, name):
    """One model class of a plugin that is on, or None."""
    m = mod(plugin, "models")
    return getattr(m, name, None) if m is not None else None


class _Proxy:
    def __init__(self, plugin, part, fallback):
        self._plugin, self._part, self._fallback = plugin, part, fallback

    def __getattr__(self, name):
        m = mod(self._plugin, self._part)
        if m is not None:
            return getattr(m, name)
        if name in self._fallback:
            return self._fallback[name]
        raise AttributeError(f"{self._plugin}.{self._part}.{name}: de plugin staat uit")

    def __bool__(self):
        return mod(self._plugin, self._part) is not None


# without the plugin Abonnementen nothing needs a subscription or a donation
subs = _Proxy("subscriptions", "service", {
    "can": lambda user, key: True, "access": lambda user, key, partner=None: (True, None), "charge": lambda *a, **k: None, "charge_like": lambda *a, **k: None,
    "likes_left": lambda user: None, "item_of": lambda key: None, "GATE_MESSAGE": {}, "on_order_status": lambda *a, **k: None, "on_payment": lambda *a, **k: None,
    "locked_pages": lambda *a, **k: [], "entitlements": lambda *a, **k: {"full": True}, "page_ok": lambda *a, **k: True, "locked_products": lambda *a, **k: [], "check_products": lambda *a, **k: None,
    "SubError": type("SubError", (Exception,), {}),
})
# without the plugin Community there are no profiles
community = _Proxy("community", "service", {
    "display_name": lambda u: u.display_name or f"{u.first_name} {u.last_name}".strip() or u.email.split("@")[0], "hidden_ids": lambda me: set(),
    "get": lambda: {"profiles": {"theme": "normal", "requests_enabled": False}, "discover": {"require_to_search": False, "swipe": "off"}}, "can_view": lambda *a, **k: True,
})


class _NullQS:
    """What a query on the model of a plugin that is off gives: nothing."""
    def __iter__(self):
        return iter(())

    def __len__(self):
        return 0

    def __bool__(self):
        return False

    def __getitem__(self, i):
        if isinstance(i, slice):
            return self
        raise IndexError(i)

    def count(self):
        return 0

    def exists(self):
        return False

    def first(self):
        return None

    last = first

    def delete(self):
        return 0, {}

    def update(self, **k):
        return 0

    def aggregate(self, *a, **k):
        return {}

    def get(self, *a, **k):
        raise LookupError("de plugin staat uit")

    def create(self, *a, **k):
        raise RuntimeError("de plugin staat uit")

    get_or_create = update_or_create = create

    def __getattr__(self, name):  # filter, exclude, order_by, values, values_list, annotate, select_related ... : still nothing
        if name.startswith("_"):
            raise AttributeError(name)
        return lambda *a, **k: self


class _NullModel:
    objects = _NullQS()
    DoesNotExist = LookupError

    def __init__(self, *a, **k):
        raise RuntimeError("de plugin staat uit")


def models(plugin, *names):
    """The models of a plugin by name; for a plugin that is off a stand-in whose queries give nothing (so code that only reads keeps working)."""
    out = tuple(model(plugin, n) or _NullModel for n in names)
    return out if len(out) != 1 else out[0]
