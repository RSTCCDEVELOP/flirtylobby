"""Theme packages: a theme is a folder <THEMES_DIR>/<key>/ with one file, theme.json:

    {"key": "oceaan", "name": "Oceaan", "description": "…", "version": "1.0.0", "system_version": "1.0.0", "mode": null,
     "values": {"primary": "#0ea5e9", …}}          # only the settings of Admin -> Vormgeving that this theme changes

The system itself only has the two house styles (RSTCC, Studio2). Every other theme is a package that a superadmin switches on or off in
Admin -> Themapakketten; switched on = it shows in Admin -> Vormgeving -> Thema's. A package holds data only (colours, fonts, sizes),
checked against the settings of the system, so it cannot run code."""
import base64
import io
import json
import re
import shutil
import zipfile

from django.conf import settings

from apps.plugins import manifest as mf

from . import theme
from .models import ThemePack

IMG_EXT = ("png", "jpg", "jpeg", "webp", "gif", "ico")  # no svg: it can carry script
MAX_IMG = 5 * 1024 * 1024
MAX_HOME = 12
SLOTS = ("logo", "logo_dark", "favicon", "icon", "og_image")  # the same as Admin -> Logo's & beeld (branding.models.SLOTS)
KEY_RE = re.compile(r"^[a-z][a-z0-9-]{1,38}[a-z0-9]$")
MAX_ZIP = 40 * 1024 * 1024


class ThemeError(ValueError):
    pass


def root():
    d = settings.THEMES_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def parse(raw, builtin_ok=False):
    """Validate a theme.json (bytes/str). Returns the clean dict. builtin_ok: the file may belong to a built-in theme (its changed version)."""
    try:
        d = json.loads(raw)
    except (TypeError, ValueError):
        raise ThemeError("theme.json is geen geldige JSON.")
    if not isinstance(d, dict):
        raise ThemeError("theme.json moet een object zijn.")
    key = str(d.get("key") or "").strip()
    if not KEY_RE.match(key):
        raise ThemeError("De sleutel (key) in theme.json is ongeldig (3-40 tekens: a-z, 0-9 en -).")
    if not builtin_ok and key in {p["key"] for p in theme.PRESET_DEFS}:
        raise ThemeError(f"De sleutel {key} is van een ingebouwd thema.")
    values = d.get("values")
    if not isinstance(values, dict) or not values:
        raise ThemeError("theme.json heeft geen values.")
    clean, errors = theme.validate(values)
    if errors:
        raise ThemeError("Ongeldige instellingen in het thema: " + ", ".join(sorted(errors)))
    ver = lambda v: str(v or "0.0.0") if re.fullmatch(r"\d{1,4}\.\d{1,4}\.\d{1,4}", str(v or "0.0.0")) else "0.0.0"  # noqa: E731
    home = [{"file": str(h.get("file")), "caption": str(h.get("caption") or "")[:255]} for h in (d.get("home") or []) if isinstance(h, dict) and re.fullmatch(r"home/[a-z0-9_-]{1,40}\.(%s)" % "|".join(IMG_EXT), str(h.get("file") or ""))][:MAX_HOME]
    return {"key": key, "home": home, "name": str(d.get("name") or key)[:60], "description": str(d.get("description") or "")[:300], "version": ver(d.get("version")),
            "system_version": ver(d.get("system_version")), "mode": d.get("mode") if d.get("mode") in ("light", "dark") else None, "values": clean}


def scan():
    """Register the theme folders; forget rows whose folder is gone. Returns (found, problems)."""
    found, problems, keys = [], [], set()
    for d in sorted(root().iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        try:
            man = parse((d / "theme.json").read_bytes(), builtin_ok=True)
            if man["key"] != d.name:
                raise ThemeError(f"De sleutel in theme.json ({man['key']}) moet gelijk zijn aan de mapnaam ({d.name}).")
        except (OSError, ThemeError) as e:
            problems.append({"folder": d.name, "problem": str(e) if not isinstance(e, OSError) else "theme.json ontbreekt"})
            continue
        man["assets"] = {slot: f.name for slot in SLOTS for f in d.glob(f"{slot}.*") if f.suffix[1:].lower() in IMG_EXT}
        man["home"] = [h for h in man["home"] if (d / h["file"]).is_file()]
        if man["key"] in BUILTIN_KEYS():  # a changed built-in theme: no package row, it replaces the built-in values
            continue
        row, created = ThemePack.objects.get_or_create(key=man["key"], defaults={"manifest": man})
        if not created and row.manifest != man:
            row.manifest = man
            row.save(update_fields=["manifest", "updated_at"])
        keys.add(man["key"])
        found.append(row)
    ThemePack.objects.exclude(key__in=keys).delete()
    return found, problems


def enabled_defs():
    """The switched-on packages in the shape of the built-in themes (PRESET_DEFS)."""
    try:
        scan()
        rows = list(ThemePack.objects.filter(enabled=True))
    except Exception:  # noqa: BLE001 - database not ready (migrations)
        return []
    return [{"key": r.key, "name": r.manifest["name"], "description": r.manifest["description"], "mode": r.manifest.get("mode"), "overrides": r.manifest["values"], "assets": len(r.manifest.get("assets", {})) + len(r.manifest.get("home", []))} for r in rows]


COMPLETE_KEYS = ("header_layout", "header_style", "header_sticky", "menu_style", "footer_layout", "footer_tone", "block_style", "block_gap", "content_w", "tab_style", "system_popup", *[f"ts_{k}_{f}" for k in ("k1", "k2", "k3", "k4", "p") for f in ("size", "weight", "color", "font", "lh", "track")])  # a theme always holds these


def BUILTIN_KEYS():
    return {p["key"] for p in theme.PRESET_DEFS}


def _builtin_file(key):
    return root() / key / "theme.json"


def builtin_manifests():
    """RSTCC and Studio2: the values in the code, unless the superadmin changed them (then <themes>/<key>/theme.json holds the changed version)."""
    out = []
    for p in theme.PRESET_DEFS:
        man = {"key": p["key"], "name": p["name"], "description": p["description"], "version": settings.SYSTEM_VERSION, "system_version": settings.SYSTEM_VERSION, "mode": p.get("mode"), "values": {**{k: theme.DEFAULTS[k] for k in COMPLETE_KEYS}, **p["overrides"]}, "home": [], "customized": False}
        f = _builtin_file(p["key"])
        if f.is_file():
            try:
                c = parse(f.read_bytes(), builtin_ok=True)
                if c["key"] == p["key"]:
                    d = f.parent
                    man.update({k: c[k] for k in ("name", "description", "version", "system_version", "mode", "values", "home")}, customized=True,
                               assets={slot: x.name for slot in SLOTS for x in d.glob(f"{slot}.*") if x.suffix[1:].lower() in IMG_EXT})
            except (OSError, ThemeError):
                pass
        out.append(man)
    return out


def reset_builtin(key):
    """Back to the values that come with the system."""
    if key not in BUILTIN_KEYS():
        raise ThemeError("Alleen een ingebouwd thema kan worden hersteld.")
    shutil.rmtree(root() / key, ignore_errors=True)


def out(man, enabled, builtin):
    v = theme.merged(man["values"])
    return {"key": man["key"], "name": man["name"], "description": man["description"], "version": man["version"], "built_for": man["system_version"], "system_version": settings.SYSTEM_VERSION,
            "compat": mf.compatibility(man["system_version"], settings.SYSTEM_VERSION), "mode": man.get("mode"), "builtin": builtin, "customized": bool(man.get("customized")), "enabled": enabled,
            "colors": {k: v[k] for k in ("primary", "secondary", "light_bg", "light_card", "light_text", "dark_bg", "dark_card", "dark_text")}, "fonts": [v["font_heading"], v["font_body"]],
            "assets": sorted(man.get("assets", {})), "home_count": len(man.get("home", []))}


KEEP = ("remember_collapse", "sidebar_auto", "nav_default", "version_notice", "device_mobile", "device_tablet", "device_desktop", "device_app")  # interface behaviour: a theme changes the look only


def manifest_of(key):
    m = next((m for m in builtin_manifests() if m["key"] == key), None)
    if m:
        return m
    row = ThemePack.objects.filter(key=key).first()
    return row.manifest if row else None


def current_values():
    from .models import SiteSettings

    return theme.merged(SiteSettings.load().theme)


def listing():
    rows = {r.key: r for r in scan()[0]}
    cur = current_values()
    res = [out(m, True, True) for m in builtin_manifests()] + [out(r.manifest, r.enabled, False) for r in rows.values()]
    for r in res:
        vals = theme.merged(manifest_of(r["key"])["values"])
        r["active"] = all(cur[k] == vals[k] for k in manifest_of(r["key"])["values"])
    return res


def use(key, with_files=False):
    """Make this theme the look of the site (the interface behaviour stays as it is); with_files: also its logos and home photos."""
    from .models import SiteSettings

    man = manifest_of(key)
    if not man:
        raise ThemeError("Dit thema bestaat niet.")
    cur = SiteSettings.load()
    old = theme.merged(cur.theme)
    new = theme.merged(man["values"])
    new.update({k: old[k] for k in KEEP if k in old} | {k: old[k] for k in old if k.startswith("chat_")})
    cur.theme = {k: v for k, v in new.items() if v != theme.DEFAULTS[k]}
    cur.save()
    files = apply_files(key) if with_files and (key not in BUILTIN_KEYS() or man.get("customized")) else (0, 0)
    return files


def install_zip(data):
    """Unpack an uploaded zip: one theme (theme.json, or <key>/theme.json) or a bundle with a folder per theme (all-themes). Returns the installed keys.
    In a bundle the built-in themes (RSTCC, Studio2) are skipped; a broken theme stops the whole install before anything is written."""
    if len(data) > MAX_ZIP:
        raise ThemeError("Het zipbestand is te groot voor een thema.")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise ThemeError("Dit is geen geldig zipbestand.")
    names = [n for n in zf.namelist() if not n.endswith("/") and not n.startswith("__MACOSX") and "/__MACOSX" not in n and not n.rsplit("/", 1)[-1].startswith("._")]
    hits = sorted(n for n in names if n == "theme.json" or (n.count("/") == 1 and n.endswith("/theme.json")))
    if not hits:
        raise ThemeError("theme.json ontbreekt in het zipbestand.")
    bundle = len(hits) > 1
    parsed = []
    for hit in hits:
        try:
            man = parse(zf.read(hit))
        except ThemeError as e:
            if bundle and "ingebouwd thema" in str(e):
                continue
            raise ThemeError(f"{hit}: {e}" if bundle else str(e))
        parsed.append((hit, man))
    if not parsed:
        raise ThemeError("Er zit geen installeerbaar thema in het zipbestand.")
    keys = []
    for hit, man in parsed:
        target = root() / man["key"]
        target.mkdir(exist_ok=True)
        base = hit[: -len("theme.json")]
        files = {n[len(base):]: base64.b64encode(zf.read(n)).decode() for n in names if n.startswith(base) and n != hit and zf.getinfo(n).file_size <= MAX_IMG}
        (target / "theme.json").write_text(json.dumps({k: man[k] for k in ("key", "name", "description", "version", "system_version", "mode", "values", "home")}, indent=2, ensure_ascii=False) + "\n")
        write_files_b64(man["key"], files)
        keys.append(man["key"])
    scan()
    return keys


def _add_theme(z, key, top=True):
    """The files of one theme into an open zip: <key>/theme.json (+ its pictures when it is a package or a changed built-in theme)."""
    man = next((m for m in builtin_manifests() if m["key"] == key), None)
    if man:
        raw = json.dumps(man, indent=2, ensure_ascii=False)
    else:
        f = root() / key / "theme.json"
        if not KEY_RE.match(key) or not f.is_file():
            return False
        raw = f.read_text()
    z.writestr(f"{key}/theme.json", raw)
    if not man or man.get("customized"):
        for name, b64 in files_b64(key).items():
            z.writestr(f"{key}/{name}", base64.b64decode(b64))
    return True


def as_zip(key):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        if not _add_theme(z, key):
            return None
    return buf.getvalue()


def all_keys():
    scan()
    return [m["key"] for m in builtin_manifests()] + [r.key for r in ThemePack.objects.order_by("key")]


def as_zip_all():
    """ALL themes in one zip (one folder per theme): the built-in ones and every package. Import it again with "Pakket uploaden"."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for key in all_keys():
            _add_theme(z, key)
    return buf.getvalue()


def dist_dir():
    """<themes>/.dist: a zip of every theme (and of all themes together) to import elsewhere. The themes folder is not part of the repository, so neither is this."""
    d = root() / ".dist"
    d.mkdir(exist_ok=True)
    return d


def build_dist():
    """Write <themes>/.dist/<key>-<version>.zip for every theme and alle-themas.zip. Old versions of a zip stay. Returns the names."""
    out = []
    for key in all_keys():
        man = manifest_of(key)
        raw = as_zip(key)
        if raw and man:
            name = f"{key}-{man['version']}.zip"
            (dist_dir() / name).write_bytes(raw)
            out.append(name)
    (dist_dir() / "alle-themas.zip").write_bytes(as_zip_all())
    return out + ["alle-themas.zip"]


def remove(key):
    if KEY_RE.match(key):
        shutil.rmtree(root() / key, ignore_errors=True)
    ThemePack.objects.filter(key=key).delete()


# ── the files of a package: logos, favicon, … and the home photos ───────────────
def _dir(key):
    if key in BUILTIN_KEYS() and not _builtin_file(key).is_file():  # the first change of a built-in theme: its values go into a file that can be edited
        man = next(m for m in builtin_manifests() if m["key"] == key)
        (root() / key).mkdir(exist_ok=True)
        _builtin_file(key).write_text(json.dumps({k: man[k] for k in ("key", "name", "description", "version", "system_version", "mode", "values", "home")}, indent=2, ensure_ascii=False) + "\n")
    if not KEY_RE.match(key) or not (root() / key / "theme.json").is_file():
        raise ThemeError("Dit themapakket bestaat niet.")
    return root() / key


def _doc(key):
    return json.loads((_dir(key) / "theme.json").read_text())


def _save_doc(key, doc):
    keep = ("key", "name", "description", "version", "system_version", "mode", "values", "home")
    (_dir(key) / "theme.json").write_text(json.dumps({k: doc[k] for k in keep if k in doc}, indent=2, ensure_ascii=False) + "\n")
    scan()


def check_image(raw, name=""):
    """The extension of a valid raster picture (png, jpg, …), or raises ThemeError."""
    from PIL import Image, UnidentifiedImageError

    if len(raw) > MAX_IMG:
        raise ThemeError("Bestand is te groot (maximaal 5 MB).")
    try:
        im = Image.open(io.BytesIO(raw))
        im.verify()
        fmt = (im.format or "").lower()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ThemeError("Dit is geen geldige afbeelding.")
    ext = {"jpeg": "jpg", "png": "png", "webp": "webp", "gif": "gif", "ico": "ico"}.get(fmt)
    if not ext:
        raise ThemeError("Gebruik PNG, JPG, WebP, GIF of ICO.")
    return ext


def set_slot(key, slot, raw):
    if slot not in SLOTS:
        raise ThemeError("Onbekend onderdeel.")
    ext = check_image(raw)
    d = _dir(key)
    clear_slot(key, slot)
    (d / f"{slot}.{ext}").write_bytes(raw)
    scan()


def clear_slot(key, slot):
    d = _dir(key)
    for f in d.glob(f"{slot}.*"):
        f.unlink()
    scan()


def add_home(key, raw, caption=""):
    d, doc = _dir(key), _doc(key)
    if len(doc.get("home", [])) >= MAX_HOME:
        raise ThemeError(f"Maximaal {MAX_HOME} foto's.")
    ext = check_image(raw)
    (d / "home").mkdir(exist_ok=True)
    n = 1 + max([int(re.sub(r"\D", "", h["file"].split("/")[1]) or 0) for h in doc.get("home", [])] or [0])
    name = f"home/{n:02d}.{ext}"
    (d / name).write_bytes(raw)
    doc["home"] = [*doc.get("home", []), {"file": name, "caption": str(caption)[:255]}]
    _save_doc(key, doc)


def remove_home(key, index):
    d, doc = _dir(key), _doc(key)
    home = doc.get("home", [])
    if not 0 <= index < len(home):
        raise ThemeError("Deze foto bestaat niet.")
    (d / home[index]["file"]).unlink(missing_ok=True)
    doc["home"] = home[:index] + home[index + 1:]
    _save_doc(key, doc)


def update_meta(key, data):
    doc = _doc(key)
    for k, n in (("name", 60), ("description", 300)):
        if k in data:
            doc[k] = str(data[k] or "").strip()[:n] or doc[k]
    if "version" in data:
        doc["version"] = parse(json.dumps({**doc, "version": data["version"]}))["version"]
    if "mode" in data:
        doc["mode"] = data["mode"] if data["mode"] in ("light", "dark") else None
    if isinstance(data.get("values"), dict):  # the settings of the theme itself (colours, fonts, shapes, page templates …)
        merged = {**doc["values"], **{k: v for k, v in data["values"].items() if k in theme.FIELDS}}
        clean, errors = theme.validate(merged)
        if errors:
            raise ThemeError("Ongeldige instellingen: " + ", ".join(sorted(errors)))
        doc["values"] = {k: v for k, v in clean.items() if k in merged}
    if isinstance(data.get("home"), list):  # captions of the home photos, same order
        for h, c in zip(doc.get("home", []), data["home"]):
            h["caption"] = str((c or {}).get("caption") or "")[:255]
    _save_doc(key, doc)


def data_urls(key):
    """For the edit screen: the pictures of the package as data urls."""
    d, doc = _dir(key), _doc(key)

    def url(f):
        mime = "image/x-icon" if f.suffix.lower() == ".ico" else "image/" + ("jpeg" if f.suffix.lower() in (".jpg", ".jpeg") else f.suffix[1:].lower())
        return f"data:{mime};base64," + base64.b64encode(f.read_bytes()).decode()

    slots = {slot: {"file": f.name, "url": url(f)} for slot in SLOTS for f in d.glob(f"{slot}.*") if f.suffix[1:].lower() in IMG_EXT}
    home = [{"file": h["file"], "caption": h["caption"], "url": url(d / h["file"])} for h in doc.get("home", []) if (d / h["file"]).is_file()]
    return {"slots": slots, "home": home, "values": theme.merged(doc["values"])}


def create(name, from_current=False):
    """A new package (empty, or with the colours, fonts, logos and home photos of the site as they are now)."""
    key = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")[:38] or "thema"
    if len(key) < 3:
        key += "-thema"
    base, n = key, 2
    taken = {p["key"] for p in theme.PRESET_DEFS}
    while key in taken or (root() / key).exists():
        key, n = f"{base}-{n}", n + 1
    (root() / key).mkdir()
    (root() / key / "theme.json").write_text(json.dumps({"key": key, "name": name.strip()[:60] or key, "description": "", "version": "1.0.0", "system_version": settings.SYSTEM_VERSION, "mode": None,
                                                         "values": {"primary": theme.DEFAULTS["primary"]}, "home": []}, indent=2, ensure_ascii=False) + "\n")
    scan()
    if from_current:
        capture(key)
    return key


def capture(key):
    """Put the look of the site as it is now into the package: all theme settings, the logos and the home photos."""
    from apps.branding.models import HomePhoto, SiteAsset

    from .models import SiteSettings

    d, doc = _dir(key), _doc(key)
    cur = theme.merged(SiteSettings.load().theme)
    values = dict(SiteSettings.load().theme) or {"primary": theme.DEFAULTS["primary"]}
    for k in ("header_layout", "header_style", "header_sticky", "menu_style", "footer_layout", "footer_tone", "block_style", "block_gap", "content_w", "tab_style", "system_popup"):
        values[k] = cur[k]  # a package always holds the complete page templates
    for slot in SLOTS:
        clear_slot(key, slot)
    for a in SiteAsset.objects.filter(slot__in=SLOTS):
        try:
            raw = a.image.read() if a.image.closed is False else a.image.open("rb").read()
            a.image.close()
            (d / f"{a.slot}.{check_image(raw)}").write_bytes(raw)
        except Exception:  # noqa: BLE001 - a missing file must not stop the rest
            continue
    shutil.rmtree(d / "home", ignore_errors=True)
    (d / "home").mkdir()
    home = []
    for i, p in enumerate(HomePhoto.objects.all()[:MAX_HOME], 1):
        try:
            raw = p.image.open("rb").read()
            p.image.close()
            name = f"home/{i:02d}.{check_image(raw)}"
            (d / name).write_bytes(raw)
            home.append({"file": name, "caption": p.caption})
        except Exception:  # noqa: BLE001
            continue
    doc["values"], doc["home"] = values, home
    _save_doc(key, doc)


def apply_files(key):
    """Use the logos and home photos of the package for the site (they replace the current ones). Returns (slots, photos)."""
    from django.core.files.base import ContentFile

    from apps.branding.models import HomePhoto, SiteAsset
    from apps.medialib import service

    d, doc = _dir(key), _doc(key)
    n = 0
    for slot in SLOTS:
        f = next((x for x in d.glob(f"{slot}.*") if x.suffix[1:].lower() in IMG_EXT), None)
        if not f:
            continue
        a = SiteAsset.objects.filter(slot=slot).first() or SiteAsset(slot=slot)
        old = a.image.name if a.pk else ""
        a.image.save(f"{key}-{f.name}", ContentFile(f.read_bytes()))
        if old:
            service.release(old)
        n += 1
    photos = [h for h in doc.get("home", []) if (d / h["file"]).is_file()]
    m = 0
    if photos:
        for p in list(HomePhoto.objects.all()):
            name = p.image.name
            p.delete()
            service.release(name)
        for i, h in enumerate(photos):
            p = HomePhoto(caption=h["caption"], order=i)
            p.image.save(f"{key}-{_base(h['file'])}", ContentFile((d / h["file"]).read_bytes()))
            m += 1
    return n, m


def _base(p):
    return p.rsplit("/", 1)[-1]


def files_b64(key):
    """Every file of a package (besides theme.json) as {name: base64}, for the settings back-up."""
    d = _dir(key)
    return {f.relative_to(d).as_posix(): base64.b64encode(f.read_bytes()).decode() for f in d.rglob("*") if f.is_file() and f.name != "theme.json" and f.suffix[1:].lower() in IMG_EXT}


def write_files_b64(key, files):
    d = _dir(key)
    for name, b64 in (files or {}).items():
        if not re.fullmatch(r"((%s)|home/[a-z0-9_-]{1,40})\.(%s)" % ("|".join(SLOTS), "|".join(IMG_EXT)), name):
            continue
        raw = base64.b64decode(b64)
        check_image(raw)
        (d / name).parent.mkdir(exist_ok=True)
        (d / name).write_bytes(raw)
    scan()
