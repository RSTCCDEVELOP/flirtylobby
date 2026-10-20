import base64
import hashlib
import json

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def encrypt(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt(token: str) -> dict:
    if not token:
        return {}
    try:
        return json.loads(_fernet().decrypt(token.encode()))
    except Exception:  # SECRET_KEY changed or corrupt data
        return {}
