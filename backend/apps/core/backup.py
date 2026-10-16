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
register("modules", "Modules", _modules_export, _modules_apply, description="Welke modules aan of uit staan.", order=20)
register("languages", "Talen", _lang_export, _lang_apply, description="Welke talen aan staan, de standaardtaal en de taalkeuze.", order=30)
register("content", "Teksten van de website", _content_export, _content_apply, description="Alle teksten die in de bewerkmodus zijn aangepast.", order=40)
register("dashboard", "Standaard dashboard", _dash_export, _dash_apply, description="De standaardindeling van het dashboard voor iedereen.", order=90)
