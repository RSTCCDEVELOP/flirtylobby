import json
from pathlib import Path

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.access import level
from apps.core import modules

from .go import go_of
from .source import GROUPS, ITEMS

LANGS = ("nl", "en", "de", "fr", "es", "pt", "zh", "ar")
FILE = Path(__file__).parent / "data" / "faq.json"


def texts():
    try:
        return json.loads(FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"groups": {}, "items": {}}


def allowed(user, need):
    """Does this person get to see an item: from the rights they have (and the module or plugin must be on)."""
    if need == "all":
        return True
    authed = bool(user and user.is_authenticated)
    if need == "admin":  # anything of the admin menu: super admins, or a person with some access to a module
        return authed and (user.is_staff or any(level(user, m["key"]) >= 1 for m in modules.MODULES if m.get("acl", True) and m["key"] not in ("dashboard", "modules")))
    if need == "member":
        return authed
    if need == "staff":
        return authed and user.is_staff
    if need.startswith("plugin+:"):  # a part of a plugin for every logged-in person, while the plugin is on
        return authed and modules.enabled("plugin:" + need[8:])
    if need.startswith("plugin:"):  # the management of a plugin: super admins, while the plugin is on
        return authed and user.is_staff and modules.enabled(need)
    module, _, lv = need.partition(":")
    need_level = int(lv or 1)
    if need_level == 0:  # a part for every logged-in person, while its module is on
        return authed and modules.enabled(module)
    return modules.enabled(module) and level(user, module) >= need_level


def pick(d, lang):
    d = d or {}
    return d.get(lang) or d.get("en") or d.get("nl") or ""


LAYERS = ("user", "admin", "super")


def _social():
    from apps.plugins import facade

    service, themes = facade.mod("community", "service"), facade.mod("community", "themes")  # (the plugin Community)
    if not service:  # without it nothing about the community applies
        return {"profiles": {"theme": "", "requests_enabled": False}, "discover": {"swipe": "off", "pass_days": 0}}, "", None
    cfg = service.get()
    return cfg, cfg["profiles"]["theme"], themes


def _swipe():
    cfg, theme, themes = _social()
    sw = cfg["discover"]["swipe"]
    return sw == "on" or (sw == "auto" and themes is not None and themes.search_config(theme)["swipe"])


def _available():
    from apps.plugins import facade

    availability = facade.mod("community", "availability")
    return bool(availability and availability.groups())


# items that only apply when a setting is in use: nothing is shown about what is not on (e.g. dating when the profile theme is not Dating)
CONDITIONS = {
    "dating": lambda: _social()[1] == "dating",
    "swipe": _swipe,
    "hide": lambda: _social()[0]["discover"].get("pass_days", 0) > 0 or _social()[0]["discover"].get("pass_forever"),
    "available": _available,
    "friends": lambda: _social()[0]["profiles"].get("requests_enabled", True),
}


def applies(item_id):
    try:
        return CONDITIONS[item_id]() if item_id in CONDITIONS else True
    except Exception:  # noqa: BLE001 - a broken setting must never hide the whole help
        return True


@api_view(["GET"])
@permission_classes([AllowAny])
def help_view(request):
    """The help of Easy2edit in three layers: ?layer=user | admin | super. Back end only (logged in); only what is on and what this person has the rights for."""
    if not modules.enabled("help") or not request.user.is_authenticated:
        return Response({"detail": "Deze module is uitgeschakeld."}, status=404)
    lang = str(request.query_params.get("lang") or "nl")[:5]
    layer = request.query_params.get("layer") if request.query_params.get("layer") in LAYERS else "user"
    t = texts()
    shown = [i for i in ITEMS if allowed(request.user, i[3]) and applies(i[0]) and (i[1] != "super" or request.user.is_staff)]
    layers = [l for l in LAYERS if l == "user" or any(i[1] == l for i in shown)]
    items = []
    for i, lay, group, _need, q_nl, a_nl in shown:
        if lay != layer:
            continue
        tr = t["items"].get(i, {})
        items.append({"id": i, "group": group, "q": q_nl if lang == "nl" else pick(tr.get("q"), lang) or q_nl, "a": a_nl if lang == "nl" else pick(tr.get("a"), lang) or a_nl, "go": go_of(i)})
    used = {i["group"] for i in items}
    groups = [{"id": g, "art": art, "title": title if lang == "nl" else pick(t["groups"].get(g), lang) or title} for g, lay, title, art in GROUPS if lay == layer and g in used]
    return Response({"layer": layer, "layers": layers, "groups": groups, "items": items})
