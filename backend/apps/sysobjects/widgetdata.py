# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The data of the widgets: a widget that names a provider in its widget.json ("data": {"provider": "faq"}) gets the data of that plugin (or of the system) when it is on, so the content comes from the
database. It is put in the document of the widget as window.WIDGET_DATA = {provider, active, items, ...}; the widget uses it when its option `source` is "auto" (or "plugin") and there is something,
and falls back on its own options (source "own", or the plugin is off, or it has nothing). The widget runs in a sandboxed frame without access to the system: only what is put here reaches it, and only
public data of the website (a visitor of the website sees it anyway). Texts are plain (the widget draws them as text, never as html).

A provider is a function () -> {"active": bool, "items": [...]}; PROVIDERS says which exist and how they are called (the label is shown in the editor)."""
import logging
from decimal import Decimal

from django.apps import apps as django_apps
from django.utils import timezone

logger = logging.getLogger(__name__)


def _plugin_on(name):
    try:
        from apps.plugins import runtime

        runtime.ensure_loaded()
        return name in runtime.LOADED
    except Exception:  # noqa: BLE001
        return False


def _model(label, name):
    return django_apps.all_models.get(label, {}).get(name.lower())  # the models of a plugin are in the registry while it is on


def _text(v, n=1200):
    return str(v or "")[:n]


def faq():
    """The questions of the plugin FAQ: [{q, a, c}] with a text per language ({"nl": ..., "en": ...})."""
    M = _model("plugin_faq", "FaqEntry") if _plugin_on("faq") else None
    if M is None:
        return {"active": False, "items": []}
    items = [{"q": e.question or {}, "a": e.answer or {}, "c": e.category or {}} for e in M.objects.filter(active=True).order_by("order", "id")[:60]]
    return {"active": True, "items": items}


def webshop():
    """The discount codes of the plugin Webwinkel that are on now: [{code, text, kind, value, min, until}]."""
    M = _model("plugin_webshop", "Discount") if _plugin_on("webshop") else None
    if M is None:
        return {"active": False, "items": []}
    now = timezone.now()
    out = []
    for d in M.objects.filter(active=True).order_by("-created_at")[:30]:
        if (d.starts_at and d.starts_at > now) or (d.ends_at and d.ends_at < now) or (d.max_uses is not None and d.used_count >= d.max_uses):
            continue
        out.append({"code": _text(d.code, 40), "text": _text(d.description, 200), "kind": d.kind if d.kind in ("percent", "fixed") else "percent", "value": float(Decimal(d.value)),
                    "min": float(Decimal(d.min_subtotal or 0)), "until": d.ends_at.isoformat() if d.ends_at else ""})
    return {"active": True, "items": out}


def agenda():
    """The public events of the plugin Agenda that are still to come: [{title, start, end, place, capacity, taken}] (capacity empty = unlimited)."""
    E, A = (_model("plugin_agenda", "Event"), _model("plugin_agenda", "Attendee")) if _plugin_on("agenda") else (None, None)
    if E is None:
        return {"active": False, "items": []}
    now = timezone.now()
    out = []
    for e in E.objects.filter(on_site=True, status="active", starts_at__gte=now).order_by("starts_at")[:20]:
        taken = A.objects.filter(event=e, status__in=("accepted", "going", "yes", "confirmed")).count() if A is not None else 0
        out.append({"title": _text(e.title, 160), "start": e.starts_at.isoformat(), "end": e.ends_at.isoformat() if e.ends_at else "", "place": _text(e.location, 160), "capacity": e.capacity, "taken": taken})
    return {"active": True, "items": out}


def entity():
    """The company of this website (the module Entiteit): name, address, phone, e-mail, website, extra locations. One item."""
    try:
        from apps.core import modules
        from apps.core.models import Entity

        if not modules.enabled("entities"):
            return {"active": False, "items": []}
        e = Entity.objects.filter(is_own=True).first()
    except Exception:  # noqa: BLE001
        return {"active": False, "items": []}
    if not e:
        return {"active": False, "items": []}
    item = {"name": _text(e.name or e.legal_name, 160), "legal": _text(e.legal_name, 160), "email": _text(e.email, 160), "phone": _text(e.phone, 40), "website": _text(e.website, 200),
            "street": _text(e.street, 120), "number": _text(e.house_number, 20), "zip": _text(e.postal_code, 20), "city": _text(e.city, 80), "country": _text(e.country, 80),
            "locations": [{k: _text(l.get(k), 120) for k in ("name", "street", "house_number", "postal_code", "city", "country", "phone", "email")} for l in (e.locations or [])[:8] if isinstance(l, dict)]}
    return {"active": bool(item["name"] or item["email"] or item["phone"] or item["street"]), "items": [item]}


def hours():
    """The opening hours that are set in the widget Openingstijden (when it is installed): one item with its options (mon ... sun as texts like "09:00-17:30" or "gesloten", and the texts)."""
    try:
        from . import widgets
        from .models import InstalledWidget

        w = InstalledWidget.objects.filter(key="opening-hours", enabled=True).first()
        m = widgets.manifest("opening-hours")
        if not w or not m:
            return {"active": False, "items": []}
        o = widgets.clean_options(m, w.options)
    except Exception:  # noqa: BLE001
        return {"active": False, "items": []}
    return {"active": True, "items": [{k: (v if isinstance(v, (int, float, bool)) else _text(v, 200)) for k, v in o.items()}]}


PROVIDERS = {
    "faq": ("FAQ-plugin", faq),
    "webshop": ("Plugin Webwinkel (kortingscodes)", webshop),
    "agenda": ("Plugin Agenda (evenementen)", agenda),
    "entity": ("Bedrijfsgegevens (module Entiteit)", entity),
    "hours": ("Openingstijden (widget Openingstijden)", hours),
}


def label(provider):
    return PROVIDERS[provider][0] if provider in PROVIDERS else ""


def get(provider):
    """{provider, active, items} of one provider (never raises: a broken plugin gives an inactive answer)."""
    if provider not in PROVIDERS:
        return {"provider": provider, "active": False, "items": []}
    try:
        d = PROVIDERS[provider][1]()
    except Exception:  # noqa: BLE001
        logger.exception("widget data %s", provider)
        d = {"active": False, "items": []}
    return {"provider": provider, **d}


def status(provider):
    """For the editor: is the source on and how much does it have: {provider, label, active, count}."""
    d = get(provider)
    return {"provider": provider, "label": label(provider), "active": bool(d["active"]), "count": len(d["items"])}
