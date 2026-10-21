"""What is standard in the pages of easy2edit: the built-in pages with their names, layouts and texts. Used to leave the standard out of a backup, and to reset a
standard page that was changed to the original setup."""
import re

from apps.core.models import ContentBlock

from . import defaults as page_defaults
from . import service as page_service
from .models import Page, PageLayout

def _default_fields(key):
    for k, url, module, in_menu, audience, titles in page_service.SYSTEM:
        if k == key:
            return {"kind": "system", "title": titles, "url": url, "module": module, "in_menu": in_menu, "audience": audience}
    for k, url, module, scope, in_menu in page_defaults.SCREENS:
        if k == key:
            return {"kind": "link" if scope == "private" else "system", "title": page_defaults.title(k), "url": url, "module": module, "in_menu": in_menu, "scope": scope,
                    "audience": "members" if scope == "private" else "all"}
    for k, url, module, scope, in_menu in page_defaults.CONTENT:
        if k == key:
            return {"kind": "content", "title": page_defaults.title(k), "url": url, "module": module, "in_menu": in_menu, "scope": scope, "audience": "all"}
    return None


def page_changed(p):
    """Is this page not (exactly) the standard page? Own pages, links and menu items always are."""
    d = _default_fields(p.key)
    if d is None or p.kind in ("link", "menu") and d["kind"] != p.kind:
        return True
    for f, v in d.items():
        if f == "title":  # the standard names are in some languages; other languages that were added by the system do not count
            if any((p.title or {}).get(l) != t for l, t in v.items()):
                return True
        elif getattr(p, f) != v:
            return True
    if not p.enabled and p.key not in page_service.ALWAYS_ON:
        return True
    return bool(p.parent_id or p.background or p.access or p.new_tab or p.cta or p.label_link or any(v is False for v in (p.devices or {}).values()))


def _standard_keys():
    return [k for k, *_ in page_defaults.CONTENT] + list(page_defaults.SCREEN_BLOCKS) + list(page_defaults.SHOP_PAGES)


def _standard_texts():
    """{(key, lang): text} of the texts that come with the system: the blocks of the standard pages, their names and the opening texts of the member pages."""
    out, theme = {}, page_defaults._theme()
    for key in _standard_keys():
        for bkey, per in page_defaults._blocks(key, theme):
            for lang, text in per.items():
                out[(bkey, lang)] = text
        for lang, text in page_defaults.TEXTS.get(f"title.{key}", {}).items():
            out[(f"page.{key}.title", lang)] = text
    for tid, per in page_defaults.TEXTS.items():
        if tid.startswith("my-"):
            for lang, text in per.items():
                out[(f"page.{tid}", lang)] = text
    return out


def _standard_layout(key, data):
    """Is this layout the one that the system made (not edited)? An edited layout has no `auto` mark."""
    if key not in _standard_keys():
        return False
    return bool((data or {}).get("auto")) or data == page_defaults.layout_for(key, page_defaults._theme())


def has_default(key):
    return _default_fields(key) is not None


def own_blocks(page):
    # the blocks of the page, its own texts, and the fixed elements (home.title, home.text, login.intro … and what was removed or styled with them)
    return (ContentBlock.objects.filter(key__startswith=f"layout.{page.key}.") | ContentBlock.objects.filter(key__startswith=f"page.{page.key}.")
            | ContentBlock.objects.filter(key__startswith=f"{page.key}."))


def modified(page, std_texts=None):
    """Is this standard page changed (the page itself, its blocks or its texts)? Always False for a page that has no standard."""
    if not has_default(page.key):
        return False
    if page_changed(page):
        return True
    lay = PageLayout.objects.filter(key=page.key).first()
    if lay and not _standard_layout(page.key, lay.data) and page.key in _standard_keys():
        return True
    std = std_texts if std_texts is not None else _standard_texts()
    return any(std.get((b.key, b.lang)) != b.text for b in own_blocks(page) if not b.key.endswith(".title") or (b.key, b.lang) in std)


def reset(page):
    """Back to the first setup: the page itself, its layout and its texts are what the system made. Own settings (menu place, SEO) of other pages are not touched."""
    d = _default_fields(page.key)
    if d is None:
        raise ValueError("Deze pagina heeft geen standaard om naar terug te gaan.")
    title = {**page_defaults.EXTRA["titles"].get(page.key, {}), **d["title"]}
    Page.objects.filter(pk=page.pk).update(title=title, url=d.get("url", page.url), module=d.get("module", page.module), in_menu=d["in_menu"], audience=d["audience"], enabled=True,
                                          new_tab=False, cta=False, label_link=False, devices={}, access={}, background={}, setup={}, parent=None)
    page.refresh_from_db()
    PageLayout.objects.filter(key=page.key).delete()
    own_blocks(page).delete()
    try:
        page_defaults.ensure_pages()  # makes the standard layout and texts of the standard pages again
    except Exception:  # noqa: BLE001
        pass
    from .default_source import SLUGS

    if SLUGS.get(page.key):
        Page.objects.filter(pk=page.pk).update(slugs={**page_defaults.EXTRA["slugs"].get(page.key, {}), **SLUGS[page.key]})
    page.refresh_from_db()
    page_service.fill_slugs(page)
    page.save()
    return page
