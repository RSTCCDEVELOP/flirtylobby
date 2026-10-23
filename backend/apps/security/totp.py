# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Authenticator-app codes (TOTP, RFC 6238): 6 digits, 30 seconds, SHA-1 — works with Google/Microsoft Authenticator, Authy, 1Password, Bitwarden…"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from apps.integrations import crypto

STEP, DIGITS, WINDOW = 30, 6, 1  # accept the previous/next 30 s to allow for clock drift


def new_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")  # 32 characters, no padding


def _code(secret, counter):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = digest[-1] & 0x0F
    return f"{(struct.unpack('>I', digest[o:o + 4])[0] & 0x7FFFFFFF) % 10 ** DIGITS:0{DIGITS}d}"


def uri(secret, account, issuer):
    return f"otpauth://totp/{quote(issuer)}:{quote(account)}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits={DIGITS}&period={STEP}"


def verify(secret, code, last_step=0, now=None):
    """The matching time step (int) or None. A step that was already used is refused (no replay)."""
    code = "".join(ch for ch in str(code) if ch.isdigit())
    if len(code) != DIGITS or not secret:
        return None
    t = int((now if now is not None else time.time()) // STEP)
    for step in range(t - WINDOW, t + WINDOW + 1):
        if step > last_step and hmac.compare_digest(_code(secret, step), code):
            return step
    return None


def seal(secret):
    return crypto.encrypt({"s": secret}) if secret else ""


def unseal(token):
    return crypto.decrypt(token).get("s", "")
