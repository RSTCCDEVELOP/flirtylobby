import logging
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.access import level
from apps.accounts.permissions import has_level, has_level_for
from apps.core import modules
from apps.core.modules import module_required
from apps.security.words import find_forbidden

from . import service
from .models import Page

logger = logging.getLogger(__name__)
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731
KEY_RE = re.compile(r"[a-z0-9][a-z0-9-]{1,58}")
RESERVED = {"admin", "api", "login", "dashboard", "p", "static", "media"}
PRIVATE_RESERVED = {"admin", "community", "plugins", "profile", "subscriptions", "superadmin", "mijn-bestellingen", "mijn-donaties", "groep"}  # the folders of the dashboard itself: a private page cannot take their address


def _bg(p):
    """Background of a page from the media library: {type, media, name, url, overlay} or {} when none."""
    from django.core.files.storage import default_storage

    from apps.medialib.models import MediaItem

    b = p.background or {}
    item = MediaItem.objects.filter(pk=b.get("media")).first() if b.get("type") in ("image", "video") else None
    if not item or item.kind != b["type"]:
        return {}
    return {"type": b["type"], "media": item.id, "name": item.name, "url": default_storage.url(item.key), "overlay": b.get("overlay", 0.35)}


def _out(p):
    return {"background": _bg(p), "id": p.id, "key": p.key, "kind": p.kind, "title": p.title, "path": p.path, "url": p.url, "module": p.module, "enabled": p.enabled,
            "scope": p.scope, "in_menu": p.in_menu, "new_tab": p.new_tab, "audience": p.audience, "parent": p.parent_id, "order": p.order,
            "slugs": p.slugs or {}, "has_slugs": service.has_slugs(p), "devices": p.devices or {}, "cta": p.cta, "label_link": p.label_link, "available": service.available(p), "locked": p.key in service.ALWAYS_ON, "editable": p.kind == "content" or p.key in service.EDITABLE}


@api_view(["GET"])
@permission_classes([AllowAny])
def menu(request):
    """Public: the header menu (only what is switched on)."""
    return Response({"items": service.menu() if modules.enabled("pages") else service.default_menu(), "settings": service.menu_settings()})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def private_menu(request):
    """Members: the menu of the dashboard (private pages that are on)."""
    return Response({"items": service.private_menu()})


@api_view(["GET"])
@permission_classes([AllowAny])
def backgrounds(request):
    """Public: {path: {type, url, overlay}} of the pages that are on and have a background (picture or video from the media library)."""
    out = {}
    if modules.enabled("pages"):
        for p in Page.objects.exclude(background={}):
            if service.available(p) and (bg := _bg(p)) and p.path:
                out[p.path] = {"type": bg["type"], "url": bg["url"], "overlay": bg["overlay"]}
    return Response(out)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_state(request):
    """Public: which built-in pages are on (the site routes use this to 404 pages that are off)."""
    service.ensure_defaults()
    return Response({"on": {p.key: (service.available(p) if modules.enabled("pages") else True) for p in Page.objects.all()}})


@api_view(["GET"])
@permission_classes([AllowAny])
def public_page(request, key):
    """Public: one own page (title per language) if it is on."""
    p = Page.objects.filter(key=key, kind="content").first()
    if not p or not modules.enabled("pages") or not service.available(p) or (p.scope == "private" and not request.user.is_authenticated):
        return Response(status=status.HTTP_404_NOT_FOUND)
    from apps.subscriptions import service as subs

    return Response({"key": p.key, "scope": p.scope, "title": p.title, "audience": p.audience, "locked": p.key in subs.locked_pages(), "access": subs.page_ok(request.user, p.key)})


@api_view(["GET"])
@permission_classes([AllowAny])
def by_url(request):
    """Public: the standard page (content page with an address of its own, like /community) at ?path=; 404 when there is none or its module is off."""
    path = "/" + str(request.query_params.get("path") or "").strip("/")
    p = next((x for x in Page.objects.filter(scope="public", kind__in=("content", "system", "link", "menu")) if path in x.all_paths()), None)  # the address in any language leads to the page
    if not p or not modules.enabled("pages") or not service.available(p):
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response({"key": p.key, "kind": p.kind, "canonical": p.path, "title": p.title})


@api_view(["GET"])
@permission_classes([AllowAny])
def aliases(request):
    """Public: the addresses of the standard pages in every language. {aliases: {address: canonical address}, pages: {key: {canonical, urls: {lang: address}}}}; only pages that are on."""
    out, pages = {}, {}
    if modules.enabled("pages"):
        for p in Page.objects.filter(scope="public", kind__in=("content", "system", "link", "menu")):
            if not p.slugs or not service.available(p):
                continue
            urls = {l: p.path_in(l) for l in service.LANG_CODES}
            pages[p.key] = {"canonical": p.path, "urls": urls}
            for a in p.all_paths()[1:]:
                out[a] = p.path
    return Response({"aliases": out, "pages": pages})


@api_view(["GET", "POST"])
@permission_classes([has_level_for("pages", {"GET": "use", "POST": "manage"}), module_required("pages")])
def pages(request):
    service.ensure_defaults()
    if request.method == "POST":
        d = request.data
        kind = d.get("kind")
        if kind not in ("content", "link", "menu"):
            return bad("Kies een eigen pagina, een link of een menu-item.")
        title = _titles(d.get("title"))
        if not title:
            return bad("Geef de pagina een naam.")
        if (w := find_forbidden(" ".join(title.values()))):
            return bad(f"Bevat niet toegestane woorden: {', '.join(w)}.")
        key = str(d.get("key") or "").strip().lower() or re.sub(r"[^a-z0-9]+", "-", next(iter(title.values())).lower()).strip("-")[:58]
        scope = "private" if d.get("scope") == "private" else "public"
        if not KEY_RE.fullmatch(key) or key in RESERVED or (scope == "private" and key in PRIVATE_RESERVED):
            return bad("Het adres mag alleen a-z, 0-9 en - bevatten (minimaal 2 tekens).")
        base, n = key, 2
        while Page.objects.filter(key=key).exists():
            key, n = f"{base}-{n}", n + 1
        url = ""
        if kind == "link":
            url = str(d.get("url") or "").strip()
            if not service.URL_RE.match(url):
                return bad("Geef een geldige link (https://… of /pad).")
        last = Page.objects.order_by("-order").first()
        p = Page.objects.create(key=key, kind=kind, title=title, url=url, scope=scope, audience="members" if scope == "private" else "all", in_menu=bool(d.get("in_menu", True)), order=(last.order + 1) if last else 0)
        service.fill_slugs(p)
        p.save()
        logger.info("Page '%s' created by %s", key, request.user.email)
        return Response(_out(p), status=status.HTTP_201_CREATED)
    scope = "private" if request.query_params.get("scope") == "private" else "public"
    from apps.integrations import ai

    return Response({"pages": [_out(p) for p in Page.objects.filter(scope=scope)], "can_manage": level(request.user, "pages") >= 3, "ai": ai.available()})


@api_view(["POST"])
@permission_classes([has_level_for("pages", {"POST": "edit"}), module_required("pages")])
def translate(request):
    """The name of a menu item or page in EVERY language of the system (also the ones that are off), translated by Claude from the default language."""
    import json

    from apps.core import themeimport
    from apps.core.models import Language
    from apps.integrations import ai

    text = str(request.data.get("text") or "").strip()[:80]
    if not text:
        return bad("Vul eerst de naam in.")
    if not ai.available():
        return bad("Claude is niet gekoppeld. Vul de namen zelf in of koppel Claude bij Admin → API keys.")
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    todo = [(l.code, l.name) for l in Language.objects.all() if l.code != default]
    system = ("You translate the short name of a website menu item (one or two words). Keep it short, natural and neutral. "
              "Answer with ONE JSON object only, no text around it: {\"titles\": {code: translation}} with an entry for every requested language code.")
    prompt = json.dumps({"text": text, "source_language": default, "languages": [{"code": c, "name": n} for c, n in todo]}, ensure_ascii=False)
    try:
        out = themeimport._parse_json(ai.claude(system, prompt, max_tokens=1500, timeout=60), need=("titles",))
    except (ValueError, KeyError) as e:
        return bad(f"Vertalen mislukt: {e}")
    got = out.get("titles") or {}
    titles = {default: text, **{c: str(got.get(c) or "").strip()[:80] for c, _n in todo if str(got.get(c) or "").strip()}}
    return Response({"titles": titles})


def _titles(raw):
    if not isinstance(raw, dict):
        return {}
    return {str(k)[:5]: str(v).strip()[:80] for k, v in raw.items() if re.fullmatch(r"[a-z]{2,5}", str(k)) and str(v).strip()}


@api_view(["PATCH", "DELETE"])
@permission_classes([has_level_for("pages", {"PATCH": "edit", "DELETE": "manage"}), module_required("pages")])
def page(request, pk):
    p = Page.objects.filter(pk=pk).first()
    if not p:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        if p.kind == "system":
            return bad("Een systeempagina kun je niet verwijderen. Zet hem uit.")
        p.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data
    if "enabled" in d:
        if p.key in service.ALWAYS_ON and not d["enabled"]:
            return bad("De homepage kan niet worden uitgezet.")
        p.enabled = bool(d["enabled"])
    for f in ("in_menu", "new_tab"):
        if f in d:
            setattr(p, f, bool(d[f]))
    if "audience" in d:
        if d["audience"] not in ("all", "members", "guests"):
            return bad("Ongeldige doelgroep.")
        p.audience = d["audience"]
    if "title" in d:
        title = _titles(d["title"])
        if not title:
            return bad("Geef de pagina een naam.")
        if (w := find_forbidden(" ".join(title.values()))):
            return bad(f"Bevat niet toegestane woorden: {', '.join(w)}.")
        p.title = title
    if "url" in d and p.kind == "link":
        url = str(d["url"]).strip()
        if not service.URL_RE.match(url):
            return bad("Geef een geldige link (https://… of /pad).")
        p.url = url
    if "background" in d:
        b = d["background"] or {}
        if not b or b.get("type") in (None, "", "none"):
            p.background = {}
        else:
            from apps.medialib.models import MediaItem

            item = MediaItem.objects.filter(pk=b.get("media")).first()
            if b.get("type") not in ("image", "video") or not item or item.kind != b["type"]:
                return bad("Kies een afbeelding of video uit de mediabibliotheek.")
            try:
                overlay = min(max(float(b.get("overlay", 0.35)), 0), 0.9)
            except (TypeError, ValueError):
                return bad("Ongeldige donkerte.")
            p.background = {"type": b["type"], "media": item.id, "overlay": round(overlay, 2)}
    if "slugs" in d or "title" in d:
        if isinstance(d.get("slugs"), dict) or not p.slugs:
            err = service.fill_slugs(p, d.get("slugs") if isinstance(d.get("slugs"), dict) else None)
            if err:
                return bad(err)
    if "cta" in d:
        p.cta = bool(d["cta"])
    if "label_link" in d:
        p.label_link = bool(d["label_link"])
    if isinstance(d.get("devices"), dict):
        p.devices = {k: bool(d["devices"].get(k, True)) for k in service.DEVICES}
    if "parent" in d:
        par = Page.objects.filter(pk=d["parent"]).first() if d["parent"] else None
        if par and (par.pk == p.pk or par.parent_id):
            return bad("Een menu-item kan maximaal één niveau diep.")
        if par and p.children.exists():
            return bad("Een item met subitems kan niet zelf onder een ander item komen.")
        p.parent = par
    p.save()
    return Response(_out(p))


@api_view(["PUT"])
@permission_classes([has_level("pages", "edit"), module_required("pages")])
def menu_order(request):
    """Save the whole menu structure at once: items = [{id, parent, order}] (two levels)."""
    items = request.data.get("items")
    if not isinstance(items, list):
        return bad("Ongeldige volgorde.")
    ids = {p.id for p in Page.objects.all()}
    parents = {}
    for i in items:
        if not isinstance(i, dict) or i.get("id") not in ids:
            return bad("Ongeldig menu-item.")
        parents[i["id"]] = i.get("parent") or None
    for pid, par in parents.items():
        if par and (par not in ids or parents.get(par)):
            return bad("Een menu-item kan maximaal één niveau diep.")
    for n, i in enumerate(items):
        Page.objects.filter(pk=i["id"]).update(parent_id=parents[i["id"]], order=n)
    return Response({"pages": [_out(p) for p in Page.objects.all()]})


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def menu_settings(request):
    """The look of the header menu: GET for everyone (the site needs it), PUT for those who manage the pages."""
    from .models import MenuSettings

    if request.method == "PUT":
        if not request.user.is_authenticated or level(request.user, "pages") < 3 or not modules.enabled("pages"):
            return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
        MenuSettings.objects.update_or_create(pk=1, defaults={"data": service.clean_menu_settings(request.data)})
    return Response(service.menu_settings())
