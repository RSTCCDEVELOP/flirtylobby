"""Search engine settings: site-wide and per page. Pictures are matched by their file name in the media library."""
from apps.core.settings_backup import register
from apps.medialib.models import MediaItem

from .models import SeoPage, SeoSettings


def _export(opts):
    return {"site": SeoSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {},
            "pages": [{"path": p.path, "lang": p.lang, "title": p.title, "description": p.description, "noindex": p.noindex, "canonical": p.canonical,
                       "og_image": p.og_media.key if p.og_media_id else None} for p in SeoPage.objects.select_related("og_media")]}


def _apply(data, ctx):
    data = data or {}
    if isinstance(data.get("site"), dict):
        obj, _ = SeoSettings.objects.get_or_create(pk=1)
        obj.data = data["site"]
        obj.save()
    n = lost = 0
    for p in data.get("pages", []):
        if not (p.get("path") and p.get("lang")):
            continue
        media = MediaItem.objects.filter(key=p["og_image"]).first() if p.get("og_image") else None
        lost += bool(p.get("og_image") and not media)
        SeoPage.objects.update_or_create(path=p["path"], lang=p["lang"], defaults={"title": p.get("title", ""), "description": p.get("description", ""),
                                         "noindex": bool(p.get("noindex")), "canonical": p.get("canonical", ""), "og_media": media})
        n += 1
    return f"SEO geladen, {n} pagina-instelling(en)" + (f"; {lost} afbeelding(en) niet gevonden in de mediabibliotheek." if lost else ".")


def _add(data, ctx):
    have = set(SeoPage.objects.values_list("path", "lang"))
    return _apply({"pages": [p for p in (data or {}).get("pages", []) if (p.get("path"), p.get("lang")) not in have]}, ctx)


def _clear():
    SeoPage.objects.all().delete()


register("seo", "SEO", _export, _apply, description="Zoekmachine-instellingen van de site en per pagina.", order=45, add=_add, clear=_clear)
