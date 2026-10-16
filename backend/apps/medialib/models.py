import os

from django.conf import settings
from django.db import models

IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp"}
VIDEO_EXT = {"mp4", "webm", "mov", "m4v", "ogv"}


def kind_of(name):
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else "other"


class MediaItem(models.Model):
    """Registry of every uploaded file. Each file lives in exactly one place: local disk or S3."""

    key = models.CharField(max_length=500, unique=True)  # = Django file name, relative to MEDIA_ROOT
    name = models.CharField(max_length=255)  # display name
    kind = models.CharField(max_length=10, default="image")  # image | video
    mime = models.CharField(max_length=100, blank=True)
    size = models.BigIntegerField(default=0)
    storage = models.CharField(max_length=10, default="local")  # local | s3
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name

    @property
    def local_path(self):
        return os.path.join(settings.MEDIA_ROOT, self.key)
