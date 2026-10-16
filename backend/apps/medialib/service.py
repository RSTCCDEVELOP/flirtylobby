import logging
import os

from django.conf import settings

from apps.accounts.models import User  # noqa: F401  (ensures app registry order)

from . import s3
from .models import MediaItem, kind_of

logger = logging.getLogger(__name__)


def usage_map():
    """{file key: [where it is used]} across branding, members and editable content."""
    from apps.branding.models import HomePhoto, SiteAsset
    from apps.core.models import ContentBlock
    from apps.accounts.models import User as AccountUser

    use = {}
    add = lambda key, label: use.setdefault(key, []).append(label)  # noqa: E731
    for a in SiteAsset.objects.all():
        add(a.image.name, f"Branding: {a.slot}")
    for p in HomePhoto.objects.all():
        add(p.image.name, "Homepagefoto")
    for u in AccountUser.objects.exclude(image=""):
        add(u.image.name, f"Gebruiker: {u.email}")
    ids = {}
    for b in ContentBlock.objects.filter(text__startswith="media:"):
        ids.setdefault(int(b.text[6:] or 0), []).append(b.key)
    for item in MediaItem.objects.filter(id__in=ids):
        for key in ids[item.id]:
            add(item.key, f"Tekstblok: {key}")
    return use


def release(name):
    """Delete a file, unless something else still uses it."""
    if name and not usage_map().get(name):
        from django.core.files.storage import default_storage

        default_storage.delete(name)


def scan():
    """Register files in MEDIA_ROOT that are not in the library yet. Returns how many were added."""
    import mimetypes

    added = 0
    root = str(settings.MEDIA_ROOT)
    for dirpath, _, files in os.walk(root):
        for f in files:
            full = os.path.join(dirpath, f)
            key = os.path.relpath(full, root).replace(os.sep, "/")
            if kind_of(key) == "other" or MediaItem.objects.filter(key=key).exists():
                continue
            MediaItem.objects.create(key=key, name=f, kind=kind_of(key), mime=mimetypes.guess_type(key)[0] or "",
                                     size=os.path.getsize(full), storage="local")
            added += 1
    return added


def move(item, to):
    """Move one file to 'local' or 's3'. Copies, verifies, then removes the source: a file lives in one place only."""
    if item.storage == to:
        return
    if to == "s3":
        if not s3.available():
            raise s3.S3Error("S3 is niet gekoppeld of staat uit.")
        if not os.path.exists(item.local_path):
            raise s3.S3Error("Lokaal bestand ontbreekt.")
        item.size = os.path.getsize(item.local_path)
        s3.upload(item)
        os.remove(item.local_path)
    else:
        s3.download(item)
        try:
            s3.delete(item)
        except Exception as e:  # file is safe locally; report but keep going
            logger.warning("Could not delete %s from S3 after download: %s", item.key, e)
    item.storage = to
    item.size = os.path.getsize(item.local_path) if to == "local" else item.size
    item.save()
    logger.info("Media %s moved to %s", item.key, to)
