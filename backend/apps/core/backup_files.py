"""Helpers to carry small files (logos, pictures) inside a settings backup as base64."""
import base64
import logging

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)
MAX_FILE = 8 * 1024 * 1024  # one file
MAX_TOTAL = 40 * 1024 * 1024  # everything in one backup


class Budget:
    """Keeps a backup from growing without limit: files over the limits are left out and listed."""

    def __init__(self):
        self.total, self.skipped = 0, []

    def take(self, name, size):
        if size > MAX_FILE or self.total + size > MAX_TOTAL:
            self.skipped.append(name)
            return False
        self.total += size
        return True


def read(key, budget):
    """{"name", "b64"} for a stored file, or None (missing / too big)."""
    try:
        with default_storage.open(key, "rb") as fh:
            raw = fh.read(MAX_FILE + 1)
    except Exception:  # noqa: BLE001
        return None
    return {"b64": base64.b64encode(raw).decode()} if budget.take(key, len(raw)) else None


def write(key, b64):
    """Store the file under `key` unless a file with that name already exists. Returns the stored name."""
    if default_storage.exists(key):
        return key
    return default_storage.save(key, ContentFile(base64.b64decode(b64)))
