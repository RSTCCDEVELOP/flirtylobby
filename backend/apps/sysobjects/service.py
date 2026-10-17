"""System objects: registry, sync with the sources, and where they are used."""
import logging

from apps.core import modules

from .models import SystemObject

logger = logging.getLogger(__name__)


def sources():
    """kind -> queryset of the items that ticked 'System Object'."""
    from apps.subscriptions.models import DonationCampaign, Plan

    return {"donation": DonationCampaign.objects.filter(system_object=True), "plan": Plan.objects.filter(system_object=True)}


def sync():
    """Create objects for ticked items, remove those that are no longer ticked (or whose source is gone). Cheap; called on every save."""
    keep = set()
    for kind, qs in sources().items():
        for src in qs:
            obj, _ = SystemObject.objects.get_or_create(kind=kind, ref_id=src.pk, defaults={"slug": f"{kind}-{src.slug}"[:80]})
            keep.add(obj.pk)
    SystemObject.objects.exclude(pk__in=keep).delete()


def source_of(obj):
    from apps.subscriptions.models import DonationCampaign, Plan

    return (DonationCampaign if obj.kind == "donation" else Plan).objects.filter(pk=obj.ref_id).first()


def usage(slug):
    """Pages (content block keys) that contain this object."""
    from apps.core.models import ContentBlock

    out = set()
    for b in ContentBlock.objects.filter(text__contains=f'data-sysobject="{slug}"'):
        parts = b.key.split(".")
        out.add(parts[1] if parts[0] == "page" and len(parts) > 2 else parts[0])
    return sorted(out)
