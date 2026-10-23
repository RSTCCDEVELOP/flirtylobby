# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""System objects: registry, sync with the sources, and where they are used."""
import logging

from apps.core import modules

from .models import SystemObject

logger = logging.getLogger(__name__)


def sources():
    """kind -> queryset of the items that ticked 'System Object'."""
    from apps.plugins import facade

    DonationCampaign, Plan = facade.models("subscriptions", "DonationCampaign", "Plan")

    from apps.plugins import installer
    from apps.plugins.models import Plugin

    from apps.medialib.models import MediaView

    return {"media": MediaView.objects.all(), "donation": DonationCampaign.objects.filter(system_object=True), "plan": Plan.objects.filter(system_object=True),
            "plugin": [p for p in Plugin.objects.all() if installer.as_page_object(p)],
            "plugin_item": [(p, i) for p in Plugin.objects.all() for i in (installer.content_items(p) or []) if i["object"] and not i["problem"] and p.manifest.get("web")],
            "plugin_part": [(p, x) for p in Plugin.objects.all() for x in installer.all_parts(p)]}  # parts of a plugin (product overview, cart ...) to move around on a page


def sync():
    """Create objects for ticked items, remove those that are no longer ticked (or whose source is gone). Cheap; called on every save."""
    keep = set()
    for kind, qs in sources().items():
        for src in qs:
            if kind == "plugin_part":  # a block of a plugin page: (plugin, part)
                plug, part = src
                obj, _ = SystemObject.objects.get_or_create(kind=kind, ref_id=plug.pk, ref_key=part["key"], defaults={"slug": f"plugin-{plug.name}-{part['key']}"[:80]})
            elif kind == "plugin_item":  # a part of a plugin: (plugin, item)
                plug, item = src
                obj, _ = SystemObject.objects.get_or_create(kind=kind, ref_id=plug.pk, ref_key=item["name"], defaults={"slug": f"plugin-{plug.name}-{item['name']}"[:80]})
            else:
                obj, _ = SystemObject.objects.get_or_create(kind=kind, ref_id=src.pk, defaults={"slug": f"{kind}-{getattr(src, 'slug', None) or src.name}"[:80]})
            keep.add(obj.pk)
    keep |= set(SystemObject.objects.filter(kind__in=("calculator", "marketing", "pricelist", "installation")).values_list("pk", flat=True))  # the calculation form (Super admin → Prijzen → Sales) is switched on there
    SystemObject.objects.exclude(pk__in=keep).delete()


def source_of(obj):
    from apps.plugins import facade

    DonationCampaign, Plan = facade.models("subscriptions", "DonationCampaign", "Plan")

    if obj.kind in ("calculator", "marketing", "pricelist", "installation"):
        return obj
    if obj.kind == "media":
        from apps.medialib.models import MediaView

        return MediaView.objects.filter(pk=obj.ref_id).first()
    if obj.kind in ("plugin", "plugin_item", "plugin_part"):
        from apps.plugins.models import Plugin

        return Plugin.objects.filter(pk=obj.ref_id).first()
    return (DonationCampaign if obj.kind == "donation" else Plan).objects.filter(pk=obj.ref_id).first()


def usage(slug):
    """Pages (content block keys) that contain this object."""
    from apps.core.models import ContentBlock

    out = set()
    for b in ContentBlock.objects.filter(text__contains=f'data-sysobject="{slug}"'):
        parts = b.key.split(".")
        out.add(parts[1] if parts[0] == "page" and len(parts) > 2 else parts[0])
    return sorted(out)
