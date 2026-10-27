# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Putting plugins on the system: safe unzip of an upload into <PLUGINS_DIR>/<name>/, scanning the folder, config, removal."""
import contextlib
import io
import re
import logging
import os
import shutil
import stat
import tempfile
import threading
import zipfile
from pathlib import Path

from django.conf import settings

from apps.integrations import crypto

from . import manifest as mf
from . import signing
from .models import Plugin

logger = logging.getLogger(__name__)
MAX_ZIP_MB, MAX_UNPACKED_MB, MAX_FILES = 50, 150, 3000


def root():
    d = Path(getattr(settings, "PLUGINS_DIR", None) or Path(settings.PROJECT_ROOT) / "plugins")
    d.mkdir(parents=True, exist_ok=True)
    return d


def plugin_dir(name):
    return root() / name


_held = threading.local()


@contextlib.contextmanager
def install_lock():
    """Only one process installs plugins at a time. The workers of a server all start the same installation at the same moment (a part that used to be built in comes from the library): without this
    they unpack into each other's folders and leave half a plugin behind. Re-entrant (the same thread may take it again)."""
    if getattr(_held, "n", 0):
        _held.n += 1
        try:
            yield
        finally:
            _held.n -= 1
        return
    fh = open(root() / ".install.lock", "a+")
    try:
        try:
            import fcntl

            fcntl.flock(fh, fcntl.LOCK_EX)
        except ImportError:  # (no file locks on this system)
            pass
        _held.n = 1
        yield
    finally:
        _held.n = 0
        try:
            import fcntl

            fcntl.flock(fh, fcntl.LOCK_UN)
        except ImportError:
            pass
        fh.close()


def data_dir(name):
    """Where a plugin keeps its own data (outside its program folder, so an update does not touch it)."""
    d = root() / ".data" / name
    d.mkdir(parents=True, exist_ok=True)
    return d


class InstallError(ValueError):
    pass


def _members(zf):
    """Safe list of (info, relative path); refuses absolute paths, '..', symlinks and zip bombs."""
    infos, total = [], 0
    for i in zf.infolist():
        name = i.filename.replace("\\", "/")
        if name.startswith("/") or ".." in name.split("/") or ":" in name.split("/")[0]:
            raise InstallError(f"Onveilig pad in het zipbestand: {i.filename}")
        if stat.S_ISLNK(i.external_attr >> 16):
            raise InstallError("Het zipbestand bevat een symbolische link; dat is niet toegestaan.")
        if name.startswith("__MACOSX/") or name.endswith(".DS_Store"):
            continue
        total += i.file_size
        infos.append((i, name))
    if len(infos) > MAX_FILES or total > MAX_UNPACKED_MB * 1024 * 1024:
        raise InstallError("Het zipbestand is te groot of heeft te veel bestanden.")
    return infos


def install_zip(data):
    """Unpack an uploaded zip. Returns the Plugin. It stays switched off; an update keeps the settings (and the on/off state)."""
    if len(data) > MAX_ZIP_MB * 1024 * 1024:
        raise InstallError(f"Het zipbestand is groter dan {MAX_ZIP_MB} MB.")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise InstallError("Dit is geen geldig zipbestand.")
    infos = _members(zf)
    names = [n for _, n in infos if not n.endswith("/")]
    prefix = ""
    if "plugin.json" not in names:  # the plugin may sit in one folder inside the zip
        tops = {n.split("/")[0] for n in names}
        if len(tops) == 1 and f"{next(iter(tops))}/plugin.json" in names:
            prefix = next(iter(tops)) + "/"
        else:
            raise InstallError("plugin.json ontbreekt in het zipbestand.")
    try:
        man = mf.parse(zf.read(prefix + "plugin.json"))
    except mf.ManifestError as e:
        raise InstallError(str(e))
    with install_lock():
        target = plugin_dir(man["name"])
        tmp = Path(tempfile.mkdtemp(prefix=f".{man['name']}.", suffix=".tmp", dir=root()))  # (own folder: nobody else unpacks into it)
        for info, name in infos:
            if not name.startswith(prefix) or name == prefix:
                continue
            dest = (tmp / name[len(prefix):]).resolve()
            if tmp.resolve() not in dest.parents and dest != tmp.resolve():
                shutil.rmtree(tmp, ignore_errors=True)
                raise InstallError(f"Onveilig pad: {name}")
            if name.endswith("/"):
                dest.mkdir(parents=True, exist_ok=True)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(dest, "wb") as out:
                    shutil.copyfileobj(src, out)
        if signing.verify(tmp) != "valid":  # only plugins made by our developer
            shutil.rmtree(tmp, ignore_errors=True)
            raise InstallError("Deze plugin is niet door onze ontwikkelaar ondertekend (of is na het ondertekenen gewijzigd). Alleen ondertekende plugins kunnen worden geïnstalleerd.")
        for need in (man["python"], man["web"]):
            if need and not (tmp / need).is_file():
                shutil.rmtree(tmp, ignore_errors=True)
                raise InstallError(f"In plugin.json staat {need}, maar dat bestand zit niet in de plugin.")
        for d in signing.content_dirs(target) if target.is_dir() else ():  # content added later (games) survives an update of the plugin
            old = target / d
            if old.is_dir():
                (tmp / d).mkdir(exist_ok=True)
                for item in old.iterdir():
                    if not (tmp / d / item.name).exists():
                        shutil.move(str(item), str(tmp / d / item.name))
        shutil.rmtree(target, ignore_errors=True)
        os.replace(tmp, target)
    return register(man)


# parts that used to be built into the system and are plugins now: a website that had them on keeps them on (the first time the plugin is found)
ADOPT = {"community": ("profiles", "discover", "messages", "chat", "directconnect"), "subscriptions": ("subscriptions", "donations"), "age-gates": ("age_gate", "geo", "gambling"), "statistics": ("stats",), "siteimport": ("siteimport",), "faq": ("faq",), "seo": ("seo",)}
DEFAULT_ON = {"age-gates", "statistics", "siteimport", "faq", "seo"}  # (the parts that were on by default: SEO, FAQ, Statistieken ...)
MERGED = {"payments": "finance"}  # a plugin that is part of another one now: its row goes


def _adopt(name):
    from apps.core.models import ModuleState

    if name in DEFAULT_ON:  # these parts were on in a website that never switched them (no stored choice = the default of the module)
        from apps.core import modules

        rows = dict(ModuleState.objects.filter(key__in=ADOPT[name]).values_list("key", "enabled"))
        return any(rows.get(k, modules.BY_KEY[k].get("default", True)) for k in ADOPT[name])
    if name in ADOPT:
        return ModuleState.objects.filter(key__in=ADOPT[name], enabled=True).exists()
    if name == "profile-themes":  # a website with profiles had its profile themes before: they stay
        return ModuleState.objects.filter(key="profiles", enabled=True).exists()
    if name == "finance":  # everything that handles money needs it
        return Plugin.objects.filter(name__in=("orders", "payments", "webshop"), enabled=True).exists()
    return False


LAST_ERROR = {"text": ""}  # why the last installation from the library did not work (for the message on the screen)


def needs_install(name):
    """Is this plugin missing, or is its folder half there or not signed right (an earlier installation that went wrong)?"""
    d = plugin_dir(name)
    return not (Plugin.objects.filter(name=name).exists() and (d / "plugin.json").is_file() and signing.verify(d) == "valid")


def install_from_library(name):
    """Install a plugin from the library (resource/plugins) when its folder is not here yet. Returns True when it was installed."""
    from apps.core import resources

    LAST_ERROR["text"] = ""
    try:
        with install_lock():  # (the workers of a server do this at the same moment: one at a time, and what the other one did is not done again)
            d = plugin_dir(name)
            if (d / "plugin.json").is_file() and signing.verify(d) == "valid":
                if not Plugin.objects.filter(name=name).exists():
                    scan()
                LAST_ERROR["text"] = "al geïnstalleerd"
                return False
            entry = next((e for e in resources.catalog("plugins") if e["name"] == name), None)
            if not entry:
                LAST_ERROR["text"] = f"{name} staat niet in de bibliotheek ({resources.root()}/plugins)"
                return False
            p = install_zip(resources._zip_bytes("plugins", entry))  # (also replaces a folder that is half there)
            for need in (p.manifest or {}).get("requires") or []:  # the plugins this one needs come with it (Abonnementen needs Orders and Financieel)
                install_from_library(need)
            return True
    except Exception as e:  # noqa: BLE001 - a library that cannot be read or a plugin that does not install: the plugin is simply not there
        LAST_ERROR["text"] = str(e)[:200]
        logging.getLogger(__name__).exception("Plugin %s could not be installed from the library", name)
        return False


def library_diff(name):
    """The files of an installed plugin that differ from the zip in the library (changed, extra or missing): the reason when its signature does not match. At most 6 names, or an empty list."""
    import hashlib

    from apps.core import resources

    try:
        entry = next((e for e in resources.catalog("plugins") if e["name"] == name), None)
        if not entry:
            return []
        zf = zipfile.ZipFile(io.BytesIO(resources._zip_bytes("plugins", entry)))
        want = {n: hashlib.sha256(zf.read(n)).hexdigest() for n in zf.namelist() if not n.endswith("/") and n != signing.SIG_FILE}
        d = plugin_dir(name)
        have = {rel: hashlib.sha256((d / rel).read_bytes()).hexdigest() for rel in signing.files(d)}
        sig_zip, sig_dir = zf.read(signing.SIG_FILE).decode().strip(), (d / signing.SIG_FILE).read_text().strip() if (d / signing.SIG_FILE).is_file() else ""
        out = sorted({k for k in want if have.get(k) != want[k]} | {k for k in have if k not in want})
        return out[:6] + (["plugin.sig"] if sig_zip != sig_dir else [])
    except Exception:  # noqa: BLE001 - only an aid for the message
        return []


def adopt_from_library():
    """A part that used to be built into the system is a plugin now: a website that had it switched on gets the plugin from the library (once) and keeps it on."""
    for name in ADOPT:
        if not plugin_dir(name).is_dir() and _adopt(name):
            install_from_library(name)


def register(man):
    """Create or update the database row of a plugin folder."""
    p, created = Plugin.objects.get_or_create(name=man["name"], defaults={"title": man["title"]})
    if created and _adopt(man["name"]):
        p.enabled = True
    cfg = dict(p.config or {})
    for c in man["config"]:  # new settings get their default
        cfg.setdefault(c["key"], c["default"])
    if not created and p.manifest == man and p.config == cfg:  # nothing changed: no write (this runs on every visit of the plugin pages)
        return p
    p.title, p.version, p.description, p.author, p.manifest, p.config = man["title"], man["version"], man["description"], man["author"], man, cfg
    p.error = ""
    p.save()
    return p


def scan():
    """Find plugin folders (developed in <PLUGINS_DIR>/<name>/) and register them. Returns (added_or_updated, problems)."""
    done, problems = [], []
    for d in sorted(root().iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        try:
            man = mf.parse((d / "plugin.json").read_bytes())
            if man["name"] != d.name:
                raise mf.ManifestError(f"De naam in plugin.json ({man['name']}) moet gelijk zijn aan de mapnaam ({d.name}).")
            done.append(register(man))
        except (OSError, mf.ManifestError) as e:
            problems.append({"folder": d.name, "problem": str(e) if not isinstance(e, OSError) else "plugin.json ontbreekt"})
    gone = Plugin.objects.exclude(name__in=[d.name for d in root().iterdir() if d.is_dir()])
    for p in gone:
        if p.name in MERGED and Plugin.objects.filter(name=MERGED[p.name]).exists():
            p.delete()
            continue
        p.enabled, p.error = False, "De map van deze plugin ontbreekt."
        p.save(update_fields=["enabled", "error"])
    return done, problems


def languages():
    """Language codes the system speaks (a plugin has to be translated into all of them)."""
    from apps.core.models import Language

    return sorted(set(Language.objects.values_list("code", flat=True)))


def lang_state(name):
    """{'have': [...], 'missing': [...]} for the translations in <plugin>/lang/<code>.json."""
    d = plugin_dir(name) / "lang"
    codes = languages()
    have = [c for c in codes if c == "nl" or (d / f"{c}.json").is_file()]
    return {"have": have, "missing": [c for c in codes if c not in have]}


def remove(p):
    shutil.rmtree(plugin_dir(p.name), ignore_errors=True)
    shutil.rmtree(root() / ".data" / p.name, ignore_errors=True)
    p.delete()


# ── settings: secret fields are stored encrypted ─────────────────────────────
def public_config(p):
    """Settings for the admin form: secrets are never sent back (only whether they are set)."""
    out = {}
    for c in p.manifest.get("config", []):
        v = (p.config or {}).get(c["key"], c["default"])
        out[c["key"]] = bool(v) if c["type"] == "secret" else v
    return out


def runtime_config(p):
    out = {}
    for c in p.manifest.get("config", []):
        v = (p.config or {}).get(c["key"], c["default"])
        out[c["key"]] = (crypto.decrypt(v).get("v", "") if isinstance(v, str) and v else "") if c["type"] == "secret" else v
    return out


ITEM_TYPES = ("text", "textarea", "number", "bool", "select", "color")


def clean_options(raw):
    """The options an item offers (game.json: config / settings): [{key, label, type, default, options, min, max, hint}]. Wrong entries are left out."""
    out, seen = [], set()
    for c in (raw or [])[:30]:
        if not isinstance(c, dict) or not re.fullmatch(r"[a-z][a-z0-9_]{0,30}", str(c.get("key") or "")) or c["key"] in seen or c.get("type", "text") not in ITEM_TYPES:
            continue
        t = c.get("type", "text")
        seen.add(c["key"])
        out.append({"key": c["key"], "label": str(c.get("label") or c["key"])[:80], "type": t, "default": c.get("default", False if t == "bool" else (0 if t == "number" else "")),
                    "options": [o if isinstance(o, dict) else {"value": str(o)[:60], "label": str(o)[:60]} for o in (c.get("options") or [])][:40] if t == "select" else [],
                    "hint": str(c.get("hint") or "")[:200], "min": c.get("min") if isinstance(c.get("min"), (int, float)) else None, "max": c.get("max") if isinstance(c.get("max"), (int, float)) else None})
    return out


def clean_values(schema, incoming, current):
    out = dict(current or {})
    for c in schema:
        if c["key"] not in incoming:
            continue
        v, t = incoming[c["key"]], c["type"]
        if t == "bool":
            v = bool(v)
        elif t == "number":
            try:
                v = float(v) if "." in str(v) else int(v)
            except (TypeError, ValueError):
                v = c["default"]
            if c["min"] is not None:
                v = max(c["min"], v)
            if c["max"] is not None:
                v = min(c["max"], v)
        elif t == "select":
            v = v if str(v) in [str(o["value"]) for o in c["options"]] else c["default"]
        elif t == "color":
            v = v if re.fullmatch(r"#[0-9a-fA-F]{6}", str(v or "")) else c["default"]
        else:
            v = str(v or "")[:2000]
        out[c["key"]] = v
    return out


def item_state(p):
    """{item: {enabled, object, config}} as the superadmin set it (the items of the content folder of a plugin: the games)."""
    return (p.config or {}).get("_items") or {}


def content_items(p):
    """What a plugin holds in its content folder (plugin.json: content_dirs + content_item), read from the files, with the state set by the superadmin.
    For the games plugin: the games in games/<name>/game.json, also while the plugin is switched off."""
    import json

    dirs, item = p.manifest.get("content_dirs") or [], p.manifest.get("content_item")
    if not dirs or not item:
        return None
    base = plugin_dir(p.name) / dirs[0]
    state = item_state(p)
    out = []
    for d in sorted(base.iterdir()) if base.is_dir() else []:
        f = d / item
        if not d.is_dir() or d.name.startswith(".") or not f.is_file():
            continue
        try:
            j = json.loads(f.read_text())
        except (OSError, ValueError):
            out.append({"name": d.name, "title": d.name, "description": "", "version": "", "author": "", "problem": True, "enabled": False, "object": False, "public": True, "min_age": 0, "config_schema": [], "config": {}, "settings_schema": [], "players_cap": {"min": 1, "max": 1}, "players": {"mode": "single", "max": 1, "chat": False, "direct": False}, "meta": {"titles": {}, "descriptions": {}, "image": "", "about": {"layout": "right", "images": [], "texts": {}}}})
            continue
        schema = clean_options(j.get("config"))
        st = state.get(d.name) or {}
        out.append({"name": d.name, "title": str(j.get("title") or d.name)[:80], "description": str(j.get("description") or "")[:300], "version": str(j.get("version") or "")[:20], "author": str(j.get("author") or "")[:80],
                    "categories": [str(c)[:30] for c in (j.get("categories") or []) if isinstance(c, str)][:6], "problem": False, "entry": str(j.get("entry") or "index.html")[:120], "thumb_file": str(j.get("thumbnail") or "")[:120],
                    "enabled": st.get("enabled", True), "object": bool(st.get("object")), "public": bool(st.get("public", True)), "min_age": _age(st.get("min_age")), "config_schema": schema, "config": {c["key"]: (st.get("config") or {}).get(c["key"], c["default"]) for c in schema},
                    "settings_schema": clean_options(j.get("settings")),
                    "players_cap": players_cap(j), "players": effective_players(players_cap(j), st.get("players")), "meta": item_meta(st)})
    return out[:300]


def players_cap(j):
    """How many players a game supports (game.json: players {min, max})."""
    pl = j.get("players") if isinstance(j.get("players"), dict) else {}
    try:
        mn, mx = int(pl.get("min", 1)), int(pl.get("max", 1))
    except (TypeError, ValueError):
        mn, mx = 1, 1
    mn = max(1, min(8, mn))
    return {"min": mn, "max": max(mn, min(8, mx))}


def effective_players(cap, st):
    """What is allowed for an item: the capability of the game, narrowed by what the superadmin chose (alone or with more, chat in the game, direct mode)."""
    st = st if isinstance(st, dict) else {}
    multi = cap["max"] > 1 and (st.get("mode") == "multi" or cap["min"] >= 2)  # a game that needs two or more players cannot be "alone"
    try:
        top = int(st.get("max") or cap["max"])
    except (TypeError, ValueError):
        top = cap["max"]
    return {"mode": "multi" if multi else "single", "max": max(max(2, cap["min"]), min(cap["max"], top)) if multi else 1,
            "chat": bool(st.get("chat")) and multi, "direct": bool(st.get("direct")) and cap["max"] >= 2 and cap["min"] <= 2}


ITEM_EXT = {"html", "htm", "js", "mjs", "css", "json", "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "mp3", "ogg", "wav", "mp4", "webm", "woff", "woff2", "ttf", "txt", "md", "wasm", "bin", "atlas", "glb"}
ITEM_MAX_FILE_MB, ITEM_MAX_UNPACKED_MB, ITEM_ZIP_MB = 15, 60, 30
ITEM_NAME_RE = re.compile(r"^[a-z][a-z0-9-]{1,38}[a-z0-9]$")


def add_item_zip(p, data):
    """Put a new item (a game) in the content folder of a plugin from a zip: a folder with the plugin's item file (game.json) in it. An existing item with the same name is replaced.
    Returns the name of the item. Only safe file types, paths and sizes; the item runs sealed off, like every item of the plugin."""
    import json

    if not p.manifest.get("content_dirs") or not p.manifest.get("content_item"):
        raise InstallError("Deze plugin heeft geen onderdelen om te uploaden.")
    if len(data) > ITEM_ZIP_MB * 2**20:
        raise InstallError(f"Het zipbestand is groter dan {ITEM_ZIP_MB} MB.")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise InstallError("Dit is geen geldig zipbestand.")
    spec = p.manifest["content_item"]
    infos = [i for i in zf.infolist() if not i.is_dir() and not i.filename.startswith("__MACOSX/") and not i.filename.split("/")[-1].startswith(".")]
    names = [i.filename for i in infos]
    prefix = ""
    if spec not in names:  # the item may sit in one folder inside the zip
        tops = {n.split("/")[0] for n in names}
        if len(tops) == 1 and f"{next(iter(tops))}/{spec}" in names:
            prefix = next(iter(tops)) + "/"
        else:
            raise InstallError(f"{spec} ontbreekt in het zipbestand.")
    try:
        man = json.loads(zf.read(prefix + spec).decode("utf-8"))
        name = str(man["name"])
    except (ValueError, KeyError, UnicodeDecodeError):
        raise InstallError(f"{spec} is niet te lezen of heeft geen \"name\".")
    if not ITEM_NAME_RE.match(name):
        raise InstallError("De naam in het bestand is ongeldig (3-40 tekens: a-z, 0-9 en -, begint met een letter).")
    total = 0
    for i in infos:
        n = i.filename[len(prefix):]
        if not i.filename.startswith(prefix) or not n:
            continue
        if n.startswith("/") or ".." in n.split("/") or "\\" in n or ((i.external_attr >> 16) & 0o170000) == 0o120000:
            raise InstallError(f"Onveilig pad in het pakket: {n}")
        if (n.rsplit(".", 1)[-1].lower() if "." in n else "") not in ITEM_EXT:
            raise InstallError(f"Dit bestandstype is niet toegestaan: {n}")
        if i.file_size > ITEM_MAX_FILE_MB * 2**20:
            raise InstallError(f"{n} is te groot (maximaal {ITEM_MAX_FILE_MB} MB per bestand).")
        total += i.file_size
        if total > ITEM_MAX_UNPACKED_MB * 2**20:
            raise InstallError(f"Het uitgepakte pakket is te groot (maximaal {ITEM_MAX_UNPACKED_MB} MB).")
    base = plugin_dir(p.name) / p.manifest["content_dirs"][0]
    base.mkdir(parents=True, exist_ok=True)
    tmp = base / f".{name}.tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    for i in infos:
        if not i.filename.startswith(prefix) or not i.filename[len(prefix):]:
            continue
        dest = (tmp / i.filename[len(prefix):]).resolve()
        if tmp.resolve() not in dest.parents:
            shutil.rmtree(tmp, ignore_errors=True)
            raise InstallError(f"Onveilig pad in het pakket: {i.filename}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(i) as src, open(dest, "wb") as out:
            shutil.copyfileobj(src, out)
    target = base / name
    keep = [x for x in ("cover.png", "cover.jpg", "cover.jpeg", "cover.webp") if (target / x).is_file()]  # the picture the superadmin chose stays when a game is updated
    for x in keep:
        if not (tmp / x).exists():
            shutil.copy2(target / x, tmp / x)
    if (target / "about").is_dir() and not (tmp / "about").exists():
        shutil.copytree(target / "about", tmp / "about")
    shutil.rmtree(target, ignore_errors=True)
    tmp.rename(target)
    return name


def _zip_dir(folder, top, skip=(".data", "__pycache__", ".DS_Store", ".tmp")):
    """The files of a folder as a zip (in memory), inside one folder `top` when given."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(Path(folder).rglob("*")):
            rel = f.relative_to(folder)
            if not f.is_file() or f.is_symlink() or any(part in skip or part.startswith(".") and part not in (".htaccess",) for part in rel.parts):
                continue
            zf.write(f, (f"{top}/" if top else "") + rel.as_posix())
    return buf.getvalue()


def zip_plugin(p):
    """The installed plugin as a zip that can be installed again on another site (plugin.json and plugin.sig at the top; the data of the plugin stays out)."""
    return _zip_dir(plugin_dir(p.name), "")


def zip_item(p, name):
    """One item (a game) as a zip with a folder of its own, ready to upload again."""
    if not p.manifest.get("content_dirs") or not ITEM_NAME_RE.match(name or ""):
        raise InstallError("Dit onderdeel bestaat niet.")
    d = plugin_dir(p.name) / p.manifest["content_dirs"][0] / name
    if not d.is_dir():
        raise InstallError("Dit onderdeel bestaat niet.")
    return _zip_dir(d, name)


def remove_item(p, name):
    """Take an item out of the content folder of a plugin (its files and the state the superadmin gave it)."""
    if not p.manifest.get("content_dirs") or not ITEM_NAME_RE.match(name or ""):
        raise InstallError("Dit onderdeel bestaat niet.")
    target = plugin_dir(p.name) / p.manifest["content_dirs"][0] / name
    if not target.is_dir():
        raise InstallError("Dit onderdeel bestaat niet.")
    shutil.rmtree(target, ignore_errors=True)
    cfg = dict(p.config or {})
    items = dict(cfg.get("_items") or {})
    items.pop(name, None)
    cfg["_items"] = items
    p.config = cfg
    p.save(update_fields=["config", "updated_at"])


ABOUT_LAYOUTS = ("left", "right", "top", "gallery")  # the explanation block of an item: picture left, right, above the text, or a gallery below it
MAX_ABOUT_IMAGES = 8


AGES = (0, 6, 8, 10, 12, 14, 16, 18, 21)  # age limits an item can have (0 = none)


def _age(v):
    try:
        return int(v) if int(v) in AGES else 0
    except (TypeError, ValueError):
        return 0


def item_meta(st):
    """The title, the explanation (in every language) and the picture an administrator gave an item; they come before the texts of the game itself."""
    m = (st or {}).get("meta") or {}
    ab = m.get("about") or {}
    return {"titles": m.get("titles") or {}, "descriptions": m.get("descriptions") or {}, "image": m.get("image") or "",
            "about": {"layout": ab.get("layout") if ab.get("layout") in ABOUT_LAYOUTS else "right", "images": ab.get("images") or [], "texts": ab.get("texts") or {}}}


def set_item_image(p, item, raw):
    """The picture of an item (a cover): saved in the folder of the item as cover.<ext>; raw=None removes it."""
    from apps.core import themepacks

    it = next((i for i in content_items(p) or [] if i["name"] == item), None)
    if not it:
        raise InstallError("Dit onderdeel bestaat niet in de map van de plugin.")
    d = plugin_dir(p.name) / p.manifest["content_dirs"][0] / item
    for old in d.glob("cover.*"):
        old.unlink()
    name = ""
    if raw is not None:
        try:
            ext = themepacks.check_image(raw)
        except themepacks.ThemeError as e:
            raise InstallError(str(e))
        if len(raw) > 3 * 2**20:
            raise InstallError("De afbeelding is te groot (maximaal 3 MB).")
        name = f"cover.{ext}"
        (d / name).write_bytes(raw)
    cfg = dict(p.config or {})
    allitems = dict(cfg.get("_items") or {})
    st = dict(allitems.get(item) or {})
    m = dict(st.get("meta") or {})
    m["image"] = name
    st["meta"] = m
    allitems[item] = st
    cfg["_items"] = allitems
    p.config = cfg
    p.save(update_fields=["config", "updated_at"])


def _meta_state(p, item):
    cfg = dict(p.config or {})
    allitems = dict(cfg.get("_items") or {})
    st = dict(allitems.get(item) or {})
    return cfg, allitems, st


def add_about_image(p, item, raw):
    """A picture for the explanation block of an item: about/<random>.<ext> in the folder of the item (max 8, 3 MB each)."""
    import secrets as _s

    from apps.core import themepacks

    it = next((i for i in content_items(p) or [] if i["name"] == item), None)
    if not it:
        raise InstallError("Dit onderdeel bestaat niet in de map van de plugin.")
    if len(it["meta"]["about"]["images"]) >= MAX_ABOUT_IMAGES:
        raise InstallError(f"Maximaal {MAX_ABOUT_IMAGES} afbeeldingen in het uitlegblok.")
    if len(raw) > 3 * 2**20:
        raise InstallError("De afbeelding is te groot (maximaal 3 MB).")
    try:
        ext = themepacks.check_image(raw)
    except themepacks.ThemeError as e:
        raise InstallError(str(e))
    d = plugin_dir(p.name) / p.manifest["content_dirs"][0] / item / "about"
    d.mkdir(exist_ok=True)
    name = f"{_s.token_hex(4)}.{ext}"
    (d / name).write_bytes(raw)
    cfg, allitems, st = _meta_state(p, item)
    m = dict(st.get("meta") or {})
    ab = dict(m.get("about") or {})
    ab["images"] = [*(ab.get("images") or []), f"about/{name}"]
    m["about"] = ab
    st["meta"] = m
    allitems[item] = st
    cfg["_items"] = allitems
    p.config = cfg
    p.save(update_fields=["config", "updated_at"])


def remove_about_image(p, item, name):
    cfg, allitems, st = _meta_state(p, item)
    m = dict(st.get("meta") or {})
    ab = dict(m.get("about") or {})
    if f"about/{name}" not in (ab.get("images") or []):
        raise InstallError("Deze afbeelding bestaat niet.")
    ab["images"] = [x for x in ab["images"] if x != f"about/{name}"]
    (plugin_dir(p.name) / p.manifest["content_dirs"][0] / item / "about" / name).unlink(missing_ok=True)
    m["about"] = ab
    st["meta"] = m
    allitems[item] = st
    cfg["_items"] = allitems
    p.config = cfg
    p.save(update_fields=["config", "updated_at"])


def save_item(p, item, data):
    """Change the state of one item (on/off, may be a system object, configuration). Returns the content_items of the plugin."""
    items = {i["name"]: i for i in content_items(p) or []}
    if item not in items:
        raise InstallError("Dit onderdeel bestaat niet in de map van de plugin.")
    cfg = dict(p.config or {})
    allitems = dict(cfg.get("_items") or {})
    st = dict(allitems.get(item) or {})
    if "enabled" in data:
        st["enabled"] = bool(data["enabled"])
    if "object" in data:
        st["object"] = bool(data["object"])
    if "min_age" in data:
        st["min_age"] = _age(data["min_age"])
    if "public" in data:  # visible to everyone (True) or only behind the login of an account (False, the default)
        st["public"] = bool(data["public"])
    if isinstance(data.get("config"), dict):
        st["config"] = clean_values(items[item]["config_schema"], data["config"], st.get("config") or {})
    if isinstance(data.get("meta"), dict):
        m = dict(st.get("meta") or {})
        for key, n in (("titles", 80), ("descriptions", 600)):
            if isinstance(data["meta"].get(key), dict):
                m[key] = {str(c)[:10]: str(v or "").strip()[:n] for c, v in data["meta"][key].items() if re.fullmatch(r"[a-zA-Z-]{2,10}", str(c)) and str(v or "").strip()}
        if isinstance(data["meta"].get("about"), dict):
            ab = dict(m.get("about") or {})
            if data["meta"]["about"].get("layout") in ABOUT_LAYOUTS:
                ab["layout"] = data["meta"]["about"]["layout"]
            if isinstance(data["meta"]["about"].get("texts"), dict):
                ab["texts"] = {str(c)[:10]: str(v or "").strip()[:4000] for c, v in data["meta"]["about"]["texts"].items() if re.fullmatch(r"[a-zA-Z-]{2,10}", str(c)) and str(v or "").strip()}
            m["about"] = ab
        st["meta"] = m
    if isinstance(data.get("players"), dict):  # the choice is kept as typed; what it means follows from the capability of the game (effective_players)
        pl = dict(st.get("players") or {})
        for k in ("mode",):
            if k in data["players"]:
                pl[k] = "multi" if data["players"][k] == "multi" else "single"
        for k in ("chat", "direct"):
            if k in data["players"]:
                pl[k] = bool(data["players"][k])
        if "max" in data["players"]:
            try:
                pl["max"] = max(2, min(8, int(data["players"]["max"])))
            except (TypeError, ValueError):
                pass
        st["players"] = pl
    allitems[item] = st
    cfg["_items"] = allitems
    p.config = cfg
    p.save(update_fields=["config", "updated_at"])


def menu_group(p):
    """Where the plugin page sits in the member menu: the choice of the admin, else what the plugin proposes."""
    g = (p.config or {}).get("_menu_group")
    return g if g in mf.MENU_GROUPS else (p.manifest.get("menu") or {}).get("group", "other")


def all_parts(p):
    """The parts of a plugin for pages: those in plugin.json, and (while it runs) the ones it offers itself with system.provide("parts", fn)."""
    parts = list(p.manifest.get("parts") or [])
    try:
        from . import runtime

        runtime.ensure_loaded()  # a plugin that is on but not loaded in this process yet
        fn = (runtime.LOADED.get(p.name).provides if runtime.LOADED.get(p.name) else {}).get("parts")
        for x in (fn() if fn else []) or []:
            if isinstance(x, dict) and re.fullmatch(r"[a-z][a-z0-9-]{1,60}", str(x.get("key") or "")) and str(x.get("file") or "").startswith("web/"):
                parts.append({"key": x["key"], "title": str(x.get("title") or x["key"])[:80], "file": x["file"], "query": {str(k)[:30]: str(v)[:80] for k, v in (x.get("query") or {}).items()}})
    except Exception:  # noqa: BLE001 - a plugin must never break the system objects
        pass
    return parts


def as_page_object(p):
    """May the plugin be put on a page as a system object? Only if it offers that (plugin.json) and an admin allowed it."""
    return bool(p.manifest.get("page_object")) and bool((p.config or {}).get("_page_object"))


def page_public(p):
    """Is the page of the plugin for everyone (at /<public_path>) or only for logged-in members (at /dashboard/<public_path>)?"""
    return bool(p.manifest.get("public_path")) and bool((p.config or {}).get("_page_public"))


def sync_menu_page(p):
    """A plugin page gets its item in a menu: public -> the menu of the website (/<path>), else the private menu of the dashboard (/dashboard/<path>). A plugin that is off loses it."""
    from apps.pages.models import Page

    src, path = f"plugin:{p.name}", p.manifest.get("public_path")
    if not path:
        return
    mine = bool(p.manifest.get("web")) and ((p.manifest.get("menu") or {}).get("access") == "members" or page_public(p))
    want = p.enabled and mine
    scope = "public" if page_public(p) else "private"
    url = f"/{path}" if scope == "public" else f"/dashboard/{path}"
    row = Page.objects.filter(source=src).first()
    if not want:
        if row:
            row.delete()
        return
    label = (p.manifest.get("menu") or {}).get("label") or p.title
    if row:
        Page.objects.filter(pk=row.pk).update(module=f"plugin:{p.name}", url=url, scope=scope, audience="all" if scope == "public" else "members", enabled=True)  # (the title, place and menu choice stay as the administrator set them)
        return
    key, n = f"plugin-{p.name}", 2
    while Page.objects.filter(key=key).exists():
        key, n = f"plugin-{p.name}-{n}", n + 1
    last = Page.objects.order_by("-order").first()
    Page.objects.create(key=key, kind="link", title={"nl": label}, url=url, scope=scope, module=f"plugin:{p.name}", in_menu=True, audience="all" if scope == "public" else "members", source=src, order=(last.order + 1) if last else 0)


def admin_section(p):
    """In which part of the admin menu (and which group of tiles) the admin page of the plugin sits: the choice of the superadmin, else what the plugin proposes."""
    s = (p.config or {}).get("_admin_section")
    return s if s in mf.SECTIONS else p.manifest.get("section", "system")


def save_placement(p, group=None, page_object=None, page_public=None, section=None):
    cfg = dict(p.config or {})
    if section in mf.SECTIONS:
        cfg["_admin_section"] = section
    if page_public is not None:
        cfg["_page_public"] = bool(page_public)
    if group in mf.MENU_GROUPS:
        cfg["_menu_group"] = group
    if page_object is not None:
        cfg["_page_object"] = bool(page_object)
    p.config = cfg
    p.save(update_fields=["config", "updated_at"])


def save_config(p, incoming):
    cfg = dict(p.config or {})
    for c in p.manifest.get("config", []):
        if c["key"] not in incoming:
            continue
        v, t = incoming[c["key"]], c["type"]
        if t == "bool":
            v = bool(v)
        elif t == "number":
            try:
                v = float(v) if "." in str(v) else int(v)
            except (TypeError, ValueError):
                v = c["default"] if c["default"] != "" else 0
        elif t == "select":
            v = v if v in c["options"] else c["default"]
        elif t == "secret":
            if v in (None, "", True):  # empty or the 'is set' marker: keep what was stored
                continue
            v = crypto.encrypt({"v": str(v)[:500]})
        else:
            v = str(v or "")[:4000]
        cfg[c["key"]] = v
    p.config = cfg
    p.save(update_fields=["config", "updated_at"])
