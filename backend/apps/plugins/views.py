"""Plugins: admin (superadmin) endpoints, the menu, the files of a plugin's own pages, and the routes plugins add."""
import io
import mimetypes
import zipfile
from pathlib import Path

from django.http import FileResponse, Http404, HttpResponse
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


def _out(p):
    sig = signing.verify(installer.plugin_dir(p.name))
    built = p.manifest.get("system_version", "0.0.0")
    return {"signature": sig, "dev_mode": sig == "missing" and signing.dev_mode_allowed(), "system_version": settings.SYSTEM_VERSION, "built_for": built,
            "compat": mf.compatibility(built, settings.SYSTEM_VERSION), "languages": installer.lang_state(p.name), "blocked": runtime.start_problem(p),
            "name": p.name, "title": p.title, "version": p.version, "description": p.description, "author": p.author, "enabled": p.enabled, "error": p.error,
            "permissions": p.manifest.get("permissions", []), "events": p.manifest.get("events", []), "has_python": bool(p.manifest.get("python")), "section": p.manifest.get("section", "system"), "admin_web": p.manifest.get("admin_web", ""), "has_web": bool(p.manifest.get("web")),
            "menu": p.manifest.get("menu"), "public_pages": p.manifest.get("public_pages", []), "site_link": p.manifest.get("site_link"), "provides": p.manifest.get("provides", []), "menu_group": installer.menu_group(p), "page_object_offered": bool(p.manifest.get("page_object")), "page_object": installer.as_page_object(p), "config_schema": p.manifest.get("config", []), "config": installer.public_config(p), "updated_at": p.updated_at}


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
    if not p:
        return bad("Plugin niet gevonden.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
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
        if "menu_group" in request.data or "page_object" in request.data:
            installer.save_placement(p, request.data.get("menu_group"), request.data.get("page_object") if "page_object" in request.data else None)
            p.refresh_from_db()
            from apps.sysobjects import service as sysobj
            sysobj.sync()
        if "enabled" in request.data:
            want = bool(request.data["enabled"])
            if want:
                err = runtime.load(p)
                if err:
                    Plugin.objects.filter(pk=p.pk).update(error=err, enabled=False)
                    return bad(f"De plugin kon niet worden gestart: {err}")
                Plugin.objects.filter(pk=p.pk).update(enabled=True, error="")
            else:
                runtime.unload(p.name)
                Plugin.objects.filter(pk=p.pk).update(enabled=False)
            p.refresh_from_db()
            from apps.core import modules

            modules.invalidate()
    return Response(_out(p))


@api_view(["GET"])
@permission_classes([IsAuthenticated, MOD])
def menu(request):
    """Plugins with a page of their own, for the menu of the dashboard. ?scope=admin (superadmins): every plugin that is on, for the admin menu."""
    installer.scan()  # a changed plugin.json (section, menu) is picked up at once
    out = []
    if request.query_params.get("scope") == "admin":
        if not request.user.is_staff:
            return Response([])
        return Response([{"name": p.name, "label": p.title, "title": p.title, "section": p.manifest.get("section", "system"), "has_admin": bool(p.manifest.get("admin_web"))} for p in Plugin.objects.filter(enabled=True)])
    for p in Plugin.objects.filter(enabled=True):
        m, web = p.manifest.get("menu"), p.manifest.get("web")
        if m and web and (m["access"] == "members" or request.user.is_staff):  # the page of the plugin in the menu
            out.append({"name": p.name, "label": m["label"], "title": p.title, "section": p.manifest.get("section", "system"), "group": installer.menu_group(p)})
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
        hit = mf.match_public(p.manifest.get("public_pages", []), path)
        if hit:
            pg, params = hit
            return Response({"name": p.name, "file": pg["file"], "title": pg["title"] or p.title, "noindex": pg.get("noindex", False), "params": params})
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
    if (d.plugin === "init") { strings = d.strings || {}; document.documentElement.lang = d.lang || "nl"; resolveReady({ user: d.user, name: d.name, apiBase: d.apiBase, lang: d.lang, route: d.route || {}, siteOrigin: d.siteOrigin || "" }); }
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
    go: function (path) { parent.postMessage({ plugin: "go", path: path }, "*"); },  /* open an address of the website (or a full link) */
    pickMedia: function () { return call("media", {}); },  /* the media library of the system: resolves {id, url} or null */
    editHtml: function (html, opts) { return call("html", { html: html || "", opts: opts || {} }); },  /* the system's text editor: resolves the new html, or null */
    resize: function (h) { parent.postMessage({ plugin: "resize", height: h }, "*"); }
  };
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
        tag = f"<script>{SDK}</script>"
        html = html.replace("<head>", "<head>" + tag, 1) if "<head>" in html else tag + html
        r = HttpResponse(html, content_type="text/html; charset=utf-8")
    else:
        r = FileResponse(open(f, "rb"), content_type=ctype)
    r["Content-Security-Policy"] = "sandbox allow-scripts allow-forms allow-popups"  # the page cannot reach the login or storage of the system
    r["X-Content-Type-Options"] = "nosniff"
    return r


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
