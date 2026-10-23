"""Settings of the core: theme, modules, languages, editable texts and the default dashboard."""
from apps.core.settings_backup import register

from . import modules
from .models import ContentBlock, DashboardLayout, Language, LanguageSettings, ModuleState, SiteSettings


# ── theme (Vormgeving) ──
def _theme_export(opts):
    return SiteSettings.load().theme or {}


def _theme_apply(data, ctx):
    if not isinstance(data, dict):
        raise ValueError("Ongeldige vormgeving.")
    obj = SiteSettings.load()
    obj.theme = data
    obj.save()
    return "Vormgeving geladen."


# ── modules on/off ──
def _modules_export(opts):
    return {m.key: m.enabled for m in ModuleState.objects.all()}


def _modules_apply(data, ctx):
    n = skipped = 0
    for key, on in (data or {}).items():
        if key not in modules.BY_KEY or modules.BY_KEY[key].get("core"):
            skipped += 1  # a module this system does not have (any more) or that cannot be switched off
            continue
        ModuleState.objects.update_or_create(key=key, defaults={"enabled": bool(on)})
        n += 1
    modules.invalidate()
    return f"{n} module(s) ingesteld" + (f", {skipped} onbekend overgeslagen." if skipped else ".")


# ── languages ──
def _lang_export(opts):
    return {"switcher": (LanguageSettings.objects.first() or LanguageSettings()).switcher,
            "languages": list(Language.objects.values("code", "name", "native_name", "rtl", "enabled", "is_default", "order"))}


def _lang_apply(data, ctx):
    data = data or {}
    n = 0
    for row in data.get("languages", []):
        if not row.get("code"):
            continue
        Language.objects.update_or_create(code=row["code"], defaults={k: row[k] for k in ("name", "native_name", "rtl", "enabled", "order") if k in row})
        n += 1
    default = next((r["code"] for r in data.get("languages", []) if r.get("is_default")), None)
    if default and Language.objects.filter(code=default).exists():
        Language.objects.update(is_default=False)
        Language.objects.filter(code=default).update(is_default=True)
    if data.get("switcher") in ("dropdown", "flags"):
        obj = LanguageSettings.objects.first() or LanguageSettings()
        obj.switcher = data["switcher"]
        obj.save()
    return f"{n} taal/talen geladen."


# ── editable website texts ──
def _content_export(opts):
    return [{"key": b.key, "lang": b.lang, "text": b.text} for b in ContentBlock.objects.all()]


def _content_apply(data, ctx):
    n = 0
    for b in data or []:
        if b.get("key") and b.get("lang"):
            ContentBlock.objects.update_or_create(key=b["key"], lang=b["lang"], defaults={"text": b.get("text", "")})
            n += 1
    return f"{n} tekstblok(ken) geladen."


# ── default dashboard layout ──
def _dash_export(opts):
    d = DashboardLayout.objects.filter(user=None).first()
    return {"widgets": d.widgets, "columns": d.columns} if d else None


def _dash_apply(data, ctx):
    if not data:
        DashboardLayout.objects.filter(user=None).delete()
        return "Geen standaarddashboard (standaard van het thema)."
    DashboardLayout.objects.update_or_create(user=None, defaults={"widgets": data.get("widgets", []), "columns": int(data.get("columns", 2) or 2)})
    return "Standaarddashboard geladen."


register("theme", "Vormgeving", _theme_export, _theme_apply, description="Kleuren, lettertypen, popups, tabbladen en standaardinstellingen.", order=10)
def _modules_add(data, ctx):
    have = set(ModuleState.objects.values_list("key", flat=True))
    return _modules_apply({k: v for k, v in (data or {}).items() if k not in have}, ctx)


def _lang_add(data, ctx):
    have = set(Language.objects.values_list("code", flat=True))
    return _lang_apply({"languages": [r for r in (data or {}).get("languages", []) if r.get("code") not in have and not r.get("is_default")]}, ctx)


def _content_add(data, ctx):
    have = set(ContentBlock.objects.values_list("key", "lang"))
    return _content_apply([b for b in data or [] if (b.get("key"), b.get("lang")) not in have], ctx)


def _content_clear():
    ContentBlock.objects.all().delete()


register("modules", "Modules", _modules_export, _modules_apply, description="Welke modules aan of uit staan.", order=20, add=_modules_add)
register("languages", "Talen", _lang_export, _lang_apply, description="Welke talen aan staan, de standaardtaal en de taalkeuze.", order=30, add=_lang_add)
register("content", "Teksten van de website", _content_export, _content_apply, description="Alle teksten die in de bewerkmodus zijn aangepast.", order=40, add=_content_add, clear=_content_clear)
register("dashboard", "Standaard dashboard", _dash_export, _dash_apply, description="De standaardindeling van het dashboard voor iedereen.", order=90)


def _system_export(opts):
    from . import system

    return system.get()


def _system_apply(data, ctx):
    from . import system

    # the addresses belong to the installation: only take over what was entered as content (name, contact), never the addresses
    keep = {k: v for k, v in (data or {}).items() if k not in ("frontend_url", "backend_url", "extra_origins", "environment")}
    cleaned, _ = system.clean(keep)
    system.save({k: v for k, v in cleaned.items() if k in keep})
    return "Basisgegevens geladen (adressen van deze installatie blijven staan)."


register("system", "Basisgegevens", _system_export, _system_apply, description="Naam, bedrijf en contactgegevens van de website.", order=5)


def _packs_export(opts):
    """The theme packages (the files of the themes folder) with their on/off state. opts["themes"]: only these keys (None = all)."""
    from . import themepacks

    keys = opts.get("themes")
    themepacks.scan()
    from .models import ThemePack

    builtin = [{"manifest": {k: m[k] for k in ("key", "name", "description", "version", "system_version", "mode", "values", "home")}, "enabled": True, **({"files": themepacks.files_b64(m["key"])} if opts.get("include_files", True) else {})}
               for m in themepacks.builtin_manifests() if m.get("customized") and (keys is None or m["key"] in keys)]
    return {"themes": builtin + [{"manifest": r.manifest, "enabled": r.enabled, **({"files": themepacks.files_b64(r.key)} if opts.get("include_files", True) else {})}
                       for r in ThemePack.objects.all() if keys is None or r.key in keys]}


def _packs_apply(data, ctx):
    import json

    from . import themepacks
    from .models import ThemePack

    done, notes = 0, []
    for it in (data or {}).get("themes", []):
        try:
            man = themepacks.parse(json.dumps(it.get("manifest")), builtin_ok=True)
            d = themepacks.root() / man["key"]
            d.mkdir(exist_ok=True)
            (d / "theme.json").write_text(json.dumps({k: man[k] for k in ("key", "name", "description", "version", "system_version", "mode", "values", "home")}, indent=2, ensure_ascii=False) + "\n")
            themepacks.write_files_b64(man["key"], it.get("files"))
            themepacks.scan()
            ThemePack.objects.filter(key=man["key"]).update(enabled=bool(it.get("enabled")))
            done += 1
        except Exception as e:  # noqa: BLE001
            notes.append(f"{(it.get('manifest') or {}).get('key', '?')}: {e}")
    return f"{done} themapakket(ten) geladen." + (" " + "; ".join(notes) if notes else "")


def _packs_add(data, ctx):
    from .models import ThemePack

    have = set(ThemePack.objects.values_list("key", flat=True))
    return _packs_apply({"themes": [t for t in (data or {}).get("themes", []) if (t.get("manifest") or {}).get("key") not in have]}, ctx)


register("themepacks", "Themapakketten", _packs_export, _packs_apply, description="De thema's uit de themamap en welke aan staan.", order=11, add=_packs_add)
