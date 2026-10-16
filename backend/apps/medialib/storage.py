"""
File storage used by every FileField/ImageField. Files are written locally and registered in MediaItem;
`url()` follows wherever a file currently lives (local or S3), so moving a file never breaks a model.
"""
import mimetypes
import os

from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage

from .models import kind_of


class LibraryStorage(FileSystemStorage):
    def _item(self, name):
        from .models import MediaItem

        return MediaItem.objects.filter(key=name).first()

    def _save(self, name, content):
        from .models import MediaItem

        name = super()._save(name, content)
        MediaItem.objects.update_or_create(key=name, defaults={
            "name": os.path.basename(name), "kind": kind_of(name), "mime": mimetypes.guess_type(name)[0] or "",
            "size": os.path.getsize(self.path(name)), "storage": "local",
        })
        return name

    def exists(self, name):
        return super().exists(name) or self._item(name) is not None

    def url(self, name):
        item = self._item(name)
        if item and item.storage == "s3":
            from . import s3

            return s3.public_url(item.key)
        return super().url(name)

    def delete(self, name):
        item = self._item(name)
        if item and item.storage == "s3":
            from . import s3

            try:
                s3.delete(item)
            except Exception:
                pass
        else:
            super().delete(name)
        if item:
            item.delete()

    def open(self, name, mode="rb"):
        item = self._item(name)
        if item and item.storage == "s3":
            from . import s3

            cfg = s3.config()
            body = s3.client(cfg).get_object(Bucket=cfg["bucket"], Key=s3.object_key(cfg, name))["Body"].read()
            return ContentFile(body, name=name)
        return super().open(name, mode)

    def size(self, name):
        item = self._item(name)
        return item.size if item and item.storage == "s3" else super().size(name)
