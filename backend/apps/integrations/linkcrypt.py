# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The keys of the default API links (the superadmin+ links) travel ENCRYPTED from the easy2edit server to a website, and are decrypted again at the installation.

The transport key is made per website from the hash of its registration key (the server keeps that hash, the website can make it from its key), so the encrypted keys of one website
are of no use to another. The server seals the secret fields of a link (`seal`), the website opens them (`unseal`) when it makes or updates the link. Nothing but the sealed block
holds a secret in the answer of the server."""
import base64
import hashlib
import json

from cryptography.fernet import Fernet


def _fernet(token_hash):
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("easy2edit-default-links:" + str(token_hash)).encode()).digest()))


def hash_of(token):
    """What the server keeps of the registration key of a website (the same as sitemanager._hash)."""
    return hashlib.sha256(str(token or "").encode()).hexdigest()


def seal(secrets, token_hash):
    """{field: value} -> an encrypted text; "" when there is nothing to seal or no hash."""
    if not secrets or not token_hash:
        return ""
    return _fernet(token_hash).encrypt(json.dumps(secrets, sort_keys=True).encode()).decode()


def unseal(blob, token_hash):
    """The encrypted text -> {field: value}; {} when it does not open (another website, damaged)."""
    if not blob or not token_hash:
        return {}
    try:
        data = json.loads(_fernet(token_hash).decrypt(str(blob).encode()))
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def revision(secrets):
    """A short fingerprint of the keys (to see that they changed, without showing them)."""
    return hashlib.sha256(json.dumps(secrets or {}, sort_keys=True).encode()).hexdigest()[:12]
