"""Move all API links (with their keys) to another installation, e.g. from the test machine to the live site.
The file holds secrets, so it is always locked with a password (PBKDF2 + Fernet): without the password it is unreadable."""
import base64
import hashlib
import json
import os

from cryptography.fernet import Fernet, InvalidToken

FORMAT = "flirtylobby-api-keys"
ROUNDS = 390_000


def _fernet(password, salt):
    return Fernet(base64.urlsafe_b64encode(hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ROUNDS)))


def pack(rows, password):
    salt = os.urandom(16)
    return {"format": FORMAT, "v": 1, "salt": base64.b64encode(salt).decode(), "data": _fernet(password, salt).encrypt(json.dumps(rows).encode()).decode()}


def unpack(bundle, password):
    if not isinstance(bundle, dict) or bundle.get("format") != FORMAT:
        raise ValueError("Dit is geen exportbestand van API-koppelingen.")
    try:
        return json.loads(_fernet(password, base64.b64decode(bundle["salt"])).decrypt(bundle["data"].encode()))
    except (InvalidToken, KeyError, ValueError):
        raise ValueError("Wachtwoord klopt niet of het bestand is beschadigd.")
