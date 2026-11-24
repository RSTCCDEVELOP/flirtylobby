# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The widgets: small parts (a countdown, a clock, a ticker ...) that an admin installs from the library and that an editor puts on a page like any system object.

Library:   <source>/widgets/<key>/widget.json   {key, name, description, version, category, subcategory, height, options: [{key, label, type, default, ...}], example: {option: value}}
           widget.html, widget.css, widget.js   {{option}} in the html and the css is replaced by the (escaped) value; the js reads window.WIDGET (the values) and window.WIDGET_KEY
Installed: InstalledWidget (key, enabled, options): the admin installs and removes; the options he sets apply everywhere the widget is shown.
A widget runs inside a sandboxed iframe (scripts only, no access to the page, the cookies or the login) and tells its height to the page (postMessage).
Every widget has an example: the widget as it looks with its example options, shown in the library and in the page editor."""
import html as _html
import json
import re
from pathlib import Path

from django.conf import settings

KEY_RE = re.compile(r"^[a-z][a-z0-9-]{1,38}[a-z0-9]$")
OPTION_TYPES = ("text", "textarea", "number", "color", "choice", "switch", "datetime")
MAX_FILE = 200_000


def root():
    return Path(settings.SOURCE_DIR) / "widgets"


def _read(key, name):
    f = root() / key / name
    try:
        return f.read_text(encoding="utf-8")[:MAX_FILE] if f.is_file() else ""
    except OSError:
        return ""


def _clean_option(o):
    if not isinstance(o, dict) or not re.fullmatch(r"[a-z][a-z0-9_]{0,30}", str(o.get("key") or "")) or o.get("type") not in OPTION_TYPES:
        return None
    out = {"key": o["key"], "label": str(o.get("label") or o["key"])[:80], "type": o["type"], "default": o.get("default", "")}
    if o["type"] == "number":
        out.update({"min": o.get("min", 0), "max": o.get("max", 100), "step": o.get("step", 1)})
    if o["type"] == "choice":
        out["choices"] = [{"value": str(c.get("value")), "label": str(c.get("label") or c.get("value"))} for c in (o.get("choices") or []) if isinstance(c, dict) and c.get("value") is not None][:30]
    return out


def manifest(key):
    """The clean manifest of a widget of the library, or None (not there, or broken)."""
    if not KEY_RE.match(str(key or "")):
        return None
    f = root() / key / "widget.json"
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(d, dict) or d.get("key") != key or not str(d.get("name") or "").strip() or not _read(key, "widget.html").strip():
        return None
    opts = [x for x in (_clean_option(o) for o in d.get("options") or []) if x]
    return {"key": key, "name": str(d["name"])[:60], "description": str(d.get("description") or "")[:300], "version": str(d.get("version") or "1.0.0")[:20], "category": str(d.get("category") or "Overig")[:30], "subcategory": str(d.get("subcategory") or "")[:30],
            "height": min(max(int(d.get("height") or 220), 40), 1200), "popup": bool(d.get("popup")), "options": opts, "example": d.get("example") if isinstance(d.get("example"), dict) else {}}


def library():
    """All widgets of the library, sorted by category and name."""
    out = []
    d = root()
    if d.is_dir():
        for p in sorted(d.iterdir()):
            m = manifest(p.name) if p.is_dir() else None
            if m:
                out.append(m)
    return sorted(out, key=lambda m: (m["category"], m["subcategory"], m["name"]))


def defaults(m):
    return {o["key"]: o["default"] for o in m["options"]}


def clean_options(m, given):
    """The options of a widget: the defaults, with the values that were given (only known options, in the right type)."""
    out = defaults(m)
    for o in m["options"]:
        if not isinstance(given, dict) or o["key"] not in given:
            continue
        v = given[o["key"]]
        if o["type"] == "number":
            try:
                v = float(v)
                v = min(max(v, float(o["min"])), float(o["max"]))
                v = int(v) if v == int(v) else v
            except (TypeError, ValueError):
                continue
        elif o["type"] == "switch":
            v = bool(v) and str(v).lower() not in ("0", "false", "no", "")
        elif o["type"] == "choice":
            if str(v) not in {c["value"] for c in o["choices"]}:
                continue
            v = str(v)
        elif o["type"] == "color":
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(v)):
                continue
        elif o["type"] == "textarea":
            v = str(v).replace("\r", "")[:1200]
        else:
            v = str(v)[:300]
        out[o["key"]] = v
    return out


def _fill(text, values):
    return re.sub(r"\{\{([a-z][a-z0-9_]*)\}\}", lambda m: _html.escape(str(values.get(m.group(1), "") if not isinstance(values.get(m.group(1)), bool) else ("1" if values[m.group(1)] else "")), quote=True), text)


def doc(key, options=None, example=False):
    """The whole html document of a widget (for a sandboxed iframe): its html, css and js with the options filled in. example=True: with the example options of the widget."""
    m = manifest(key)
    if not m:
        return ""
    vals = clean_options(m, {**(m["example"] if example else {}), **(options or {})})
    body = _fill(_read(key, "widget.html"), vals)
    css = _fill(_read(key, "widget.css"), vals)
    js = _read(key, "widget.js")
    data = json.dumps(vals).replace("</", "<\\/")
    return ("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            "<style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}</style>"
            f"<style>{css}</style></head><body>{body}<script>window.WIDGET={data};window.WIDGET_KEY={json.dumps(key)};</script>"
            f"<script>{js}</script><script>(function(){{function h(){{parent.postMessage({{widgetHeight:document.documentElement.scrollHeight,widget:{json.dumps(key)}}},'*')}}"
            "addEventListener('load',h);if(window.ResizeObserver)new ResizeObserver(h).observe(document.body);setTimeout(h,300)})();</script></body></html>")


# ── installed ──
def installed():
    from .models import InstalledWidget

    return {w.key: w for w in InstalledWidget.objects.all()}


def install(key):
    from . import service
    from .models import InstalledWidget

    if not manifest(key):
        raise ValueError("Dit widget staat niet in de bibliotheek.")
    w, _ = InstalledWidget.objects.update_or_create(key=key, defaults={"enabled": True})
    from apps.core import modules
    from apps.core.models import ModuleState

    if not modules.enabled("sysobjects"):  # a widget is a system object: the module that offers them to the page editor goes on with the first widget
        ModuleState.objects.update_or_create(key="sysobjects", defaults={"enabled": True})
        modules.invalidate()
    service.sync()
    return w


def uninstall(key):
    from . import service
    from .models import InstalledWidget

    InstalledWidget.objects.filter(key=key).delete()
    service.sync()


def set_options(key, given):
    from .models import InstalledWidget

    m = manifest(key)
    w = InstalledWidget.objects.filter(key=key).first()
    if not m or not w:
        raise ValueError("Dit widget is niet geïnstalleerd.")
    w.options = clean_options(m, given)
    w.save(update_fields=["options"])
    return w


def admin_listing():
    """The library for the admin: every widget with its example and whether it is installed (and its options then)."""
    have = installed()
    out = []
    for m in library():
        w = have.get(m["key"])
        opts = clean_options(m, w.options if w else {})
        out.append({**m, "installed": bool(w), "options_now": opts, "example_doc": doc(m["key"], example=True), "doc": doc(m["key"], opts) if w else ""})
    return out
