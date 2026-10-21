import os

from django.conf import settings
from django.db import models

IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp"}
VIDEO_EXT = {"mp4", "webm", "mov", "m4v", "ogv"}


def kind_of(name):
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else "other"


# Files that belong to members (profile photos, avatars, chat attachments): not part of the site library.
# Only a superuser who switches on "gebruikersgegevens tonen" sees them.
USER_PREFIXES = ("profiles/", "images/tms/coaches/", "chat/")


def is_user_content(key):
    from . import areas

    return key.startswith(areas.user_prefixes())


class MediaItem(models.Model):
    """Registry of every uploaded file. Each file lives in exactly one place: local disk or S3."""

    key = models.CharField(max_length=500, unique=True)  # = Django file name, relative to MEDIA_ROOT
    name = models.CharField(max_length=255)  # display name
    kind = models.CharField(max_length=10, default="image")  # image | video
    mime = models.CharField(max_length=100, blank=True)
    size = models.BigIntegerField(default=0)
    storage = models.CharField(max_length=10, default="local")  # local | s3
    tags = models.JSONField(default=list, blank=True)  # short labels to find files quickly
    source = models.CharField(max_length=40, blank=True, db_index=True)  # "import:<id>" for files that come from a site import
    owner_id = models.IntegerField(null=True, blank=True, db_index=True)  # the user whose file this is (files of members), no FK: cleaned up by the erase routine
    encrypted = models.BooleanField(default=False)  # stored encrypted (see filecrypt.py)
    enc_scope = models.CharField(max_length=40, blank=True)  # which key encrypted it: user:<id> | area:<name>
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name

    @property
    def local_path(self):
        return os.path.join(settings.MEDIA_ROOT, self.key)


class StorageSettings(models.Model):
    """Singleton (pk=1): folder structure per area (users / site / other), where it lives (local or S3) and whether it is encrypted."""

    data = models.JSONField(default=dict, blank=True)


class FileKey(models.Model):
    """The data key of one scope (a user, or a whole area), itself encrypted with the master key. Deleting it makes those files unreadable."""

    scope = models.CharField(max_length=40, unique=True)
    wrapped = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class MediaView(models.Model):
    """A way to show pictures on a page (photo book, carousel, photo wall, slideshow): a system object that is put on a page in edit mode."""

    TYPES = [("album", "Fotoboek"), ("carousel", "Beeldcarrousel"), ("wall", "Fotomuur"), ("slideshow", "Diavoorstelling")]
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=70, unique=True)
    type = models.CharField(max_length=12, choices=TYPES)
    source = models.JSONField(default=dict, blank=True)  # {mode: "ids"|"tags"|"all", ids: [...], tags: [...], limit}
    settings = models.JSONField(default=dict, blank=True)  # the effects and settings of the type (see mediaviews.py)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
