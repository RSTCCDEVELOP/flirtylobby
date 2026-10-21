"""Only plugins made by our developer run here. The developer tool (manage.py plugin_build) signs a plugin with the private key
(kept outside the repository); the system only holds the public key (developer_public.pem) and checks every file against the signature."""
import base64
import hashlib
import os
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from django.conf import settings

SIG_FILE = "plugin.sig"
PUBLIC_KEY = Path(__file__).resolve().parent / "developer_public.pem"
SKIP_DIRS = {"__pycache__", ".git", "node_modules", "dist"}


def private_key_path():
    if os.getenv("PLUGIN_SIGNING_KEY"):
        return Path(os.environ["PLUGIN_SIGNING_KEY"])
    new, old = Path.home() / ".easy2edit" / "plugin-signing.pem", Path.home() / ".flirtylobby" / "plugin-signing.pem"
    return old if old.is_file() and not new.is_file() else new  # a key that was made before the rename in ~/.flirtylobby/ is still used


def content_dirs(root):
    """Folders of a plugin that hold content added later (the games of the games plugin): named in plugin.json, so they are signed as a promise but their files are not."""
    import json

    try:
        d = json.loads((Path(root) / "plugin.json").read_text())
        return {x for x in (d.get("content_dirs") or []) if isinstance(x, str) and "/" not in x and x not in ("", ".", "..")}
    except (OSError, ValueError, AttributeError):
        return set()


def files(root):
    root = Path(root)
    out = []
    skip = SKIP_DIRS | content_dirs(root)
    for f in sorted(root.rglob("*")):
        rel = f.relative_to(root)
        if f.is_file() and f.name != SIG_FILE and not (set(rel.parts) & SKIP_DIRS) and rel.parts[0] not in skip and not f.name.endswith((".pyc", ".DS_Store")):
            out.append(rel.as_posix())
    return out


def digest(root):
    """One hash over the paths and contents of all files of a plugin (the signature file excluded)."""
    h = hashlib.sha256()
    for rel in files(root):
        h.update(rel.encode() + b"\0" + hashlib.sha256((Path(root) / rel).read_bytes()).digest())
    return h.digest()


def public_key():
    return serialization.load_pem_public_key(PUBLIC_KEY.read_bytes()) if PUBLIC_KEY.is_file() else None


def verify(root):
    """'valid' | 'invalid' | 'missing' for the plugin folder."""
    sig = Path(root) / SIG_FILE
    if not sig.is_file():
        return "missing"
    key = public_key()
    if key is None:
        return "invalid"
    try:
        key.verify(base64.b64decode(sig.read_text().strip()), digest(root))
        return "valid"
    except (InvalidSignature, ValueError):
        return "invalid"


def sign(root):
    """Sign a plugin folder with the developer's private key (only on the developer's machine)."""
    kp = private_key_path()
    if not kp.is_file():
        raise FileNotFoundError(f"De ondertekeningssleutel ontbreekt ({kp}). Maak hem met: python manage.py plugin_keygen")
    key = serialization.load_pem_private_key(kp.read_bytes(), password=None)
    (Path(root) / SIG_FILE).write_text(base64.b64encode(key.sign(digest(root))).decode())


def dev_mode_allowed():
    """An unsigned plugin may run while developing (DEBUG), never on a live system."""
    return bool(settings.DEBUG)
