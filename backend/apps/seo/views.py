import logging

from django.core.files.storage import default_storage
from django.http import Http404, HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import has_level, has_level_for
from apps.core import modules
from apps.core.models import Language
from apps.core.modules import module_required

from . import defaults as d
from . import output, service
from .models import SeoPage

logger = logging.getLogger(__name__)
mod_seo = module_required("seo")


def _base(request):
    return service.get()["site"]["site_url"] or request.GET.get("base", "").rstrip("/")


def _page(p):
    return {"id": p.id, "path": p.path, "lang": p.lang, "title": p.title, "description": p.description, "og_media": p.og_media_id,
            "og_image": default_storage.url(p.og_media.key) if p.og_media_id else None, "noindex": p.noindex, "canonical": p.canonical}


# ── public: for the website and for crawlers ────────────────────────────────
@api_view(["GET"])
@permission_classes([AllowAny])
def public(request):
    s, base = service.get(), _base(request)
    pages = {}
    if modules.enabled("seo"):
        for p in SeoPage.objects.select_related("og_media"):
            pages.setdefault(p.path, {})[p.lang] = _page(p)
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    return Response({
        "site": {**s["site"], "default_og_image": service.og_image_url(s["site"]["default_og_media"])},
        "verification": s["verification"], "pages": pages, "jsonld": output.jsonld(base), "default_language": default,
    })


def _text(content, mime):
    return HttpResponse(content, content_type=f"{mime}; charset=utf-8")


@api_view(["GET"])
@permission_classes([AllowAny])
def robots_txt(request):
    return _text(output.robots(_base(request)), "text/plain")


@api_view(["GET"])
@permission_classes([AllowAny])
def sitemap_xml(request):
    return _text(output.sitemap(_base(request)), "application/xml")


@api_view(["GET"])
@permission_classes([AllowAny])
def llms_txt(request):
    content = output.llms(_base(request))
    if content is None:
        raise Http404
    return _text(content, "text/plain")


# ── admin ───────────────────────────────────────────────────────────────────
@api_view(["GET", "PUT"])
@permission_classes([has_level_for("seo", {"GET": "use"}, default="edit"), mod_seo])
def settings_admin(request):
    if request.method == "PUT":
        try:
            service.save(service.clean(request.data))
        except service.Invalid as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        logger.info("SEO settings updated by %s", request.user.email)
    bots = [{"group": g, "label": label, "bots": [{"key": k, "token": t, "label": lb} for k, t, lb in items]} for g, (label, items) in d.BOTS.items()]
    return Response({"settings": service.raw(), "bots": bots, "pages": [{"path": p, "label": lb} for p, lb in service.pages()],
                     "languages": list(Language.objects.filter(enabled=True).values("code", "native_name", "is_default")),
                     "types": d.SCHEMA_TYPES, "freq": d.FREQ})


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([has_level_for("seo", {"GET": "use"}, default="edit"), mod_seo])
def pages_admin(request):
    """GET: all page settings. PUT: create/update one (path + lang). DELETE ?id=: remove one."""
    if request.method == "GET":
        return Response([_page(p) for p in SeoPage.objects.select_related("og_media")])
    if request.method == "DELETE":
        SeoPage.objects.filter(pk=request.query_params.get("id")).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    b = request.data
    path, lang = str(b.get("path", "")).strip(), b.get("lang", "")
    if not path.startswith("/") or len(path) > 200 or " " in path or not Language.objects.filter(code=lang).exists():
        return Response({"detail": "Ongeldig pad (begin met /) of taal."}, status=status.HTTP_400_BAD_REQUEST)
    canonical = str(b.get("canonical", "")).strip()
    if canonical and not (canonical.startswith("https://") or canonical.startswith("http://") or canonical.startswith("/")):
        return Response({"detail": "Canonical: volledige URL of pad."}, status=status.HTTP_400_BAD_REQUEST)
    media = b.get("og_media")
    page, _ = SeoPage.objects.update_or_create(path=path, lang=lang, defaults={
        "title": str(b.get("title", ""))[:200], "description": str(b.get("description", ""))[:400], "noindex": bool(b.get("noindex")),
        "canonical": canonical[:300], "og_media_id": int(media) if media else None})
    return Response(_page(page))


@api_view(["GET"])
@permission_classes([has_level("seo", "use"), mod_seo])
def audit(request):
    s = service.raw()
    site, checks = s["site"], []
    add = lambda level, title, detail="", path=None: checks.append({"level": level, "title": title, "detail": detail, "path": path})  # noqa: E731

    add("ok" if site["allow_indexing"] else "fail", "Zoekmachines mogen de site indexeren" if site["allow_indexing"] else "De hele site staat op 'niet indexeren'",
        "" if site["allow_indexing"] else "Zet 'Indexeren toestaan' aan zodra de site live is, anders komt hij niet in Google.")
    add("ok" if site["site_url"] else "warn", "Website-adres ingesteld" if site["site_url"] else "Website-adres ontbreekt",
        "Nodig voor een correcte sitemap en canonical-links (bv. https://www.jouwdomein.nl).")
    add("ok" if 50 <= len(site["default_description"]) <= 160 else "warn", "Standaard omschrijving",
        f"{len(site['default_description'])} tekens. Ideaal: 70–160." if site["default_description"] else "Nog leeg: zoekmachines kiezen dan zelf een stukje tekst.")
    add("ok" if site["default_og_media"] else "warn", "Standaard deelafbeelding" if site["default_og_media"] else "Geen deelafbeelding",
        "" if site["default_og_media"] else "Een afbeelding (1200×630) maakt links op social media en in AI-antwoorden aantrekkelijker.")
    add("ok" if s["sitemap"]["enabled"] else "warn", "Sitemap actief" if s["sitemap"]["enabled"] else "Sitemap staat uit", "Een sitemap helpt zoekmachines al je pagina's te vinden.")
    add("ok" if s["schema"]["enabled"] and (s["schema"]["legal_name"] or site["name"]) else "warn", "Gestructureerde gegevens (JSON-LD)",
        "Organisatie en website worden meegegeven aan zoekmachines." if s["schema"]["enabled"] else "Staat uit.")
    add("ok" if s["llms"]["enabled"] else "info", "llms.txt voor AI-agents", "Beschrijft de site voor AI-assistenten." if s["llms"]["enabled"] else "Staat uit.")
    if not any(s["verification"].values()):
        add("info", "Geen verificatiecodes", "Voeg een Google Search Console- of Bing-code toe om je zoekresultaten te volgen.")
    blocked_ai = [t for k, t, _ in d.BOTS["ai_training"][1] if not s["bots"][k]]
    add("info", f"AI-training: {len(blocked_ai)} van {len(d.BOTS['ai_training'][1])} bots geblokkeerd", "Je bepaalt zelf of AI-bedrijven je teksten mogen gebruiken om modellen te trainen.")
    if not s["bots"]["googlebot"] or not s["bots"]["bingbot"]:
        add("warn", "Google of Bing is geblokkeerd", "Dan verschijnt de site daar niet in de zoekresultaten.")

    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    by = {(p.path, p.lang): p for p in SeoPage.objects.all()}
    for path, label in service.pages():
        p = by.get((path, default))
        if p and p.noindex:
            add("info", f"{label}: niet geïndexeerd", "Deze pagina staat op noindex en wordt uit de sitemap gehaald.", path)
            continue
        t, ds = (p.title if p else ""), (p.description if p else "")
        add("ok" if 30 <= len(t) <= 60 else "warn", f"{label}: titel", f"{len(t)} tekens. Ideaal: 30–60." if t else "Geen eigen titel: de standaardtitel wordt gebruikt.", path)
        add("ok" if 70 <= len(ds) <= 160 else "warn", f"{label}: omschrijving", f"{len(ds)} tekens. Ideaal: 70–160." if ds else "Geen eigen omschrijving.", path)
    return Response(checks)
