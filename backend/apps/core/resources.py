# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The library: the zips that come with the product in the folder resource/ (in git): resource/plugins, resource/themas and resource/languages. Only the latest version of each is kept.

From here a superadmin (or, for what is ticked in resource/allowed.json, anybody who may manage that part) can add a plugin, theme or language without uploading a file, and update
what is installed. `resource/allowed.json` says which ones may be installed by others: {"plugins": [...], "themas": [...], "languages": [...]} (names: plugin name, theme key, language code)."""
import io
import json
import re
import zipfile
from pathlib import Path

from django.conf import settings

KINDS = {"plugins": "plugins", "themas": "theme", "languages": "languages", "components": "pages", "templates": "pages"}  # folder -> the module whose rights decide who may use it
TITLES = {"plugins": "Plugins", "themas": "Thema's", "languages": "Talen", "components": "Componenten", "templates": "Templates"}
ENTRY = {"plugins": "plugin.json", "themas": "theme.json", "languages": "language.json", "components": "components.json", "templates": "template.json"}


class ResourceError(ValueError):
    pass


class SourceUnavailable(ResourceError):
    """The easy2edit server cannot give the library. reason: "disabled" (the site manager is not switched on there), "refused" (this website is not known or is blocked), "unreachable"."""

    def __init__(self, reason, message):
        super().__init__(message)
        self.reason = reason


# ── the library from the easy2edit server ───────────────────────────────────
MAX_ZIP = 80_000_000


def _remote_call(path, params, prefix="source/"):
    """GET on the easy2edit server with the key of this website (it registers first when it has none). -> bytes."""
    import urllib.error
    import urllib.parse
    import urllib.request

    from . import global_settings, sitemanager

    if sitemanager._state().get("disconnected"):
        raise SourceUnavailable("disconnected", "Deze website is ontkoppeld van de easy2edit-server.")
    key = sitemanager._state().get("token") or ""
    if not key:
        sitemanager.report("sync")  # the first time: this website reports itself and gets its key
        key = sitemanager._state().get("token") or ""
    if not key:  # (the server answered nothing or does not accept registrations: the site manager is not switched on there, or it cannot be reached)
        raise SourceUnavailable(_why(), "Deze website is nog niet aangemeld bij de easy2edit-server.")
    url = f"{global_settings.get()['api_url']}/api/easy2edit/{prefix}{path}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"X-Easy2edit-Key": key, "User-Agent": "easy2edit-site"}), timeout=30) as r:
            return r.read(MAX_ZIP + 1)
    except urllib.error.HTTPError as e:
        if e.code == 404:  # the easy2edit server does not have the site manager switched on
            raise SourceUnavailable("disabled", "De easy2edit-server heeft de site manager niet ingeschakeld.")
        if e.code == 403:
            try:
                why = json.loads(e.read(2000).decode("utf-8", "ignore")).get("reason")
            except (ValueError, OSError):
                why = ""
            if why == "pending":  # known, but not approved yet: the key stays
                raise SourceUnavailable("pending", "Deze website is nog niet goedgekeurd door de easy2edit-server.")
        if e.code in (401, 403):
            sitemanager._save(token="")  # the key is not known any more: register again next time
            raise SourceUnavailable("refused", "De easy2edit-server kent deze website niet of heeft hem geblokkeerd.")
        raise SourceUnavailable("unreachable", f"De easy2edit-server gaf een fout (HTTP {e.code}).")
    except Exception:  # noqa: BLE001
        raise SourceUnavailable("unreachable", "De easy2edit-server is niet bereikbaar.")


def _why():
    """Why the registration at the easy2edit server did not work (from what the last report said)."""
    from . import sitemanager

    err = str(sitemanager._state().get("last_error") or "")
    return "disabled" if "404" in err else "refused" if ("401" in err or "403" in err) else "unreachable"


def remote_catalog(kind):
    """The library of the easy2edit server for one kind (kept for five minutes)."""
    from django.core.cache import cache

    ck = f"e2e-source:{kind}"
    rows = cache.get(ck)
    if rows is None:
        try:
            rows = json.loads(_remote_call("", {"kind": kind}).decode("utf-8")).get("items") or []
        except SourceUnavailable as e:
            cache.set("e2e-source-error", e.reason, 120)  # the library shows a quiet note about it
            raise
        except (json.JSONDecodeError, UnicodeDecodeError):  # (not ValueError: a ResourceError is one too, and has its own message)
            cache.set("e2e-source-error", "unreachable", 120)
            raise SourceUnavailable("unreachable", "Onverwacht antwoord van de easy2edit-server.")
        cache.delete("e2e-source-error")
        cache.set(ck, rows, 300)
    return [{**e, "origin": "easy2edit"} for e in rows if isinstance(e, dict) and e.get("name") and e.get("file")]


def remote_file(kind, file):
    data = _remote_call("file/", {"kind": kind, "file": file})
    if len(data) > MAX_ZIP or data[:2] != b"PK":
        raise ResourceError("Het bestand van de easy2edit-server is geen geldige zip.")
    return data


def test_source():
    """Reach the library of the easy2edit server: -> (ok, message)."""
    from django.core.cache import cache

    cache.delete_many([f"e2e-source:{k}" for k in KINDS])
    try:
        n = sum(len(remote_catalog(k)) for k in KINDS)
    except SourceUnavailable as e:
        return False, e.reason
    except ResourceError as e:
        return False, "unreachable"
    return True, f"{n}"


def source_state():
    """{remote, error}: for the library screen: is the source the easy2edit server, and did the last call fail (disabled | refused | unreachable)."""
    from django.core.cache import cache

    return {"remote": remote(), "error": (cache.get("e2e-source-error") or "") if remote() else ""}


def root():
    d = Path(settings.RESOURCE_DIR)
    for p in [d, *[d / k for k in KINDS]]:  # (a library on a read-only mount, as in Coolify, cannot be written to: only make what is missing, and do not stop when that is not possible)
        if not p.is_dir():
            try:
                p.mkdir(parents=True, exist_ok=True)
            except OSError:
                pass
    return d


def site_dir(kind):
    """The folder of THIS site where packages that were made here are kept (themes: site/themes/<key>-<version>.zip), or None. The library resource/ belongs to the product (in git) and is only read."""
    if kind not in ("themas", "templates"):
        return None
    d = Path(settings.THEMES_DIR if kind == "themas" else settings.TEMPLATES_DIR)
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    return d


def _folders(kind, site=True, product=True):
    """[(origin, folder)] the packages of this kind are read from: first the site, then the library of the product."""
    out = [("site", site_dir(kind))] if (site and site_dir(kind)) else []
    return out + ([("product", root() / kind)] if product else [])


def remote():
    """True when the library comes from the easy2edit server (Super admin+ -> easy2edit management -> Settings): then the folder resource/ of this installation is not read. The server itself always uses its own folder."""
    from . import global_settings, sitemanager

    try:
        return global_settings.get()["source_mode"] == "easy2edit" and not sitemanager.server_enabled()
    except Exception:  # noqa: BLE001 - database not ready
        return False


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
        elif kind in ("themas", "components", "templates"):
            name, title = d.get("key"), d.get("name")
        else:
            name, title = d.get("code"), d.get("native_name") or d.get("name")
        preview = None
        if kind == "themas" and isinstance(d.get("values"), dict):  # the colours and fonts, so the library can show what the theme looks like
            v = d["values"]
            g = lambda k, dflt: str(v.get(k) or dflt) if re.fullmatch(r"#[0-9a-fA-F]{3,8}", str(v.get(k) or dflt)) else dflt  # noqa: E731
            preview = {"primary": g("primary", "#f2823f"), "secondary": g("secondary", "#939497"), "mode": d.get("mode") if d.get("mode") in ("light", "dark") else None,
                       "light": {"page": g("light_page", "#ffffff"), "card": g("light_card", "#ffffff"), "line": g("light_line", "#e6e6e6"), "text": g("light_text", "#222222"), "muted": g("light_muted", "#777777")},
                       "dark": {"page": g("dark_page", "#1c1c1d"), "card": g("dark_card", "#242425"), "line": g("dark_line", "#3a3a3b"), "text": g("dark_text", "#f1f1f1"), "muted": g("dark_muted", "#a0a1a4")},
                       "font": str(v.get("font_heading") or v.get("font_body") or "")[:40], "radius": v.get("radius") if isinstance(v.get("radius"), (int, float)) else 8}
        if name:
            out.append({"preview": preview, "name": str(name), "title": str(title or name), "version": str(d.get("version") or "1.0.0"), "description": str(d.get("description") or "")[:300], "author": str(d.get("author") or ""),
                        "built_for": str(d.get("system_version") or "")})
    return out


def catalog(kind, strict=False):
    """The library of one kind: one entry per plugin / theme / language (the latest version), plus the bundles (a zip with several). From the easy2edit server when the source is set to that.
    strict: raise SourceUnavailable when the server cannot be reached (installing, updating); otherwise (showing the library) the library is just what was made on this site."""
    if kind not in KINDS:
        raise ResourceError("Onbekend onderdeel.")
    if not remote():
        return local_catalog(kind)
    try:
        theirs = remote_catalog(kind)
    except SourceUnavailable:
        if strict:
            raise
        theirs = []
    rows = [e for e in local_catalog(kind, product=False)] + theirs  # what was made on this site, and the library of the easy2edit server
    best, bundles = {}, []
    for e in rows:
        if e["bundle"]:
            bundles.append(e)
        elif e["name"] not in best or _ver(e["version"]) > _ver(best[e["name"]]["version"]):  # (the site comes first: at an equal version its own package wins)
            best[e["name"]] = e
    return sorted(best.values(), key=lambda e: e["title"].lower()) + bundles


def local_catalog(kind, site=True, product=True):
    """The library of one kind read from the folders of this installation (site = what was made here, product = the folder resource/)."""
    best, bundles = {}, []
    for origin, folder in _folders(kind, site, product):
        for f in sorted(folder.glob("*.zip")):
            items = _read(f, kind)
            if len(items) > 1:  # all themes / all languages in one zip
                bundles.append({"name": f.stem, "title": f"{TITLES[kind]}: {f.stem}", "version": max((i["version"] for i in items), key=_ver), "description": f"{len(items)} items in één zip", "author": "",
                                "built_for": "", "file": f.name, "size": f.stat().st_size, "bundle": True, "items": [i["name"] for i in items], "origin": origin})
            elif items:
                e = {**items[0], "file": f.name, "size": f.stat().st_size, "bundle": False, "origin": origin}
                if e["name"] not in best or _ver(e["version"]) > _ver(best[e["name"]]["version"]):  # (the site comes first: at an equal version its own package wins)
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
    from . import componentpacks

    try:
        comps = {k: m.get("version", "") for k, (_f, m) in componentpacks.installed_map().items()}
    except Exception:  # noqa: BLE001 - the library must stay readable
        comps = {}
    try:  # a template is not installed: what is in the library is there to use
        from . import templatepacks

        temps = {k: m["version"] for k, (_f, m, _o) in templatepacks.all_templates().items()}
    except Exception:  # noqa: BLE001
        temps = {}
    return {"templates": temps, "components": comps, "plugins": {p.name: p.version for p in Plugin.objects.all()}, "themas": {t["key"]: t.get("version", "") for t in themepacks.listing()}, "languages": langs}


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


def overview(user=None, strict=False):
    """The library with the state of every item. A user who is not a superadmin only sees what is allowed."""
    inst, ok = _installed(), allowed()
    out = {}
    for kind in KINDS:
        rows = []
        for e in catalog(kind, strict=strict):
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
    if entry.get("origin") == "easy2edit":
        return remote_file(kind, entry["file"])
    folder = dict(_folders(kind)).get(entry.get("origin") or "product") or (root() / kind)
    f = folder / entry["file"]
    if f.resolve().parent != folder.resolve():
        raise ResourceError("Onveilig pad.")
    return f.read_bytes()


def install(kind, name, user):
    """Install (or update) one item from the library. Returns what was installed."""
    from apps.plugins import installer, runtime
    from apps.plugins.models import Plugin

    from . import componentpacks, langpacks, themepacks

    if not can_use(user, kind):
        raise ResourceError("Je hebt hier geen rechten voor.")
    if kind == "templates":
        raise ResourceError("Een template gebruik je bij Admin → Website → Templates.")
    entry = next((e for e in catalog(kind, strict=True) if e["name"] == name), None)  # (strict: an easy2edit server that does not answer is a clear message, not "not in the library")
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
        if kind == "components":
            return [componentpacks.install(name, data=data if entry.get("origin") == "easy2edit" else None)["key"]]
        return langpacks.install_zip(data)
    except (installer.InstallError, themepacks.ThemeError, langpacks.LanguageError, componentpacks.ComponentError) as e:
        raise ResourceError(str(e))


# the demo data of the system itself that belongs to a plugin (the parts of demo.remove_parts): the FAQ questions, the plans and the donation campaigns
DEMO_PARTS_OF = {"faq": ["faq"], "subscriptions": ["plans", "money"]}


def demo_of(name):
    """How much demo data this plugin holds (its own, and what the system made for it). 0 = none."""
    from . import demo

    n = 0
    try:
        for pname, p in demo._plugins_named({name}):
            n += sum(int(v) for v in (p.counts() or {}).values())
        if name == "faq":
            n += len(demo._ids("faq"))
        if name == "subscriptions":
            n += len(demo._ids("plans")) + len(demo._ids("campaigns"))
    except Exception:  # noqa: BLE001 - a check must never stop a removal
        pass
    return n


def remove(kind, name, user, with_demo=False):
    """Take an installed plugin away (its folder and its settings; the data of the plugin stays in the database). For superadmins and for administrators who manage plugins."""
    from apps.plugins import installer, runtime
    from apps.plugins.models import Plugin

    if kind != "plugins":
        raise ResourceError("Verwijderen kan alleen bij plugins.")
    if not can_use(user, kind):
        raise ResourceError("Je hebt hier geen rechten voor.")
    p = Plugin.objects.filter(name=name).first()
    if not p:
        raise ResourceError("Deze plugin is niet geïnstalleerd.")
    need = runtime.dependents(p.name)
    if need:
        raise ResourceError("Eerst deze plugins uitzetten of verwijderen: " + ", ".join(need) + ". Zij hebben deze plugin nodig.")
    if with_demo:  # the demo data of this plugin goes first (while the plugin is still on)
        from . import demo

        try:
            demo.remove_parts([f"plugin:{name}", *DEMO_PARTS_OF.get(name, [])])
        except Exception:  # noqa: BLE001
            raise ResourceError("De demo-gegevens van deze plugin konden niet worden verwijderd.")
    runtime.unload(p.name)
    installer.remove(p)
    return [name]


def update_all(kind, user):
    """Update everything of this kind that is installed and has a newer version in the library. Returns the names."""
    done = []
    for row in overview(user, strict=True)[kind]:
        if row["state"] == "update" and not (kind == "languages" and not row["installed_version"]):  # (built-in languages are only replaced when asked for by name)
            install(kind, row["name"], user)
            done.append(row["name"])
    return done


# ── making and removing themes of the library ────────────────────────────────
THEME_KEYS = ["primary", "secondary", "light_page", "light_bg", "light_card", "light_hover", "light_line", "light_text", "light_muted",
              "dark_page", "dark_bg", "dark_card", "dark_hover", "dark_line", "dark_text", "dark_muted", "font_body", "font_heading", "radius", "btn_radius", "shadow",
              "header_layout", "header_style", "header_sticky", "header_sticky_unit", "header_sticky_pct", "header_sticky_px", "header_side", "header_side_unit", "header_side_pct", "header_side_px", "page_start", "hero_start", "menu_style", "footer_layout", "footer_tone", "footer_brand", "block_style", "block_gap", "content_w", "heading_weight", "tab_style", "system_popup"]


def _slug(name):
    import re as _re
    import unicodedata

    s = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    s = _re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:30].strip("-")
    return s if len(s) >= 3 else "thema"


def make_theme(prompt, mode=""):
    """Claude designs a theme from the description; it is checked like any theme package and put in the library as <key>-1.0.0.zip. Returns the manifest."""
    from apps.integrations import ai

    from . import theme, themeimport, themepacks

    prompt = str(prompt or "").strip()[:1500]
    if len(prompt) < 3:
        raise ResourceError("Beschrijf eerst het thema dat je wilt, bijvoorbeeld: een warm, rustig thema voor een bloemenwinkel.")
    if not ai.available():
        raise ResourceError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    spec = []
    for k in THEME_KEYS:
        f = theme.FIELDS.get(k)
        if not f:
            continue
        spec.append(f"{k}: " + ("hex colour #rrggbb" if f["type"] == "color" else f"number {f['min']}-{f['max']}" if f["type"] == "number" else "one of " + " | ".join(c["value"] for c in f["choices"])))
    system = ("You design a visual theme for a website (colours, fonts, shapes) from the description of the user. Answer with ONE JSON object only, no text around it: "
              '{"name": short name (1-3 words, in the language of the description), "description": one short sentence in the same language, "mode": "light" | "dark" | null, "values": {setting: value}}. '
              "Give a value for every setting below, only with the allowed values. The light_* colours are for the light stand, the dark_* colours for the dark stand: both must be complete, readable "
              "(strong contrast between text and page) and fit together; primary is the colour of buttons and links, secondary an accent. mode is null when both stands are fine, 'light' or 'dark' when the theme is meant for one stand only.\n"
              "Settings:\n" + "\n".join(spec))
    ask = prompt + (f"\n(The theme is meant for the {mode} stand only.)" if mode in ("light", "dark") else "")
    try:
        out = themeimport._parse_json(ai.claude(system, ask, max_tokens=3500, timeout=120), need=("values",))
    except ValueError as e:
        raise ResourceError(f"Claude gaf geen bruikbaar thema ({e}). Probeer het nog eens.")
    clean, _errors = theme.validate({k: v for k, v in (out.get("values") or {}).items() if k in THEME_KEYS})  # what is not allowed is left out
    if "primary" not in clean:
        raise ResourceError("Claude gaf geen bruikbaar thema (de hoofdkleur ontbreekt). Probeer het nog eens.")
    return save_theme(out.get("name"), out.get("description"), out.get("mode"), clean)


def save_theme(name, description, mode, values, install=False):
    """A theme (checked values) as a package of this site (site/themes/<key>-1.0.0.zip); with install it is also put on the list of themes in use. Returns the manifest."""
    from . import themepacks

    name = str(name or "Nieuw thema").strip()[:60] or "Nieuw thema"
    entries = [e for e in catalog("themas") if not e["bundle"]]
    builtin_names = {str(r.get("name") or "").strip().lower() for r in themepacks.builtin_manifests()}
    same = next((e for e in entries if e.get("origin") == "site" and str(e["title"]).strip().lower() == name.lower()), None)
    if same:  # a theme of this site with this name exists: it is replaced, not copied (no easy2edit-2, easy2edit-3 ...)
        key = same["name"]
    else:
        names = {str(e["title"]).strip().lower() for e in entries} | builtin_names  # a name of the library or of a built-in theme is not used twice: the theme gets "naam 2"
        base, n = name, 2
        while name.lower() in names:
            name = f"{base[:56]} {n}"
            n += 1
        taken = {e["name"] for e in entries} | themepacks.BUILTIN_KEYS()
        key, n = _slug(name), 2
        while key in taken or key in {r["key"] for r in themepacks.builtin_manifests()}:
            key = f"{_slug(name)[:27]}-{n}"
            n += 1
    man = {"key": key, "name": name, "description": str(description or "")[:300], "version": "1.0.0", "system_version": str(settings.SYSTEM_VERSION),
           "mode": mode if mode in ("light", "dark") else None, "values": values}
    raw = json.dumps(man, indent=2, ensure_ascii=False) + "\n"
    themepacks.parse(raw)  # the same check as an uploaded package
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{key}/theme.json", raw)
    try:  # a theme made on this site is a package of this site (site/themes), not of the product library (resource/themas)
        (site_dir("themas") / f"{key}-1.0.0.zip").write_bytes(buf.getvalue())
    except OSError:
        raise ResourceError("De themamap van deze site (site/themes) is niet te beschrijven.")
    if install:
        try:
            themepacks.install_zip(buf.getvalue())
        except themepacks.ThemeError as e:
            raise ResourceError(f"Het thema staat in de bibliotheek maar kon niet worden geïnstalleerd: {e}")
    return man


def delete_theme(key):
    """Remove a theme package (its zip, from this site or from the library). An installed theme stays installed."""
    import re as _re

    key = str(key or "")
    files = []
    if _re.fullmatch(r"[a-z0-9-]{3,40}", key):  # the packages of this site first; older ones that were made in the product library are removed from there too
        for _origin, folder in _folders("themas"):
            files += [f for f in folder.glob(f"{key}-*.zip") if _re.fullmatch(_re.escape(key) + r"-\d+\.\d+\.\d+\.zip", f.name)]
    if not files:
        raise ResourceError("Dit thema staat niet (als los pakket) in de bibliotheek.")
    try:
        for f in files:
            f.unlink()
    except OSError:
        raise ResourceError("Het pakket is niet te verwijderen (alleen-lezen map).")
    return key
