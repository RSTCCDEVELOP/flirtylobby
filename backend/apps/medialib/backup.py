"""Library pictures that the pages and SEO settings use (backgrounds, share images), carried inside the backup."""
import mimetypes

from apps.core.backup_files import Budget, read, write
from apps.core.settings_backup import register

from .models import MediaItem, kind_of


def _used_ids():
    from apps.pages.models import Page
    from apps.seo.models import SeoPage

    ids = {(p.background or {}).get("media") for p in Page.objects.exclude(background={})}
    ids |= set(SeoPage.objects.exclude(og_media=None).values_list("og_media_id", flat=True))
    return {i for i in ids if i}


def _export(opts):
    if not opts.get("include_files", True):
        return {"items": [], "note": "files not included"}
    b, items = Budget(), []
    for m in MediaItem.objects.filter(id__in=_used_ids()):
        f = read(m.key, b)
        if f:
            items.append({"key": m.key, "name": m.name, "tags": m.tags or [], "mime": m.mime, **f})
    return {"items": items, "skipped": b.skipped}


def _apply(data, ctx):
    n = 0
    for it in (data or {}).get("items", []):
        key = it.get("key")
        if not key or not it.get("b64") or kind_of(key) == "other":
            continue
        if not MediaItem.objects.filter(key=key).exists():
            stored = write(key, it["b64"])
            item, _ = MediaItem.objects.get_or_create(key=stored, defaults={"name": it.get("name") or key, "kind": kind_of(stored), "mime": it.get("mime") or mimetypes.guess_type(stored)[0] or "", "tags": it.get("tags") or []})
            n += 1
    return f"{n} afbeelding(en) uit de mediabibliotheek toegevoegd."


# order 6: before the pages and SEO (order 25/45) so those can find their pictures
register("media_files", "Afbeeldingen van pagina's en SEO", _export, _apply, description="Achtergronden en deelafbeeldingen uit de mediabibliotheek die pagina's en SEO gebruiken.", order=6)
