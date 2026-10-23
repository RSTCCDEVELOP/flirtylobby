# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
        from . import areas, filecrypt
        from .models import MediaItem

        name = super()._save(name, content)
        cfg = areas.config()
        area = areas.area_of(name, cfg)
        item, _ = MediaItem.objects.update_or_create(key=name, defaults={
            "name": os.path.basename(name), "kind": kind_of(name), "mime": mimetypes.guess_type(name)[0] or "",
            "size": os.path.getsize(self.path(name)), "storage": "local", "owner_id": areas.owner_of(name, cfg), "encrypted": False, "enc_scope": "",
        })
        if cfg[area]["encrypt"]:  # the file's own key: one per user for members' files
            scope = areas.scope_of(name, cfg=cfg)
            filecrypt.encrypt_file(self.path(name), scope)
            item.encrypted, item.enc_scope, item.size = True, scope, os.path.getsize(self.path(name))
            item.save(update_fields=["encrypted", "enc_scope", "size"])
        if cfg[area]["storage"] == "s3":
            from . import s3, service

            if s3.available():
                try:
                    service.move(item, "s3")
                except Exception:  # noqa: BLE001  the file stays local; the admin sees it in the library
                    pass
        return name

    def exists(self, name):
        return super().exists(name) or self._item(name) is not None

    def url(self, name):
        item = self._item(name)
        if item and item.encrypted:
            from . import filecrypt

            return filecrypt.signed_url(name)
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
        if item and item.encrypted:  # decrypted in memory, for whoever may see this file
            from io import BytesIO

            from . import filecrypt

            if item.storage == "s3":
                from . import s3

                cfg = s3.config()
                raw = BytesIO(s3.client(cfg).get_object(Bucket=cfg["bucket"], Key=s3.object_key(cfg, name))["Body"].read())
            else:
                raw = open(self.path(name), "rb")
            try:
                return ContentFile(filecrypt.decrypt_bytes(raw, item.enc_scope), name=name)
            finally:
                raw.close()
        if item and item.storage == "s3":
            from . import s3

            cfg = s3.config()
            body = s3.client(cfg).get_object(Bucket=cfg["bucket"], Key=s3.object_key(cfg, name))["Body"].read()
            return ContentFile(body, name=name)
        return super().open(name, mode)

    def size(self, name):
        item = self._item(name)
        return item.size if item and item.storage == "s3" else super().size(name)
