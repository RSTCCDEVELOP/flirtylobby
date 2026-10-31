# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
    """Superadmins: write a zip per language and all_languages.zip into <project>/resource/languages."""
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

    from apps.plugins.facade import subs

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


@api_view(["POST"])
@permission_classes([has_level("edit_mode", "edit"), module_required("edit_mode")])
def content_copy(request):
    """Copy the texts (all languages) and image choices of content keys to new keys: {"pairs": [{"from": key, "to": key}]} (a duplicated or pasted part of a page)."""
    pairs = request.data.get("pairs")
    if not isinstance(pairs, list) or len(pairs) > 300:
        return Response({"detail": "Ongeldige lijst."}, status=status.HTTP_400_BAD_REQUEST)
    done = 0
    for p in pairs:
        src, dst = str((p or {}).get("from", "")), str((p or {}).get("to", ""))
        if not (re.fullmatch(r"[a-z0-9._-]{1,100}", src) and re.fullmatch(r"[a-z0-9._-]{1,100}", dst)) or src == dst:
            continue
        for b in ContentBlock.objects.filter(key=src):
            ContentBlock.objects.update_or_create(key=dst, lang=b.lang, defaults={"text": b.text})
            done += 1
    return Response({"copied": done})


@api_view(["GET"])
@permission_classes([has_level("edit_mode", "edit"), module_required("edit_mode")])
def content_ai(request):
    """Can the text editor write with Claude, and in which languages (the ones that are switched on; default first)."""
    from apps.integrations import ai

    langs = list(Language.objects.filter(enabled=True).order_by("-is_default", "order").values("code", "name", "is_default"))
    return Response({"available": ai.available(), "languages": langs})


@api_view(["POST"])
@permission_classes([has_level("edit_mode", "edit"), module_required("edit_mode")])
def content_ai_write(request):
    """Claude writes a text from what the editor typed (the prompt), in the given languages at once: {"texts": {code: html}}."""
    import json

    from apps.integrations import ai

    from . import themeimport

    prompt = str(request.data.get("prompt") or "").strip()[:4000]
    if not prompt:
        return Response({"detail": "Schrijf eerst in het tekstveld wat Claude moet maken."}, status=status.HTTP_400_BAD_REQUEST)
    if not ai.available():
        return Response({"detail": "Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan."}, status=status.HTTP_400_BAD_REQUEST)
    active = {l.code: l.name for l in Language.objects.filter(enabled=True)}
    asked = request.data.get("langs")
    codes = [c for c in (asked if isinstance(asked, list) else [request.data.get("lang")]) if c in active] or ([request.data.get("lang")] if request.data.get("lang") else [])
    if not codes:
        return Response({"detail": "Onbekende taal."}, status=status.HTTP_400_BAD_REQUEST)
    system = ("You write texts for a website. The user gives a draft, notes or an instruction; write the finished text from it, in a natural, friendly and clear tone, without inventing facts "
              "(prices, names, dates) that were not given. Use only these HTML tags: p, h2, h3, h4, ul, ol, li, strong, em, br, a. Answer with ONE JSON object only, no text around it: "
              "{code: html} with an entry for every requested language code. Every language gets the same content, written natively in that language.")
    payload = json.dumps({"input": prompt, "languages": [{"code": c, "name": active.get(c, c)} for c in codes]}, ensure_ascii=False)
    try:
        out = themeimport._parse_json(ai.claude(system, payload, max_tokens=6000, timeout=150), need=tuple(codes))
    except (ValueError, KeyError) as e:
        return Response({"detail": f"Claude gaf geen bruikbaar antwoord ({e})."}, status=status.HTTP_502_BAD_GATEWAY)
    texts = {}
    for c in codes:
        html = richtext.clean(str(out.get(c) or "")[: richtext.MAX])
        if html.strip() and not find_forbidden(richtext.plain(html)):
            texts[c] = html
    if not texts:
        return Response({"detail": "Claude gaf geen bruikbare tekst. Probeer het nog eens."}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"texts": texts})


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
            for m in modules.MODULES if not m.get("hidden")]  # (parts that are plugins are switched on and off at Plugins, not here)


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
    removed = reset.perform(request.user, ai=bool(request.data.get("ai")))
    applied = None
    if request.data.get("preset"):  # start straight from a standard installation
        from . import presets

        if request.data["preset"] in presets.BY_KEY:
            applied = presets.apply(request.data["preset"])
    return Response({"removed": removed, "applied": applied, "admin": removed.get("admin", "")})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def refresh_settings(request):
    """How often the pages ask the server for news (superadmins, always: not tied to a module). {refresh_seconds, signal_seconds}."""
    from . import system

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "POST":
        out = {}
        for k, lo, hi in (("refresh_seconds", 0, 600), ("signal_seconds", 0, 30)):
            if k in request.data:
                try:
                    out[k] = str(max(lo, min(hi, int(request.data[k]))))
                except (TypeError, ValueError):
                    return Response({"detail": "Geef een geheel getal op."}, status=status.HTTP_400_BAD_REQUEST)
        if out:
            system.save(out)
    cur = system.get()
    return Response({"refresh_seconds": int(cur["refresh_seconds"] or 0), "signal_seconds": int(cur["signal_seconds"] or 0)})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def site_defaults_view(request):
    """The saved default settings (superadmins). GET: what is saved. POST {action: "capture" | "apply"}."""
    from . import site_defaults

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "POST":
        action = request.data.get("action")
        if action == "capture":
            return Response(site_defaults.capture())
        if action == "apply":
            if not site_defaults.info()["exists"]:
                return Response({"detail": "Er zijn nog geen standaard instellingen opgeslagen."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"results": site_defaults.apply(), **site_defaults.info()})
        return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(site_defaults.info())


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def installations_config_view(request):
    """The basis of the standard installations (superadmins). GET: what is saved. POST {action: "capture" | "apply"}."""
    from . import installations_config

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "POST":
        action = request.data.get("action")
        if action == "capture":
            return Response(installations_config.capture())
        if action == "apply":
            if not installations_config.info()["exists"]:
                return Response({"detail": "Er is nog geen basis opgeslagen."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"result": installations_config.apply(force=True), **installations_config.info()})
        return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(installations_config.info())


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def pricing_view(request):
    """The price list (superadmins): GET = config + everything with a price; POST {base_price, vat_rate, periods:{k:{discount}}, items:{key: price}} = save (pricing.json) and put it in the licence."""
    from . import pricing

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "POST":
        try:
            pricing.save(request.data if isinstance(request.data, dict) else {})
            pricing.apply_to_license()
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    cfg = pricing.load()
    return Response({"config": {k: cfg.get(k) for k in ("currency", "vat_rate", "rst_share", "note", "base_price", "periods", "includes", "implementation")}, "hosting": {"config": cfg.get("hosting"), "options": pricing.hosting_options()}, "email": pricing.email_config(), "catalog": pricing.catalog()})


def _ai_job_file(job):
    import re
    import tempfile
    from pathlib import Path

    return Path(tempfile.gettempdir()) / f"e2e_priceai_{re.sub('[^a-f0-9]', '', job)[:32]}.json"


def _ai_job_write(job, data):
    import json

    f = _ai_job_file(job)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(f)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def pricing_ai(request):
    """AI calculation (superadmins). {answers:{position, audience, margin, notes}} = a proposal; {accept: {key: value}} = put these values in pricing.json (all sites get them through git) and in the licence."""
    from apps.integrations import ai

    from . import pricing

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET" and request.query_params.get("last"):  # what the last calculation had done (to ask: go on or start again)
        return Response(pricing.run_info())
    if request.method == "GET":  # the progress of a running calculation: {steps: [{t, at}], done, result, error}
        import json
        import time

        f = _ai_job_file(str(request.query_params.get("job") or ""))
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return Response({"detail": "Onbekende berekening."}, status=status.HTTP_404_NOT_FOUND)
        data["now"] = time.time()
        return Response(data)
    d = request.data if isinstance(request.data, dict) else {}
    if d.get("start") and isinstance(d.get("answers"), dict):  # start it in the background and answer with a job to follow
        import threading
        import time
        import uuid

        if not ai.available():
            return Response({"detail": "Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan."}, status=status.HTTP_400_BAD_REQUEST)
        job = uuid.uuid4().hex
        state = {"steps": [], "done": False, "result": None, "error": None}

        def note(text):
            state["steps"].append({"t": text, "at": time.time()})
            _ai_job_write(job, state)

        def run():
            try:
                def partial(res):
                    state["partial"] = res
                    _ai_job_write(job, state)

                state["result"] = pricing.ai_run(d["answers"], progress=note, partial=partial, resume=bool(d.get("resume")))
            except ValueError as e:
                state["error"] = str(e)
            except Exception as e:  # noqa: BLE001
                state["error"] = f"De berekening mislukte: {e}"
            state["done"] = True
            note("Klaar" if not state["error"] else "Mislukt")
            from django.db import connection

            connection.close()

        note("Gestart")
        threading.Thread(target=run, daemon=True).start()
        return Response({"job": job})
    if isinstance(d.get("accept"), dict):
        new, n = pricing.apply_values(pricing.load(), d["accept"])
        pricing.PATH.write_text(__import__("json").dumps(new, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        pricing.apply_to_license()
        return Response({"changed": n})
    if not ai.available():
        return Response({"detail": "Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return Response(pricing.ai_proposal(d.get("answers") or {}))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def wizard_pdf(request):
    """The quotation as a PDF (superadmins): {answers, name, site_name, period, lang, mode: "download"|"mail", email}."""
    from django.http import HttpResponse

    from apps.communication import sending

    from . import pricing, pricing_pdf

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    d = request.data if isinstance(request.data, dict) else {}
    lang = d.get("lang") if d.get("lang") in pricing_pdf.T else "nl"
    plan = pricing.plan({k: (v if k in ("hosting", "email") else bool(v)) for k, v in (d.get("answers") or {}).items()})
    name, site = str((d.get("customer") or {}).get("company") or d.get("name") or "").strip()[:200] or "-", str(d.get("site_name") or "").strip()[:100] or "-"
    period = d.get("period") if d.get("period") in ("month", "quarter", "year") else "year"
    pdf = pricing_pdf.build(plan, name, site, period, lang, reseller=pricing.reseller_of(d))
    fname = f"easy2edit-{pricing_pdf.T[lang]['title'].lower()}-{__import__('re').sub(r'[^a-z0-9]+', '-', '-'.join(dict.fromkeys(x for x in (name, site) if x and x != '-')).lower()).strip('-') or 'website'}.pdf"
    if d.get("mode") == "mail":
        to = str(d.get("email") or "").strip()
        if not __import__("re").fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", to):
            return Response({"detail": "Vul een geldig e-mailadres in."}, status=status.HTTP_400_BAD_REQUEST)
        t = pricing_pdf.T[lang]
        try:
            files = [(fname, pdf, "application/pdf")]
            if d.get("with_config"):  # the installation configuration (JSON) goes with it
                files.append((fname[:-4].replace(f"easy2edit-{t['title'].lower()}-", "easy2edit-installatie-") + ".json", __import__("json").dumps(pricing.build_config(d), indent=2, ensure_ascii=False).encode(), "application/json"))
            sending.send_email(to, f"{t['title']} Easy2edit – {site}", f"{t['title']}: {site}\n\n{t['total']}: {pricing_pdf.eur(plan['monthly'])}\n\n{t['contact']}", attachments=files)
        except sending.DeliveryError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"sent": to})
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{fname}"'
    return resp


def _wizard_installations():
    """The standard installations for the wizard, each with the answers it stands for."""
    from . import presets, pricing

    return [{"key": p["key"], "name": p["name"], "icon": p["icon"], "desc": p["desc"], "theme": p["theme"], "webshop": "webshop" in p["plugins"], "answers": pricing.answers_of(p)} for p in (presets.get(x["key"]) for x in presets.PRESETS)]


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def wizard_view(request):
    """The installation wizard (superadmins). GET = the questions. POST {answers, plan: true} = what is needed and what it costs; {answers, apply: true, name, site_name, period} = do it."""
    from . import pricing, presets, system
    from .models import License

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    cfg = pricing.load()
    if request.method == "GET":
        return Response({"email": pricing.email_config(), "default_email": 0, "hosting": pricing.hosting_options(), "default_hosting": (cfg.get("hosting") or {}).get("default", "shared"), "questions": [{k: q.get(k) for k in ("key", "label", "help", "requires", "type") } for q in cfg["wizard"] if q.get("type") != "choice"], "periods": cfg["periods"], "vat_rate": cfg["vat_rate"], "reseller": pricing.reseller_of({}), "installations": _wizard_installations(), "defaults_available": __import__("apps.core.site_defaults", fromlist=["PATH"]).PATH.is_file(), "settings": {"site_name": system.get().get("site_name", ""), "client": License.objects.filter(pk=1).values_list("client", flat=True).first() or ""}})
    d = request.data if isinstance(request.data, dict) else {}
    plan = pricing.plan({k: (v if k in ("hosting", "email") else bool(v)) for k, v in (d.get("answers") or {}).items()})
    if d.get("config"):  # only the document, to download
        return Response(pricing.build_config(d))
    if not d.get("apply"):
        return Response(plan)
    cu = d.get("customer") if isinstance(d.get("customer"), dict) else {}
    name, site = str(cu.get("company") or d.get("name") or "").strip()[:200], str(d.get("site_name") or "").strip()[:100]
    if not name or not site:
        return Response({"detail": "Vul de naam van het bedrijf en van de website in."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        cfg_doc = pricing.build_config(d)
        result = pricing.apply_config(cfg_doc)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"applied": True, "plan": plan, "result": result, "config": cfg_doc}, status=status.HTTP_201_CREATED)


def _preset_access(user):
    """Superadmins may use every standard installation; administrators (system: manage) only those the superadmin released."""
    return "all" if user.is_staff else ("admin" if access_level(user, "system") >= 3 else None)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def presets_list(request):
    """The standard installations: all for superadmins, the released ones for administrators."""
    from . import presets

    who = _preset_access(request.user)
    if not who:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    rows = presets.listing()
    if who == "all":
        return Response(rows)
    return Response([{k: v for k, v in r.items() if k not in ("system_api", "ai", "price", "demo_cfg")} for r in rows if r["admin"]])  # what the system uses to bill and its own settings are not for an admin


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_default(request):
    """The superadmin ticks the standard installations that are offered when nothing is installed yet: {key, on}. At least one stays ticked."""
    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    try:
        return Response({"keys": presets.set_default(str(request.data.get("key") or ""), request.data.get("on", True) is not False)})
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_ai(request, key):
    """The superadmin sets the AI of a standard installation: {on, credit_required, topup_min, topup_max, topup_step}; it is set when that installation is set."""
    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    try:
        return Response(presets.set_ai(key, request.data or {}))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def sandbox_first(request):
    """The first question for a superadmin who works on his own computer: switch the sandbox on? (payments, e-mail, sms and the tests of the API links are then simulated, nothing real happens).
    GET = {local, asked, enabled}; POST {on} = the answer (on: the module and the sandbox are switched on)."""
    from django.conf import settings as dj

    from apps.sandbox import service as sandbox

    from .models import ModuleState, SystemSettings

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    host = (request.get_host() or "").split(":")[0].lower().strip("[]")
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    if request.method == "POST":
        if request.data.get("on"):
            ModuleState.objects.update_or_create(key="sandbox", defaults={"enabled": True})
            modules.invalidate()
            sandbox.save({"enabled": True})
        obj.data = {**(obj.data or {}), "sandbox_asked": True}
        obj.save()
    # "local": the address of this server is your own computer (not a real domain)
    local = host in ("localhost", "127.0.0.1", "::1", "0.0.0.0") or host.endswith(".localhost") or host.endswith(".local")
    return Response({"local": local, "asked": bool((obj.data or {}).get("sandbox_asked")), "enabled": sandbox.active()})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def presets_setup(request):
    """After logging in: is no standard installation set yet? Then a superadmin is asked which of the offered ones to install (one). {needed, presets: [{key, name, desc}]}."""
    from . import presets

    if not request.user.is_staff or presets.active():
        return Response({"needed": False})
    return Response({"needed": True, "presets": [{"key": k, "name": presets.get(k)["name"], "desc": presets.get(k).get("desc", "")} for k in presets.default_keys()]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_apply(request, key):
    """Switch everything for a standard installation: modules, plugins and the community theme. No data is removed."""
    from . import presets

    who = _preset_access(request.user)
    if not who:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    if key not in presets.BY_KEY:
        return Response({"detail": "Onbekende installatie."}, status=status.HTTP_404_NOT_FOUND)
    if who == "admin" and key not in presets.admin_allowed():
        return Response({"detail": "Deze installatie is niet vrijgegeven voor beheerders."}, status=status.HTTP_403_FORBIDDEN)
    if request.data.get("check"):  # which pages would be replaced and already have content: the screen asks before it overwrites
        return Response({"conflicts": presets.conflicts(key)})
    return Response(presets.apply(key, overwrite_pages=bool(request.data.get("overwrite_pages"))))


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def presets_edit(request, key):
    """The content of a standard installation (superadmins only): GET = what can be chosen and what is chosen, PUT {modules, plugins, pages: {add, remove}, demo: {drop, media, heroes, users}} = save, DELETE = back to the built-in definition."""
    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins mogen de inhoud van een standaard installatie wijzigen."}, status=status.HTTP_403_FORBIDDEN)
    if key not in presets.BY_KEY:
        return Response({"detail": "Onbekende installatie."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        return Response(presets.reset_edits(key))
    if request.method == "PUT":
        try:
            return Response(presets.save_edits(key, request.data if isinstance(request.data, dict) else {}))
        except (ValueError, TypeError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(presets.edit_options(key))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def demo_data(request):
    """Demo-gegevens (superadmins): GET = what exists; POST {media, users, content, objects, orders} = make; POST {remove: true} = remove it all."""
    from . import demo

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        c = demo.counts()
        return Response({"exists": demo.exists(), "counts": c, "presets": sorted(demo.registry()), "incomplete": demo.incomplete()})
    d = request.data if isinstance(request.data, dict) else {}
    from . import presets as presets_mod

    preset = d.get("preset") if d.get("preset") in presets_mod.BY_KEY else None
    if preset and not d.get("remove") and presets_mod.active() != preset:  # demo data is made for the installation that is set and in use
        return Response({"detail": "Stel eerst deze installatie in: demo-gegevens kunnen pas worden gemaakt als de installatie actief is."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        opts = dict(content=bool(d.get("content", True)), objects=bool(d.get("objects", True)), orders=bool(d.get("orders", True)), media=d.get("media", 16), heroes=d.get("heroes", 6), users=d.get("users", 8))
        shops_ = [x for x in (d.get("shops") or []) if x in ("clothing", "furniture", "grocery", "standard")] or None
        if d.get("plan"):  # the steps, so the screen can show the progress
            return Response({"steps": demo.plan(preset, shops=shops_, **opts)})
        if d.get("step"):  # one step
            try:
                made_ = demo.create_part(str(d["step"]), media=opts["media"], users=opts["users"], objects=opts["objects"], orders=opts["orders"], heroes=opts["heroes"], shops=shops_)
            except demo.NeedsPlugin as need:  # the plugin is off
                from . import pricing

                # a plugin that the installation in use needs, for someone who may set that installation (superadmin, or an administrator when it is released): installed from the library and switched on right away, without asking
                if preset and (_preset_access(request.user) == "all" or (_preset_access(request.user) == "admin" and preset in presets_mod.admin_allowed())) and need.name in presets_mod.plugins_for(presets_mod.get(preset)):
                    did = presets_mod.ensure_plugin(need.name)
                    if did.get("problem"):  # it could not be installed or started: say why (the screen shows it)
                        return Response({"detail": did["problem"]}, status=status.HTTP_409_CONFLICT)
                    made_ = demo.create_part(str(d["step"]), media=opts["media"], users=opts["users"], objects=opts["objects"], orders=opts["orders"], heroes=opts["heroes"], shops=shops_)
                    return Response({"made": made_, "plugins_installed": did["installed"], "plugins_enabled": did["enabled"]})

                info = pricing.extra_for_plugin(need.name)
                return Response({"detail": f"De plugin {info['title']} staat uit.", "needs_plugin": need.name, **info}, status=status.HTTP_409_CONFLICT)
            return Response({"made": made_})
        if d.get("finish"):
            demo.finish(preset, demo.parts_for(preset, opts["content"], opts["objects"], opts["orders"], 1, 1, 1))
            return Response({"counts": demo.counts(), "presets": sorted(demo.registry()), "incomplete": demo.incomplete()})
        if d.get("remove"):
            return Response({"removed": demo.remove(preset), "counts": demo.counts(), "presets": sorted(demo.registry())})
        made = demo.create(media=d.get("media", 16), heroes=d.get("heroes", 6), users=d.get("users", 8), content=bool(d.get("content", True)), objects=bool(d.get("objects", True)), orders=bool(d.get("orders", True)), preset=preset, shops=[x for x in (d.get("shops") or []) if x in ("clothing", "furniture", "grocery", "standard")] or None)
    except Exception as e:  # noqa: BLE001
        logger.exception("Demo-gegevens mislukt")
        return Response({"detail": f"Het lukte niet: {str(e)[:200]}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({"made": made, "counts": demo.counts(), "presets": sorted(demo.registry()), "incomplete": demo.incomplete()}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_remove(request, key):
    """Take the installation in use away (modules and plugins off, no data removed). Same rights as setting one."""
    from . import presets

    who = _preset_access(request.user)
    if not who:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    if key not in presets.BY_KEY:
        return Response({"detail": "Onbekende installatie."}, status=status.HTTP_404_NOT_FOUND)
    if who == "admin" and key not in presets.admin_allowed():
        return Response({"detail": "Deze installatie is niet vrijgegeven voor beheerders."}, status=status.HTTP_403_FORBIDDEN)
    if presets.active() != key:
        return Response({"detail": "Deze installatie is niet in gebruik."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(presets.unapply(key))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_page(request, key):
    """Edit mode (superadmins): save the page as it is now in a standard installation: {page: "home"}."""
    from apps.pages.layout import KEY_RE

    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    page = str(request.data.get("page") or "")
    if key not in presets.BY_KEY or not KEY_RE.match(page):
        return Response({"detail": "Onbekende installatie of pagina."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return Response({"saved_pages": presets.save_page(key, page)})
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_admin(request):
    """The superadmin chooses which standard installations administrators may set: {keys: [...]}."""
    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    keys = request.data.get("keys")
    return Response({"keys": presets.set_admin_allowed(keys if isinstance(keys, list) else [])})


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
    """Superadmins: write the zips of all themes into <project>/resource/themas."""
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
        key = themepacks.create(name, bool(request.data.get("from_current")), str(request.data.get("copy_of") or ""))
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
    if with_files and not request.user.is_staff and not (modules.enabled("branding") and access_level(request.user, "branding") >= 2):  # a superadmin may always
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
    from apps.core.webtoolkit import ImportError_

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
            "price": str(license_price.refresh()), "base_price": str(license_price.config_base()), "renew_months": lic.renew_months if lic else 12, "has": system.license_info()["has"],
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
    return Response({"from_file": True, "items": items, "base_price": str(license_price.config_base()), "total": str(price), "in_use": str(month - license_price.config_base()), "months": lic.renew_months, "monthly": str(month),
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


def _build_number(dj):
    """The build number from backend/BUILD, read each time so a pull shows the new number without a restart."""
    try:
        return int((dj.BASE_DIR / "BUILD").read_text().strip())
    except (OSError, ValueError):
        return dj.SYSTEM_BUILD


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
    return Response({"name": "Easy2edit", "version": dj.SYSTEM_VERSION, "build": _build_number(dj), "plugins": plugins, "modules": mods, "copyright": "RST CC BV", "license": _license_out(),
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
    return Response([{**{k: p[k] for k in ("key", "label", "desc")}, "modules": [{"key": k, "label": label[k], "enabled": bool(on.get(k, True)), "plugin": modules.BY_KEY[k].get("plugin") or ""} for k in p["modules"]], "price": str(prices.get(p["key"], 0))}
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


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def standard_admin_view(request):
    """Superadmins: set the standard superadmin (name, e-mail, password). It overwrites the standard superadmin of the installation and is the one a reset makes again.
    POST {name, email, password, password2, confirm_password}: the own password of the person who does this is the check; a mail goes to the addresses that were active."""
    import re

    from django.contrib.auth.password_validation import validate_password
    from django.contrib.auth.hashers import make_password
    from django.core.exceptions import ValidationError

    from apps.accounts.models import User
    from apps.communication import sending

    from . import reset
    from .models import SystemSettings

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    cur = reset.standard_email()
    if request.method == "GET":
        u = User.objects.filter(email__iexact=cur).first() if cur else None
        return Response({"email": cur, "name": (u.display_name or f"{u.first_name} {u.last_name}".strip()) if u else "", "stored": bool(reset.stored_admin()), "you": request.user.email})
    d = request.data if isinstance(request.data, dict) else {}
    if d.get("code") is not None:  # step 2: the code from the mail of the old address
        import time

        from django.contrib.auth.hashers import check_password

        row = SystemSettings.objects.filter(pk=1).first()
        pend = ((row.data or {}).get("standard_admin_pending") if row else None)
        if not pend or pend.get("by") != request.user.pk or time.time() > pend.get("expires", 0):
            return Response({"detail": "Er is geen openstaande wijziging, of de code is verlopen. Begin opnieuw."}, status=status.HTTP_400_BAD_REQUEST)
        if pend.get("attempts", 0) >= 5:
            return Response({"detail": "Te vaak een verkeerde code. Begin opnieuw."}, status=status.HTTP_400_BAD_REQUEST)
        if not check_password(str(d.get("code") or "").strip(), pend["code_hash"]):
            row.data = {**row.data, "standard_admin_pending": {**pend, "attempts": pend.get("attempts", 0) + 1}}
            row.save()
            return Response({"detail": "De code klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_apply_standard_admin(request, pend))
    name, email = str(d.get("name") or "").strip()[:80], str(d.get("email") or "").strip().lower()
    password, again = str(d.get("password") or ""), str(d.get("password2") or "")
    if not name:
        return Response({"detail": "Vul een naam in."}, status=status.HTTP_400_BAD_REQUEST)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return Response({"detail": "Vul een geldig e-mailadres in."}, status=status.HTTP_400_BAD_REQUEST)
    if password != again:
        return Response({"detail": "De twee wachtwoorden zijn niet gelijk."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(password)
    except ValidationError as e:
        return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    if not request.user.check_password(str(d.get("confirm_password") or "")):
        return Response({"detail": "Het controle-wachtwoord (dat van jezelf) klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
    old = User.objects.filter(email__iexact=cur).first() if cur else None
    other = User.objects.filter(email__iexact=email).exclude(pk=old.pk if old else None).first()
    if other and not other.is_staff:
        return Response({"detail": "Dit e-mailadres is al van een gewone gebruiker."}, status=status.HTTP_400_BAD_REQUEST)
    # the address of the old standard superadmin must approve it first: a code goes there (without a standard superadmin: to the one who asks)
    import secrets
    import time

    to = cur or request.user.email
    code = f"{secrets.randbelow(10**6):06d}"
    row, _c = SystemSettings.objects.get_or_create(pk=1)
    prev = (row.data or {}).get("standard_admin_pending")
    if prev and prev.get("by") == request.user.pk and time.time() - prev.get("sent_at", 0) < 30:  # (sending again: not more often than once per 30 seconds)
        return Response({"detail": "Wacht even voordat je de mail opnieuw laat sturen.", "wait": int(30 - (time.time() - prev.get("sent_at", 0)))}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    row.data = {**(row.data or {}), "standard_admin_pending": {"sent_at": time.time(), "email": email, "name": name, "password_hash": make_password(password), "code_hash": make_password(code), "expires": time.time() + 15 * 60, "attempts": 0, "to": to, "by": request.user.pk}}
    row.save()
    try:
        sending.send_email(to, "Bevestig de nieuwe standaard superadmin", f"{request.user.email} wil de standaard superadmin van deze website wijzigen naar {name} ({email}).\n\nJe bevestigingscode is: {code}\n\nDe code is 15 minuten geldig. Was jij dit niet? Geef de code dan niet door; de wijziging gaat niet door zonder deze code.", purpose="security", code=code)
    except Exception:  # noqa: BLE001
        logger.exception("Verification mail for the standard superadmin could not be sent to %s", to)
        return Response({"detail": "De bevestigingsmail kon niet worden verstuurd. Controleer de e-mailkoppeling (Admin → Communicatie)."}, status=status.HTTP_502_BAD_GATEWAY)
    masked = to[:2] + "***" + to[to.index("@"):] if "@" in to else to
    from apps.sandbox import service as sandbox

    # sandbox on: the mail is not really sent (it is kept in Admin → Sandbox), so the code is given right away to fill in
    return Response({"sent_to": masked, **({"sandbox_code": code} if sandbox.active("email") else {})})


def _apply_standard_admin(request, pend):
    """The change has been approved by the old address: make it."""
    from django.contrib.auth.models import Group  # noqa: F401

    from apps.accounts.models import User
    from apps.communication import sending

    from . import reset
    from .models import SystemSettings

    cur, email, name = reset.standard_email(), pend["email"], pend["name"]
    old = User.objects.filter(email__iexact=cur).first() if cur else None
    other = User.objects.filter(email__iexact=email).exclude(pk=old.pk if old else None).first()
    target = old or other or User(username=email, email=email)
    if old and other and other.pk != old.pk:  # the new address already belongs to another superadmin: that one becomes the standard one
        target = other
    target.username = target.email = email
    target.is_staff = target.is_superuser = target.is_active = True
    target.display_name = name
    target.first_name, _s, target.last_name = name.partition(" ")
    target.password = pend["password_hash"]
    target.twofa_method, target.totp_secret, target.totp_last_step = "", "", 0
    target.save()
    row, _c = SystemSettings.objects.get_or_create(pk=1)
    data = {**(row.data or {}), "standard_admin": {"email": email, "name": name, "password_hash": target.password}}
    data.pop("standard_admin_pending", None)
    row.data = data
    row.save()
    notify = []
    for addr in dict.fromkeys(x for x in (cur, pend.get("to"), request.user.email, email) if x and "@" in x):
        try:
            sending.send_email(addr, "De standaard superadmin is gewijzigd", f"De standaard superadmin van deze website is zojuist ingesteld (bevestigd via {pend.get('to')}).\n\nNaam: {name}\nE-mailadres: {email}\n\nHet wachtwoord staat niet in dit bericht. Was jij dit niet? Neem direct contact op met de beheerder van de website.", purpose="security")
            notify.append(addr)
        except Exception:  # noqa: BLE001 - the change is made; the mail is a message about it
            logger.exception("Mail about the standard superadmin could not be sent to %s", addr)
    return {"email": email, "name": name, "mailed": notify, "same_user": target.pk == request.user.pk}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def standard_admin_file(request):
    """Superadmins. {action: "export", password}: the encrypted config file of the standard superadmin (locked with the password of that account).
    {action: "import", file, password, confirm_password}: load such a file here: the standard superadmin of this website becomes the one in the file."""
    from django.core.cache import cache

    from . import reset

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    d = request.data if isinstance(request.data, dict) else {}
    pw = str(d.get("password") or "")
    key = f"stdadmin-file:{request.user.pk}"
    if cache.get(key, 0) >= 8:
        return Response({"detail": "Te veel pogingen. Probeer het over een kwartier opnieuw."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    cache.set(key, cache.get(key, 0) + 1, 900)
    try:
        if d.get("action") == "export":
            return Response({"file": reset.export_file(pw)})
        if d.get("action") == "import":
            if not request.user.check_password(str(d.get("confirm_password") or "")):
                return Response({"detail": "Het controle-wachtwoord (dat van jezelf) klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
            st = reset.read_file(d.get("file") if isinstance(d.get("file"), dict) else {}, pw)
            return Response(_apply_standard_admin(request, {"email": st["email"], "name": st.get("name") or st["email"], "password_hash": st["password_hash"], "to": "een configuratiebestand"}))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def system_update(request):
    """After an update of Easy2edit: GET = does this site have to be checked, and which steps; POST {step} = do one step (see apps/core/sysupdate.py). Administrators and superadmins."""
    from . import sysupdate

    if not (request.user.is_staff or level(request.user, "system") >= 2):
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        return Response(sysupdate.status(request.user))
    return Response(sysupdate.run(str(request.data.get("step") or ""), request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_update(request, key):
    """Check an installation that is in use and switch on what was switched off (modules, plugins). No content is changed."""
    from . import presets

    who = _preset_access(request.user)
    if not who:
        return Response({"detail": "Geen toegang."}, status=status.HTTP_403_FORBIDDEN)
    if key not in presets.BY_KEY:
        return Response({"detail": "Onbekende installatie."}, status=status.HTTP_404_NOT_FOUND)
    if presets.active() != key:
        return Response({"detail": "Deze installatie is niet in gebruik."}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(request.data.get("pages"), list):  # the pages the person agreed to put back as the standard has them
        return Response(presets.update_pages(key, [str(k) for k in request.data["pages"]]))
    return Response(presets.update_installation(key))
