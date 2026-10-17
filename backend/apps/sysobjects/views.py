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
    from apps.subscriptions import views as sv

    src = service.source_of(o)
    if not src:
        return None
    if o.kind == "plugin":
        data, names, button = {"name": src.name, "title": src.title, "enabled": src.enabled}, {"": src.title}, {}
    elif o.kind == "donation":
        data = sv._campaign_public(src, detail=False)
        names, button = src.names or {"": src.name}, src.button or {}
    else:
        data = sv._plan_public(src, {})
        names, button = {"": src.name}, src.button or {}
    row = {"id": o.id, "slug": o.slug, "kind": o.kind, "enabled": o.enabled, "names": names, "button": button, "data": data}
    if not public:
        row.update(kind_label=dict(SystemObject.KINDS)[o.kind], used_on=service.usage(o.slug), source_id=o.ref_id,
                   edit_url={"donation": "/dashboard/admin/donations", "plan": "/dashboard/admin/subscriptions"}.get(o.kind, f"/dashboard/admin/plugins/{src.name}"))
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
        if not modules.enabled({"donation": "donations", "plan": "subscriptions", "plugin": "plugins"}[o.kind]):
            continue
        r = _row(o, public=True)
        if r and o.kind == "plugin" and not r["data"]["enabled"]:
            continue
        if r:
            out.append(r)
    return Response(out)
