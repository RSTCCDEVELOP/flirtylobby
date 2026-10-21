import logging

from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    logger.info("Health check OK (db vendor: %s)", connection.vendor)
    return Response({"status": "ok", "database": connection.vendor})


# ── Theme / "Vormgeving" ────────────────────────────────────────────────────
from rest_framework import status  # noqa: E402
from apps.accounts.access import level as access_level  # noqa: E402
from apps.accounts.permissions import has_level, has_level_for  # noqa: E402
from . import modules  # noqa: E402
from .modules import module_required  # noqa: E402

from . import theme  # noqa: E402
from .models import SiteSettings  # noqa: E402


def _loader_image(values):
    """The address of the own picture of the page loader (from the media library), or ''."""
    try:
        from django.core.files.storage import default_storage

        from apps.medialib.models import MediaItem

        mid = int(values.get("loader_image_id") or 0)
        item = MediaItem.objects.filter(pk=mid, kind="image").first() if mid else None
        return default_storage.url(item.key) if item else ""
    except Exception:  # noqa: BLE001
        return ""


def _theme_payload(values, with_schema=False):
    css, fonts_url = theme.build(values)
    payload = {"values": {**values, "loader_image_url": _loader_image(values)}, "css": css, "fonts_url": fonts_url}
    if with_schema:
        payload["schema"] = theme.SCHEMA
        payload["presets"] = theme.presets()
    return payload


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def theme_settings(request):
    """GET: public (the site needs it to render). PUT: staff only, partial values allowed."""
    if request.method == "GET":
        values = theme.merged(SiteSettings.load().theme if modules.enabled("theme") else {})
        return Response(_theme_payload(values, with_schema=access_level(request.user, "theme") >= 1))

    if not modules.enabled("theme") or not access_level(request.user, "theme") >= 2:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    clean, errors = theme.validate({k: v for k, v in (request.data.get("values") or {}).items() if k != "loader_image_url"})
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    final = theme.merged(clean)
    if not any(final[k] == "yes" for k in ("device_mobile", "device_tablet", "device_desktop", "device_app")):
        return Response({"detail": "Minimaal één weergave (mobiel, iPad, website of app) moet actief zijn."}, status=status.HTTP_400_BAD_REQUEST)
    settings_obj = SiteSettings.load()
    settings_obj.theme = {k: v for k, v in clean.items() if v != theme.DEFAULTS[k]}
    settings_obj.save()
    logger.info("Theme updated by %s", request.user.email)
    return Response(_theme_payload(theme.merged(settings_obj.theme)))


@api_view(["POST"])
@permission_classes([has_level("theme", "edit"), module_required("theme")])
def theme_preview(request):
    clean, errors = theme.validate(request.data.get("values"))
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(_theme_payload(theme.merged(clean)))


@api_view(["POST"])
@permission_classes([has_level("theme", "edit"), module_required("theme")])
def theme_reset(request):
    settings_obj = SiteSettings.load()
    settings_obj.theme = {}
    settings_obj.save()
    return Response(_theme_payload(theme.merged({}), with_schema=True))


# ── Languages ───────────────────────────────────────────────────────────────
from django.db import transaction  # noqa: E402
from django.shortcuts import get_object_or_404  # noqa: E402

from .models import Language  # noqa: E402


def _lang(l):
    from . import langpacks

    return {"code": l.code, "name": l.name, "native_name": l.native_name, "rtl": l.rtl,
            "enabled": l.enabled, "is_default": l.is_default, "protected": l.code in langpacks.PROTECTED or l.is_default, "package": langpacks.installed(l.code) is not None}


def _switcher():
    from .models import LanguageSettings

    return LanguageSettings.objects.filter(pk=1).values_list("switcher", flat=True).first() or "dropdown"


@api_view(["GET", "PUT"])
@permission_classes([has_level_for("languages", {"GET": "use", "PUT": "edit"}), module_required("languages")])
def languages_config(request):
    """How the language switch is shown in the header: a text pulldown or little flags."""
    from .models import LanguageSettings

    if request.method == "PUT":
        value = request.data.get("switcher")
        if value not in ("dropdown", "flags"):
            return Response({"detail": "Kies tekst (pulldown) of vlaggetjes."}, status=status.HTTP_400_BAD_REQUEST)
        LanguageSettings.objects.update_or_create(pk=1, defaults={"switcher": value})
    return Response({"switcher": _switcher()})


@api_view(["GET"])
@permission_classes([AllowAny])
def languages_public(request):
    default = Language.objects.filter(is_default=True).first()
    langs = Language.objects.filter(enabled=True)
    if not modules.enabled("languages"):  # module off: only the default language
        langs = langs.filter(is_default=True)
    return Response({"default": default.code if default else None, "languages": [_lang(l) for l in langs], "switcher": _switcher()})


@api_view(["GET"])
@permission_classes([has_level("languages", "use"), module_required("languages")])
def languages_all(request):
    return Response([_lang(l) for l in Language.objects.all()])


@api_view(["PATCH", "DELETE"])
@permission_classes([has_level_for("languages", {"PATCH": "edit", "DELETE": "manage"}), module_required("languages")])
def language_update(request, code):
    lang = get_object_or_404(Language, code=code)
    if request.method == "DELETE":
        from . import langpacks

        try:
            langpacks.remove(lang)
        except langpacks.LanguageError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response([_lang(l) for l in Language.objects.all()])
    enabled = bool(request.data.get("enabled"))
    if not enabled and lang.is_default:
        return Response({"detail": "De standaardtaal kan niet worden uitgezet."}, status=status.HTTP_400_BAD_REQUEST)
    lang.enabled = enabled
    lang.save(update_fields=["enabled"])
    return Response(_lang(lang))


# ── Language packages (Admin -> Talen): import for admins, export for superadmins ──
from rest_framework.decorators import parser_classes  # noqa: E402
from rest_framework.parsers import FormParser, MultiPartParser  # noqa: E402


@api_view(["GET"])
@permission_classes([AllowAny])
def language_dictionary(request, code):
    """The interface texts of an installed language package (the languages that come with the system are static files of the frontend)."""
    from . import langpacks

    pack = langpacks.installed(code)
    if not pack or not Language.objects.filter(code=code).exists():
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response(pack["ui"])


@api_view(["POST"])
@permission_classes([has_level("languages", "edit"), module_required("languages")])
@parser_classes([MultiPartParser, FormParser])
def language_import(request):
    from . import langpacks

    f = request.FILES.get("file")
    if not f or not f.name.lower().endswith(".zip"):
        return Response({"detail": "Kies een zipbestand met een taal."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        codes = langpacks.install_zip(f.read())
    except langpacks.LanguageError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"installed": codes, "languages": [_lang(l) for l in Language.objects.all()]})


def _superadmin(request):
    return bool(request.user.is_staff or request.user.is_superuser)


@api_view(["POST"])
@permission_classes([has_level("languages", "manage"), module_required("languages")])
def language_export(request):
    """Superadmins: write a zip per language and all_languages.zip into <project>/themes/.dist/languages."""
    from . import langpacks

    if not _superadmin(request):
        return Response({"detail": "Alleen een superadmin kan talen exporteren."}, status=status.HTTP_403_FORBIDDEN)
    return Response({"folder": str(langpacks.dist_dir()), "files": langpacks.build_dist()})


@api_view(["GET"])
@permission_classes([has_level("languages", "manage"), module_required("languages")])
def language_export_all(request):
    from django.http import HttpResponse

    from . import langpacks

    if not _superadmin(request):
        return Response({"detail": "Alleen een superadmin kan talen exporteren."}, status=status.HTTP_403_FORBIDDEN)
    r = HttpResponse(langpacks.as_zip_all(), content_type="application/zip")
    r["Content-Disposition"] = 'attachment; filename="all_languages.zip"'
    return r


@api_view(["POST"])
@permission_classes([has_level("languages", "edit"), module_required("languages")])
def language_set_default(request, code):
    lang = get_object_or_404(Language, code=code)
    with transaction.atomic():
        Language.objects.update(is_default=False)
        lang.is_default = lang.enabled = True
        lang.save(update_fields=["is_default", "enabled"])
    logger.info("Default language set to %s by %s", code, request.user.email)
    return Response([_lang(l) for l in Language.objects.all()])


# ── Editable content (bewerkmodus) ──────────────────────────────────────────
import re  # noqa: E402

from . import richtext  # noqa: E402

from apps.security.words import find_forbidden  # noqa: E402

from .models import ContentBlock  # noqa: E402


@api_view(["GET"])
@permission_classes([AllowAny])
def content_public(request):
    out = {}
    from django.core.files.storage import default_storage

    from apps.medialib.models import MediaItem

    from apps.subscriptions import service as subs

    items = {i.id: i for i in MediaItem.objects.all()}
    hidden = {k for k in subs.locked_pages() if not subs.page_ok(request.user, k)}
    from apps.pages import service as pages_service
    from apps.pages.models import Page

    closed = {p.key for p in Page.objects.exclude(access={}) if not pages_service.can_see(request.user, p)}  # pages for chosen users / groups only
    for b in ContentBlock.objects.all():
        if hidden and b.key.startswith("page.") and b.key.split(".")[1] in hidden and not b.key.endswith(".title"):
            continue  # the text of a subscribers-only page stays on the server
        if closed and b.key.split(".")[0] in ("page", "layout") and b.key.split(".")[1] in closed:
            continue
        text = b.text
        if text.startswith(richtext.PREFIX):
            def url_for(i):
                item = items.get(i)
                return default_storage.url(item.key) if item else None

            text = richtext.PREFIX + richtext.resolve(text[len(richtext.PREFIX):], url_for)
        elif text.startswith("media:"):  # image block: resolve to the file's current URL (local or S3)
            item = items.get(int(text[6:] or 0))
            text = default_storage.url(item.key) if item else ""
        out.setdefault(b.key, {})[b.lang] = text
    return Response(out)


@api_view(["PUT"])
@permission_classes([has_level("edit_mode", "edit"), module_required("edit_mode")])
def content_save(request):
    key, lang, text = request.data.get("key", ""), request.data.get("lang", ""), str(request.data.get("text", ""))
    rich = bool(request.data.get("html"))
    if not re.fullmatch(r"[a-z0-9._-]{1,100}", key) or not Language.objects.filter(code=lang).exists():
        return Response({"detail": "Ongeldige sleutel of taal."}, status=status.HTTP_400_BAD_REQUEST)
    if len(text) > (richtext.MAX if rich else 5000):
        return Response({"detail": "Tekst is te lang."}, status=status.HTTP_400_BAD_REQUEST)
    if rich:
        text = richtext.clean(text)
    found = find_forbidden(richtext.plain(text) if rich else text)
    if found:
        return Response({"detail": f"Bevat niet toegestane woorden: {', '.join(found)}."}, status=status.HTTP_400_BAD_REQUEST)
    ContentBlock.objects.update_or_create(key=key, lang=lang, defaults={"text": (richtext.PREFIX + text) if rich else text})
    logger.info("Content '%s' (%s) edited by %s", key, lang, request.user.email)
    return Response({"ok": True, "text": text})


# ── Modules ─────────────────────────────────────────────────────────────────
from rest_framework.permissions import IsAdminUser  # noqa: E402

from .models import ModuleState  # noqa: E402


@api_view(["GET"])
@permission_classes([AllowAny])
def modules_public(request):
    from apps.plugins.models import Plugin

    return Response({**modules.states(), **{f"plugin:{n}": on for n, on in Plugin.objects.values_list("name", "enabled")}})  # plugins count as modules for the website


def _module_payload():
    st = modules.states()
    from django.db.models import Count

    from apps.accounts.models import ModuleGrant

    counts = dict(ModuleGrant.objects.values_list("module").annotate(n=Count("id")))
    label = {m["key"]: m["label"] for m in modules.MODULES}
    # a module that needs other modules (e.g. subscriptions need orders): which of those are off
    return [{**m, "enabled": st[m["key"]], "core": bool(m.get("core")), "acl": m.get("acl", True), "grants": counts.get(m["key"], 0),
             "requires": [{"key": r, "label": label.get(r, r), "enabled": st.get(r, True)} for r in m.get("requires", [])]}
            for m in modules.MODULES]


@api_view(["GET"])
@permission_classes([IsAdminUser])  # superadmins only (is_staff)
def modules_admin(request):
    return Response(_module_payload())


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def module_update(request, key):
    m = modules.BY_KEY.get(key)
    if not m:
        return Response({"detail": "Onbekende module."}, status=status.HTTP_404_NOT_FOUND)
    if m.get("core"):
        return Response({"detail": "Kernmodules kunnen niet worden uitgezet."}, status=status.HTTP_400_BAD_REQUEST)
    if m.get("plugin"):
        return Response({"detail": "Deze module is een plugin: zet hem aan of uit bij Admin → Plugins."}, status=status.HTTP_400_BAD_REQUEST)
    on = bool(request.data.get("enabled"))
    ModuleState.objects.update_or_create(key=key, defaults={"enabled": on})
    modules.invalidate()
    from apps.security import service as security_service

    security_service.invalidate()
    logger.info("Module %s %s by %s", key, "enabled" if on else "disabled", request.user.email)
    return Response(_module_payload())


# ── Basic data / deployment ─────────────────────────────────────────────────
from . import system  # noqa: E402


@api_view(["GET"])
@permission_classes([AllowAny])
def site_public(request):
    """The website's own name, domains and footer data (the frontend reads this on every page)."""
    return Response(system.public())


@api_view(["GET", "PUT"])
@permission_classes([has_level("system", "manage"), module_required("system")])
def system_settings(request):
    if request.method == "PUT":
        cleaned, errors = system.clean(request.data)
        if errors:
            return Response({"detail": " ".join(errors.values()), "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
        system.save(cleaned)
    return Response({"settings": system.get(), "checks": system.checks(request), "env": system.env_files(), "environments": system.ENVIRONMENTS,
                     "request_origin": f"{request.scheme}://{request.get_host()}"})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def system_reset(request):
    """Back to a clean system (see apps/core/reset.py). Superadmins only. GET: what would go. POST {confirm: "RESET", password}: do it."""
    from . import reset

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins mogen het systeem resetten."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        return Response(reset.summary())
    if str(request.data.get("confirm", "")).strip() != "RESET":
        return Response({"detail": "Typ RESET om te bevestigen."}, status=status.HTTP_400_BAD_REQUEST)
    if not request.user.check_password(str(request.data.get("password", ""))):
        return Response({"detail": "Het wachtwoord klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
    removed = reset.perform(request.user)
    applied = None
    if request.data.get("preset"):  # start straight from a standard installation
        from . import presets

        if request.data["preset"] in presets.BY_KEY:
            applied = presets.apply(request.data["preset"])
    return Response({"removed": removed, "applied": applied})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def presets_list(request):
    """The standard installations (superadmins)."""
    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    return Response(presets.listing())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_apply(request, key):
    """Switch everything for a standard installation: modules, plugins and the community theme. Superadmins only; no data is removed."""
    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if key not in presets.BY_KEY:
        return Response({"detail": "Onbekende installatie."}, status=status.HTTP_404_NOT_FOUND)
    return Response(presets.apply(key))


@api_view(["POST"])
@permission_classes([has_level("system", "manage"), module_required("system")])
def maintenance_translate(request):
    """The maintenance notice in every language of the system (also the ones that are off), translated by Claude. Fills the languages that are empty; overwrite=true replaces them all."""
    import json

    from apps.integrations import ai

    from . import themeimport

    cfg = system.get()
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    msgs = dict(cfg["maintenance_messages"])
    source = msgs.get(default) or cfg["maintenance_message"] or "We zijn bezig met onderhoud. Probeer het straks opnieuw."
    overwrite = bool(request.data.get("overwrite"))
    todo = [(l.code, l.name) for l in Language.objects.all() if l.code != default and (overwrite or not msgs.get(l.code))]
    if not todo:
        return Response({"settings": system.get(), "translated": 0})
    if not ai.available():
        return Response({"detail": "Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan."}, status=status.HTTP_400_BAD_REQUEST)
    prompt = json.dumps({"text": source, "source_language": default, "languages": [{"code": c, "name": n} for c, n in todo]}, ensure_ascii=False)
    sysmsg = "You translate a short maintenance notice of a website. Keep the meaning and the friendly tone. Answer with ONE JSON object only, no text around it: {\"messages\": {code: translation}} with an entry for every requested language code."
    try:
        out = themeimport._parse_json(ai.claude(sysmsg, prompt, max_tokens=3000, timeout=90), need=("messages",))
    except ValueError as e:
        return Response({"detail": f"Vertalen mislukt: {e}"}, status=status.HTTP_502_BAD_GATEWAY)
    got = out.get("messages") or {}
    msgs[default] = source
    n = 0
    for c, _name in todo:
        t = str(got.get(c) or "").strip()
        if t:
            msgs[c] = t[:500]
            n += 1
    system.save({"maintenance_messages": msgs})
    return Response({"settings": system.get(), "translated": n})


# ── Theme packages (Admin -> Themapakketten) ────────────────────────────────
from django.http import HttpResponse  # noqa: E402
from rest_framework.parsers import FormParser, MultiPartParser  # noqa: E402
from rest_framework.decorators import parser_classes  # noqa: E402

from . import themepacks  # noqa: E402
from .models import ThemePack  # noqa: E402

PACKS = [has_level_for("theme", {"GET": "use", "DELETE": "manage"}, default="edit"), module_required("theme")]
_bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


@api_view(["GET"])
@permission_classes(PACKS)
def theme_packs(request):
    themepacks.scan()
    from apps.integrations import ai

    return Response({"packs": themepacks.listing(), "ai": ai.available(), "folder": str(themepacks.root()), "dist": str(themepacks.dist_dir()), "system_version": __import__("django.conf", fromlist=["settings"]).settings.SYSTEM_VERSION})


@api_view(["POST"])
@permission_classes(PACKS)
@parser_classes([MultiPartParser, FormParser])
def theme_pack_upload(request):
    f = request.FILES.get("file")
    if not f or not f.name.lower().endswith(".zip"):
        return _bad("Kies een zipbestand met een thema.")
    try:
        keys = themepacks.install_zip(f.read())
    except themepacks.ThemeError as e:
        return _bad(str(e))
    return Response({"packs": themepacks.listing(), "installed": keys})


@api_view(["GET"])
@permission_classes(PACKS)
def theme_pack_download_all(request):
    """ALL themes in one zip."""
    r = HttpResponse(themepacks.as_zip_all(), content_type="application/zip")
    r["Content-Disposition"] = 'attachment; filename="themes-all.zip"'
    return r


@api_view(["POST"])
@permission_classes([has_level("theme", "edit"), module_required("theme")])
def theme_pack_dist(request):
    """Superadmins: write the zips of all themes into <project>/themes/.dist/themes."""
    if not _superadmin(request):
        return Response({"detail": "Alleen een superadmin kan thema's exporteren."}, status=status.HTTP_403_FORBIDDEN)
    names = themepacks.build_dist()
    return Response({"folder": str(themepacks.dist_dir()), "files": names})


@api_view(["PATCH", "DELETE"])
@permission_classes(PACKS)
def theme_pack(request, key):
    themepacks.scan()
    builtin = key in themepacks.BUILTIN_KEYS()
    row = None if builtin else ThemePack.objects.filter(key=key).first()
    if not row and not builtin:
        return _bad("Dit themapakket bestaat niet.", status.HTTP_404_NOT_FOUND)
    if builtin and request.method == "DELETE":
        return _bad("Een ingebouwd thema kan niet worden verwijderd. Je kunt het wel herstellen.")
    if request.method == "DELETE":
        themepacks.remove(key)
    else:
        if "enabled" in request.data and row:
            row.enabled = bool(request.data.get("enabled"))
            row.save(update_fields=["enabled", "updated_at"])
        if any(k in request.data for k in ("name", "description", "version", "mode", "home", "values")):
            try:
                themepacks.update_meta(key, request.data)
            except themepacks.ThemeError as e:
                return _bad(str(e))
    return Response({"packs": themepacks.listing()})


def _pack_call(fn, *a):
    try:
        fn(*a)
    except themepacks.ThemeError as e:
        return _bad(str(e))
    return Response({"packs": themepacks.listing()})


@api_view(["POST"])
@permission_classes(PACKS)
def theme_pack_create(request):
    name = str(request.data.get("name") or "").strip()
    if not name:
        return _bad("Geef het thema een naam.")
    try:
        key = themepacks.create(name, bool(request.data.get("from_current")))
    except themepacks.ThemeError as e:
        return _bad(str(e))
    return Response({"key": key, "packs": themepacks.listing()}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes(PACKS)
def theme_pack_assets(request, key):
    try:
        return Response(themepacks.data_urls(key))
    except themepacks.ThemeError as e:
        return _bad(str(e), status.HTTP_404_NOT_FOUND)


@api_view(["PUT", "DELETE"])
@permission_classes(PACKS)
@parser_classes([MultiPartParser, FormParser])
def theme_pack_slot(request, key, slot):
    if request.method == "DELETE":
        return _pack_call(themepacks.clear_slot, key, slot)
    f = request.FILES.get("image")
    return _pack_call(themepacks.set_slot, key, slot, f.read()) if f else _bad("Kies een afbeelding.")


@api_view(["POST"])
@permission_classes(PACKS)
@parser_classes([MultiPartParser, FormParser])
def theme_pack_home_add(request, key):
    f = request.FILES.get("image")
    return _pack_call(themepacks.add_home, key, f.read(), request.data.get("caption", "")) if f else _bad("Kies een afbeelding.")


@api_view(["DELETE"])
@permission_classes(PACKS)
def theme_pack_home_del(request, key, index):
    return _pack_call(themepacks.remove_home, key, index)


@api_view(["POST"])
@permission_classes(PACKS)
def theme_pack_capture(request, key):
    return _pack_call(themepacks.capture, key)


@api_view(["POST"])
@permission_classes(PACKS)
def theme_pack_use(request, key):
    """Make a theme (colours, fonts, shapes; optionally its logos and home photos) the look of the website."""
    with_files = bool(request.data.get("files"))
    if with_files and not (modules.enabled("branding") and access_level(request.user, "branding") >= 2):
        return _bad("Je hebt geen rechten om logo's te wijzigen.", status.HTTP_403_FORBIDDEN)
    try:
        slots, photos = themepacks.use(key, with_files)
    except themepacks.ThemeError as e:
        return _bad(str(e))
    logger.info("Theme %s put in use by %s (files=%s)", key, request.user.email, with_files)
    return Response({"slots": slots, "photos": photos, "packs": themepacks.listing()})


@api_view(["POST"])
@permission_classes([has_level("branding", "edit"), module_required("branding"), *PACKS])
def theme_pack_apply(request, key):
    """Use the logos and home photos of a package for the site."""
    try:
        slots, photos = themepacks.apply_files(key)
    except themepacks.ThemeError as e:
        return _bad(str(e))
    logger.info("Theme package %s applied (%s logos, %s photos) by %s", key, slots, photos, request.user.email)
    return Response({"slots": slots, "photos": photos})


@api_view(["GET"])
@permission_classes(PACKS)
def theme_pack_download(request, key):
    data = themepacks.as_zip(key)
    if not data:
        return _bad("Dit themapakket bestaat niet.", status.HTTP_404_NOT_FOUND)
    r = HttpResponse(data, content_type="application/zip")
    r["Content-Disposition"] = f'attachment; filename="theme-{key}.zip"'
    return r


# ── A theme from a website address (draft first, then saved as a package) ───
from . import themeimport  # noqa: E402
from .models import ThemeImportJob  # noqa: E402


def _job(request, pk):
    try:
        return ThemeImportJob.objects.filter(pk=pk, user=request.user).first()
    except (ValueError, TypeError):
        return None


@api_view(["POST"])
@permission_classes(PACKS)
def theme_import_start(request):
    from apps.siteimport.importer import ImportError_

    try:
        job = themeimport.start(request.user, str(request.data.get("url") or ""))
    except (ImportError_, themepacks.ThemeError) as e:
        return _bad(str(e))
    return Response(themeimport.public(job), status=status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
@permission_classes(PACKS)
def theme_import(request, pk):
    job = _job(request, pk)
    if not job:
        return _bad("Dit import bestaat niet (meer).", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        themeimport.cleanup(job)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(themeimport.public(job))


@api_view(["POST"])
@permission_classes(PACKS)
def theme_import_save(request, pk):
    job = _job(request, pk)
    if not job:
        return _bad("Dit import bestaat niet (meer).", status.HTTP_404_NOT_FOUND)
    b = request.data
    photos = [int(i) for i in b.get("photos", [])]
    if photos and not (modules.enabled("media") and access_level(request.user, "media") >= 2):
        return _bad("Je hebt geen rechten om foto's aan de mediabibliotheek toe te voegen.", status.HTTP_403_FORBIDDEN)
    try:
        key, imported = themeimport.save(job, str(b.get("name") or "").strip()[:60], b.get("description"), [str(x) for x in b.get("assets", [])], [int(i) for i in b.get("home", [])],
                                         b.get("values") if isinstance(b.get("values"), dict) else None, photos, request.user)
    except (themepacks.ThemeError, ValueError) as e:
        return _bad(str(e))
    return Response({"key": key, "photos": imported, "packs": themepacks.listing()}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes(PACKS)
def theme_import_refine(request, pk):
    """Claude improves the draft after what the user writes; ?undo=1 puts the previous version back."""
    job = _job(request, pk)
    if not job:
        return _bad("Dit import bestaat niet (meer).", status.HTTP_404_NOT_FOUND)
    try:
        if request.data.get("undo"):
            themeimport.undo(job)
            summary = ""
        else:
            summary = themeimport.refine(job, str(request.data.get("prompt") or ""))
    except themepacks.ThemeError as e:
        return _bad(str(e))
    job.refresh_from_db()
    return Response({**themeimport.public(job), "summary": summary})


@api_view(["POST"])
@permission_classes(PACKS)
def theme_pack_reset(request, key):
    """RSTCC / Studio2 back to the values of the system."""
    try:
        themepacks.reset_builtin(key)
    except themepacks.ThemeError as e:
        return _bad(str(e))
    return Response({"packs": themepacks.listing()})


@api_view(["POST"])
@permission_classes(PACKS)
def theme_pack_refine(request, key):
    """Claude improves the settings of a package after what the user writes. The answer holds the previous values, so the screen can undo it."""
    try:
        doc = themepacks._doc(key)
        cur = theme.merged(doc["values"])
        changes, summary, _name, _desc = themeimport.refine_values(cur, str(request.data.get("prompt") or ""), doc.get("name", ""), str(request.data.get("url") or "")[:500])
        themepacks.update_meta(key, {"values": changes})
    except themepacks.ThemeError as e:
        return _bad(str(e))
    return Response({"summary": summary, "changed": sorted(changes), "values": theme.merged(themepacks._doc(key)["values"]), "packs": themepacks.listing()})


def _license_out():
    from .models import License

    lic = License.objects.filter(pk=1).first()
    from . import license_price, system

    return {"number": lic.number if lic else "", "client": lic.client if lic else "", "client_address": lic.client_address if lic else "", "issued_at": lic.issued_at if lic else None,
            "valid_until": lic.valid_until.isoformat() if lic and lic.valid_until else None, "expired": system.license_info()["expired"],
            "price": str(license_price.refresh()), "base_price": str(lic.base_price) if lic else "0.00", "renew_months": lic.renew_months if lic else 12, "has": system.license_info()["has"],
            "monthly": str(license_price.monthly(lic)), "quarterly": str(license_price.for_period(3, lic)), "yearly": str(license_price.for_period(12, lic)),
            "backup_included": lic.backup_included if lic else 5, "backup_slot_price": str(lic.backup_slot_price) if lic else "0.00", "backup_slots": license_price.backup_slots(),
            "reseller": {"name": lic.reseller_name, "email": lic.reseller_email, "url": lic.reseller_url} if lic else {"name": "", "email": "", "url": ""},
            "billing": __import__("apps.core.license_billing", fromlist=["state"]).state(lic) if lic else None}


@api_view(["GET", "PUT", "POST", "DELETE"])
@permission_classes([IsAdminUser])  # superadmins only
def system_license(request):
    """GET the licence; PUT {client}; POST makes a new licence number (XXXX-XXXX-XXXX-XXXX)."""
    import secrets

    from django.utils import timezone

    from .models import License

    from . import system

    lic, _ = License.objects.get_or_create(pk=1)
    if request.method == "PUT":
        from datetime import date

        d = request.data
        if "client" in d:
            lic.client = str(d.get("client") or "").strip()[:200]
        if "client_address" in d:
            lic.client_address = str(d.get("client_address") or "").strip()[:300]
        if "valid_until" in d:
            try:
                lic.valid_until = date.fromisoformat(str(d["valid_until"])) if d.get("valid_until") else None
            except ValueError:
                return Response({"detail": "Geef een geldige datum."}, status=400)
        if "base_price" in d:
            try:
                from decimal import Decimal

                lic.base_price = max(Decimal(str(d["base_price"] or 0)), Decimal("0")).quantize(Decimal("0.01"))
            except Exception:  # noqa: BLE001
                return Response({"detail": "Geef een geldig bedrag."}, status=400)
        if "renew_months" in d:
            try:
                lic.renew_months = int(d["renew_months"])
            except (TypeError, ValueError):
                lic.renew_months = 0
            if lic.renew_months not in (1, 3, 12):
                return Response({"detail": "Kies per maand, per kwartaal of per jaar."}, status=400)
        if "allowed_methods" in d:
            from . import license_billing

            lst = [m for m in (d["allowed_methods"] if isinstance(d["allowed_methods"], list) else []) if m in license_billing.METHODS]
            if not lst:
                return Response({"detail": "Bied minstens één betaalmethode aan."}, status=400)
            lic.allowed_methods = lst
            if lic.payment_method not in lst:
                lic.payment_method = lst[0]
        if "backup_included" in d:
            try:
                lic.backup_included = min(max(int(d["backup_included"]), 0), 1000)
            except (TypeError, ValueError):
                return Response({"detail": "Geef een aantal backups."}, status=400)
        if "backup_slot_price" in d:
            try:
                from decimal import Decimal

                lic.backup_slot_price = max(Decimal(str(d["backup_slot_price"] or 0)), Decimal("0")).quantize(Decimal("0.01"))
            except Exception:  # noqa: BLE001
                return Response({"detail": "Geef een geldig bedrag."}, status=400)
        for k, n in (("reseller_name", 120), ("reseller_email", 254), ("reseller_url", 300)):
            if k in d:
                setattr(lic, k, str(d.get(k) or "").strip()[:n])
        if lic.reseller_url and not re.fullmatch(r"https?://[^\s]{3,290}|/[^\s]{0,290}", lic.reseller_url):
            return Response({"detail": "Geef een geldige link (https://…)."}, status=400)
        lic.save(update_fields=["client", "client_address", "valid_until", "base_price", "renew_months", "allowed_methods", "payment_method", "backup_included", "backup_slot_price", "reseller_name", "reseller_email", "reseller_url"])
    elif request.method == "DELETE":  # empty the licence (the reseller data stays: it says where a new one is bought)
        from .reset import clear_license

        clear_license()
        lic.refresh_from_db()
    elif request.method == "POST":
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I: easy to read out
        lic.number = "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(4))
        lic.issued_at = timezone.now()
        lic.save(update_fields=["number", "issued_at"])
    system.license_changed()
    return Response(_license_out())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def license_status(request):
    """For administrators (also when the licence has run out): the state of the licence and what renewing costs."""
    from apps.accounts.access import can_admin

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    out = _license_out()
    out["can_pay"] = bool(float(out["price"]) > 0)
    return Response(out)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def license_pay(request):
    """An administrator pays the renewal of the licence (a payment, simulated in the sandbox). Answer: {url} to continue at."""
    from apps.accounts.access import can_admin
    from apps.sandbox import service as sandbox

    from . import system
    from .models import License

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    from . import license_stripe

    if license_stripe.active():  # the licence's own Stripe account: a Checkout page
        from . import license_price as _lp

        price = _lp.refresh()
        if float(price) <= 0:
            return Response({"detail": "De licentie heeft geen prijs."}, status=400)
        try:
            return Response({"url": license_stripe.checkout(request.user, price, License.objects.get_or_create(pk=1)[0].renew_months)})
        except license_stripe.StripeError as e:
            return Response({"detail": str(e)}, status=400)
    from . import license_price

    lic, _ = License.objects.get_or_create(pk=1)
    license_price.refresh()
    lic.refresh_from_db()
    if lic.price <= 0:
        return Response({"detail": "Verlengen is niet online mogelijk: neem contact op met de leverancier."}, status=400)
    base = (request.headers.get("Origin") or "").rstrip("/")
    back = f"{base}/dashboard/license" if base else ""
    try:
        p = sandbox.create_payment(lic.price, "EUR", f"Licentie {lic.number or ''}".strip(), sandbox.payment_provider(), back)
    except (sandbox.NotConfigured, ValueError) as e:
        return Response({"detail": str(e)}, status=400)
    lic.payment_ref = p.ref
    lic.save(update_fields=["payment_ref"])
    done = sandbox.settle(p, back or "/dashboard/license")  # automatic mode: paid at once
    system.license_changed()
    return Response({"url": done or f"/sandbox/checkout/{p.ref}"})


@api_view(["GET", "PUT"])
@permission_classes([IsAdminUser])  # superadmins only
def license_prices(request):
    """The price (incl. VAT) of every module, plugin and game, and what is in use now. PUT {prices: {"module:faq": "2.50", "plugin:games": "10", "game:games:chess": "1"}}."""
    from decimal import Decimal, InvalidOperation

    from . import license_price
    from .models import ComponentPrice, License

    if request.method == "PUT":
        for k, v in (request.data.get("prices") or {}).items():
            kind, _, key = str(k).partition(":")
            if kind not in ("module", "plugin", "game", "package") or not key:
                continue
            try:
                price = max(Decimal(str(v or 0)), Decimal("0")).quantize(Decimal("0.01"))
            except (InvalidOperation, ValueError):
                return Response({"detail": f"Ongeldig bedrag voor {key}."}, status=400)
            if price > 0:
                ComponentPrice.objects.update_or_create(kind=kind, key=key[:120], defaults={"price": price})
            else:
                ComponentPrice.objects.filter(kind=kind, key=key).delete()
    lic, _ = License.objects.get_or_create(pk=1)
    price = license_price.refresh()
    items = [{**c, "price": str(c["price"])} for c in license_price.catalog()]
    month = license_price.monthly(lic)
    return Response({"items": items, "base_price": str(lic.base_price), "total": str(price), "in_use": str(month - lic.base_price), "months": lic.renew_months, "monthly": str(month),
                     "quarterly": str(license_price.for_period(3, lic)), "yearly": str(license_price.for_period(12, lic))})


def extend_license(lic):
    """The licence runs one more period (from today, or from the old end date when that is still ahead)."""
    from datetime import date
    import calendar

    from . import system

    start = max(date.today(), lic.valid_until or date.today())
    y, m = divmod(start.month - 1 + lic.renew_months, 12)
    year, month = start.year + y, m + 1
    lic.valid_until = date(year, month, min(start.day, calendar.monthrange(year, month)[1]))
    lic.payment_ref = ""
    lic.save(update_fields=["valid_until", "payment_ref"])
    system.license_changed()


def on_license_payment(payment):
    """After a payment status change: a paid renewal moves the end date on."""
    from .models import License

    lic = License.objects.filter(pk=1).first()
    if not lic or not lic.payment_ref or lic.payment_ref != payment.ref:
        return
    if payment.status == "paid":
        extend_license(lic)
    elif payment.status in ("failed", "canceled", "expired"):
        lic.payment_ref = ""  # the next try can start
        lic.save(update_fields=["payment_ref"])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def system_info(request):
    """Info for the Info pop-up in the Beheer menu: the version of Easy2edit and the installed plugins."""
    from django.conf import settings as dj

    from apps.plugins.models import Plugin

    plugins = [{"name": p.name, "title": p.manifest.get("title") or p.name, "version": p.manifest.get("version", ""), "enabled": p.enabled, "author": p.manifest.get("author", "")} for p in Plugin.objects.order_by("name")]
    from apps.core import modules, system

    sysdata = system.get()
    on = modules.states()
    mods = [{"key": m["key"], "group": m["group"], "label": m["label"], "desc": m.get("desc", ""), "enabled": bool(on.get(m["key"], True)), "core": bool(m.get("core"))} for m in modules.MODULES]
    return Response({"name": "Easy2edit", "version": dj.SYSTEM_VERSION, "plugins": plugins, "modules": mods, "copyright": "RST CC BV", "license": _license_out(),
                     "site": {k: sysdata.get(k, "") for k in ("site_name", "company_name", "frontend_url", "contact_email", "support_email", "phone", "address", "kvk", "vat_id")}})


# ── Licence for the administrator: costs and how to pay ─────────────────────
def _admin_only(request):
    from apps.accounts.access import can_admin

    return can_admin(request.user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def license_usage(request):
    """The licence for administrators: what is in use and what it costs (per month, quarter, year), the payment method and the subscription."""
    from decimal import Decimal

    from . import license_billing, license_price
    from .models import License

    if not _admin_only(request):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    lic, _ = License.objects.get_or_create(pk=1)
    items = [{"kind": c["kind"], "key": c["key"], "label": c["label"], "group": c["group"], "price": str(c["price"])} for c in license_price.catalog() if c["active"] and c["price"] > 0]
    out = _license_out()
    out.update({"items": items, "months": lic.renew_months, "backup_slots": license_price.backup_slots(), "billing": license_billing.state(lic), "can_pay": float(out["price"]) > 0})
    return Response(out)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def license_method(request):
    from . import license_billing

    if not _admin_only(request):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    try:
        license_billing.set_method(str(request.data.get("method") or ""))
    except license_billing.BillingError as e:
        return Response({"detail": str(e)}, status=400)
    return Response(_license_out())


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def license_subscribe(request):
    """POST: start automatic collection (a subscription). DELETE: stop it."""
    from . import license_billing

    if not _admin_only(request):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    try:
        if request.method == "DELETE":
            license_billing.stop_subscription()
            return Response(_license_out())
        p = license_billing.start_subscription(request.user)
    except license_billing.BillingError as e:
        return Response({"detail": str(e)}, status=400)
    if isinstance(p, dict):  # Stripe Checkout
        return Response({**_license_out(), "url": p["url"]})
    from apps.sandbox import service as sandbox

    return Response({**_license_out(), "url": sandbox.settle(p) or f"/sandbox/checkout/{p.ref}"})


@api_view(["POST"])
@permission_classes([IsAdminUser])  # superadmins only
def license_invoice_paid(request):
    """On account: the invoice was paid, the licence is extended with one period."""
    from . import license_billing

    license_billing.mark_invoice_paid()
    return Response(_license_out())


@api_view(["GET"])
@permission_classes([IsAdminUser])  # superadmins only
def module_packages(request):
    """The add-on packages (not the core CMS): which modules, how many are on, and the price per month in the licence."""
    from . import license_price

    on = modules.states()
    prices = {c["key"]: c["price"] for c in license_price.catalog() if c["kind"] == "package"}
    label = {m["key"]: m["label"] for m in modules.MODULES}
    return Response([{**{k: p[k] for k in ("key", "label", "desc")}, "modules": [{"key": k, "label": label[k], "enabled": bool(on.get(k, True))} for k in p["modules"]], "price": str(prices.get(p["key"], 0))}
                     for p in modules.PACKAGES])


@api_view(["GET", "PUT", "POST"])
@permission_classes([IsAdminUser])  # superadmins only
def license_stripe_settings(request):
    """The Stripe account of the licence (keys never go back to the screen). POST tests the key."""
    from . import license_stripe

    if request.method == "PUT":
        try:
            license_stripe.save_config(request.data)
        except license_stripe.StripeError as e:
            return Response({"detail": str(e)}, status=400)
    elif request.method == "POST":
        ok, msg = license_stripe.test()
        return Response({"ok": ok, "message": msg, **license_stripe.public()})
    out = license_stripe.public()
    base = (__import__("apps.core.system", fromlist=["get"]).get().get("backend_url") or "").rstrip("/") or request.build_absolute_uri("/").rstrip("/")
    out["webhook_url"] = f"{base}/api/system/license/stripe-webhook/"
    return Response(out)


from django.http import HttpResponse, JsonResponse  # noqa: E402
from django.views.decorators.csrf import csrf_exempt  # noqa: E402


@csrf_exempt
def license_stripe_webhook(request):
    """Stripe tells us a licence payment happened (signature checked with the webhook secret)."""
    import json as _json

    from . import license_stripe

    if request.method != "POST":
        return HttpResponse(status=405)
    secret = license_stripe.config().get("webhook_secret")
    if not secret:
        return HttpResponse("webhook-geheim ontbreekt", status=400)
    try:
        license_stripe.verify(request.body, request.META.get("HTTP_STRIPE_SIGNATURE", ""), secret)
        event = _json.loads(request.body)
    except (license_stripe.StripeError, ValueError) as e:
        return HttpResponse(str(e), status=400)
    return JsonResponse({"result": license_stripe.handle(event)})
