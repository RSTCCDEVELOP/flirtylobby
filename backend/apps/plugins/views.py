# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Plugins: admin (superadmin) endpoints, the menu, the files of a plugin's own pages, and the routes plugins add."""
import io
import json
import mimetypes
import re
import zipfile
from pathlib import Path

from django.http import FileResponse, Http404, HttpResponse
from django.views.decorators.clickjacking import xframe_options_exempt
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.modules import module_required

from django.conf import settings

from . import installer, manifest as mf, runtime, signing
from .models import Plugin

MOD = module_required("plugins")
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731
STAFF = Response({"detail": "Alleen superadmins mogen plugins beheren."}, status=status.HTTP_403_FORBIDDEN)


def active_languages(everything=False):
    """The languages that are on in the system, the default first (for the titles and explanations of items per language)."""
    from apps.core.models import Language

    rows = list(Language.objects.all()) if everything else (list(Language.objects.filter(enabled=True)) or list(Language.objects.filter(is_default=True)))
    return [{"code": l.code, "name": l.name, "native_name": l.native_name, "rtl": l.rtl, "is_default": l.is_default, "enabled": l.enabled} for l in sorted(rows, key=lambda x: (not x.is_default, x.order))]


def _out(p):
    sig = signing.verify(installer.plugin_dir(p.name))
    built = p.manifest.get("system_version", "0.0.0")
    return {"signature": sig, "dev_mode": sig == "missing" and signing.dev_mode_allowed(), "system_version": settings.SYSTEM_VERSION, "built_for": built,
            "compat": mf.compatibility(built, settings.SYSTEM_VERSION), "languages": installer.lang_state(p.name), "blocked": runtime.start_problem(p), "requires": p.manifest.get("requires", []), "required_by": runtime.dependents(p.name), "requires_off": [{"name": x.name, "title": x.title} for x in runtime.requirement_chain(p)[0]], "requires_missing": runtime.requirement_chain(p)[1],
            "payments_notice": __import__("apps.core.payments_notice", fromlist=["x"]).notice_for([p.name]) if p.enabled else "",
            "name": p.name, "title": p.title, "version": p.version, "description": p.description, "descriptions": p.manifest.get("descriptions") or {}, "author": p.author, "enabled": p.enabled, "error": p.error,
            "permissions": p.manifest.get("permissions", []), "events": p.manifest.get("events", []), "has_python": bool(p.manifest.get("python")), "section": installer.admin_section(p), "section_default": p.manifest.get("section", "system"), "admin_web": p.manifest.get("admin_web", ""), "settings_web": p.manifest.get("settings_web", ""), "blocks_page": p.manifest.get("blocks_page", ""), "admin_links": p.manifest.get("admin_links", []), "admin_entries": p.manifest.get("admin_entries", []), "has_web": bool(p.manifest.get("web")),
            "menu": p.manifest.get("menu"), "public_pages": p.manifest.get("public_pages", []), "site_link": p.manifest.get("site_link"), "provides": p.manifest.get("provides", []), "admin_label": p.manifest.get("admin_label", ""), "content_label": p.manifest.get("content_label", ""), "active_languages": active_languages() if p.manifest.get("content_dirs") else [], "all_languages": active_languages(everything=True) if p.manifest.get("content_dirs") else [], "content_items": installer.content_items(p), "menu_group": installer.menu_group(p), "page_object_offered": bool(p.manifest.get("page_object")), "public_path": p.manifest.get("public_path", ""), "page_public": installer.page_public(p), "page_object": installer.as_page_object(p), "config_schema": p.manifest.get("config", []), "config": installer.public_config(p), "updated_at": p.updated_at}


@api_view(["GET"])
@permission_classes([IsAuthenticated, MOD])
def plugins(request):
    if not request.user.is_staff:
        return STAFF
    installer.scan()  # a plugin folder that was put in <plugins>/ shows up by itself
    return Response({"plugins": [_out(p) for p in Plugin.objects.all()], "folder": str(installer.root()), "max_zip_mb": installer.MAX_ZIP_MB, "events": runtime.EVENTS, "system_version": settings.SYSTEM_VERSION, "languages": installer.languages()})


@api_view(["POST"])
@permission_classes([IsAuthenticated, MOD])
@parser_classes([MultiPartParser, FormParser])
def upload(request):
    if not request.user.is_staff:
        return STAFF
    f = request.FILES.get("file")
    if not f or not f.name.lower().endswith(".zip"):
        return bad("Kies een zipbestand met een plugin.")
    try:
        p = installer.install_zip(f.read())
    except installer.InstallError as e:
        return bad(str(e))
    was_on = Plugin.objects.filter(pk=p.pk, enabled=True).exists()
    if was_on:  # an update of a running plugin: load the new code
        err = runtime.load(p)
        if err:
            Plugin.objects.filter(pk=p.pk).update(error=err, enabled=False)
            p.refresh_from_db()
    return Response(_out(p), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated, MOD])
def scan(request):
    if not request.user.is_staff:
        return STAFF
    done, problems = installer.scan()
    return Response({"found": [p.name for p in done], "problems": problems, "plugins": [_out(p) for p in Plugin.objects.all()]})


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, MOD])
def plugin(request, name):
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    if not p and request.method == "PATCH" and request.data.get("enabled"):  # switching on a plugin that is not installed yet: it comes from the library of the product (resource/plugins)
        installer.install_from_library(name)
        p = Plugin.objects.filter(name=name).first()
    if not p:
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        if need := runtime.dependents(p.name):
            return bad("Eerst deze plugins uitzetten of verwijderen: " + ", ".join(need) + ". Zij hebben deze plugin nodig.")
        runtime.unload(p.name)
        installer.remove(p)
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PATCH":
        if isinstance(request.data.get("config"), dict):
            installer.save_config(p, request.data["config"])
            p.refresh_from_db()
            if p.enabled:
                err = runtime.load(p)  # new settings: reload
                if err:
                    Plugin.objects.filter(pk=p.pk).update(error=err, enabled=False)
                    p.refresh_from_db()
        if "menu_group" in request.data or "page_object" in request.data or "page_public" in request.data or "admin_section" in request.data:
            installer.save_placement(p, request.data.get("menu_group"), request.data.get("page_object") if "page_object" in request.data else None, request.data.get("page_public") if "page_public" in request.data else None, request.data.get("admin_section"))
            p.refresh_from_db()
            from apps.sysobjects import service as sysobj
            sysobj.sync()
            installer.sync_menu_page(p)
        if "enabled" in request.data:
            want = bool(request.data["enabled"])
            if want:
                todo, absent = runtime.requirement_chain(p)
                if absent:
                    return bad("Deze plugin heeft nog niet geïnstalleerde plugins nodig: " + ", ".join(absent) + ". Installeer die eerst.")
                if todo and not request.data.get("with_requires"):
                    return bad("Zet eerst ook aan: " + ", ".join(x.title for x in todo) + ".")
                for dep in todo:  # the plugins this one needs, the ones they need first
                    err = runtime.load(dep)
                    if err:
                        Plugin.objects.filter(pk=dep.pk).update(error=err, enabled=False)
                        return bad(f"{dep.title} kon niet worden gestart: {err}")
                    Plugin.objects.filter(pk=dep.pk).update(enabled=True, error="")
            if not want and (need := runtime.dependents(p.name)):
                names = dict(Plugin.objects.filter(name__in=need).values_list("name", "title"))
                return bad("Eerst deze plugins uitzetten: " + ", ".join(names.get(n, n) for n in need) + ". Zij hebben deze plugin nodig.")
            if want:
                err = runtime.load(p)
                if err:
                    Plugin.objects.filter(pk=p.pk).update(error=err, enabled=False)
                    return bad(f"De plugin kon niet worden gestart: {err}")
                Plugin.objects.filter(pk=p.pk).update(enabled=True, error="")
                try:  # the price list of the licence follows the plugins in use
                    from apps.core import pricing

                    pricing.apply_to_license()
                except Exception:  # noqa: BLE001
                    pass  # (the licence prices follow the next time they are saved)
            else:
                runtime.unload(p.name)
                Plugin.objects.filter(pk=p.pk).update(enabled=False)
            p.refresh_from_db()
            from apps.core import modules

            modules.invalidate()
            installer.sync_menu_page(p)  # (a plugin that is off has no item in the menu)
    return Response(_out(p))


def _zip_response(data, filename):
    r = HttpResponse(data, content_type="application/zip")
    r["Content-Disposition"] = f'attachment; filename="{filename}"'
    r["Cache-Control"] = "no-store"
    return r


@api_view(["GET"])
@permission_classes([IsAuthenticated, MOD])
def plugin_download(request, name):
    """The installed plugin as a zip (superadmins only): to install it on another site or to keep."""
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    if not p:
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    return _zip_response(installer.zip_plugin(p), f"{p.name}-{p.manifest.get('version', '1.0.0')}.zip")


@api_view(["GET"])
@permission_classes([IsAuthenticated, MOD])
def item_download(request, name, item):
    """One item (a game) of a plugin as a zip (superadmins only)."""
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    if not p:
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    try:
        data = installer.zip_item(p, item)
    except installer.InstallError as e:
        return bad(str(e), status.HTTP_404_NOT_FOUND)
    return _zip_response(data, f"{item}.zip")


@api_view(["POST"])
@permission_classes([IsAuthenticated, MOD])
@parser_classes([MultiPartParser, FormParser])
def item_upload(request, name):
    """Add an item (a game) to the content folder of a plugin from a zip, like uploading a plugin. Superadmins only."""
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    f = request.FILES.get("file")
    if not p:
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    if not f or not f.name.lower().endswith(".zip"):
        return bad("Kies een zipbestand.")
    try:
        added = installer.add_item_zip(p, f.read())
    except installer.InstallError as e:
        return bad(str(e))
    p.refresh_from_db()
    return Response({**_out(p), "added": added})


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, MOD])
def item(request, name, item):
    """One item of the content folder of a plugin (a game): on/off, may be a system object, its configuration; or remove it. Superadmins only."""
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    if not p:
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        try:
            installer.remove_item(p, item)
        except installer.InstallError as e:
            return bad(str(e), status.HTTP_404_NOT_FOUND)
        p.refresh_from_db()
        from apps.sysobjects import service as sysobj

        sysobj.sync()
        return Response(_out(p))
    try:
        installer.save_item(p, item, request.data if isinstance(request.data, dict) else {})
    except installer.InstallError as e:
        return bad(str(e), status.HTTP_404_NOT_FOUND)
    p.refresh_from_db()
    from apps.sysobjects import service as sysobj

    sysobj.sync()
    return Response(_out(p))


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated, MOD])
@parser_classes([MultiPartParser, FormParser])
def item_image(request, name, item):
    """The picture of an item (a game): upload (file) or remove. Superadmins only."""
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    if not p or not p.manifest.get("content_dirs"):
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    try:
        if request.method == "DELETE":
            installer.set_item_image(p, item, None)
        else:
            f = request.FILES.get("file")
            if not f:
                return bad("Kies een afbeelding.")
            installer.set_item_image(p, item, f.read())
    except installer.InstallError as e:
        return bad(str(e))
    p.refresh_from_db()
    return Response(_out(p))


@api_view(["POST"])
@permission_classes([IsAuthenticated, MOD])
@parser_classes([MultiPartParser, FormParser])
def item_about_image(request, name, item):
    """A picture for the explanation block of an item. Superadmins only."""
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    f = request.FILES.get("file")
    if not p or not p.manifest.get("content_dirs"):
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    if not f:
        return bad("Kies een afbeelding.")
    try:
        installer.add_about_image(p, item, f.read())
    except installer.InstallError as e:
        return bad(str(e))
    p.refresh_from_db()
    return Response(_out(p))


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, MOD])
def item_about_image_delete(request, name, item, file):
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    if not p or not p.manifest.get("content_dirs"):
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    try:
        installer.remove_about_image(p, item, file)
    except installer.InstallError as e:
        return bad(str(e), status.HTTP_404_NOT_FOUND)
    p.refresh_from_db()
    return Response(_out(p))


@api_view(["POST"])
@permission_classes([IsAuthenticated, MOD])
def item_translate(request, name, item):
    """Claude fills the title and the explanation of an item in every language that is on. Superadmins only. overwrite=false: only the empty languages."""
    if not request.user.is_staff:
        return STAFF
    from apps.core import themeimport
    from apps.core.models import Language
    from apps.integrations import ai

    p = Plugin.objects.filter(name=name).first()
    it = next((i for i in installer.content_items(p) or [] if i["name"] == item), None) if p else None
    if not it or it.get("problem"):
        return bad("Dit onderdeel bestaat niet in de map van de plugin.", status.HTTP_404_NOT_FOUND)
    if not ai.available():
        return bad("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    overwrite = bool(request.data.get("overwrite"))
    meta = it["meta"]
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    src_title = meta["titles"].get(default) or meta["titles"].get("nl") or it["title"]
    src_desc = meta["descriptions"].get(default) or meta["descriptions"].get("nl") or it["description"]
    langs = [(l.code, l.name) for l in Language.objects.all() if l.code != default]  # every language of the system, also the ones that are switched off (they are ready when one is switched on)
    about = meta["about"]["texts"]
    src_about = about.get(default) or about.get("nl") or ""
    todo = [(c, n) for c, n in langs if overwrite or not meta["titles"].get(c) or not meta["descriptions"].get(c) or (src_about and not about.get(c))]
    if not todo:
        return Response({**_out(p), "translated": 0})
    system = ("You translate the title and the short explanation of a game for a website. Keep the title short and natural, keep the tone friendly and the explanation clear. "
              "Answer with ONE JSON object only, no text around it: {\"titles\": {code: title}, \"descriptions\": {code: explanation}, \"about\": {code: longer text}} with an entry for every requested language code (about only when a longer text is given; keep its paragraphs).")
    prompt = json.dumps({"source_language": default, "title": src_title, "explanation": src_desc, "longer_text": src_about, "languages": [{"code": c, "name": n} for c, n in todo]}, ensure_ascii=False)
    try:
        out = themeimport._parse_json(ai.claude(system, prompt, max_tokens=3000, timeout=90), need=("titles", "descriptions"))
    except (ValueError, KeyError) as e:
        return bad(f"Claude kon de teksten niet vertalen: {e}")
    titles, descs, n = dict(meta["titles"]), dict(meta["descriptions"]), 0
    titles.setdefault(default, src_title) if src_title else None
    descs.setdefault(default, src_desc) if src_desc else None
    for c, _name in todo:
        t, d = str((out.get("titles") or {}).get(c) or "").strip(), str((out.get("descriptions") or {}).get(c) or "").strip()
        if t and (overwrite or not titles.get(c)):
            titles[c] = t[:80]
            n += 1
        if d and (overwrite or not descs.get(c)):
            descs[c] = d[:600]
    abouts = dict(about)
    if src_about:
        abouts.setdefault(default, src_about)
        for c, _name in todo:
            a = str((out.get("about") or {}).get(c) or "").strip()
            if a and (overwrite or not abouts.get(c)):
                abouts[c] = a[:4000]
    installer.save_item(p, item, {"meta": {"titles": titles, "descriptions": descs, "about": {"texts": abouts}}})
    p.refresh_from_db()
    return Response({**_out(p), "translated": n})


@api_view(["POST"])
@permission_classes([IsAuthenticated, MOD])
def item_preview(request, name, item):
    """A superadmin looks at an item (a game) before it is switched on: a short-lived address of the files of that item, also while the plugin is off."""
    if not request.user.is_staff:
        return STAFF
    p = Plugin.objects.filter(name=name).first()
    it = next((i for i in installer.content_items(p) or [] if i["name"] == item), None) if p else None
    if not it or it.get("problem"):
        return bad("Dit onderdeel bestaat niet in de map van de plugin.", status.HTTP_404_NOT_FOUND)
    from django.core import signing as dj

    token = dj.dumps({"p": name, "i": item}, salt="plugin-item-preview")
    return Response({"path": f"/api/plugins/content/{token}/{name}/{item}/{it['entry']}", "base": f"/api/plugins/content/{token}/{name}/{item}/"})


@xframe_options_exempt
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny, MOD])
def content_file(request, token, name, item, path):
    """The files of one item of a plugin for the preview (token from item_preview, valid for a quarter of an hour). Sealed like a live game."""
    from django.core import signing as dj

    try:
        t = dj.loads(token, salt="plugin-item-preview", max_age=900)
    except dj.BadSignature:
        raise Http404()
    p = Plugin.objects.filter(name=name).first()
    if t != {"p": name, "i": item} or not p or not (p.manifest.get("content_dirs") and p.manifest.get("content_sdk")) or not re.fullmatch(r"[a-z0-9-]{2,40}", item):
        raise Http404()
    root = (installer.plugin_dir(name) / p.manifest["content_dirs"][0] / item).resolve()
    f = (root / path).resolve()
    if root not in f.parents or not f.is_file():
        raise Http404()
    if f.suffix.lower() in (".html", ".htm"):
        sdk = (installer.plugin_dir(name) / p.manifest["content_sdk"]).read_text(encoding="utf-8", errors="replace")
        html = f.read_text(encoding="utf-8", errors="replace")
        tag = f"<script>{sdk}</script>"
        r = HttpResponse(tag + html if "<head>" not in html else html.replace("<head>", "<head>" + tag, 1), content_type="text/html; charset=utf-8")
    else:
        r = HttpResponse(f.read_bytes(), content_type=mimetypes.guess_type(f.name)[0] or "application/octet-stream")
    r["Content-Security-Policy"] = ("sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; "
                                    f"font-src 'self' data:; connect-src 'self' data: blob:; worker-src 'self' blob:; form-action 'none'; frame-ancestors {frame_ancestors(request)}")
    r["X-Content-Type-Options"] = "nosniff"
    r["Cache-Control"] = "no-store"
    return r


@api_view(["GET"])
@permission_classes([IsAuthenticated, MOD])
def menu(request):
    """Plugins with a page of their own, for the menu of the dashboard. ?scope=admin (superadmins): every plugin that is on, for the admin menu."""
    installer.scan()  # a changed plugin.json (section, menu) is picked up at once
    out = []
    if request.query_params.get("scope") == "admin":
        if not request.user.is_staff:
            return Response([])
        return Response([{"name": p.name, "label": p.title, "title": p.title, "section": installer.admin_section(p), "has_admin": bool(p.manifest.get("admin_web")), "admin_web": p.manifest.get("admin_web", ""), "entries": p.manifest.get("admin_entries", [])} for p in Plugin.objects.filter(enabled=True)])
    for p in Plugin.objects.filter(enabled=True):
        m, web = p.manifest.get("menu"), p.manifest.get("web")
        if m and web and (m["access"] == "members" or request.user.is_staff):  # the page of the plugin in the menu
            out.append({"name": p.name, "label": m["label"], "title": p.title, "section": p.manifest.get("section", "system"), "group": installer.menu_group(p), "path": p.manifest.get("public_path", "")})
    return Response(out)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny, MOD])
def public(request):
    """For the website (visitors, no login): ?path=/producten/x -> the plugin page at that address; without path -> the links plugins put in the header."""
    path = request.query_params.get("path")
    plugs = list(Plugin.objects.filter(enabled=True))
    if path is None:
        return Response([{"name": p.name, **p.manifest["site_link"]} for p in plugs if p.manifest.get("site_link")])
    for p in plugs:
        pages = list(p.manifest.get("public_pages", []))
        if installer.page_public(p) and p.manifest.get("web"):
            pages.append({"path": p.manifest["public_path"], "file": p.manifest["web"], "title": p.title})
        hit = mf.match_public(pages, path)
        if hit:
            pg, params = hit
            return Response({"name": p.name, "file": pg["file"], "title": pg["title"] or p.title, "noindex": pg.get("noindex", False), "params": params, "page": pg.get("page", "")})
    return bad("Onbekende pagina.", status.HTTP_404_NOT_FOUND)


SDK = r"""/* Plugin SDK: put into every page of a plugin by the system (nothing to include).
   system.api(path, {method, body}) calls the system as the logged-in member (the system makes the call for you; your page never sees the login).
   system.confirm(message, {title, okLabel, danger}): the system's own confirmation window (true/false); do not use window.confirm, a sandboxed page cannot.
   system.t("Nederlandse tekst {0}", x): the text in the language of the visitor; the system supplies the translations (lang/<code>.json of the plugin, then its own texts).
   system.ready: resolves with {user, apiBase} when the page is connected. The colours of the site arrive as CSS variables (--bg, --card, --text, --muted, --line, --blue …). */
(function () {
  var pending = {}, n = 0, strings = {}, resolveReady, ready = new Promise(function (r) { resolveReady = r; });
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.plugin === "init" || d.plugin === "vars") { Object.keys(d.vars || {}).forEach(function (k) { document.documentElement.style.setProperty(k, d.vars[k]); }); }
    if (d.scheme) { document.documentElement.style.colorScheme = d.scheme; }  /* a transparent page in a frame gets a white canvas unless it says which scheme it uses */
    if (d.plugin === "init" && d.attrs) { Object.keys(d.attrs).forEach(function (k) { document.documentElement.setAttribute("data-" + k, d.attrs[k]); }); }  /* the layout choices of the theme (block style) */
    if (d.plugin === "init") { strings = d.strings || {}; document.documentElement.lang = d.lang || "nl"; resolveReady({ user: d.user, name: d.name, apiBase: d.apiBase, lang: d.lang, route: d.route || {}, siteOrigin: d.siteOrigin || "" }); }
    if (d.plugin === "attrs" && d.attrs) { Object.keys(d.attrs).forEach(function (k) { document.documentElement.setAttribute("data-" + k, d.attrs[k]); }); }  /* a choice of the site changed (edit mode on/off) */
    if (d.plugin === "rehello") { parent.postMessage({ plugin: "hello" }, "*"); }  /* the page loaded before the site was ready to answer (server-rendered page): ask again */
    if (d.plugin === "reply" && pending[d.id]) { var p = pending[d.id]; delete pending[d.id]; d.ok ? p.resolve(d.data) : p.reject(new Error(d.error || "Mislukt")); }
  });
  function call(type, extra) { return new Promise(function (resolve, reject) { var id = ++n; pending[id] = { resolve: resolve, reject: reject }; parent.postMessage(Object.assign({ plugin: type, id: id }, extra), "*"); }); }
  window.system = {
    ready: ready,
    api: function (path, opts) { return new Promise(function (resolve, reject) { var id = ++n; pending[id] = { resolve: resolve, reject: reject }; parent.postMessage({ plugin: "api", id: id, path: path, opts: opts || {} }, "*"); }); },
    t: function (text) { var a = Array.prototype.slice.call(arguments, 1), s = Object.prototype.hasOwnProperty.call(strings, text) ? strings[text] : text; return s.replace(/\{(\d+)\}/g, function (m, i) { return a[i] !== undefined ? String(a[i]) : m; }); },
    confirm: function (message, opts) { return new Promise(function (resolve, reject) { var id = ++n; pending[id] = { resolve: resolve, reject: reject }; parent.postMessage({ plugin: "confirm", id: id, message: message, opts: opts || {} }, "*"); }); },
    store: {  /* the plugin's own storage in this browser (the page itself has none): await system.store.get("cart") */
      get: function (k) { return call("store", { op: "get", key: k }); },
      set: function (k, v) { return call("store", { op: "set", key: k, value: v }); },
      remove: function (k) { return call("store", { op: "remove", key: k }); }
    },
    upload: function (path, file, fields) { return call("upload", { path: path, file: file, fields: fields || {} }); },  /* send a file (multipart) to the system API as the member: resolves the answer */
    openAdmin: function (file, query) { parent.postMessage({ plugin: "openadmin", file: file, query: query || {} }, "*"); },  /* the admin screen of this plugin in a popup of the site (edit mode only) */
    go: function (path) { parent.postMessage({ plugin: "go", path: path }, "*"); },  /* open an address of the website (or a full link) */
    pickMedia: function () { return call("media", {}); },  /* the media library of the system: resolves {id, url} or null */
    editHtml: function (html, opts) { return call("html", { html: html || "", opts: opts || {} }); },  /* the system's text editor: resolves the new html, or null */
    resize: function (h) { parent.postMessage({ plugin: "resize", height: h }, "*"); }
  };
  /* the page always fits its frame: no scrollbar inside the frame, the frame grows and shrinks with the content */
  var st = document.createElement("style"); st.textContent = "html{overflow-y:hidden}"; (document.head || document.documentElement).appendChild(st);
  function fit() { var b = document.body; if (!b || document.documentElement.hasAttribute("data-noauto")) return; var cs = getComputedStyle(b); parent.postMessage({ plugin: "resize", height: Math.ceil(b.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0)) }, "*"); }
  if (window.ResizeObserver) { document.addEventListener("DOMContentLoaded", function () { new ResizeObserver(fit).observe(document.body); fit(); }); }
  window.addEventListener("load", fit);
  window.addEventListener("resize", fit);
  parent.postMessage({ plugin: "hello" }, "*");
})();
"""


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny, MOD])
def lang(request, name):
    """The plugin's own translations for one language (?lang=de): {keys: [...], dict: {dutch: translation}}. The page of the website adds the system's texts."""
    import json

    code = request.query_params.get("lang", "nl")
    if not Plugin.objects.filter(name=name, enabled=True).exists() or not code.isalpha() or len(code) > 5:
        return bad("Onbekende plugin.", status.HTTP_404_NOT_FOUND)
    d = installer.plugin_dir(name) / "lang"
    read = lambda c: json.loads((d / f"{c}.json").read_text()) if (d / f"{c}.json").is_file() else {}  # noqa: E731
    return Response({"keys": sorted(read("nl")), "dict": {} if code == "nl" else read(code)})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def sdk(request):
    return HttpResponse(SDK, content_type="application/javascript")


def frame_ancestors(request=None):
    """The websites that may show a plugin page in a frame: this system's own front end, and this API itself (a game is framed by the plugin page, which is also sandboxed, see below)."""
    from apps.core import system

    origins = [*settings.CORS_ALLOWED_ORIGINS, system.origin(system.get().get("frontend_url")), system.origin(system.get().get("backend_url"))]
    if request is not None:
        origins.append(f"{request.scheme}://{request.get_host()}")
        if settings.DEBUG:  # development: the site is also opened from another device on the local network (http://10.x.x.x:5173): its pages may frame the plugin too
            import ipaddress
            from urllib.parse import urlparse

            ref = urlparse(request.META.get("HTTP_REFERER", ""))
            try:
                private = ref.hostname == "localhost" or ipaddress.ip_address(ref.hostname or "").is_private
            except ValueError:
                private = False
            if private and ref.scheme in ("http", "https"):
                origins.append(f"{ref.scheme}://{ref.netloc}")
    return " ".join(["'self'", *dict.fromkeys(o for o in origins if o)])


@xframe_options_exempt  # the general rule (X-Frame-Options: DENY) would block the frame; frame-ancestors below says who may
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny, MOD])
def web(request, name, path):
    """A file of the plugin's own page (<plugin>/<path>); only for switched-on plugins and only inside the plugin folder."""
    p = Plugin.objects.filter(name=name, enabled=True).first()
    root = installer.plugin_dir(name).resolve()
    f = (root / (path or p.manifest.get("web", ""))).resolve() if p else None
    if not p or not f or (root / "web") not in f.parents or not f.is_file():  # only the plugin's web/ folder is public: never its program, translations or settings
        raise Http404()
    ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
    if f.suffix.lower() in (".html", ".htm"):  # the SDK (window.system) is put in every page of a plugin
        html = f.read_text(encoding="utf-8", errors="replace")
        rel = f.parent.relative_to(root).as_posix()  # /plugins/web/<name>/ asks for the main page: its relative files (css, js) live next to it, so tell the browser where
        base = f'<base href="{request.build_absolute_uri(f"/api/plugins/web/{name}/{rel}/")}">' if not path else ""
        tag = f"{base}<script>{SDK}</script>"
        html = html.replace("<head>", "<head>" + tag, 1) if "<head>" in html else tag + html
        r = HttpResponse(html, content_type="text/html; charset=utf-8")
    else:
        r = FileResponse(open(f, "rb"), content_type=ctype)
    r["Content-Security-Policy"] = f"sandbox allow-scripts allow-forms allow-popups allow-downloads; frame-ancestors {frame_ancestors(request)}"  # the page cannot reach the login or storage of the system
    r["X-Content-Type-Options"] = "nosniff"
    r["Cache-Control"] = "no-cache"  # always ask again (a changed page, script or style of a plugin shows at once; the browser keeps it when nothing changed)
    return r


@xframe_options_exempt
@api_view(["GET", "POST", "PUT", "PATCH", "DELETE"])
@permission_classes([AllowAny, MOD])
def run(request, name, path):
    """The routes a plugin adds (system.route in its plugin.py): /api/plugins/run/<name>/<path>."""
    runtime.ensure_loaded()
    lp = runtime.LOADED.get(name)
    hit = lp.match(request.method, path) if lp else None
    if not hit:
        return bad("Onbekende route.", status.HTTP_404_NOT_FOUND)
    fn, public, params = hit
    if not public and not request.user.is_authenticated:
        return bad("Inloggen is nodig.", status.HTTP_401_UNAUTHORIZED)
    try:
        r = fn(request, **params)
    except Exception as e:  # noqa: BLE001
        Plugin.objects.filter(name=name).update(error=f"{path}: {type(e).__name__}: {e}"[:500])
        return bad("De plugin gaf een fout.", status.HTTP_500_INTERNAL_SERVER_ERROR)
    if r is None:
        return Response(status=status.HTTP_204_NO_CONTENT)
    return r if hasattr(r, "status_code") else Response(r)


EXAMPLE = Path(__file__).resolve().parents[3] / "plugin-example" / "hello"


@api_view(["GET"])
@permission_classes([IsAuthenticated, MOD])
def example(request):
    """The example plugin as a zip, to start from."""
    if not request.user.is_staff:
        return STAFF
    if not EXAMPLE.is_dir():
        return bad("De voorbeeldplugin is niet aanwezig.", status.HTTP_404_NOT_FOUND)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in EXAMPLE.rglob("*"):
            if f.is_file() and "__pycache__" not in f.parts:
                z.write(f, f.relative_to(EXAMPLE).as_posix())
    r = HttpResponse(buf.getvalue(), content_type="application/zip")
    r["Content-Disposition"] = 'attachment; filename="hello-plugin.zip"'
    return r
