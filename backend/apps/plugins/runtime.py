"""Plugins at work: loading a plugin's Python code, the events it listens to, the routes it adds.

A plugin is trusted code (a superadmin uploads and switches it on): it runs inside the system, so it may import and use everything
(`from apps.accounts.models import User`, the services, the models …). What the plugin file `plugin.py` has to offer:

    def register(system):                      # called when the plugin is switched on (and after every start of the system)
        system.on("user_registered", lambda user, **kw: ...)
        system.route("GET", "hello", lambda request: {"hello": system.config["greeting"]})
        system.route("POST", "webhook", handler, public=True)

`system` gives: name, dir, config (the plugin's settings), log, send_mail(to, subject, body), User, on(event, fn), route(method, path, fn, public=False).
"""
import importlib.util
import logging
import sys
import time

from . import installer, manifest as mf, signing
from .models import Plugin

logger = logging.getLogger(__name__)
EVENTS = ["user_registered", "user_login", "listing_created", "bid_placed", "booking_created", "agenda_event_created", "agenda_event_responded"]
LOADED = {}      # name -> Loaded, per process
_checked = {"t": 0}
TTL = 5


class Loaded:
    def __init__(self, stamp):
        self.stamp, self.hooks, self.routes, self.module, self.provides = stamp, {}, [], None, {}

    def match(self, method, path):
        """(fn, public, params) for a path like "listing/3", or None. Exact paths win over paths with <parts>."""
        parts, best = tuple(path.strip("/").split("/")), None
        for m, segs, fn, public in self.routes:
            rest = bool(segs) and segs[-1].startswith("<*")  # <*name> as the last part takes the whole rest of the path (e.g. a file in a folder)
            if m != method or (len(segs) != len(parts) if not rest else len(parts) < len(segs)):
                continue
            params, ok = {}, True
            for i, seg in enumerate(segs):
                if rest and i == len(segs) - 1:
                    params[seg[2:-1]] = "/".join(parts[i:])
                elif seg.startswith("<") and seg.endswith(">"):
                    params[seg[1:-1]] = parts[i]
                elif seg != parts[i]:
                    ok = False
                    break
            if ok and not params:
                return fn, public, {}
            if ok and best is None:
                best = (fn, public, params)
        return best


class System:
    """What a plugin gets to work with."""

    def __init__(self, plugin, loaded):
        self._loaded = loaded
        self.name, self.dir = plugin.name, installer.plugin_dir(plugin.name)
        self.data_dir = installer.data_dir(plugin.name)  # the plugin's own files and databases: kept when the plugin is updated
        self.config = installer.runtime_config(plugin)
        self.log = logging.getLogger(f"plugin.{plugin.name}")
        self.app_label = "plugin_" + plugin.name.replace("-", "_")  # for the models of the plugin (Meta.app_label)
        self.db_prefix = "plg_" + plugin.name.replace("-", "_") + "_"  # table names of the plugin start with this
        self.system_version = __import__("django.conf", fromlist=["settings"]).settings.SYSTEM_VERSION
        self.version = plugin.version

    @property
    def User(self):
        from django.contrib.auth import get_user_model

        return get_user_model()

    def on(self, event, fn=None):
        if event not in EVENTS:
            raise ValueError(f"Onbekende gebeurtenis: {event}. Kies uit {', '.join(EVENTS)}.")

        def add(f):
            self._loaded.hooks.setdefault(event, []).append(f)
            return f
        return add(fn) if fn else add

    def route(self, method, path, fn=None, public=False):
        """Add a route. A part like <id> in the path is handed to the function as a keyword (fn(request, id="3"))."""
        def add(f):
            self._loaded.routes.append((method.upper(), tuple(str(path).strip("/").split("/")), f, bool(public)))
            return f
        return add(fn) if fn else add

    def gate(self, user, key):
        """None when `user` may use the part `key` (free, or he has the subscription / donation for it); else a 402 answer with the reason, to return from a route (Admin -> Actions)."""
        from rest_framework import status
        from rest_framework.response import Response

        from apps.subscriptions import service as subs

        if subs.can(user, key):
            return None
        return Response({"detail": subs.GATE_MESSAGE.get(key, "Hiervoor heb je een abonnement of donatie nodig."), "subscribe": True}, status=status.HTTP_402_PAYMENT_REQUIRED)

    def item(self, slug, players=False):
        """The state of one item of the content folder, as the superadmin set it: {enabled, object, config}. (Read fresh: it can change while the plugin runs.)"""
        row = Plugin.objects.filter(name=self.name).first()
        st = installer.item_state(row).get(slug) if row else None
        out = {"enabled": (st or {}).get("enabled", True), "object": bool((st or {}).get("object")), "public": bool((st or {}).get("public", True)), "min_age": installer._age((st or {}).get("min_age")), "config": (st or {}).get("config") or {}, "meta": installer.item_meta(st)}
        if players:  # (reads the game's own json: only when it is needed)
            cap = next((i["players_cap"] for i in installer.content_items(row) or [] if i["name"] == slug), {"min": 1, "max": 1}) if row else {"min": 1, "max": 1}
            out["players"] = installer.effective_players(cap, (st or {}).get("players"))
        return out

    def provide(self, what, obj):
        """Offer something to the system (see manifest.PROVIDES): the system asks for it through runtime.provider(what)."""
        if what not in mf.PROVIDES:
            raise ValueError(f"Onbekend aanbod: {what}.")
        self._loaded.provides[what] = obj

    def t(self, text, *args):
        """The text of a message; the system translates it into the language of the visitor (the plugin's lang/<code>.json, then the system's own texts)."""
        return text.format(*args) if args else text

    def sync_models(self, *models):
        """Create the tables of the plugin's Django models in the system's own database when they do not exist yet.
        Use Meta.app_label = system.app_label and Meta.db_table = system.db_prefix + "name". Changes later go in migrate(system, old, new)."""
        from django.db import connection

        existing = set(connection.introspection.table_names())
        with connection.schema_editor() as se:
            for m in models:
                if m._meta.db_table not in existing:
                    se.create_model(m)

    def emit(self, event, **data):
        """Tell the other plugins something happened (see EVENTS)."""
        emit(event, **data)

    def send_mail(self, to, subject, body):
        from apps.communication import sending

        return sending.send_email(to, subject, body, purpose="plugin")


def _purge_models(name):
    """Forget the Django models a plugin defined (they are made again when it loads)."""
    from django.apps import apps

    apps.all_models.pop("plugin_" + name.replace("-", "_"), None)
    apps.clear_cache()


def _unload(name):
    LOADED.pop(name, None)
    _purge_models(name)
    sys.modules.pop(f"plugin_{name}", None)
    d = str(installer.plugin_dir(name))
    if d in sys.path:
        sys.path.remove(d)


def load(p):
    """(Re)load one plugin. Returns an error text, or None."""
    _unload(p.name)
    problem = start_problem(p)
    if problem:
        return problem
    entry = p.manifest.get("python")
    loaded = Loaded(p.updated_at)
    if entry:
        d = installer.plugin_dir(p.name)
        try:
            sys.path.insert(0, str(d))
            spec = importlib.util.spec_from_file_location(f"plugin_{p.name}", d / entry)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = mod
            spec.loader.exec_module(mod)
            loaded.module = mod
            if hasattr(mod, "register"):
                mod.register(System(p, loaded))
            new = int(p.manifest.get("schema") or 0)
            if new > p.schema_version:  # the plugin's tables in the system database change with a new version of the plugin
                if p.schema_version > 0 and hasattr(mod, "migrate"):
                    mod.migrate(System(p, loaded), p.schema_version, new)
                Plugin.objects.filter(pk=p.pk).update(schema_version=new)
        except Exception as e:  # noqa: BLE001 - a broken plugin must never take the system down
            logger.exception("Plugin %s could not be loaded", p.name)
            _unload(p.name)
            return f"{type(e).__name__}: {e}"[:500]
    LOADED[p.name] = loaded
    return None


def start_problem(p):
    """Why a plugin may not run (text), or None: it is not signed by our developer, or it is for a different generation of the system."""
    sig = signing.verify(installer.plugin_dir(p.name))
    if sig == "invalid" or (sig == "missing" and not signing.dev_mode_allowed()):
        return "De ondertekening van deze plugin ontbreekt of klopt niet: alleen plugins van onze ontwikkelaar draaien hier."
    built, now = p.manifest.get("system_version", "0.0.0"), __import__("django.conf", fromlist=["settings"]).settings.SYSTEM_VERSION
    state = mf.compatibility(built, now)
    if state == "incompatible" or (state == "newer" and mf.ver(built)[0] != mf.ver(now)[0]):
        return f"Deze plugin is gemaakt voor systeemversie {built} en werkt niet met versie {now}. Werk de plugin bij."
    return None


def provider(what):
    """What a switched-on plugin offers the system (or None)."""
    try:
        ensure_loaded()
    except Exception:  # noqa: BLE001
        return None
    for lp in list(LOADED.values()):
        if what in lp.provides:
            return lp.provides[what]
    return None


def unload(name):
    _unload(name)


def ensure_loaded(force=False):
    """Make this process follow the database: load plugins that were switched on, drop the ones switched off (checked every few seconds)."""
    if not force and time.time() - _checked["t"] < TTL:
        return
    _checked["t"] = time.time()
    try:
        on = {p.name: p for p in Plugin.objects.filter(enabled=True)}
    except Exception:  # noqa: BLE001 - database not ready (migrations)
        return
    for name in list(LOADED):
        if name not in on:
            _unload(name)
    for name, p in on.items():
        cur = LOADED.get(name)
        if not cur or cur.stamp != p.updated_at:
            err = load(p)
            if err:
                Plugin.objects.filter(pk=p.pk).update(error=err, enabled=False)


def emit(event, **data):
    """Tell the plugins something happened. Never raises."""
    try:
        ensure_loaded()
        for name, lp in list(LOADED.items()):
            for fn in lp.hooks.get(event, []):
                try:
                    fn(**data)
                except Exception as e:  # noqa: BLE001
                    logger.exception("Plugin %s failed on %s", name, event)
                    Plugin.objects.filter(name=name).update(error=f"{event}: {type(e).__name__}: {e}"[:500])
    except Exception:  # noqa: BLE001
        logger.exception("Plugin events failed")
