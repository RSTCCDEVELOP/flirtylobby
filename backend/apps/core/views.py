import logging

from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
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


def _theme_payload(values, with_schema=False):
    css, fonts_url = theme.build(values)
    payload = {"values": values, "css": css, "fonts_url": fonts_url}
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
    clean, errors = theme.validate(request.data.get("values"))
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
    return {"code": l.code, "name": l.name, "native_name": l.native_name, "rtl": l.rtl,
            "enabled": l.enabled, "is_default": l.is_default}


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


@api_view(["PATCH"])
@permission_classes([has_level("languages", "edit"), module_required("languages")])
def language_update(request, code):
    lang = get_object_or_404(Language, code=code)
    enabled = bool(request.data.get("enabled"))
    if not enabled and lang.is_default:
        return Response({"detail": "De standaardtaal kan niet worden uitgezet."}, status=status.HTTP_400_BAD_REQUEST)
    lang.enabled = enabled
    lang.save(update_fields=["enabled"])
    return Response(_lang(lang))


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
    for b in ContentBlock.objects.all():
        if hidden and b.key.startswith("page.") and b.key.split(".")[1] in hidden and not b.key.endswith(".title"):
            continue  # the text of a subscribers-only page stays on the server
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
    return Response(modules.states())


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
