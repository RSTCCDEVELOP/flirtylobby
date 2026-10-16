"""
File encryption: AES-256-GCM in chunks, one random data key per scope (a user, or a whole area).

  master key  FILE_ENCRYPTION_KEY (environment, 32 bytes base64) — falls back to a key derived from SECRET_KEY
      └─ wraps ─> data key of one scope (stored in FileKey, never in plain text)
                    └─ encrypts ─> every file of that scope (chunks of 1 MB, each with its own nonce and the scope + chunk number as
                                    authenticated data, so chunks cannot be swapped or moved to another owner)

Erasing a user deletes his files and his key: what might be left (backups, S3 versions) can no longer be read.
"""
import base64
import hashlib
import os
from io import BytesIO

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings

MAGIC = b"FLE1"
CHUNK = 1 << 20


def master_source():
    return "environment" if os.environ.get("FILE_ENCRYPTION_KEY") else "derived"


def _master():
    raw = os.environ.get("FILE_ENCRYPTION_KEY", "")
    if raw:
        try:
            k = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
            if len(k) == 32:
                return k
        except Exception:  # noqa: BLE001
            pass
        return hashlib.sha256(raw.encode()).digest()
    return hashlib.sha256(b"flirtylobby-file-key:" + settings.SECRET_KEY.encode()).digest()


def _wrap():
    return Fernet(base64.urlsafe_b64encode(_master()))


def key_for(scope, create=True):
    from .models import FileKey

    row = FileKey.objects.filter(scope=scope).first()
    if row:
        return _wrap().decrypt(row.wrapped.encode())
    if not create:
        return None
    raw = os.urandom(32)
    FileKey.objects.create(scope=scope, wrapped=_wrap().encrypt(raw).decode())
    return raw


def drop_key(scope):
    from .models import FileKey

    FileKey.objects.filter(scope=scope).delete()


def encrypt_file(path, scope):
    """Encrypt the file at `path` in place."""
    aes, tmp = AESGCM(key_for(scope)), path + ".enc"
    with open(path, "rb") as src, open(tmp, "wb") as out:
        out.write(MAGIC)
        i = 0
        while True:
            chunk = src.read(CHUNK)
            if not chunk and i:
                break
            nonce = os.urandom(12)
            ct = aes.encrypt(nonce, chunk, f"{scope}:{i}".encode())
            out.write(len(ct).to_bytes(4, "big") + nonce + ct)
            i += 1
            if not chunk:
                break
    os.replace(tmp, path)


def decrypt_iter(fh, scope):
    """Yield the plain chunks of an encrypted file object."""
    if fh.read(4) != MAGIC:
        raise ValueError("Geen versleuteld bestand.")
    key = key_for(scope, create=False)
    if not key:
        raise ValueError("De sleutel van dit bestand bestaat niet meer.")
    aes, i = AESGCM(key), 0
    while True:
        head = fh.read(4)
        if not head:
            return
        n = int.from_bytes(head, "big")
        nonce, ct = fh.read(12), fh.read(n)
        yield aes.decrypt(nonce, ct, f"{scope}:{i}".encode())
        i += 1


def decrypt_bytes(fh, scope):
    return b"".join(decrypt_iter(fh, scope))


def decrypt_file(path, scope):
    """Decrypt the file at `path` in place."""
    tmp = path + ".dec"
    with open(path, "rb") as src, open(tmp, "wb") as out:
        for part in decrypt_iter(src, scope):
            out.write(part)
    os.replace(tmp, path)


def looks_encrypted(path):
    try:
        with open(path, "rb") as fh:
            return fh.read(4) == MAGIC
    except OSError:
        return False


def signed_url(key):
    """Short-lived link to the decrypting download view (images/videos in the page cannot send a login)."""
    from django.core import signing

    return f"/api/files/{signing.dumps(key, salt='file')}/"
