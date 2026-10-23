# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Pages and the menu. Backgrounds are matched by their file name in the media library."""
from apps.core.settings_backup import register
from apps.medialib.models import MediaItem

from .models import Page


def _export(opts):
    rows = []
    for p in Page.objects.select_related("parent"):
        bg = dict(p.background or {})
        media = MediaItem.objects.filter(pk=bg.get("media")).first() if bg.get("media") else None
        rows.append({"key": p.key, "kind": p.kind, "title": p.title, "url": p.url, "module": p.module, "enabled": p.enabled, "in_menu": p.in_menu,
                     "new_tab": p.new_tab, "audience": p.audience, "parent": p.parent.key if p.parent_id else None, "order": p.order,
                     "background": {"type": bg.get("type"), "file": media.key, "overlay": bg.get("overlay", 0.35)} if media else {}})
    return rows


def _apply(data, ctx):
    n = 0
    for r in data or []:
        if not r.get("key") or r.get("kind") not in ("system", "content", "link"):
            continue
        bg, media = r.get("background") or {}, None
        if bg.get("file"):
            media = MediaItem.objects.filter(key=bg["file"], kind=bg.get("type")).first()
        Page.objects.update_or_create(key=r["key"], defaults={
            "kind": r["kind"], "title": r.get("title") or {}, "url": r.get("url", ""), "module": r.get("module", ""), "enabled": bool(r.get("enabled", True)),
            "in_menu": bool(r.get("in_menu")), "new_tab": bool(r.get("new_tab")), "audience": r.get("audience", "all"), "order": int(r.get("order", 0) or 0),
            "background": {"type": bg["type"], "media": media.id, "overlay": bg.get("overlay", 0.35)} if media else {}})
        n += 1
    for r in data or []:  # parents last: they may come later in the file
        if r.get("key") and r.get("parent"):
            parent = Page.objects.filter(key=r["parent"]).first()
            Page.objects.filter(key=r["key"]).update(parent=parent)
    return f"{n} pagina(s) geladen."


def _add(data, ctx):
    have = set(Page.objects.values_list("key", flat=True))
    return _apply([r for r in data or [] if r.get("key") not in have], ctx)


def _clear():
    Page.objects.filter(kind__in=("content", "link")).delete()  # the system pages stay (the file updates them)


register("pages", "Pagina's en menu", _export, _apply, description="Alle pagina's, het menu, zichtbaarheid en achtergronden.", order=25, add=_add, clear=_clear)
