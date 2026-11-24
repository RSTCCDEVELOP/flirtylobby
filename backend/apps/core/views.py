# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging
from decimal import Decimal

from django.db import connection
from rest_framework.decorators import api_view, authentication_classes, permission_classes
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
from apps.accounts.permissions import IsSuperPlus, has_level, has_level_for  # noqa: E402
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
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser  # noqa: E402


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
from rest_framework.permissions import BasePermission, IsAdminUser  # noqa: E402

from .models import ModuleState  # noqa: E402


@api_view(["GET"])
@permission_classes([AllowAny])
def modules_public(request):
    from apps.plugins.models import Plugin

    from . import presets

    flags = presets.setup_flags()  # Setup of the standard installation: Users and Entiteit on the dashboard (left menu and tile) or not
    return Response({**modules.states(), **{f"plugin:{n}": on for n, on in Plugin.objects.values_list("name", "enabled")}, "setup_users": flags["users"], "setup_entity": flags["entity"]})  # plugins count as modules for the website


class StaffOrDemo(BasePermission):
    """A superadmin; in demo mode also a demo account (it may switch the modules on and off to try them out)."""

    def has_permission(self, request, view):
        if request.user and request.user.is_staff:
            return True
        from apps.sandbox import demo

        return demo.may_switch(request.user)


def _module_payload():
    st = modules.states()
    from django.db.models import Count

    from apps.accounts.models import ModuleGrant

    counts = dict(ModuleGrant.objects.values_list("module").annotate(n=Count("id")))
    label = {m["key"]: m["label"] for m in modules.MODULES}
    # a module that needs other modules (e.g. subscriptions need orders): which of those are off
    owner = modules.owner_only_keys()
    return [{**m, "enabled": st[m["key"]], "core": bool(m.get("core")), "acl": m.get("acl", True), "grants": counts.get(m["key"], 0), "owner_only": m["key"] in owner,
             "requires": [{"key": r, "label": label.get(r, r), "enabled": st.get(r, True)} for r in m.get("requires", [])]}
            for m in modules.MODULES if not m.get("hidden")]  # (parts that are plugins are switched on and off at Plugins, not here)


@api_view(["GET"])
@permission_classes([StaffOrDemo])  # superadmins only (is_staff); in demo mode also the demo accounts
def modules_admin(request):
    return Response(_module_payload())


@api_view(["PATCH"])
@permission_classes([StaffOrDemo])
def module_update(request, key):
    m = modules.BY_KEY.get(key)
    if not m:
        return Response({"detail": "Onbekende module."}, status=status.HTTP_404_NOT_FOUND)
    plus = bool(request.user.is_superplus)
    if "owner_only" in request.data:  # mark a module as an easy2edit module (only a superadmin+ sees and manages it); also for a core module
        if not plus:
            return Response({"detail": "Alleen een superadmin+ kan dit instellen."}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ModuleState.objects.get_or_create(key=key, defaults={"enabled": bool(modules.enabled(key))})  # (a new row keeps the state the module has now)
        row.owner_only = bool(request.data.get("owner_only"))
        row.save(update_fields=["owner_only", "updated_at"])
        modules.invalidate()
        logger.info("Module %s %s by %s", key, "marked superadmin+ only" if row.owner_only else "released for superadmins", request.user.email)
        return Response(_module_payload())
    if key in modules.owner_only_keys() and not plus:
        return Response({"detail": "Deze module is alleen voor een superadmin+."}, status=status.HTTP_403_FORBIDDEN)
    if m.get("core"):
        return Response({"detail": "Kernmodules kunnen niet worden uitgezet."}, status=status.HTTP_400_BAD_REQUEST)
    if m.get("plugin"):
        return Response({"detail": "Deze module is een plugin: zet hem aan of uit bij Admin → Plugins."}, status=status.HTTP_400_BAD_REQUEST)
    on = bool(request.data.get("enabled"))
    ModuleState.objects.update_or_create(key=key, defaults={"enabled": on})
    __import__("apps.auditlog.service", fromlist=["log"]).log("module.changed", request.user, target=key, detail="aan" if on else "uit", request=request)
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


def _setup_pay_guard(request):
    from apps.accounts.access import can_admin

    return None if can_admin(request.user) else Response({"detail": "Je hebt hier geen rechten voor."}, status=403)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_pay(request):
    """Payment step: saves the basic data and the choices (hosting, period), then makes the Stripe Checkout page. POST {fields…, hosting, renew_months} -> {url}."""
    from . import license_price, setup_pay

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    if _license_exists():
        return Response({"detail": "Er is al een licentie."}, status=400)
    d = request.data
    cleaned, errors = system.clean({k: v for k, v in d.items() if k in system.SETUP_FIELDS})
    merged = {**{k: system.split_contact(system.get()).get(k, "") for k in system.SETUP_FIELDS}, **cleaned}
    for k in system.SETUP_FIELDS:
        if not str(merged.get(k) or "").strip():
            errors[k] = "Dit veld is verplicht."
    try:
        months = int(d.get("renew_months"))
    except (TypeError, ValueError):
        months = 0
    if months not in (1, 3, 12):
        errors["renew_months"] = "Kies per maand, per kwartaal of per jaar."
    if str(d.get("hosting") or "") not in {o["key"] for o in license_price.hosting_options()}:
        errors["hosting"] = "Kies een hosting uit de lijst."
    if errors:
        return Response({"detail": " ".join(errors.values()), "errors": errors}, status=400)
    system.save(cleaned)
    setup_pay.prepare(str(d.get("hosting")), months)
    if not setup_pay.provider():
        return Response({"detail": "Stripe is niet gekoppeld voor de licentie (Super admin → Licentie → Betalen)."}, status=400)
    base = (system.get().get("frontend_url") or "").rstrip("/") or request.build_absolute_uri("/").rstrip("/").replace(":8000", ":5173")
    origin = request.headers.get("Origin") or base
    try:
        return Response({"url": setup_pay.checkout(request.user, origin.rstrip("/"))})
    except setup_pay.PayError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_pay_confirm(request):
    """The customer is back from Stripe: POST {session_id}."""
    from . import setup_pay

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    try:
        setup_pay.confirm(request.user, request.data.get("session_id"))
    except setup_pay.PayError as e:
        return Response({"detail": str(e)}, status=400)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_pdf(request):
    """The licence overview as a PDF (button in the last step of the wizard): POST the fields of the wizard (+ lang, pay: stripe|invoice|none)."""
    from . import setup_pdf

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    d = request.data
    lang = str(d.get("lang") or "nl")[:2]
    number = (__import__("apps.core.models", fromlist=["x"]).License.objects.filter(pk=1).values_list("number", flat=True).first() or "") or _reserved_number()
    pdf = setup_pdf.build(d, lang, number, str(d.get("pay") or ""))
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="easy2edit-licence-{number}.pdf"'
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_pay_test(request):
    """Only for testing: "Betaal (test)": on localhost a superadmin goes on as if it was paid (Stripe not linked)."""
    from . import setup_pay

    if request.get_host().split(":")[0] not in ("localhost", "127.0.0.1", "[::1]") or not request.user.is_staff:
        return Response({"detail": "Alleen een superadmin op localhost."}, status=403)
    setup_pay.mark_ok(request.user)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_pay_none(request):
    """"Betaal niet": the wizard goes on without paying; the licence is then made for a short time (setup_pay.TRIAL_DAYS), after that the website goes into free mode.
    POST {hosting, renew_months} (kept, like with paying)."""
    from . import license_price, setup_pay

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    try:
        months = int(request.data.get("renew_months"))
    except (TypeError, ValueError):
        months = 0
    if months not in (1, 3, 12):
        return Response({"detail": "Kies per maand, per kwartaal of per jaar."}, status=400)
    if str(request.data.get("hosting") or "") not in {o["key"] for o in license_price.hosting_options()}:
        return Response({"detail": "Kies een hosting uit de lijst."}, status=400)
    setup_pay.prepare(str(request.data.get("hosting")), months)
    setup_pay.mark_skipped(request.user)
    return Response({"ok": True, "trial_days": setup_pay.TRIAL_DAYS})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_pay_invoice(request):
    """A superadmin or superadmin+ lets the licence be paid on account (a invoice) instead of with Stripe: POST {hosting, renew_months}. The choices that decide the price are kept."""
    from . import license_price, setup_pay
    from .models import License

    if not (request.user.is_staff or getattr(request.user, "is_superplus", False)):
        return Response({"detail": "Alleen een superadmin mag op rekening kiezen."}, status=403)
    try:
        months = int(request.data.get("renew_months"))
    except (TypeError, ValueError):
        months = 0
    if months not in (1, 3, 12):
        return Response({"detail": "Kies per maand, per kwartaal of per jaar."}, status=400)
    if str(request.data.get("hosting") or "") not in {o["key"] for o in license_price.hosting_options()}:
        return Response({"detail": "Kies een hosting uit de lijst."}, status=400)
    setup_pay.prepare(str(request.data.get("hosting")), months)
    License.objects.filter(pk=1).update(payment_method="invoice")
    setup_pay.mark_ok(request.user)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_consent(request):
    """Send the code for the consent with the licence: POST {method: email|sms, to}. On localhost a superadmin gets the code back (to test without sending)."""
    from apps.accounts.access import can_admin

    from . import setup_consent

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    try:
        code, on_screen = setup_consent.start(request.user, str(request.data.get("method") or ""), request.data.get("to"))
    except setup_consent.ConsentError as e:
        return Response({"detail": str(e)}, status=400)
    local = request.get_host().split(":")[0] in ("localhost", "127.0.0.1", "[::1]") and request.user.is_staff
    from apps.sandbox import service as _sb

    visible = on_screen or local or _sb.code_visible()
    return Response({"sent": True, "code": code if visible else None, **({"sandbox_code": code} if _sb.code_visible() else {})})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_owner(request, step):
    """Licence form: the contact e-mail address is known on the easy2edit server already. step = lookup ({email} -> {exists}), company ({name} -> {exists, hint}), send ({email} or {company} -> a code goes to that address), fetch ({challenge, code} -> {fields} to fill in)."""
    from apps.accounts.access import can_admin

    from . import ownerlookup

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    if step not in ("lookup", "company", "search", "address", "contacts", "send", "fetch"):
        return Response({"detail": "Onbekende stap."}, status=404)
    body = {k: str(request.data.get(k) or "")[:300] for k in ("email", "name", "company", "challenge", "code", "q", "entity", "user", "street", "house_number", "postal_code", "city")}
    try:
        return Response(ownerlookup.ask(step, body))
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_kvk(request, step):
    """Licence form: a Dutch company from the KVK Handelsregister (link in Admin -> API keys). step = search ({q} -> {linked, results}) or profile ({kvk} -> {fields}). The key stays on this server."""
    from django.core.cache import cache

    from apps.accounts.access import can_admin
    from apps.integrations import kvk

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    if step not in ("search", "profile"):
        return Response({"detail": "Onbekende stap."}, status=404)
    if not kvk.settings():
        return Response({"linked": False, "results": []} if step == "search" else {"detail": "De koppeling met de KVK is niet ingesteld."}, status=200 if step == "search" else 400)
    key = f"kvk:rate:{request.user.pk}"
    n = (cache.get(key) or 0) + 1
    cache.set(key, n, 3600)
    if n > 60:
        return Response({"detail": "Even rustig: je zoekt te vaak. Probeer het over een uur opnieuw."}, status=429)
    try:
        if step == "search":
            return Response({"linked": True, "results": kvk.search(request.data.get("q"))})
        return Response(kvk.profile(request.data.get("kvk")))
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_address(request, step):
    """Licence form: find a business or an address on a text ("bol.com Utrecht", "3542 DH 46") with the free sources PDOK and OpenStreetMap. step = search ({q} -> {source, results}). No key is needed."""
    from django.core.cache import cache

    from apps.accounts.access import can_admin
    from apps.integrations import addresssearch

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    if step != "search":
        return Response({"detail": "Onbekende stap."}, status=404)
    key = f"gadres:rate:{request.user.pk}"
    n = (cache.get(key) or 0) + 1
    cache.set(key, n, 3600)
    if n > 60:
        return Response({"detail": "Even rustig: je zoekt te vaak. Probeer het over een uur opnieuw."}, status=429)
    try:
        return Response(addresssearch.search(request.data.get("q")))
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def address_lookup(request):
    """Address lookup for every logged-in person (the profile: Postcode + Zoeken): GET /api/address/lookup/?q=3542 DH 46 -> {source, results: [{street, house_number, postal_code, city, country, ...}]}. The free sources PDOK and OpenStreetMap; 30 per hour per person."""
    from django.core.cache import cache

    from apps.integrations import addresssearch

    key = f"alookup:rate:{request.user.pk}"
    n = (cache.get(key) or 0) + 1
    cache.set(key, n, 3600)
    if n > 30:
        return Response({"detail": "Even rustig: je zoekt te vaak. Probeer het over een uur opnieuw."}, status=429)
    q = request.query_params.get("q") if request.method == "GET" else request.data.get("q")
    try:
        return Response(addresssearch.search(q))
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def address_search(request):
    """Address search as plain JSON: GET /api/address/search/?q=RST Coaching 3542 DH (or POST {q}) -> {source: free, results: [{id, naam, adres, street, house_number, postal_code, city, country, bron}]}.
    Through the free sources PDOK and OpenStreetMap. For administrators; 60 requests per hour per user."""
    from django.core.cache import cache

    from apps.accounts.access import can_admin
    from apps.integrations import addresssearch

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    key = f"gadres:rate:{request.user.pk}"
    n = (cache.get(key) or 0) + 1
    cache.set(key, n, 3600)
    if n > 60:
        return Response({"detail": "Even rustig: je zoekt te vaak. Probeer het over een uur opnieuw."}, status=429)
    q = request.query_params.get("q") if request.method == "GET" else request.data.get("q")
    try:
        return Response(addresssearch.search(q))
    except ValueError as e:
        return Response({"detail": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def system_setup_password(request):
    """A new password for the contact person (the refresh button of the set-up wizard): {password}."""
    from apps.accounts.access import can_admin

    from . import entity

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    return Response({"password": entity.generate_password()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def system_setup_consent_verify(request):
    from apps.accounts.access import can_admin

    from . import setup_consent

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    from . import terms

    if str(request.data.get("code") or "").strip() == "@" and request.user.is_staff:  # a superadmin passes the code with an @
        setup_consent.mark_ok(request.user)
        _sign_terms_with_consent(request, "skipped")
        return Response({"ok": True, "bypass": True})
    try:
        setup_consent.verify(request.user, request.data.get("code"))
    except setup_consent.ConsentError as e:
        return Response({"detail": str(e)}, status=400)
    _sign_terms_with_consent(request, "email")
    return Response({"ok": True})


def _sign_terms_with_consent(request, method):
    """Accepting the terms in the set-up wizard (read to the end, confirmed with a code) is the signature of the terms of this person too: the terms screen does not ask again."""
    from . import terms

    try:
        if request.user.is_authenticated and terms.required(request.user) and not terms.signed(request.user, terms.current().version):
            terms._record(request.user, request, str(request.data.get("lang") or "")[:10], method)
    except Exception:  # noqa: BLE001
        __import__("logging").getLogger(__name__).exception("terms signature after the consent")


def _license_brief():
    """The licence that was made: number, who it is for, the main address, the end date and the period (None when there is none yet)."""
    from .models import License

    lic = License.objects.filter(pk=1).first()
    if not lic or not lic.number:
        return None
    return {"number": lic.number, "client": lic.client, "main_url": lic.main_url, "valid_until": lic.valid_until.isoformat() if lic.valid_until else "", "renew_months": lic.renew_months, "issued_at": lic.issued_at.isoformat() if lic.issued_at else ""}


def _pay_info(user):
    from . import license_price, setup_pay

    return {"required": setup_pay.required(), "provider": setup_pay.provider(), "mode": setup_pay.mode(), "ok": setup_pay.ok(user)}


def _license_server():
    """Where the licence comes from, quickly (no call over the network): this is the easy2edit server | linked to the easy2edit server (licence server) | disconnected | local (not linked)."""
    from . import global_settings, sitemanager

    st = sitemanager._state()
    if sitemanager.server_enabled():
        mode = "server"
    elif st.get("disconnected"):
        mode = "disconnected"
    elif st.get("token"):
        mode = "linked"
    else:
        mode = "local"
    return {"mode": mode, "url": global_settings.get().get("api_url", "") if mode in ("linked", "disconnected") else "", "last_ok_at": st.get("last_ok_at", "") if mode == "linked" else ""}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def license_change(request):
    """Did the price of the licence change since it was made or last updated (a module or plugin was switched on or off)? {changed, old, new, delta, has}.
    A licence that has no price on record yet gets the current one as its starting point (nothing changed)."""
    from decimal import Decimal

    from . import license_price
    from .models import License

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    lic = License.objects.filter(pk=1).first()
    if not lic or not lic.number:
        return Response({"has": False, "changed": False})
    now = license_price.monthly(lic)
    item = None
    kind, _, key = str(request.query_params.get("item") or "").partition(":")  # the module or plugin that was just switched: what it is and what it costs (per month, incl. VAT)
    if kind in ("plugin", "module") and key:
        c = next((x for x in license_price.catalog() if x["kind"] == kind and x["key"] == key), None)
        if c:
            item = {"label": c["label"], "price": str(c["price"]), "kind": kind}
    if lic.billed_monthly <= 0:  # a licence without a price on record: the price from before this switch is the starting point
        before = now
        if item and request.query_params.get("enabled") in ("1", "0"):
            before = now - c["price"] if request.query_params.get("enabled") == "1" else now + c["price"]
        lic.billed_monthly = before
        lic.save(update_fields=["billed_monthly"])
    d = (now - lic.billed_monthly).quantize(Decimal("0.01"))
    act = None  # what this one switch did: switched on = more expensive, switched off = cheaper (by the price of that module or plugin), whatever the licence was made for
    if item and c and request.query_params.get("enabled") in ("1", "0") and c["price"] > 0:
        step = c["price"] if request.query_params.get("enabled") == "1" else -c["price"]
        act = {"old": str(now - step), "new": str(now), "delta": str(step)}
    return Response({"has": True, "item": item, "action": act, "billed": str(lic.billed_monthly), "changed": d != 0, "old": str(lic.billed_monthly), "new": str(now), "delta": str(d), "number": lic.number, "renew_months": lic.renew_months, "payment_method": lic.payment_method or "", "sub_active": bool(lic.sub_ref)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def license_update_reset(request):
    """The update screen is opened (again): the agreement (code) and the payment start empty, they must be given again."""
    from . import setup_consent, setup_pay

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    setup_consent.clear(request.user)
    setup_pay.clear(request.user)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def license_update_pay(request):
    """Update mode, payment step (after the consent with the code): POST {choice: "confirm"|"none"}. confirm = the new amount is paid the way the licence is paid
    (the Stripe subscription or the invoice on the 1st of the month); none = not paying: allowed, the licence then runs on with the new price, the warning is shown first."""
    from . import setup_consent, setup_pay
    from .models import License

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    lic = License.objects.filter(pk=1).first()
    if not lic or not lic.number:
        return Response({"detail": "Er is nog geen licentie."}, status=400)
    if not setup_consent.ok(request.user):
        return Response({"detail": "Geef akkoord met de code die je per e-mail of SMS krijgt.", "errors": {"consent": "Geef akkoord met de code die je per e-mail of SMS krijgt."}}, status=400)
    choice = str(request.data.get("choice") or "")
    if choice == "none":
        setup_pay.mark_skipped(request.user)
    elif choice == "confirm":
        setup_pay.mark_ok(request.user)
    else:
        return Response({"detail": "Kies bevestigen of niet betalen."}, status=400)
    return Response({"ok": True, "skipped": choice == "none"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def license_update_apply(request):
    """Update mode, last step: the licence runs on with the new price (same number). Needs the consent with the code. A Stripe subscription collects the new amount from the next period."""
    from . import license_price, licence_notify, license_stripe, setup_consent, setup_pay, system
    from .models import License

    if (bad := _setup_pay_guard(request)) is not None:
        return bad
    lic = License.objects.filter(pk=1).first()
    if not lic or not lic.number:
        return Response({"detail": "Er is nog geen licentie."}, status=400)
    if not setup_consent.ok(request.user):
        return Response({"detail": "Geef akkoord met de code die je per e-mail of SMS krijgt.", "errors": {"consent": "Geef akkoord met de code die je per e-mail of SMS krijgt."}}, status=400)
    if not setup_pay.ok(request.user):
        return Response({"detail": "Bevestig eerst de betaling.", "errors": {"pay": "Bevestig eerst de betaling."}}, status=400)
    old, now = lic.billed_monthly, license_price.monthly(lic)
    lic.billed_monthly = now
    lic.save(update_fields=["billed_monthly"])
    license_price.refresh()
    try:
        license_stripe.sync_price(lic)
    except license_stripe.StripeError:
        pass
    system.license_changed()
    setup_consent.clear(request.user)
    setup_pay.clear(request.user)
    licence_notify.notify("changed", [f"Prijs per maand (incl. btw): € {old} → € {now}"], by=request.user)
    return Response({"ok": True, "license": _license_brief(), "old": str(old), "new": str(now)})


def _license_exists():
    from .models import License

    lic = License.objects.filter(pk=1).first()
    return bool(lic and lic.number)


RESERVED_KEY = "setup-license-number"


def _reserved_number():
    """The licence number that the wizard shows in its last step (it becomes active when the licence is made): made once, kept until then."""
    import secrets

    from django.core.cache import cache

    n = cache.get(RESERVED_KEY)
    if not n:
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I: easy to read out
        n = "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(4))
        cache.set(RESERVED_KEY, n, 7 * 24 * 3600)
    return n


def _make_license(until=None, months=None, hosting=None, user=None):
    """After the basic data are complete and there is no licence yet: it is made by itself (number, client, address, main address) and runs for the date the user chose (default one year)."""
    import secrets
    from datetime import date, timedelta

    from django.utils import timezone

    from .models import License

    if system.setup_missing():
        return
    s = system.get()
    lic, _ = License.objects.get_or_create(pk=1)
    if not lic.number:
        lic.number = _reserved_number()  # the number that was shown in the last step of the wizard
        __import__("django.core.cache", fromlist=["cache"]).cache.delete(RESERVED_KEY)
        lic.issued_at = timezone.now()
        lic.valid_until = until or (date.today() + timedelta(days=365))
        if months in (1, 3, 12):
            lic.renew_months = months
        if hosting:
            lic.hosting = str(hosting)[:30]
    lic.client = lic.client or (s.get("company_name") or s.get("site_name") or "")[:200]
    if not lic.client_address:
        lic.client_parts = {k: s.get(k, "") for k in system.ADDRESS_PARTS}
        lic.client_address = (s.get("address") or "")[:300]
    lic.main_url = lic.main_url or s.get("frontend_url", "")
    from . import license_price

    lic.billed_monthly = license_price.monthly(lic)
    lic.save()
    system.license_changed()
    from . import licence_notify

    licence_notify.notify("created", by=user)
    try:  # the licence makes the entity of the website (the company) and the contact person as a user, linked to it
        from . import entity

        entity.ensure_from_licence()
        from . import everyone

        everyone.ensure()  # the standard group "Everyone" with all users in it
    except Exception:  # noqa: BLE001 - never stop the licence for this
        __import__("logging").getLogger(__name__).exception("entity could not be made from the licence")
    try:  # the owner and the company also go to the easy2edit master site (invoices are linked to them); in the background, never in the way of the licence
        from . import siteowners

        siteowners.mark_local()
        siteowners.push_async(fresh=True)
    except Exception:  # noqa: BLE001
        __import__("logging").getLogger(__name__).exception("site owner could not be sent")


def _licence_data_changed(old_owner):
    """The onboarding was done again with a licence: the name and the address go to the licence, to the entity and the contact person here, and to the easy2edit master site
    (the same owner and company there: their id and easy2edit id stay the same). Never stops the save."""
    from . import entity, siteowners
    from .models import License

    s = system.get()
    try:
        lic = License.objects.filter(pk=1).first()
        if lic:
            lic.client = (s.get("company_name") or s.get("site_name") or lic.client or "")[:200]
            lic.client_parts = {k: s.get(k, "") for k in system.ADDRESS_PARTS}
            lic.client_address = (s.get("address") or lic.client_address or "")[:300]
            if s.get("frontend_url"):
                lic.main_url = s["frontend_url"]
            lic.save(update_fields=["client", "client_parts", "client_address", "main_url"])
            system.license_changed()
        entity.apply_system_changes(s, old_owner)
        siteowners.push_async(force=True)
    except Exception:  # noqa: BLE001
        __import__("logging").getLogger(__name__).exception("the changed data could not be passed on")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def license_hosting(request):
    """Onboarding: change the hosting (and the period) of the licence that is there. POST {hosting, renew_months}. The price changes with it: the answer has what it was before (`prev`, to put it back
    when the person does not go on) and the licence goes through the update screen (agreement and payment) with /system/license/change/. A way back: POST {back: {hosting, renew_months}}."""
    from apps.accounts.access import can_admin

    from . import license_price
    from .models import License

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    lic = License.objects.filter(pk=1).first()
    if not lic or not lic.number:
        return Response({"detail": "Er is nog geen licentie."}, status=400)
    d = request.data.get("back") if isinstance(request.data.get("back"), dict) else request.data
    host, months = str(d.get("hosting") if d.get("hosting") is not None else lic.hosting), d.get("renew_months", lic.renew_months)
    if host and host not in {o["key"] for o in license_price.hosting_options()} | {""}:
        return Response({"detail": "Kies een hosting uit de lijst."}, status=400)
    try:
        months = int(months)
    except (TypeError, ValueError):
        months = 0
    if months not in (1, 3, 12):
        return Response({"detail": "Kies per maand, per kwartaal of per jaar."}, status=400)
    prev = {"hosting": lic.hosting, "renew_months": lic.renew_months}
    lic.hosting, lic.renew_months = host[:30], months
    lic.save(update_fields=["hosting", "renew_months"])
    system.license_changed()
    return Response({"ok": True, "prev": prev, "now": {"hosting": lic.hosting, "renew_months": lic.renew_months}, "monthly": str(license_price.monthly(lic)), "billed": str(lic.billed_monthly)})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def system_setup(request):
    """Set-up form for the basic data. GET: the required fields that are still empty (+ the current values). PUT: save them (all required).
    Administrators, superadmins and superadmin+ may fill it in; only a superadmin (is_staff) may close it without filling it in (can_skip)."""
    from apps.accounts.access import can_admin

    if not can_admin(request.user):
        return Response({"missing": [], "needed": False, "can_skip": False, "settings": {}})
    if request.method == "PUT":
        data = {k: v for k, v in request.data.items() if k in system.SETUP_FIELDS}
        cleaned, errors = system.clean(data)
        merged = {**{k: system.split_contact(system.get()).get(k, "") for k in system.SETUP_FIELDS}, **cleaned}
        for k in system.SETUP_FIELDS:
            if not str(merged.get(k) or "").strip():
                errors[k] = "Dit veld is verplicht."
        for k in system.PHONE_FIELDS:
            if k in cleaned and cleaned[k] and len(re.sub(r"\D", "", cleaned[k])) < 6:
                errors[k] = "Geef een geldig telefoonnummer op."
        until, months = None, None
        if "renew_months" in request.data and not _license_exists():  # the subscription: per month, quarter or year
            try:
                months = int(request.data.get("renew_months"))
            except (TypeError, ValueError):
                months = 0
            if months not in (1, 3, 12):
                errors["renew_months"] = "Kies per maand, per kwartaal of per jaar."
        if "hosting" in request.data and not _license_exists():
            from . import license_price

            if str(request.data.get("hosting")) not in {o["key"] for o in license_price.hosting_options()}:
                errors["hosting"] = "Kies een hosting uit de lijst."
        if not _license_exists():
            from . import setup_consent, setup_pay

            if setup_pay.required() and not setup_pay.ok(request.user):  # paying (Stripe subscription) comes before the consent and the licence
                errors["pay"] = "Betaal eerst het abonnement."

            if not setup_consent.ok(request.user):  # the licence is made only after the consent with a code (e-mail or SMS)
                errors["consent"] = "Geef akkoord met de code die je per e-mail of SMS krijgt."
        if "license_until" in request.data and not _license_exists():  # the end date the user chose for the licence that is made now (default: one year)
            from datetime import date

            try:
                until = date.fromisoformat(str(request.data.get("license_until") or ""))
                if until <= date.today():
                    errors["license_until"] = "Kies een einddatum in de toekomst."
            except ValueError:
                errors["license_until"] = "Geef een geldige datum."
        if errors:
            return Response({"detail": " ".join(errors.values()), "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
        from . import setup_pay as _sp

        if not _license_exists() and _sp.skipped(request.user):  # not paid: the licence runs for a short time only
            from datetime import date as _date, timedelta as _td

            until = _date.today() + _td(days=_sp.TRIAL_DAYS)
        __import__("apps.core.entity", fromlist=["x"]).set_pending_password(request.data.get("contact_password"))  # the password that the wizard showed for the contact person
        had_licence = _license_exists()
        old_owner = None
        if had_licence:
            from . import siteowners

            old_owner = siteowners.owner_user()  # (the contact person as he is now: a changed e-mail address changes this person)
        system.save(cleaned)
        __import__("apps.core.reset", fromlist=["x"]).mark_form_done()  # (the form of the onboarding that was started again is done: the installation and the design wizard follow)
        _make_license(until, months, request.data.get("hosting"), request.user)
        if had_licence:
            _licence_data_changed(old_owner)
        __import__("apps.core.setup_consent", fromlist=["x"]).clear(request.user)
        __import__("apps.core.setup_pay", fromlist=["x"]).clear(request.user)
    cur = system.split_contact(system.get())
    missing = system.setup_missing()
    me = request.user  # what is known about the person who is logged in: the form uses it for the fields that are still empty
    street, nr = str(getattr(me, "address", "") or "").strip(), ""
    m = re.match(r"^(.+?)\s+(\d+\s?[A-Za-z]?(?:[-/ ]?\d+[A-Za-z]?)?)$", street)  # "Talmastraat 24" -> street + house number
    if m:
        street, nr = m.group(1), m.group(2)
    suggest = {"contact_first_name": me.first_name, "contact_last_name": me.last_name, "contact_email": me.email, "mobile": me.mobile,
               "street": street, "house_number": nr, "postal_code": getattr(me, "postal_code", ""), "city": getattr(me, "city", ""), "country": getattr(me, "country", "")}
    suggest = {k: str(v).strip() for k, v in suggest.items() if str(v or "").strip() and not str(cur.get(k) or "").strip()}
    from datetime import date, timedelta

    needs_license = not _license_exists()
    replay = __import__("apps.core.reset", fromlist=["x"]).replay_pending()  # the onboarding was started again: the form opens as a check of what is there
    return Response({"license": _license_brief(), "needs_license": needs_license, "license_number": _reserved_number() if needs_license else None, "hosting_current": (__import__("apps.core.models", fromlist=["x"]).License.objects.filter(pk=1).values_list("hosting", flat=True).first() or ""), "pay": _pay_info(request.user), "license_server": _license_server(), "consent_methods": __import__("apps.core.setup_consent", fromlist=["x"]).methods(), "consent_ok": __import__("apps.core.setup_consent", fromlist=["x"]).ok(request.user), "renew_months": (__import__("apps.core.models", fromlist=["x"]).License.objects.filter(pk=1).values_list("renew_months", flat=True).first() or 12), "hosting_options": __import__("apps.core.license_price", fromlist=["x"]).hosting_options(), "hosting_default": ((__import__("apps.core.pricing", fromlist=["x"]).load().get("hosting") or {}).get("default") or "shared"), "license_until": (date.today() + timedelta(days=365)).isoformat(), "missing": missing, "needed": bool(missing) or (replay and not __import__("apps.core.reset", fromlist=["x"]).replay_form_done()), "replay": replay, "can_skip": bool(request.user.is_staff), "fields": list(system.SETUP_FIELDS), "suggest": suggest,
                     "settings": {k: cur.get(k, "") for k in system.SETUP_FIELDS}})


@api_view(["GET", "PUT"])
@permission_classes([has_level("system", "manage"), module_required("system")])
def system_settings(request):
    if request.method == "PUT":
        cleaned, errors = system.clean(request.data)
        if errors:
            return Response({"detail": " ".join(errors.values()), "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
        system.save(cleaned)
    return Response({"settings": system.get(), "checks": system.checks(request), "env": system.env_files(), "environments": system.ENVIRONMENTS, "currencies": system.CURRENCIES,
                     "request_origin": f"{request.scheme}://{request.get_host()}"})


@api_view(["GET", "PUT", "POST"])
@permission_classes([IsAuthenticated])
def system_cache(request):
    """Admin -> Basisgegevens -> Cache. GET: the cache in use + the system cache settings. PUT {backend, redis_url, system_cache, system_cache_seconds}: save (the cache itself takes effect after a restart).
    POST: clear the system cache now."""
    from . import syscache

    from apps.accounts.access import level

    is_super = request.user.is_staff
    if not (is_super or level(request.user, "system") >= 3):  # an administrator (manage rights on the base data) may switch the system cache and clear it; the kind of cache is for a superadmin
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "PUT" and "backend" in request.data and not is_super:
        return Response({"detail": "Alleen superadmins mogen kiezen welke cache de server gebruikt."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "POST":
        syscache.clear()
    elif request.method == "PUT":
        part = {k: request.data[k] for k in ("system_cache", "system_cache_seconds", "page_cache", "page_cache_seconds") if k in request.data}
        if part:
            cleaned, errors = system.clean(part)
            if errors:
                return Response({"detail": " ".join(errors.values()), "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
            system.save(cleaned)
        if "backend" in request.data:
            _, err = syscache.save_backend({"backend": request.data.get("backend"), "redis_url": request.data.get("redis_url")})
            if err:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    s = system.get()
    return Response({**syscache.info(), "system_cache": bool(s["system_cache"]), "system_cache_seconds": str(s["system_cache_seconds"]), "page_cache": bool(s["page_cache"]), "page_cache_seconds": str(s["page_cache_seconds"])})


GATED_PLUGINS = ("siteimport",)  # parts that are always in the menu: a click asks to install and switch them on when they are not


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def plugin_gate(request):
    """A part that is always in the menu (Website ontwerpen / Webdesign): GET ?plugin=siteimport = is it installed and on, and what does switching it on cost (and the steps);
    POST {plugin, step: install | enable | price} = do one step. For a superadmin, or someone with manage rights on the base data."""
    from apps.accounts.access import level
    from apps.plugins import installer, runtime, switch
    from apps.plugins.models import Plugin

    from . import pricing

    name = str(request.query_params.get("plugin") or request.data.get("plugin") or "")
    if name not in GATED_PLUGINS:
        return Response({"detail": "Onbekend onderdeel."}, status=status.HTTP_400_BAD_REQUEST)
    allowed = bool(request.user.is_staff or level(request.user, "system") >= 3)
    p = Plugin.objects.filter(name=name).first()
    installed = bool(p) and not installer.needs_install(name)
    on = bool(p and p.enabled and installed and not (p.error or ""))
    if request.method == "GET":
        info = pricing.extra_for_plugin(name)
        vat = Decimal(str(pricing.load()["vat_rate"]))
        extra = Decimal(info["extra"])
        steps = []
        if not installed:
            steps.append({"key": "install", "label": "Installeren uit de bibliotheek"})
        if not on:
            steps.append({"key": "enable", "label": "Inschakelen" + (" (met wat het nodig heeft)" if len(info["plugins"]) > 1 else "")})
        steps.append({"key": "price", "label": "Prijs en licentie bijwerken"})
        return Response({"plugin": name, "title": info["title"], "installed": installed, "on": on, "allowed": allowed, "needs": info["plugins"], "extra_ex": str(extra), "extra_inc": str((extra * (100 + vat) / 100).quantize(Decimal("0.01"))), "vat_rate": str(vat), "currency": "EUR",
                         "steps": steps if not on else [], "error": (p.error if p else "") or ""})
    if not allowed:
        return Response({"detail": "Dit mag alleen een beheerder met rechten voor de basisgegevens of een superadmin."}, status=status.HTTP_403_FORBIDDEN)
    step = str(request.data.get("step") or "")
    try:
        if step == "install":
            if installed or installer.install_from_library(name) is not None:
                pass
            if installer.needs_install(name):
                return Response({"detail": installer.LAST_ERROR.get("text") or "Installeren uit de bibliotheek is niet gelukt."}, status=status.HTTP_409_CONFLICT)
        elif step == "enable":
            p = Plugin.objects.filter(name=name).first()
            if not p:
                return Response({"detail": "De plugin is niet geïnstalleerd."}, status=status.HTTP_409_CONFLICT)
            switch.set_enabled(p, True, with_requires=True)
        elif step == "price":
            pricing.apply_to_license()
        else:
            return Response({"detail": "Onbekende stap."}, status=status.HTTP_400_BAD_REQUEST)
    except switch.SwitchError as e:
        return Response({"detail": str(e)}, status=status.HTTP_409_CONFLICT)
    except Exception as e:  # noqa: BLE001
        logger.exception("Plugin gate %s %s", name, step)
        return Response({"detail": f"Het lukte niet: {str(e)[:200]}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({"ok": True, "step": step})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def system_restart(request):
    """Superadmin: GET = can this server be restarted from here (and how); POST = restart it (a graceful reload; the screen waits until the server answers again)."""
    from . import restart

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins mogen de server herstarten."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        return Response({"mode": restart.mode()})
    res = restart.restart()
    if not res["ok"]:
        return Response({"detail": "Herstarten kan niet vanuit hier op deze server: herstart de service of de container zelf.", "mode": res["mode"]}, status=status.HTTP_400_BAD_REQUEST)
    return Response(res)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def system_reset(request):
    """Back to a clean system (see apps/core/reset.py). Superadmins only. GET: what would go. POST {confirm: "RESET", password}: do it."""
    from . import reset

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins mogen het systeem resetten."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "GET":
        return Response(reset.summary())
    replay = request.data.get("mode") == "replay"  # the switch "Onboarding": do the onboarding again, nothing is removed (confirmed with REPLAY)
    word = str(request.data.get("confirm", "")).strip()
    if (word.upper() != "REPLAY") if replay else (word != "RESET"):  # (REPLAY removes nothing: upper or lower case is fine; RESET has to be typed exactly)
        return Response({"detail": "Typ REPLAY om te bevestigen." if replay else "Typ RESET om te bevestigen."}, status=status.HTTP_400_BAD_REQUEST)
    from apps.accounts import devlogin

    if not devlogin.check(request, request.user, request.data.get("password", "")):  # (on your own computer also the password that @ fills in)
        return Response({"detail": "Het wachtwoord klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
    if replay:
        return Response({"replay": reset.replay_onboarding()})
    who_email, who_name, who_level = request.user.email, (getattr(request.user, "display_name", "") or request.user.get_full_name()), __import__("apps.auditlog.service", fromlist=["rank_of"]).rank_of(request.user)
    removed = reset.perform(request.user, ai=bool(request.data.get("ai")), delete_admins=bool(request.data.get("delete_admins")), delete_superadmins=bool(request.data.get("delete_superadmins")), keep_identity=bool(request.data.get("keep_identity")), remove_remote=bool(request.data.get("remove_remote")))
    audit = __import__("apps.auditlog.service", fromlist=["log"])
    clear_logs = bool(request.data.get("clear_logs"))  # the switch "Logboek legen" of the reset screen
    if clear_logs:
        audit.LogEntry.objects.all().delete()
    audit.log("system.reset", None, detail="logboek geleegd" if clear_logs else "logboek bewaard", request=request, level=who_level, actor_email=who_email, actor_name=who_name)
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


@api_view(["GET", "PUT", "POST"])
@permission_classes([IsAuthenticated])
def global_settings_view(request):
    """Default and global settings (the data of the default easy2edit server): superadmin+ only. GET: the values and the standard. PUT: save them."""
    from . import global_settings

    if not request.user.is_superplus:  # the data of the easy2edit server: superadmin+ only
        return Response({"detail": "Alleen een superadmin+."}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "POST":  # {action: "test_source"}: can this installation reach the library of the easy2edit server?
        from . import resources

        if request.data.get("action") != "test_source":
            return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
        ok, message = resources.test_source()  # message: the number of items, or the reason (disabled | refused | unreachable)
        return Response({"ok": ok, "message": message, **({} if ok else {"source": message})}, status=status.HTTP_200_OK)
    if request.method == "PUT":
        values, errors = global_settings.clean(request.data if isinstance(request.data, dict) else {})
        if errors:
            return Response({"detail": " ".join(errors.values()), "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
        global_settings.save(values)
    return Response({"values": global_settings.get(), "defaults": global_settings.DEFAULTS, "labels": global_settings.LABELS})


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

    if not request.user.is_superplus:  # the price list is an easy2edit matter: superadmin+ only
        return Response({"detail": "Alleen een superadmin+."}, status=status.HTTP_403_FORBIDDEN)
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

    if not request.user.is_superplus:  # (superadmin+ only, like the price list itself)
        return Response({"detail": "Alleen een superadmin+."}, status=status.HTTP_403_FORBIDDEN)
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
            sending.send_email(to, f"{t['title']} easy2edit – {site}", f"{t['title']}: {site}\n\n{t['total']}: {pricing_pdf.eur(plan['monthly'])}\n\n{t['contact']}", attachments=files)
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
    if d.get("apply") or d.get("config"):  # every phone number of the customer and the reseller has a country code
        from . import phone as _phone

        for who in ("customer", "reseller"):
            for f in ("phone", "mobile"):
                bad = _phone.check(((d.get(who) or {}) if isinstance(d.get(who), dict) else {}).get(f))[1]
                if bad:
                    return Response({"detail": f"{bad} ({'klant' if who == 'customer' else 'reseller'}: {f})"}, status=status.HTTP_400_BAD_REQUEST)
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
    try:  # a new default configuration (installations.json from a site update) is on this site at once, not only after a restart; unchanged file = nothing happens
        from . import installations_config

        installations_config.apply()
    except Exception:  # noqa: BLE001 - the list must always open
        logger.exception("installations.json could not be applied")
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

    from apps.accounts import access

    staff = request.user.is_staff
    if not staff and access.level(request.user, "system") < 3:  # a superadmin, or an admin who manages the system
        return Response({"detail": "Alleen beheerders."}, status=status.HTTP_403_FORBIDDEN)
    host = (request.get_host() or "").split(":")[0].lower().strip("[]")
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    if staff and not (obj.data or {}).get("welcome_asked") and not (obj.data or {}).get("onboarding_started"):  # the colour question is still open: this is a new installation, its onboarding starts now
        obj.data = {**(obj.data or {}), "onboarding_started": True}
        obj.save()
    if request.method == "POST":
        if staff and "on" in request.data and request.data.get("on"):
            ModuleState.objects.update_or_create(key="sandbox", defaults={"enabled": True})
            modules.invalidate()
            sandbox.save({"enabled": True})
        if staff and "on" in request.data:
            obj.data = {**(obj.data or {}), "sandbox_asked": True}
        if staff and request.data.get("welcome"):  # the very first popup (language and light or dark) was answered
            obj.data = {**(obj.data or {}), "welcome_asked": True, "onboarding_started": True}  # (a new installation: its onboarding is not complete until the design wizard started)
        if request.data.get("manual"):  # the question whether to look at the manual (first start, or after the installation) was answered
            obj.data = {**(obj.data or {}), "manual_asked": True}
        obj.save()
    # "local": the address of this server is your own computer (not a real domain)
    local = host in ("localhost", "127.0.0.1", "::1", "0.0.0.0") or host.endswith(".localhost") or host.endswith(".local")
    if not staff:  # the question about the sandbox on your own computer is for the superadmin
        local = False
    return Response({"local": local, "asked": bool((obj.data or {}).get("sandbox_asked")), "manual_asked": bool((obj.data or {}).get("manual_asked")), "welcome_asked": bool((obj.data or {}).get("welcome_asked")) or not staff, "enabled": sandbox.active()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def onboarding_done(request):
    """The onboarding that was started again has come to its last step (the design wizard starts): it does not come back at the next login."""
    from apps.accounts.access import can_admin

    if not can_admin(request.user):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=403)
    __import__("apps.core.onboarding", fromlist=["x"]).mark_complete()  # (also ends the onboarding done again)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def onboarding_status(request):
    """Where the onboarding stands for this person (a superadmin; for everybody else it is complete): {complete, next, next_label, steps}."""
    return Response(__import__("apps.core.onboarding", fromlist=["x"]).status(request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def presets_setup(request):
    """After logging in: is no standard installation set yet? Then a superadmin is asked which of the offered ones to install (one). {needed, presets: [{key, name, desc}]}."""
    from . import presets

    replay = __import__("apps.core.reset", fromlist=["x"]).replay_pending()  # the onboarding done again: the installation is shown as a check, with the one in use chosen
    if not request.user.is_staff or (presets.active() and not replay):
        return Response({"needed": False})
    keys = list(dict.fromkeys([*([presets.active()] if replay and presets.active() else []), *presets.default_keys()]))
    return Response({"needed": True, "replay": replay, "active": presets.active() if replay else None, "presets": [{"key": k, "name": presets.get(k)["name"], "desc": presets.get(k).get("desc", "")} for k in keys]})


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
    choice = request.data.get("theme")  # "standard" | "keep" | the key of another theme package (False = keep, like before)
    choice = "keep" if choice is False else ("standard" if choice in (None, True, "") else str(choice))
    if choice not in ("standard", "keep"):
        from . import themepacks

        if not themepacks.manifest_of(choice):
            return Response({"detail": "Dit thema bestaat niet."}, status=status.HTTP_400_BAD_REQUEST)
    out = presets.apply(key, overwrite_pages=bool(request.data.get("overwrite_pages")), install_design=request.data.get("design") is not False, use_theme=choice != "keep", theme_choice=choice)
    __import__("apps.auditlog.service", fromlist=["log"]).log("installation.applied", request.user, target=key, request=request)
    return Response(out)


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
    out = presets.unapply(key)
    __import__("apps.auditlog.service", fromlist=["log"]).log("installation.removed", request.user, target=key, request=request)
    return Response(out)


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


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def presets_design(request, key):
    """The tab Design of a standard installation (superadmins). GET: the pages that can be chosen and the ones that are kept. POST {pages: [keys]}: keep exactly these pages (with their pictures) in the installation."""
    from . import preset_design, presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if key not in presets.BY_KEY:
        return Response({"detail": "Onbekende installatie."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "POST":
        pages = request.data.get("pages")
        if not isinstance(pages, list):
            return Response({"detail": "Ongeldige keuze."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(preset_design.save(key, [str(k) for k in pages], preset_design.own_origin(request)))
        except Exception as e:  # noqa: BLE001 - a package that cannot be made (a page that is gone, a picture that cannot be read) is shown as text
            return Response({"detail": str(e) or "De pagina's konden niet worden opgeslagen."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(preset_design.listing(key))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_design_theme(request, key):
    """The colour theme of the installation (superadmins): {action: "capture"} keeps the look of this website in the installation, {action: "remove"} takes it away."""
    from . import preset_design, presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if key not in presets.BY_KEY:
        return Response({"detail": "Onbekende installatie."}, status=status.HTTP_404_NOT_FOUND)
    act = request.data.get("action")
    if act == "remove":
        preset_design.remove_theme(key)
    elif act == "capture":
        try:
            preset_design.capture_theme(key)
        except Exception as e:  # noqa: BLE001
            return Response({"detail": str(e) or "Het thema kon niet worden opgeslagen."}, status=status.HTTP_400_BAD_REQUEST)
    else:
        return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"theme": preset_design.theme_info(key)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def presets_design_sample(request, key):
    """Make the picture of one page of the design again: {page: "home"} (superadmins)."""
    from . import preset_design, presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    page = str(request.data.get("page") or "")
    if key not in presets.BY_KEY or page not in preset_design.saved_keys(key):
        return Response({"detail": "Onbekende pagina."}, status=status.HTTP_404_NOT_FOUND)
    preset_design.sample_file(key, page).unlink(missing_ok=True)
    preset_design._JOBS.pop((key, page), None)
    preset_design.start_sample(key, page, preset_design.own_origin(request))
    return Response(preset_design.listing(key))


@api_view(["GET"])
@permission_classes([AllowAny])
def presets_sample_image(request, key, page):
    """The picture of a page of a standard installation (it presents the installation, so everybody who sees the installation may see it)."""
    from django.http import FileResponse, Http404

    from . import preset_design, presets

    f = preset_design.sample_file(key, page)
    if key not in presets.BY_KEY or not f.is_file():
        raise Http404()
    r = FileResponse(open(f, "rb"), content_type="image/jpeg")
    r["Cache-Control"] = "public, max-age=300"
    return r


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
    only = str(request.data.get("key") or "")
    if only and only not in themepacks.all_keys():
        return _bad("Dit thema bestaat niet.", status.HTTP_404_NOT_FOUND)
    names = themepacks.build_dist(only or None)
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


def _client_parts(lic):
    """The address of the client in parts (street, house number, postal code, city, country): as stored, or taken from the one-line address."""
    from . import system

    parts = {k: str((lic.client_parts or {}).get(k, "")) for k in system.ADDRESS_PARTS} if lic else {}
    if lic and not any(parts.values()) and lic.client_address:
        m = system.ADDRESS_RE.match(lic.client_address)
        if m:
            parts.update(street=m["street"].strip(), house_number=m["nr"].strip(), postal_code=m["zip"].strip().upper(), city=m["city"].strip())
        else:
            parts["street"] = lic.client_address
    return parts or {k: "" for k in system.ADDRESS_PARTS}


def _license_out():
    from .models import License

    lic = License.objects.filter(pk=1).first()
    from . import license_price, system

    return {"number": lic.number if lic else "", "client": lic.client if lic else "", "client_address": lic.client_address if lic else "", "client_parts": _client_parts(lic), "main_url": lic.main_url if lic else "", "issued_at": lic.issued_at if lic else None,
            "valid_until": lic.valid_until.isoformat() if lic and lic.valid_until else None, "expired": system.license_info()["expired"],
            "price": str(license_price.refresh()), "base_price": str(license_price.config_base()), "renew_months": lic.renew_months if lic else 12, "has": system.license_info()["has"],
            "monthly": str(license_price.monthly(lic)), "quarterly": str(license_price.for_period(3, lic)), "yearly": str(license_price.for_period(12, lic)), "periods": license_price.period_overview(lic),
            "backup_included": lic.backup_included if lic else 5, "backup_slot_price": str(lic.backup_slot_price) if lic else "0.00", "backup_slots": license_price.backup_slots(),
            "reseller": {"name": lic.reseller_name, "email": lic.reseller_email, "url": lic.reseller_url} if lic else {"name": "", "email": "", "url": ""},
            "billing": __import__("apps.core.license_billing", fromlist=["state"]).state(lic) if lic else None}


@api_view(["GET", "PUT", "POST", "DELETE"])
@permission_classes([IsSuperPlus])  # superadmin+ only (the licence of the easy2edit server side)
def system_license(request):
    """GET the licence; PUT {client}; POST makes a new licence number (XXXX-XXXX-XXXX-XXXX)."""
    import secrets

    from django.utils import timezone

    from .models import License

    from . import system

    lic, _ = License.objects.get_or_create(pk=1)
    from . import licence_notify

    before = licence_notify.snapshot(lic)
    if request.method == "PUT":
        from datetime import date

        d = request.data
        if "client" in d:
            lic.client = str(d.get("client") or "").strip()[:200]
        if isinstance(d.get("client_parts"), dict):  # the address in parts, like the address of the basic data
            lic.client_parts = {k: " ".join(str(d["client_parts"].get(k) or "").split())[:12 if k == "house_number" else 80] for k in system.ADDRESS_PARTS}
            if lic.client_parts["postal_code"]:
                lic.client_parts["postal_code"] = lic.client_parts["postal_code"].upper()
            lic.client_address = system.compose_address(lic.client_parts)
        elif "client_address" in d:
            lic.client_address = str(d.get("client_address") or "").strip()[:300]
            lic.client_parts = {}
        if "main_url" in d:
            url = system.with_scheme(str(d.get("main_url") or "").strip().rstrip("/"))
            if url and not system.URL_RE.match(url):
                return Response({"detail": "Gebruik een adres als www.voorbeeld.nl (zonder pad of slash erachter)."}, status=status.HTTP_400_BAD_REQUEST)
            lic.main_url = url[:300]
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
        if "payment_method" in d:  # the way the user pays: one of the three, only one is active
            from . import license_billing

            m = str(d.get("payment_method") or "")
            if m not in license_billing.METHODS:
                return Response({"detail": "Kies online betalen, automatische incasso of op rekening."}, status=400)
            if m not in (lic.allowed_methods or []):
                lic.allowed_methods = [*(lic.allowed_methods or []), m]
            if m != "auto" and lic.sub_status == "active":
                try:
                    license_billing.stop_subscription(lic)  # collecting by itself ends when another way of paying is chosen
                except license_billing.BillingError as e:
                    return Response({"detail": str(e)}, status=400)
                lic.refresh_from_db(fields=["sub_status"])
            lic.payment_method = m
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
        lic.save(update_fields=["client", "client_address", "client_parts", "main_url", "valid_until", "base_price", "renew_months", "allowed_methods", "payment_method", "backup_included", "backup_slot_price", "reseller_name", "reseller_email", "reseller_url"])
    elif request.method == "DELETE":  # empty the licence (the reseller data stays: it says where a new one is bought)
        from .reset import clear_license

        licence_notify.notify("removed", by=request.user)  # (told before it is emptied: the mail names the licence)
        clear_license()
        lic.refresh_from_db()
    elif request.method == "POST":
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I: easy to read out
        lic.number = "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(4))
        lic.issued_at = timezone.now()
        lic.save(update_fields=["number", "issued_at"])
        licence_notify.notify("number", [f"Nieuw nummer: {lic.number}"], by=request.user)
    system.license_changed()
    if request.method == "PUT":
        lic.refresh_from_db()
        changed = licence_notify.diff(before, licence_notify.snapshot(lic))
        if changed:
            licence_notify.notify("changed", changed, by=request.user)
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
@permission_classes([IsSuperPlus])  # superadmin+ only (the licence of the easy2edit server side)
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
    from . import licence_notify

    licence_notify.notify("renewed", [f"Verlengd tot {lic.valid_until.strftime('%d-%m-%Y')}"])


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
    """Info for the Info pop-up in the Beheer menu: the version of easy2edit and the installed plugins."""
    from django.conf import settings as dj

    from apps.plugins.models import Plugin

    plugins = [{"name": p.name, "title": p.manifest.get("title") or p.name, "version": p.manifest.get("version", ""), "enabled": p.enabled, "author": p.manifest.get("author", "")} for p in Plugin.objects.order_by("name")]
    from apps.core import modules, system

    sysdata = system.get()
    on = modules.states()
    mods = [{"key": m["key"], "group": m["group"], "label": m["label"], "desc": m.get("desc", ""), "enabled": bool(on.get(m["key"], True)), "core": bool(m.get("core"))} for m in modules.MODULES]
    return Response({"name": "easy2edit", "version": dj.SYSTEM_VERSION, "build": _build_number(dj), "plugins": plugins, "modules": mods, "copyright": "RST CC BV", "license": _license_out(),
                     "site": {k: sysdata.get(k, "") for k in ("site_name", "company_name", "frontend_url", "contact_person", "mobile", "contact_email", "support_email", "phone", "address", "kvk", "vat_id")}})


@api_view(["GET"])
@permission_classes([AllowAny])
def system_overview(request):
    """The page /easy2edit_version: name, version, build, the modules, the licence and the administrators (open to everybody, the owner asked for it).
    Only the prices are kept for a logged-in superadmin."""
    from django.conf import settings as dj

    from apps.accounts.models import User

    from . import modules

    on = modules.states()
    owner = modules.owner_only_keys()
    mods = [{"key": m["key"], "group": m["group"], "label": m["label"], "enabled": bool(on.get(m["key"], True)), "core": bool(m.get("core")), "plugin": bool(m.get("plugin"))}
            for m in modules.MODULES if not m.get("hidden") and (m["key"] not in owner or getattr(request.user, "is_superplus", False))]
    out = {"name": "easy2edit", "version": dj.SYSTEM_VERSION, "build": _build_number(dj), "modules": mods, "admins": None, "license": None}
    lic = _license_out()  # the licence itself is open to everybody; the prices only to a superadmin
    keys = ("number", "client", "main_url", "issued_at", "valid_until", "expired", "has", "renew_months", "reseller")
    staff = request.user.is_authenticated and request.user.is_staff
    out["license"] = {k: lic.get(k) for k in keys + (("price", "monthly", "quarterly", "yearly") if staff else ())}
    if True:  # the administrators are open to everybody too (the owner asked for it)
        out["admins"] = [{"email": u.email, "name": u.get_full_name() or u.display_name, "superadmin_plus": bool(u.is_superadmin_plus), "active": u.is_active}
                         for u in User.objects.filter(is_staff=True).order_by("-is_superadmin_plus", "email")]
    return Response(out)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def system_sms_ready(request):
    """Is SMS offered at all (a link that is on, passed its online test and has credit)? The screens show nothing about SMS when it is not."""
    from apps.security import twofa

    return Response({"sms": bool(twofa.availability()["sms"]), "messages": bool(twofa.sms_usage()["messages"])})


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
@permission_classes([IsSuperPlus])  # superadmin+ only (the licence of the easy2edit server side)
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
@permission_classes([IsSuperPlus])  # superadmin+ only (the licence of the easy2edit server side)
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
    if not __import__("apps.accounts.devlogin", fromlist=["x"]).check(request, request.user, d.get("confirm_password")):
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
            if not __import__("apps.accounts.devlogin", fromlist=["x"]).check(request, request.user, d.get("confirm_password")):
                return Response({"detail": "Het controle-wachtwoord (dat van jezelf) klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
            st = reset.read_file(d.get("file") if isinstance(d.get("file"), dict) else {}, pw)
            return Response(_apply_standard_admin(request, {"email": st["email"], "name": st.get("name") or st["email"], "password_hash": st["password_hash"], "to": "een configuratiebestand"}))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def system_update(request):
    """After an update of easy2edit: GET = does this site have to be checked, and which steps; POST {step} = do one step (see apps/core/sysupdate.py). Administrators and superadmins."""
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


# ── Website ontwerpen: the AI-creator (a step plan that is saved as a draft, then a website designed by Claude, adjusted in a chat, then imported with the html import) ──
DESIGN_PERM = [has_level_for("siteimport", {"GET": "use"}, default="manage"), module_required("siteimport")]
IMPORT_PERM = [has_level_for("page_import", {"GET": "use"}, default="manage"), module_required("siteimport")]  # importing page designs through the API has its own right (module page_import)


def _design(request, pk):
    from .models import SiteDesignJob

    try:
        return SiteDesignJob.objects.filter(pk=pk, user=request.user).first()
    except (ValueError, TypeError):
        return None


def _gone():
    return _bad("Dit ontwerp bestaat niet (meer).", status.HTTP_404_NOT_FOUND)


@api_view(["GET", "POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_list(request):
    from . import sitecreator

    if request.method == "GET":
        return Response({"designs": sitecreator.listing(request.user), "themes": sitecreator.themes(), "ai": __import__("apps.integrations.ai", fromlist=["x"]).available()})
    try:
        job = sitecreator.create(request.user, request.data.get("name"))
    except ValueError as e:
        return _bad(str(e))
    return Response(sitecreator.public(job), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_catalog(request):
    from . import sitecreator

    return Response(sitecreator.catalog())


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_theme_brief(request):
    """?key=<theme>: the colours, fonts and corners of a theme as design conditions for the AI prompt (also a theme of the library that is not installed)."""
    from . import sitecreator

    try:
        return Response(sitecreator.theme_brief(str(request.GET.get("key") or "")))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_price(request):
    """The price per month (ex VAT) of the standard installation and with the extra modules/plugins ({"extra": [catalog keys]}) that are outside it."""
    from . import sitecreator

    keys = request.data.get("extra") if isinstance(request.data, dict) else []
    return Response(sitecreator.price_with([k for k in keys if isinstance(k, str)][:80] if isinstance(keys, list) else []))


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes(DESIGN_PERM)
def sitecreator_job(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    if request.method == "DELETE":
        job.delete()
        return Response({"ok": True})
    if request.method == "PATCH":
        try:
            job = sitecreator.save(job, request.data)
        except ValueError as e:
            return _bad(str(e))
    return Response(sitecreator.public(job, files=request.GET.get("files") == "1"))  # the files (html with css) can be several MB: only when asked for


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@parser_classes([MultiPartParser, FormParser])
def sitecreator_zip(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    f = request.FILES.get("file")
    if not job:
        return _gone()
    if not f or not f.name.lower().endswith(".zip"):
        return _bad("Kies een ZIP-bestand.")
    try:
        job, notes = sitecreator.read_zip(job, f, request.user)
    except ValueError as e:
        return _bad(str(e))
    return Response({**sitecreator.public(job), "notes": notes})


def _needs_ai_credit(view):
    """The work of this view uses the AI: someone without AI credit is asked to buy credit first (answer 402 with code ai_credit; the screen opens the offer) and nothing is started."""
    import functools

    @functools.wraps(view)
    def wrapped(request, *a, **kw):
        from apps.integrations import aiusage

        try:
            aiusage.precheck()
        except aiusage.NotAllowed as e:
            return Response({"detail": str(e), "code": "ai_not_allowed"}, status=status.HTTP_403_FORBIDDEN)
        except aiusage.NoCredit as e:
            return Response({"detail": str(e), "code": "ai_credit"}, status=status.HTTP_402_PAYMENT_REQUIRED)
        return view(request, *a, **kw)

    return wrapped


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@_needs_ai_credit
def sitecreator_generate(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        d = request.data if isinstance(request.data, dict) else {}
        sitecreator.generate(job, improve=bool(d.get("improve")), focus=str(d.get("focus") or ""))
    except ValueError as e:
        return _bad(str(e))
    job.refresh_from_db()
    return Response(sitecreator.public(job))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@_needs_ai_credit
def sitecreator_chat(request, pk):
    """AI chat build: one message of the customer; the designer answers (and designs or changes the website)."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        sitecreator.chat(job, request.data.get("text"), request.data.get("images"), request.data.get("lang"))
    except ValueError as e:
        return _bad(str(e))
    job.refresh_from_db()
    return Response(sitecreator.public(job))


@api_view(["GET", "POST", "DELETE"])
@permission_classes(DESIGN_PERM)
@parser_classes([JSONParser, MultiPartParser, FormParser])
def sitecreator_refs(request, pk):
    """The websites that the customer likes (at most five): a picture of each is made and goes to the designer. GET: the list; POST {url}: add one; DELETE {url}: remove one."""
    from . import siteshots, sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        if request.method == "POST":
            f = request.FILES.get("file")
            refs = sitecreator.add_ref_image(job, f) if f else sitecreator.add_ref(job, request.data.get("url"))
            return Response({"refs": refs, "available": siteshots.available(), "max": sitecreator.MAX_REFS}, status=status.HTTP_201_CREATED)
        if request.method == "DELETE":
            return Response({"refs": sitecreator.remove_ref(job, request.data.get("url") or request.data.get("id")), "available": siteshots.available(), "max": sitecreator.MAX_REFS})
    except ValueError as e:
        return _bad(str(e))
    return Response({"refs": sitecreator.refs_public(job), "available": siteshots.available(), "max": sitecreator.MAX_REFS})


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_ref_image(request, pk, rid):
    """The picture of one example website, full size (the screen shows it in the preview on the right)."""
    from django.http import HttpResponse

    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    data = sitecreator.ref_bytes(job, rid)
    if not data:
        return Response({"detail": "Deze afbeelding bestaat niet meer."}, status=status.HTTP_404_NOT_FOUND)
    r = HttpResponse(data, content_type="image/jpeg")
    r["Cache-Control"] = "private, max-age=300"
    return r


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_export(request, pk):
    """Superadmins: the design as json (the choices, the chat with the answers and the files)."""
    from . import sitecreator

    if not _superadmin(request):
        return Response({"detail": "Alleen een superadmin kan een ontwerp exporteren."}, status=status.HTTP_403_FORBIDDEN)
    job = _design(request, pk)
    if not job:
        return _gone()
    return Response(sitecreator.export_job(job))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_identity(request, pk):
    """The design is put on the website: the name, the footer text and the contact details of the website are filled from the design."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    return Response({"set": sitecreator.apply_identity(job)})


@api_view(["GET", "POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_version(request, pk):
    """GET: the state of the design (to see later whether something changed). POST {"action": "discard"|"new", "snapshot": the state from the opening}: put the old state back, or keep this session as a new version (name +1)."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    if request.method == "GET":
        return Response(sitecreator.snapshot(job))
    try:
        if request.data.get("action") == "new":
            new = sitecreator.save_as_new_version(job, request.data.get("snapshot"))
            return Response({"id": str(new.pk), "name": new.name})
        job = sitecreator.restore_snapshot(job, request.data.get("snapshot"))
    except ValueError as e:
        return _bad(str(e))
    return Response({"id": str(job.pk), "name": job.name})


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@_needs_ai_credit
def sitecreator_resume(request, pk):
    """The design got stuck (the server was restarted): go on with what was running."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        sitecreator.resume(job)
    except ValueError as e:
        return _bad(str(e))
    job.refresh_from_db()
    return Response(sitecreator.public(job))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@_needs_ai_credit
def sitecreator_more_photos(request, pk):
    """The pages still ask for pictures that are not there: the designer searches iStock for them (in the background)."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        sitecreator.more_photos(job)
    except ValueError as e:
        return _bad(str(e))
    job.refresh_from_db()
    return Response(sitecreator.public(job))


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_costs_all(request):
    """The costs of every design of this user (for the cost window)."""
    from . import sitecreator

    return Response(sitecreator.designs_costs(request.user))


@api_view(["GET", "POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_costs(request, pk):
    """What this design costs so far (GET); POST resets the counter of this design."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    if request.method == "POST":
        sitecreator.reset_costs(job)
        job.refresh_from_db()
    return Response(sitecreator.design_costs(job))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_import(request):
    """Superadmins: reads an exported design. Exists already: {"exists": true, ...}; then the same call with mode "replace" or "add"."""
    from . import sitecreator

    if not _superadmin(request):
        return Response({"detail": "Alleen een superadmin kan een ontwerp importeren."}, status=status.HTTP_403_FORBIDDEN)
    try:
        job, info = sitecreator.import_job(request.user, request.data.get("data"), str(request.data.get("mode") or ""), str(request.data.get("parts") or "all"))
    except ValueError as e:
        return _bad(str(e))
    if job is None:
        return Response(info)
    return Response({**info, "design": sitecreator.public(job)})


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_answers(request, pk):
    """Keeps the answers that the customer filled in on a questionnaire of the chat (also while they are not sent yet), so they are back when the window is opened again."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        sitecreator.save_answers(job, request.data.get("index"), request.data.get("ans"), request.data.get("own"))
    except ValueError as e:
        return _bad(str(e))
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_missing(request, pk):
    """The choice for ONE missing component of a design: {type, actie: vervangen|weglaten|laten_staan|aanvragen, tag}. See componentrequests.py."""
    from . import componentrequests, sitecreator, system

    job = _design(request, pk)
    if not job:
        return _gone()
    if job.status in ("running", "stopping"):
        return _bad("Er wordt nog gewerkt aan dit ontwerp.")
    try:
        job, msg = componentrequests.apply_choice(job, str(request.data.get("type") or ""), str(request.data.get("actie") or ""), str(request.data.get("tag") or ""), request.user, (system.origin(system.get()["frontend_url"]) or "").split("//")[-1])
    except ValueError as e:
        return _bad(str(e))
    return Response({"melding": msg, "ontwerp": sitecreator.public(job, files=True)})  # (with the files: the preview shows the change at once)


@api_view(["GET"])
@permission_classes([IsSuperPlus])
def component_requests(request):
    """The component requests (superadmin+): the list with the status filter."""
    from . import componentrequests
    from .models import ComponentRequest

    qs = ComponentRequest.objects.all()
    if request.query_params.get("status"):
        qs = qs.filter(status=request.query_params["status"])
    return Response({"verzoeken": [componentrequests.public(r) for r in qs[:300]], "statussen": [[k, v] for k, v in ComponentRequest.STATUS]})


@api_view(["GET", "PATCH"])
@permission_classes([IsSuperPlus])
def component_request_item(request, pk):
    """One request with the building instruction; PATCH {status, note, tag} is the judgement (tag = the type of the component when it is built)."""
    from . import componentrequests
    from .models import ComponentRequest

    r = ComponentRequest.objects.filter(pk=pk).first()
    if not r:
        return Response({"detail": "Onbekend verzoek."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PATCH":
        try:
            componentrequests.review(r, str(request.data.get("status") or ""), request.data.get("note") or "", request.data.get("tag") or "")
        except ValueError as e:
            return _bad(str(e))
        if "extends" in request.data:
            r.extends = str(request.data.get("extends") or "")[:60]
            r.save(update_fields=["extends"])
    return Response(componentrequests.public(r, detail=True))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@_needs_ai_credit
def sitecreator_prefill(request, pk):
    """Answer to "may I fill in the first questions with assumptions (AI)?": {yes: true|false}. The first request is handled after it."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        sitecreator.answer_prefill(job, bool(request.data.get("yes")))
    except ValueError as e:
        return _bad(str(e))
    return Response(sitecreator.public(sitecreator.SiteDesignJob.objects.get(pk=job.pk)))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_failed(request, pk):
    """The choice for a design that failed: {mode: "retry" | "continue"}: do the last order again, or go on with what is there."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        sitecreator.failed_choice(job, str(request.data.get("mode") or ""))
    except ValueError as e:
        return _bad(str(e))
    return Response(sitecreator.public(sitecreator.SiteDesignJob.objects.get(pk=job.pk)))


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_controle(request, pk):
    """The check of a design in the page format (all pages), made again now and kept in the design: {geldig, fouten, waarschuwingen, paginas}."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    sitecreator._store_controle(job.pk)
    job.refresh_from_db()
    return Response((job.brief or {}).get("controle") or {"geldig": True, "fouten": 0, "waarschuwingen": 0, "paginas": []})


@api_view(["GET"])
@permission_classes(IMPORT_PERM)
def pagina_catalogus(request):
    """The component catalogue of the page format, made from the component set: type, version, purpose, props, nesting and an example."""
    from . import pagevalidate

    return Response({"formaat": "easy2edit-pagina@1", "componenten": pagevalidate.catalogus(request.query_params.get("set") or None)})


@api_view(["POST"])
@permission_classes(IMPORT_PERM)
def pagina_valideer(request):
    """A dry run: the validation report of a page design (format easy2edit-pagina@1); nothing is saved."""
    from . import pagevalidate

    reports, _fixed = pagevalidate.validate_many(pagevalidate.documents_of(request.data))
    return Response({"geldig": bool(reports) and all(r["geldig"] for r in reports), "rapporten": reports})


@api_view(["POST"])
@permission_classes(IMPORT_PERM)
def pagina_import(request):
    """Imports page designs: validated again here; only without errors it becomes a design (a concept, all or nothing). 422 with the reports when there are errors."""
    from . import pagevalidate

    reports, job = pagevalidate.import_documents(request.user, request.data, (request.data.get("naam") if isinstance(request.data, dict) else "") or "")
    if not job:
        return Response({"geldig": False, "rapporten": reports}, status=422)
    return Response({"geldig": True, "rapporten": reports, "ontwerp": str(job.pk)}, status=status.HTTP_201_CREATED)


@api_view(["POST", "DELETE"])
@permission_classes(DESIGN_PERM)
def sitecreator_slot(request, pk):
    """A photo (downloaded by the user from iStock and uploaded to the media library) goes in a photo slot of the chat design; DELETE empties the slot."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        if request.method == "DELETE":
            job = sitecreator.clear_slot(job, request.data.get("file"))
        elif request.data.get("add"):
            job = sitecreator.add_pick(job, request.data.get("add"))
        elif request.data.get("pick"):
            job = sitecreator.set_istock_pick(job, request.data.get("file"), request.data.get("pick"))
        elif request.data.get("use_preview"):
            job = sitecreator.use_preview(job, request.data.get("file"), request.user)
        elif request.data.get("hide"):
            job = sitecreator.hide_slot(job, request.data.get("file"))
        elif "istock" in request.data:
            job = sitecreator.set_istock(job, request.data.get("file"), request.data.get("istock"))
        else:
            job = sitecreator.set_slot(job, request.data.get("file"), request.data.get("media"))
    except ValueError as e:
        return _bad(str(e))
    return Response(sitecreator.public(job))


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_photo_sources(request):
    """Which photo sources can be used: Pexels only when it is linked and switched on (Admin -> API keys); iStock always."""
    from . import sitecreator

    return Response({"pexels": bool(sitecreator.pexels_key()), "unsplash": bool(sitecreator.unsplash_key())})


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_istock_search(request, pk):
    """The search field of the photos: what iStock (or, with source=pexels or unsplash, that free source) shows for a search word (photos or videos), with number, address and example picture."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    q = str(request.query_params.get("q") or "").strip()[:120]
    if len(q) < 2:
        return _bad("Typ een zoekwoord van minstens 2 letters.")
    video = request.query_params.get("kind") == "video"
    sitecreator.set_photo_source(job, request.query_params.get("source"))  # the automatic searches of the designer follow this choice
    if request.query_params.get("source") in ("pexels", "unsplash"):
        try:
            return Response({"items": (sitecreator.search_unsplash if request.query_params.get("source") == "unsplash" else sitecreator.search_pexels)(q, video=video)})
        except ValueError as e:
            return _bad(str(e))
    return Response({"items": sitecreator.search_istock(q, video=video)})


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_istock(request, pk):
    """The AI searches iStock for a fitting photo (number and address) for every open photo slot of the chat design."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        job = sitecreator.find_istock(sitecreator.set_photo_source(job, request.data.get("source")))
    except Exception as e:  # noqa: BLE001
        return _bad(str(e) if isinstance(e, ValueError) else "Zoeken op iStock is niet gelukt. Probeer het nog eens.")
    return Response({**sitecreator.public(job), "found": getattr(job, "found", 0)})


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@_needs_ai_credit
def sitecreator_revise(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        sitecreator.revise(job, request.data.get("text"), str(request.data.get("page") or ""), request.data.get("images"))
    except ValueError as e:
        return _bad(str(e))
    job.refresh_from_db()
    return Response(sitecreator.public(job))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
@parser_classes([MultiPartParser, FormParser])
def sitecreator_doc_add(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    f = request.FILES.get("file")
    if not f:
        return _bad("Kies een document.")
    try:
        job = sitecreator.add_document(job, f, request.user)
    except ValueError as e:
        return _bad(str(e))
    return Response(sitecreator.public(job), status=status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
@permission_classes(DESIGN_PERM)
def sitecreator_doc(request, pk, doc_id):
    from django.http import FileResponse

    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        if request.method == "DELETE":
            return Response(sitecreator.public(sitecreator.remove_document(job, doc_id)))
        d, fh = sitecreator.document_file(job, doc_id)
    except ValueError as e:
        return _bad(str(e), status.HTTP_404_NOT_FOUND)
    return FileResponse(fh, as_attachment=True, filename=d["name"])


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_doc_apply(request, pk, doc_id):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        return Response(sitecreator.public(sitecreator.reapply_document(job, doc_id)))
    except ValueError as e:
        return _bad(str(e))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_palette(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        job, note = sitecreator.apply_palette(job)
    except ValueError as e:
        return _bad(str(e))
    return Response({**sitecreator.public(job), "note": note})


@api_view(["GET"])
@permission_classes(DESIGN_PERM)
def sitecreator_theme_library(request):
    """The colour themes to choose from in the chat: installed and not installed (library)."""
    from . import sitecreator

    return Response({"themes": sitecreator.theme_library()})


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_theme_apply(request, pk):
    """{"key": theme}: installs the theme when needed, gives the design its colours and removes the theme that an earlier choice installed."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        job = sitecreator.apply_theme(job, str(request.data.get("key") or ""), request.user)
    except ValueError as e:
        return _bad(str(e))
    return Response(sitecreator.public(job))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_search_terms(request, pk):
    """{"name", "what", "kind"}: search phrases for iStock that fit the company (asked from the AI)."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    sitecreator.set_photo_source(job, request.data.get("source"))
    return Response({"terms": sitecreator.search_terms(request.data.get("name"), request.data.get("what"), "video" if request.data.get("kind") == "video" else "photo")})


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_fictional(request, pk):
    """{"question", "name", "what", "lang"}: fictional answer for a field of the questionnaire (the customer typed @ and Enter)."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        return Response({"text": sitecreator.fictional_answer(job, request.data.get("question"), request.data.get("name"), request.data.get("what"), request.data.get("lang"))})
    except ValueError as e:
        return _bad(str(e))


@api_view(["POST", "DELETE"])
@permission_classes(DESIGN_PERM)
def sitecreator_own_media(request, pk):
    """POST {"media": id, "role": "logo"|"media"}: the customer's own logo, photo or video (uploaded to the media library) goes in the project and the prompt. DELETE {"file"} takes it out again."""
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        if request.method == "DELETE":
            return Response(sitecreator.public(sitecreator.remove_own_media(job, request.data.get("file"))))
        return Response(sitecreator.public(sitecreator.add_own_media(job, request.data.get("media"), "logo" if request.data.get("role") == "logo" else "media")))
    except ValueError as e:
        return _bad(str(e))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_stop(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    return Response(sitecreator.public(sitecreator.stop(job)))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_restore(request, pk):
    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    try:
        return Response(sitecreator.public(sitecreator.restore(job)))
    except ValueError as e:
        return _bad(str(e))


@api_view(["POST"])
@permission_classes(DESIGN_PERM)
def sitecreator_theme(request, pk):
    """A theme with the own style of the design (named after the website); {use: true} also switches it on for the website."""
    from apps.accounts.access import level

    from . import sitecreator

    job = _design(request, pk)
    if not job:
        return _gone()
    if level(request.user, "theme") < 2:
        return _bad("Je hebt geen rechten om een thema te maken.", status.HTTP_403_FORBIDDEN)
    try:
        return Response(sitecreator.make_theme(job, use=bool(request.data.get("use"))))
    except ValueError as e:
        return _bad(str(e))


# ── the first screen of an EMPTY installation (no users at all): sign up as a reseller, with a code from the master site ──
def _first_run_guard():
    from . import reseller_signup

    if not reseller_signup.is_empty():
        return Response({"detail": "Deze installatie is al ingericht."}, status=status.HTTP_403_FORBIDDEN)
    return None


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def first_run(request):
    """Is this installation still to be done (a clean installation: no standard installation, onboarding not complete, no other users than the standard superadmin)? Then the login screen offers the onboarding as a reseller."""
    from . import reseller_signup

    return Response({"empty": reseller_signup.is_empty()})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def first_run_send(request):
    """{email}: the master site looks for a reseller with this address and sends a code (only while there are no users)."""
    from . import reseller_signup

    bad = _first_run_guard()
    if bad:
        return bad
    try:
        # ONLY on the development computer (DEBUG, a call from this computer itself, for localhost: like the dev login) the code is shown on the screen too, so it can be used at once
        from django.conf import settings as dj

        dev = bool(dj.DEBUG and request.META.get("REMOTE_ADDR", "") in ("127.0.0.1", "::1") and not request.META.get("HTTP_X_FORWARDED_FOR") and request.get_host().split(":")[0] in ("localhost", "127.0.0.1"))
        return Response(reseller_signup.ask("send", {"email": (request.data or {}).get("email")}, request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", ""), show_code=dev))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def first_run_verify(request):
    """{challenge, code}: the code is checked by the master site; only then the person is made a superuser with the password of the reseller login on the master, this website reports itself as a website of that reseller, and the person is logged in."""
    from rest_framework.authtoken.models import Token

    from . import reseller_signup, sitemanager

    bad = _first_run_guard()
    if bad:
        return bad
    d = request.data or {}
    try:
        got = reseller_signup.ask("verify", {"challenge": d.get("challenge"), "code": d.get("code")})
        if got.get("owner"):  # the owner of the master site: he logs in as himself (his password stays as it is); there is no reseller to link
            from django.contrib.auth import get_user_model

            user = get_user_model().objects.filter(email__iexact=got["owner"], is_active=True, is_staff=True, is_superadmin_plus=True).first()
            if not user or not sitemanager.server_enabled():
                return Response({"detail": "Deze aanmelding is niet toegestaan."}, status=status.HTTP_403_FORBIDDEN)
            token, _ = Token.objects.get_or_create(user=user)
            return Response({"token": token.key, "email": user.email, "reseller": ""})
        user = reseller_signup.make_user(got.get("person"), got.get("login"))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except PermissionError as e:
        return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
    try:  # the link with the reseller: reported with the grant (a failing report never blocks the onboarding)
        sitemanager._save(reseller_grant=str(got.get("grant") or ""))
        sitemanager.report("register")
    except Exception:  # noqa: BLE001
        logger.exception("First run: this website could not be linked to the reseller")
    token, _ = Token.objects.get_or_create(user=user)
    __import__("apps.auditlog.service", fromlist=["log"]).log("reseller.onboarding", user, detail=(got.get("reseller") or {}).get("name", ""), request=request)
    return Response({"token": token.key, "email": user.email, "reseller": (got.get("reseller") or {}).get("name", "")})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def code_lifetimes(request):
    """How long a code that is sent stays valid, in seconds: the round timer next to every code input (components/CodeInput.js) counts down from this."""
    from apps.security import service as security

    from . import terms

    cfg = security.get()
    return Response({"twofa": int(cfg["twofa"]["code_minutes"]) * 60, "registration": int(cfg["registration"]["code_minutes"]) * 60, "terms": terms.CODE_MINUTES * 60, "owner": 600})
