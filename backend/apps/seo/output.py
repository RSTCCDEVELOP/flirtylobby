"""Generates robots.txt, sitemap.xml, llms.txt and JSON-LD from the SEO settings."""
import json
from xml.sax.saxutils import escape

from django.core.files.storage import default_storage

from apps.branding.models import SiteAsset
from apps.core.models import Language

from . import defaults as d
from . import service
from .models import SeoPage


def robots(base):
    s = service.get()
    lines = []
    for _, (_, items) in d.BOTS.items():
        for key, token, _label in items:
            if not s["bots"][key]:
                lines += [f"User-agent: {token}", "Disallow: /", ""]
    lines += ["User-agent: *"]
    if not s["site"]["allow_indexing"] or not s["bots"]["other"]:
        lines += ["Disallow: /"]
    else:
        lines += [f"Disallow: {p}" for p in s["robots"]["disallow"]] or ["Disallow:"]
    if s["robots"]["crawl_delay"]:
        lines += [f"Crawl-delay: {s['robots']['crawl_delay']}"]
    if s["robots"]["extra"].strip():
        lines += ["", s["robots"]["extra"].strip()]
    if s["sitemap"]["enabled"] and s["site"]["allow_indexing"] and base:
        lines += ["", f"Sitemap: {base}/sitemap.xml"]
    return "\n".join(lines) + "\n"


def sitemap(base):
    s = service.get()
    if not s["sitemap"]["enabled"] or not s["site"]["allow_indexing"]:
        return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>\n'
    noindex = set(SeoPage.objects.filter(noindex=True).values_list("path", flat=True))
    urls = []
    for path, _ in service.pages():
        if path in noindex:
            continue
        loc = f"{base}{path if path != '/' else '/'}"
        urls.append(f"  <url><loc>{escape(loc)}</loc><changefreq>{s['sitemap']['changefreq']}</changefreq>"
                    f"<priority>{path == '/' and 1.0 or s['sitemap']['priority']}</priority></url>")
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n"


def llms(base):
    s = service.get()
    if not s["llms"]["enabled"]:
        return None
    default = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    lines = [f"# {s['site']['name']}", ""]
    summary = s["llms"]["summary"] or s["site"]["default_description"]
    if summary:
        lines += [f"> {summary}", ""]
    if s["llms"]["include_pages"]:
        lines += ["## Pagina's", ""]
        by = {(p.path, p.lang): p for p in SeoPage.objects.all() if not p.noindex}
        for path, label in service.pages():
            p = by.get((path, default)) or next((v for (pp, _), v in by.items() if pp == path), None)
            if any(sp.path == path and sp.noindex for sp in SeoPage.objects.filter(path=path)):
                continue
            title = (p.title if p and p.title else label)
            desc = f": {p.description}" if p and p.description else ""
            lines.append(f"- [{title}]({base}{path}){desc}")
        lines.append("")
    if s["llms"]["extra"].strip():
        lines += [s["llms"]["extra"].strip(), ""]
    return "\n".join(lines)


def jsonld(base):
    s = service.get()
    if not s["schema"]["enabled"]:
        return None
    sc, site = s["schema"], s["site"]
    logo = SiteAsset.objects.filter(slot="logo").first()
    org = {"@context": "https://schema.org", "@type": sc["type"], "name": sc["legal_name"] or site["name"], "url": base or None,
           "description": sc["description"] or site["default_description"] or None,
           "logo": default_storage.url(logo.image.name) if logo else None,  # relative /media/... paths are completed by the frontend
           "email": sc["email"] or None, "telephone": sc["phone"] or None, "sameAs": sc["same_as"] or None}
    website = {"@context": "https://schema.org", "@type": "WebSite", "name": site["name"], "url": base or None}
    return [{k: v for k, v in o.items() if v} for o in (org, website)]
