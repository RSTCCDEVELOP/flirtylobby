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
    return Path(os.getenv("PLUGIN_SIGNING_KEY") or Path.home() / ".flirtylobby" / "plugin-signing.pem")


def files(root):
    root = Path(root)
    out = []
    for f in sorted(root.rglob("*")):
        rel = f.relative_to(root)
        if f.is_file() and f.name != SIG_FILE and not (set(rel.parts) & SKIP_DIRS) and not f.name.endswith((".pyc", ".DS_Store")):
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
