"""Putting plugins on the system: safe unzip of an upload into <PLUGINS_DIR>/<name>/, scanning the folder, config, removal."""
import io
import logging
import os
import shutil
import stat
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
    target = plugin_dir(man["name"])
    tmp = root() / f".{man['name']}.tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    for info, name in infos:
        if not name.startswith(prefix) or name == prefix:
            continue
        dest = (tmp / name[len(prefix):]).resolve()
        if tmp.resolve() not in dest.parents and dest != tmp.resolve():
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
    shutil.rmtree(target, ignore_errors=True)
    os.replace(tmp, target)
    return register(man)


def register(man):
    """Create or update the database row of a plugin folder."""
    p, created = Plugin.objects.get_or_create(name=man["name"], defaults={"title": man["title"]})
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


def menu_group(p):
    """Where the plugin page sits in the member menu: the choice of the admin, else what the plugin proposes."""
    g = (p.config or {}).get("_menu_group")
    return g if g in mf.MENU_GROUPS else (p.manifest.get("menu") or {}).get("group", "other")


def as_page_object(p):
    """May the plugin be put on a page as a system object? Only if it offers that (plugin.json) and an admin allowed it."""
    return bool(p.manifest.get("page_object")) and bool((p.config or {}).get("_page_object"))


def save_placement(p, group=None, page_object=None):
    cfg = dict(p.config or {})
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
