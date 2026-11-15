# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Component sets: sets of ready-made easy2edit objects (components), like theme packages. A set is one zip, <key>-<version>.zip, with
- components.json: {"key", "name", "description", "version", "author", "components": [{"easy2edit_tag", "name", "description", "group", "category", "html"}]}
- components.css: the css of the components (it uses the tokens --e2e-*, which easy2edit fills with the colours, fonts and corners of the theme in use)
- components.js: optional, the script that the components need (tabs, calendar, kanban, players ...)
The library of the product is resource/components (in git); a set is installed on a site by copying it to the components folder of the site. The FIRST set (DEFAULT_KEY,
the easy2edit UI-kit) is installed with every installation and stays in use until another one is chosen. Every component has an easy2edit_tag: the name that exports,
imports, designs and AI prompts use for it."""
import json
import re
import shutil
import zipfile
from pathlib import Path

from django.conf import settings

DEFAULT_KEY = "easy2edit-ui-kit"
KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{1,59}$")
TAG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,59}$")
_cache = {}


class ComponentError(ValueError):
    pass


def library_dir():
    return Path(settings.RESOURCE_DIR) / "components"


def site_dir():
    d = Path(settings.COMPONENTS_DIR)
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    return d


def _ver(v):
    from apps.plugins import manifest as mf

    return mf.ver(v)


def read(path, full=True):
    """One set from its zip: the manifest, and (full) the css, the script and the components. Raises ComponentError when it is not a set."""
    try:
        zf = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError):
        raise ComponentError("Dit is geen componentenset (geen geldig zipbestand).")
    with zf:
        names = {n.split("/")[-1]: n for n in zf.namelist() if "__MACOSX" not in n and not n.endswith("/")}
        if "components.json" not in names:
            raise ComponentError("In de zip staat geen components.json.")
        try:
            d = json.loads(zf.read(names["components.json"]))
        except ValueError:
            raise ComponentError("components.json is geen geldige JSON.")
        key = str(d.get("key") or "")
        if not KEY_RE.match(key):
            raise ComponentError("De set heeft geen geldige key (letters, cijfers, - en _).")
        comps = []
        for c in d.get("components") or []:
            if isinstance(c, dict) and TAG_RE.match(str(c.get("easy2edit_tag") or "")) and str(c.get("html") or "").strip():
                comps.append({"easy2edit_tag": c["easy2edit_tag"], "name": str(c.get("name") or c["easy2edit_tag"])[:80], "description": str(c.get("description") or "")[:300],
                              "group": str(c.get("group") or "")[:60], "category": str(c.get("category") or "")[:60], "html": str(c["html"])[:100000]})
        if not comps:
            raise ComponentError("De set bevat geen componenten.")
        tags = [c["easy2edit_tag"] for c in comps]
        if len(set(tags)) != len(tags):
            raise ComponentError("Een easy2edit_tag komt dubbel voor in de set.")
        out = {"key": key, "name": str(d.get("name") or key)[:80], "description": str(d.get("description") or "")[:400], "version": str(d.get("version") or "1.0.0"),
               "author": str(d.get("author") or "")[:80], "count": len(comps), "groups": sorted({c["group"] for c in comps if c["group"]})}
        if full:
            out.update({"css": zf.read(names["components.css"]).decode("utf-8", "replace") if "components.css" in names else "",
                        "runtime": zf.read(names["components.js"]).decode("utf-8", "replace") if "components.js" in names else "", "components": comps})
        return out


def _zips(folder):
    out = {}
    for f in sorted(Path(folder).glob("*.zip")):
        try:
            m = read(f, full=False)
        except ComponentError:
            continue
        if m["key"] not in out or _ver(m["version"]) > _ver(out[m["key"]][1]["version"]):
            out[m["key"]] = (f, m)
    return out


def ensure_default():
    """The standard set is installed on every site (copied from the library) when it is not there yet."""
    lib, site = _zips(library_dir()), _zips(site_dir())
    if DEFAULT_KEY not in site and DEFAULT_KEY in lib:
        try:
            shutil.copy2(lib[DEFAULT_KEY][0], site_dir() / lib[DEFAULT_KEY][0].name)
        except OSError:
            pass


def active_key():
    from .models import SiteSettings

    k = SiteSettings.load().component_set or DEFAULT_KEY
    return k if k in installed_map() or k == DEFAULT_KEY else DEFAULT_KEY


def installed_map():
    ensure_default()
    m = {k: v for k, v in _zips(site_dir()).items()}
    if DEFAULT_KEY not in m:  # (the site folder cannot be written to: the standard set is read from the library)
        lib = _zips(library_dir())
        if DEFAULT_KEY in lib:
            m[DEFAULT_KEY] = lib[DEFAULT_KEY]
    return m


def get(key=None):
    """A set with everything (css, script, components); key None = the set in use. Raises ComponentError when it does not exist."""
    key = key or active_key()
    m = installed_map()
    if key not in m:
        lib = _zips(library_dir())
        if key not in lib:
            raise ComponentError("Deze componentenset bestaat niet.")
        m = lib
    path = m[key][0]
    stamp = (str(path), path.stat().st_mtime)
    if _cache.get(key, (None,))[0] != stamp:
        _cache[key] = (stamp, read(path))
    return _cache[key][1]


def listing():
    """What an admin sees: the sets on this site (with which one is in use) and the sets in the library that can still be installed."""
    inst, lib, act = installed_map(), _zips(library_dir()), active_key()
    return {"active": act, "default": DEFAULT_KEY,
            "installed": [{**m, "active": k == act, "default": k == DEFAULT_KEY} for k, (f, m) in sorted(inst.items(), key=lambda kv: (kv[0] != DEFAULT_KEY, kv[1][1]["name"].lower()))],
            "library": [{**m, "file": f.name, "installed": k in inst, "update": k in inst and _ver(m["version"]) > _ver(inst[k][1]["version"])} for k, (f, m) in sorted(lib.items(), key=lambda kv: kv[1][1]["name"].lower())]}


def install(key):
    lib = _zips(library_dir())
    if key not in lib:
        raise ComponentError("Deze componentenset staat niet in de bibliotheek.")
    f = lib[key][0]
    for old in site_dir().glob("*.zip"):  # only the latest version of a set is kept
        try:
            if read(old, full=False)["key"] == key:
                old.unlink()
        except (ComponentError, OSError):
            pass
    shutil.copy2(f, site_dir() / f.name)
    _cache.pop(key, None)
    return get(key)


def install_upload(upload):
    """A set that was made elsewhere: a zip with components.json (and css / script)."""
    import tempfile

    if getattr(upload, "size", 0) > 8 * 2**20:
        raise ComponentError("De zip is te groot (max. 8 MB).")
    with tempfile.NamedTemporaryFile(suffix=".zip") as tmp:
        for chunk in upload.chunks():
            tmp.write(chunk)
        tmp.flush()
        m = read(tmp.name, full=False)
        for old in site_dir().glob("*.zip"):
            try:
                if read(old, full=False)["key"] == m["key"]:
                    old.unlink()
            except (ComponentError, OSError):
                pass
        shutil.copy2(tmp.name, site_dir() / f"{m['key']}-{m['version']}.zip")
    _cache.pop(m["key"], None)
    return get(m["key"])


def remove(key):
    if key == DEFAULT_KEY:
        raise ComponentError("De standaardset kan niet worden verwijderd.")
    if key == active_key():
        raise ComponentError("Deze set is in gebruik. Kies eerst een andere set.")
    n = 0
    for f in site_dir().glob("*.zip"):
        try:
            if read(f, full=False)["key"] == key:
                f.unlink()
                n += 1
        except (ComponentError, OSError):
            pass
    _cache.pop(key, None)
    if not n:
        raise ComponentError("Deze set staat niet op deze website.")


def activate(key):
    from .models import SiteSettings

    if key not in installed_map():
        raise ComponentError("Installeer de set eerst.")
    s = SiteSettings.load()
    s.component_set = "" if key == DEFAULT_KEY else key  # "" = the standard set
    s.save(update_fields=["component_set"])
    return get(key)


def rules_text(key=None):
    """The part of the rules of the AI (designer, prompts) about the components of a set: use data-easy2edit-tag with one of these tags."""
    try:
        s = get(key)
    except ComponentError:
        return ""
    lines = "\n".join(f"- {c['easy2edit_tag']}: {c['name']} [{c['group']}] - {c['description']}" for c in s["components"])
    return ("COMPONENTS: easy2edit has ready-made components, the set \"" + s["name"] + "\" (the classes e2e-*). ALWAYS use them when a part of a page is one of them: wrap it in "
            "<div data-easy2edit-tag=\"TAG\"> ... </div> with the exact tag and write the component with its e2e-* classes and structure; easy2edit draws it with the colours, fonts "
            "and corners of the theme (so no colours of your own in it). Tags:\n" + lines)
