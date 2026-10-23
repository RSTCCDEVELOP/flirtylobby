"""The library: the zips that come with the product in the folder resource/ (in git): resource/plugins, resource/themas and resource/languages. Only the latest version of each is kept.

From here a superadmin (or, for what is ticked in resource/allowed.json, anybody who may manage that part) can add a plugin, theme or language without uploading a file, and update
what is installed. `resource/allowed.json` says which ones may be installed by others: {"plugins": [...], "themas": [...], "languages": [...]} (names: plugin name, theme key, language code)."""
import io
import json
import zipfile
from pathlib import Path

from django.conf import settings

KINDS = {"plugins": "plugins", "themas": "theme", "languages": "languages"}  # folder -> the module whose rights decide who may use it
TITLES = {"plugins": "Plugins", "themas": "Thema's", "languages": "Talen"}
ENTRY = {"plugins": "plugin.json", "themas": "theme.json", "languages": "language.json"}


class ResourceError(ValueError):
    pass


def root():
    d = Path(settings.RESOURCE_DIR)
    d.mkdir(parents=True, exist_ok=True)
    for k in KINDS:
        (d / k).mkdir(exist_ok=True)
    return d


def _ver(v):
    from apps.plugins import manifest as mf

    return mf.ver(v)


def _members(zf, entry):
    return sorted(n for n in zf.namelist() if (n == entry or (n.count("/") == 1 and n.endswith("/" + entry))) and "__MACOSX" not in n)


def _read(path, kind):
    """The items in one zip: [{name, title, version, description, author, built_for}]; a bundle holds several."""
    try:
        zf = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError):
        return []
    out = []
    for hit in _members(zf, ENTRY[kind]):
        try:
            d = json.loads(zf.read(hit))
        except ValueError:
            continue
        if kind == "plugins":
            name, title = d.get("name"), d.get("title")
        elif kind == "themas":
            name, title = d.get("key"), d.get("name")
        else:
            name, title = d.get("code"), d.get("native_name") or d.get("name")
        if name:
            out.append({"name": str(name), "title": str(title or name), "version": str(d.get("version") or "1.0.0"), "description": str(d.get("description") or "")[:300], "author": str(d.get("author") or ""),
                        "built_for": str(d.get("system_version") or "")})
    return out


def catalog(kind):
    """The library of one kind: one entry per plugin / theme / language (the latest version), plus the bundles (a zip with several)."""
    if kind not in KINDS:
        raise ResourceError("Onbekend onderdeel.")
    best, bundles = {}, []
    for f in sorted((root() / kind).glob("*.zip")):
        items = _read(f, kind)
        if len(items) > 1:  # all themes / all languages in one zip
            bundles.append({"name": f.stem, "title": f"{TITLES[kind]}: {f.stem}", "version": max((i["version"] for i in items), key=_ver), "description": f"{len(items)} items in één zip", "author": "",
                            "built_for": "", "file": f.name, "size": f.stat().st_size, "bundle": True, "items": [i["name"] for i in items]})
        elif items:
            e = {**items[0], "file": f.name, "size": f.stat().st_size, "bundle": False}
            if e["name"] not in best or _ver(e["version"]) > _ver(best[e["name"]]["version"]):
                best[e["name"]] = e
    return sorted(best.values(), key=lambda e: e["title"].lower()) + bundles


def _installed():
    """kind -> {name: version ('' = built in or unknown)}."""
    from apps.plugins.models import Plugin

    from . import langpacks, themepacks
    from .models import Language

    langs = {}
    for code in Language.objects.values_list("code", flat=True):
        pack = langpacks.installed(code)
        langs[code] = (pack or {}).get("version", "") if pack else ""
    return {"plugins": {p.name: p.version for p in Plugin.objects.all()}, "themas": {t["key"]: t.get("version", "") for t in themepacks.listing()}, "languages": langs}


def allowed():
    f = root() / "allowed.json"
    try:
        d = json.loads(f.read_text())
        return {k: [str(x) for x in d.get(k, [])] for k in KINDS}
    except (OSError, ValueError, AttributeError):
        return {k: [] for k in KINDS}


def set_allowed(data):
    """Write resource/allowed.json (in git: goes along with the product). Only names that are in the library."""
    cur = {}
    for k in KINDS:
        have = {e["name"] for e in catalog(k)}
        cur[k] = sorted({str(x) for x in (data.get(k) or []) if str(x) in have})
    (root() / "allowed.json").write_text(json.dumps(cur, indent=2, ensure_ascii=False) + "\n")
    return cur


def overview(user=None):
    """The library with the state of every item. A user who is not a superadmin only sees what is allowed."""
    inst, ok = _installed(), allowed()
    out = {}
    for kind in KINDS:
        rows = []
        for e in catalog(kind):
            ver = inst[kind].get(e["name"]) if not e["bundle"] else None
            have = e["name"] in inst[kind] if not e["bundle"] else False
            if e["bundle"]:
                state = "bundle"
            elif not have:
                state = "new"
            elif ver and _ver(e["version"]) > _ver(ver):
                state = "update"
            else:
                state = "current"
            row = {**e, "installed": have, "installed_version": ver or "", "state": state, "allowed": e["name"] in ok[kind]}
            if user is not None and not user.is_staff and not row["allowed"]:
                continue
            rows.append(row)
        out[kind] = rows
    return out


def can_use(user, kind):
    from apps.accounts.access import level

    return bool(user and user.is_authenticated and (user.is_staff or level(user, KINDS[kind]) >= 3))


def _zip_bytes(kind, entry):
    f = root() / kind / entry["file"]
    if f.resolve().parent != (root() / kind).resolve():
        raise ResourceError("Onveilig pad.")
    return f.read_bytes()


def install(kind, name, user):
    """Install (or update) one item from the library. Returns what was installed."""
    from apps.plugins import installer, runtime
    from apps.plugins.models import Plugin

    from . import langpacks, themepacks

    if not can_use(user, kind):
        raise ResourceError("Je hebt hier geen rechten voor.")
    entry = next((e for e in catalog(kind) if e["name"] == name), None)
    if not entry:
        raise ResourceError("Dit staat niet in de bibliotheek (map resource).")
    if not user.is_staff and name not in allowed()[kind]:
        raise ResourceError("Dit mag niet zonder superadmin worden geïnstalleerd.")
    data = _zip_bytes(kind, entry)
    try:
        if kind == "plugins":
            p = installer.install_zip(data)
            if Plugin.objects.filter(pk=p.pk, enabled=True).exists():  # an update of a running plugin: load the new code
                err = runtime.load(p)
                if err:
                    Plugin.objects.filter(pk=p.pk).update(error=err, enabled=False)
            return [p.name]
        if kind == "themas":
            return themepacks.install_zip(data)
        return langpacks.install_zip(data)
    except (installer.InstallError, themepacks.ThemeError, langpacks.LanguageError) as e:
        raise ResourceError(str(e))


def update_all(kind, user):
    """Update everything of this kind that is installed and has a newer version in the library. Returns the names."""
    done = []
    for row in overview(user)[kind]:
        if row["state"] == "update" and not (kind == "languages" and not row["installed_version"]):  # (built-in languages are only replaced when asked for by name)
            install(kind, row["name"], user)
            done.append(row["name"])
    return done
