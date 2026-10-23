from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import has_level, has_level_for
from apps.core.modules import module_required

from . import service
from .models import SystemObject

ADMIN = [has_level_for("sysobjects", {"GET": "use"}, default="edit"), module_required("sysobjects")]


def _row(o, public=False):
    from apps.plugins import facade

    sv = facade.mod("subscriptions", "views")

    src = service.source_of(o)
    if not src:
        return None
    if o.kind == "calculator":
        data, names, button = {"title": "Prijsberekening", "enabled": True}, {"": "Prijsberekening"}, {}
    elif o.kind == "installation":
        from apps.core import pricelist as pl

        data = pl.installation(o.ref_key)
        if not data:
            return None
        names, button = {"": data["name"]}, {}
    elif o.kind == "pricelist":
        data, names, button = {"title": "Prijslijst", "enabled": True}, {"": "Prijslijst"}, {}
    elif o.kind == "marketing":
        from apps.core import modules as mods

        from apps.core import marketing as mk

        mod = mk._mod(o.ref_key)
        if not mod:
            return None
        data, names, button = {"module": o.ref_key, "label": mod["label"], "title": "Marketing: " + mod["label"], "enabled": True}, {"": "Marketing: " + mod["label"]}, {}
    elif o.kind == "plugin_item":
        from apps.plugins import installer

        it = next((i for i in installer.content_items(src) or [] if i["name"] == o.ref_key), None)
        if not it or not it["object"]:
            return None
        data, names, button = {"name": src.name, "plugin_title": src.title, "admin_web": src.manifest.get("admin_web", ""), "item": it["name"], "title": it["title"], "enabled": src.enabled and it["enabled"], "public": it["public"]}, {"": it["title"], **it["meta"]["titles"]}, {}
    elif o.kind == "plugin_part":
        part = next((x for x in __import__("apps.plugins.installer", fromlist=["all_parts"]).all_parts(src) if x["key"] == o.ref_key), None)
        if not part:
            return None
        data, names, button = {"name": src.name, "plugin_title": src.title, "admin_web": src.manifest.get("admin_web", ""), "part": part["key"], "file": part["file"], "query": part.get("query") or {}, "title": part["title"], "enabled": src.enabled}, {"": part["title"]}, {}
    elif o.kind == "media":
        from apps.medialib import mediaviews

        data, names, button = {"name": src.name, "type": src.type, "type_label": mediaviews.LABEL[src.type], "settings": mediaviews.clean_settings(src.type, src.settings), "items": mediaviews.items(src), "enabled": True}, {"": src.name}, {}
    elif o.kind == "plugin":
        data, names, button = {"name": src.name, "title": src.title, "admin_web": src.manifest.get("admin_web", ""), "enabled": src.enabled}, {"": src.title}, {}
    elif o.kind == "donation":
        data = sv._campaign_public(src, detail=False)
        names, button = src.names or {"": src.name}, src.button or {}
    else:
        data = sv._plan_public(src, {})
        names, button = {"": src.name}, src.button or {}
    row = {"id": o.id, "slug": o.slug, "kind": o.kind, "enabled": o.enabled, "names": names, "button": button, "data": data}
    if not public:
        row.update(kind_label=dict(SystemObject.KINDS)[o.kind], used_on=service.usage(o.slug), source_id=o.ref_id,
                   edit_url={"donation": "/dashboard/admin/donations", "plan": "/dashboard/admin/subscriptions", "media": "/dashboard/admin/media", "calculator": "/dashboard/superadmin/prijzen", "marketing": "/dashboard/superadmin/prijzen", "pricelist": "/dashboard/superadmin/prijzen", "installation": "/dashboard/superadmin/prijzen"}.get(o.kind) or f"/dashboard/admin/plugins/{getattr(src, 'name', '')}")
    return row


@api_view(["GET"])
@permission_classes(ADMIN)
def admin_list(request):
    service.sync()
    return Response([r for r in (_row(o) for o in SystemObject.objects.all()) if r])


@api_view(["PATCH"])
@permission_classes([has_level("sysobjects", "edit"), module_required("sysobjects")])
def admin_toggle(request, pk):
    o = SystemObject.objects.filter(pk=pk).first()
    if not o:
        return Response(status=status.HTTP_404_NOT_FOUND)
    o.enabled = bool(request.data.get("enabled"))
    o.save(update_fields=["enabled"])
    return Response(_row(o))


@api_view(["GET"])
@permission_classes([AllowAny, module_required("sysobjects")])
def public_list(request):
    """What a page may show (enabled objects whose own module is on). The editor uses the same list for its picker."""
    from apps.core import modules

    out = []
    for o in SystemObject.objects.filter(enabled=True):
        if not modules.enabled({"donation": "donations", "plan": "subscriptions", "plugin": "plugins", "plugin_item": "plugins", "plugin_part": "plugins", "media": "media", "calculator": "sysobjects", "marketing": "sysobjects", "pricelist": "sysobjects", "installation": "sysobjects"}[o.kind]):
            continue
        r = _row(o, public=True)
        if r and o.kind in ("plugin", "plugin_item", "plugin_part") and not r["data"]["enabled"]:
            continue
        if r:
            out.append(r)
    return Response(out)
