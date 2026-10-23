# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Inloggen met Google, Apple of een passkey (WebAuthn).

Google en Apple: de browser krijgt van hen een identiteitstoken; de server controleert het (handtekening, doelgroep, geldigheid) en zoekt of maakt de gebruiker bij het e-mailadres.
Passkey: een sleutelpaar op het apparaat; de server bewaart alleen de publieke sleutel en controleert de handtekening over een eenmalige uitdaging. Alles zonder extra pakketten
(alleen `cryptography`). De sleutels van Google en Apple komen bij Admin -> API keys (Inloggen met Google / Apple); een passkey kan elke gebruiker zelf toevoegen in het profiel."""
import base64
import hashlib
import json
import logging
import re
import secrets
import time
import urllib.parse
import urllib.request

from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.core import modules
from apps.security import service as security

from .models import PasskeyCredential, SocialIdentity, User

logger = logging.getLogger(__name__)


class SsoThrottle(AnonRateThrottle):
    """The login routes of Google, Apple and passkeys: a limit per address (they call outside services and check signatures)."""
    rate = "30/min"
    scope = "sso"
SALT = "passkey"
STATE_MAX_AGE = 300


def b64e(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def b64d(text):
    text = str(text or "")
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _bad(msg, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": msg}, status=code)


# ── CBOR (the small part WebAuthn needs) and the keys of a device (COSE) ─────────────────────────────────────────────
def cbor_decode(data, i=0):
    """(value, next position). Integers, bytes, text, arrays, maps, booleans and null: enough for WebAuthn."""
    ib = data[i]
    major, info = ib >> 5, ib & 31
    i += 1
    if info < 24:
        val = info
    elif info == 24:
        val, i = data[i], i + 1
    elif info == 25:
        val, i = int.from_bytes(data[i:i + 2], "big"), i + 2
    elif info == 26:
        val, i = int.from_bytes(data[i:i + 4], "big"), i + 4
    elif info == 27:
        val, i = int.from_bytes(data[i:i + 8], "big"), i + 8
    else:
        raise ValueError("CBOR: not supported")
    if major == 0:
        return val, i
    if major == 1:
        return -1 - val, i
    if major == 2:
        return bytes(data[i:i + val]), i + val
    if major == 3:
        return bytes(data[i:i + val]).decode(), i + val
    if major == 4:
        out = []
        for _ in range(val):
            x, i = cbor_decode(data, i)
            out.append(x)
        return out, i
    if major == 5:
        out = {}
        for _ in range(val):
            k, i = cbor_decode(data, i)
            v, i = cbor_decode(data, i)
            out[k] = v
        return out, i
    if major == 6:  # a tag: the value after it
        return cbor_decode(data, i)
    if major == 7:
        return {20: False, 21: True, 22: None}.get(val), i
    raise ValueError("CBOR: not supported")


def verify_signature(cose, message, signature):
    """Raises when the signature over message does not match the public key (COSE: ES256, RS256 or EdDSA)."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, ed25519, padding, rsa

    key, _ = cbor_decode(bytes(cose))
    kty, alg = key.get(1), key.get(3)
    if kty == 2 and alg in (-7, None):
        pub = ec.EllipticCurvePublicNumbers(int.from_bytes(key[-2], "big"), int.from_bytes(key[-3], "big"), ec.SECP256R1()).public_key()
        pub.verify(signature, message, ec.ECDSA(hashes.SHA256()))
    elif kty == 3 and alg in (-257, None):
        pub = rsa.RSAPublicNumbers(int.from_bytes(key[-2], "big"), int.from_bytes(key[-1], "big")).public_key()
        pub.verify(signature, message, padding.PKCS1v15(), hashes.SHA256())
    elif kty == 1 and alg in (-8, None):
        ed25519.Ed25519PublicKey.from_public_bytes(key[-2]).verify(signature, message)
    else:
        raise ValueError("This kind of key is not supported.")


# ── what the browser needs ─────────────────────────────────────────────────────────────────────────────────────────
def _integration(provider):
    from apps.integrations.models import Integration

    if not modules.enabled("integrations"):
        return None
    row = Integration.objects.filter(provider=provider, enabled=True).first()
    cfg = row.config if row else None
    return cfg if cfg and cfg.get("client_id") else None


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def config(request):
    """Which ways of logging in are there next to the password (for the login page)."""
    cfg = security.get()
    g, a = (_integration("google_login") if cfg["social"]["google"] else None), (_integration("apple_login") if cfg["social"]["apple"] else None)
    return Response({"google": {"client_id": g["client_id"]} if g else None, "apple": {"client_id": a["client_id"]} if a else None, "passkey": bool(cfg["passkeys"]["enabled"] and cfg["passkeys"]["login"])})


def _origin(request):
    """The address of the website that asks (checked against the allowed addresses); the passkey belongs to its host name."""
    origin = request.META.get("HTTP_ORIGIN", "")
    from apps.core import system

    allowed = list(getattr(settings, "CORS_ALLOWED_ORIGINS", [])) + [system.get().get("frontend_url", "")]
    if origin and (origin in allowed or any(re.match(rx, origin) for rx in getattr(settings, "CORS_ALLOWED_ORIGIN_REGEXES", []))):
        return origin
    return None


def _host(origin):
    return urllib.parse.urlparse(origin).hostname or ""


def _ip_problem(origin):
    """A passkey belongs to a domain name; browsers refuse an IP address. A readable answer instead of the browser's error."""
    host = _host(origin)
    if re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host) or ":" in host:
        return _bad("Een passkey werkt niet op een IP-adres. Open de website via een domeinnaam, of op deze computer via https://localhost.")
    return None


def _finish(request, user):
    from .views import _finish_login

    if not user.is_active:
        return _bad("Dit account is geblokkeerd.", status.HTTP_403_FORBIDDEN)
    return _finish_login(request, user)


# ── Google and Apple ──────────────────────────────────────────────────────────────────────────────────────────────
def _user_for(provider, subject, email, name):
    """(user, error response): the user of this identity; else the user with this (verified) e-mail address; else a new one (when signing up is allowed)."""
    ident = SocialIdentity.objects.filter(provider=provider, subject=subject).select_related("user").first()
    if ident:
        return ident.user, None
    email = (email or "").strip().lower()
    if not email:
        return None, _bad("Er is geen e-mailadres gedeeld. Deel je e-mailadres om in te loggen.")
    user = User.objects.filter(email__iexact=email).first()
    if user and (user.is_staff or user.is_superuser or user.otp_active):  # an administrator or an account with 2-step verification is never taken over by e-mail address alone: log in with the password first (then link in the profile)
        return None, _bad("Dit account is beveiligd. Log in met je wachtwoord.", status.HTTP_403_FORBIDDEN)
    if not user:
        if not security.get()["registration"]["enabled"]:
            return None, _bad("Er bestaat geen account met dit e-mailadres en aanmelden staat uit.", status.HTTP_403_FORBIDDEN)
        user = User(email=email, username=email, first_name=(name or "")[:150], display_name=(name or "")[:60], is_active=True, email_verified=True)
        user.set_unusable_password()
        user.save()
    SocialIdentity.objects.create(user=user, provider=provider, subject=subject, email=email)
    return user, None


def _http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "portal-login"})
    with urllib.request.urlopen(req, timeout=8) as res:  # noqa: S310 - fixed https addresses of Google and Apple
        return json.loads(res.read().decode())


def verify_google(id_token, client_id):
    """The claims of a Google identity token (checked by Google itself), or raises ValueError."""
    claims = _http_json("https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(id_token))
    if claims.get("aud") != client_id or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com") or int(claims.get("exp", 0)) < time.time():
        raise ValueError("Het token van Google is niet geldig voor deze website.")
    if str(claims.get("email_verified")).lower() != "true":
        raise ValueError("Het e-mailadres bij Google is niet bevestigd.")
    return claims


_apple_keys = {"t": 0, "keys": []}


def verify_apple(id_token, client_id, keys=None):
    """The claims of an Apple identity token (signature checked with Apple's public keys), or raises ValueError."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding, rsa

    head_b, body_b, sig_b = id_token.split(".")
    head, claims = json.loads(b64d(head_b)), json.loads(b64d(body_b))
    if head.get("alg") != "RS256":
        raise ValueError("Onbekende handtekening.")
    if keys is None:
        if time.time() - _apple_keys["t"] > 3600 or not any(k.get("kid") == head.get("kid") for k in _apple_keys["keys"]):
            _apple_keys.update(t=time.time(), keys=_http_json("https://appleid.apple.com/auth/keys")["keys"])
        keys = _apple_keys["keys"]
    jwk = next((k for k in keys if k.get("kid") == head.get("kid")), None)
    if not jwk:
        raise ValueError("Onbekende sleutel van Apple.")
    pub = rsa.RSAPublicNumbers(int.from_bytes(b64d(jwk["e"]), "big"), int.from_bytes(b64d(jwk["n"]), "big")).public_key()
    pub.verify(b64d(sig_b), f"{head_b}.{body_b}".encode(), padding.PKCS1v15(), hashes.SHA256())
    if claims.get("iss") != "https://appleid.apple.com" or claims.get("aud") != client_id or int(claims.get("exp", 0)) < time.time():
        raise ValueError("Het token van Apple is niet geldig voor deze website.")
    return claims


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([SsoThrottle])
def google_login(request):
    cfg = _integration("google_login") if security.get()["social"]["google"] else None
    if not cfg:
        return _bad("Inloggen met Google staat niet aan.", status.HTTP_404_NOT_FOUND)
    try:
        claims = verify_google(str(request.data.get("credential") or ""), cfg["client_id"])
    except Exception as e:  # noqa: BLE001
        logger.warning("Google login refused: %s", e)
        return _bad(str(e) if isinstance(e, ValueError) else "Inloggen met Google is mislukt.")
    user, err = _user_for("google", claims["sub"], claims.get("email"), claims.get("name"))
    return err or _finish(request, user)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([SsoThrottle])
def apple_login(request):
    cfg = _integration("apple_login") if security.get()["social"]["apple"] else None
    if not cfg:
        return _bad("Inloggen met Apple staat niet aan.", status.HTTP_404_NOT_FOUND)
    try:
        claims = verify_apple(str(request.data.get("id_token") or ""), cfg["client_id"])
    except Exception as e:  # noqa: BLE001
        logger.warning("Apple login refused: %s", e)
        return _bad(str(e) if isinstance(e, ValueError) else "Inloggen met Apple is mislukt.")
    verified = str(claims.get("email_verified", "true")).lower() == "true"
    user, err = _user_for("apple", claims["sub"], claims.get("email") if verified else "", str(request.data.get("name") or "")[:100])
    return err or _finish(request, user)


# ── passkeys ──────────────────────────────────────────────────────────────────────────────────────────────────────
def _state(kind, challenge, origin, user_id=None):
    return signing.dumps({"k": kind, "c": challenge, "o": origin, "u": user_id}, salt=SALT)


def _open_state(request, kind):
    try:
        st = signing.loads(str(request.data.get("state") or ""), salt=SALT, max_age=STATE_MAX_AGE)
    except signing.BadSignature:
        raise ValueError("De sessie is verlopen. Probeer het opnieuw.")
    if st.get("k") != kind or st.get("o") != _origin(request):
        raise ValueError("Onbekende aanvraag.")
    return st


def _client_data(resp, st, typ):
    raw = b64d(resp.get("clientDataJSON"))
    cd = json.loads(raw)
    if cd.get("type") != typ or cd.get("challenge") != st["c"] or cd.get("origin") != st["o"]:
        raise ValueError("De controle van de passkey klopt niet.")
    return raw


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([SsoThrottle])
def passkey_login_options(request):
    pk = security.get()["passkeys"]
    if not (pk["enabled"] and pk["login"]):
        return _bad("Inloggen met een passkey staat uit.", status.HTTP_403_FORBIDDEN)
    origin = _origin(request)
    if not origin:
        return _bad("Dit adres is niet toegestaan voor passkeys.", status.HTTP_403_FORBIDDEN)
    if (problem := _ip_problem(origin)):
        return problem
    challenge = b64e(secrets.token_bytes(32))
    return Response({"state": _state("get", challenge, origin), "options": {"challenge": challenge, "rpId": _host(origin), "timeout": 60000, "userVerification": security.get()["passkeys"]["verification"], "allowCredentials": []}})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([SsoThrottle])
def passkey_login(request):
    pk = security.get()["passkeys"]
    if not (pk["enabled"] and pk["login"]):
        return _bad("Inloggen met een passkey staat uit.", status.HTTP_403_FORBIDDEN)
    try:
        st = _open_state(request, "get")
        resp = request.data.get("response") or {}
        cred = PasskeyCredential.objects.filter(credential_id=str(request.data.get("id") or "")).select_related("user").first()
        if not cred:
            raise ValueError("Deze passkey is niet bekend. Log in met je wachtwoord en voeg hem toe in je profiel.")
        client = _client_data(resp, st, "webauthn.get")
        auth = b64d(resp.get("authenticatorData"))
        if auth[:32] != hashlib.sha256(_host(st["o"]).encode()).digest() or not auth[32] & 1:
            raise ValueError("De controle van de passkey klopt niet.")
        if pk["verification"] == "required" and not auth[32] & 4:
            raise ValueError("Je apparaat moet je identiteit controleren (pincode, vingerafdruk of gezicht).")
        counter = int.from_bytes(auth[33:37], "big")
        verify_signature(cred.public_key, auth + hashlib.sha256(client).digest(), b64d(resp.get("signature")))
        if (counter or cred.sign_count) and counter <= cred.sign_count:
            raise ValueError("Deze passkey lijkt gekopieerd te zijn en is geweigerd.")
    except Exception as e:  # noqa: BLE001
        logger.warning("Passkey login refused: %s", e)
        return _bad(str(e) if isinstance(e, ValueError) else "Inloggen met de passkey is mislukt.")
    PasskeyCredential.objects.filter(pk=cred.pk).update(sign_count=counter, last_used_at=timezone.now())
    return _finish(request, cred.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def passkey_register_options(request):
    pk = security.get()["passkeys"]
    if not (pk["enabled"] and pk["add"]):
        return _bad("Passkeys toevoegen staat uit.", status.HTTP_403_FORBIDDEN)
    if request.user.passkeys.count() >= pk["max_per_user"]:
        return _bad(f"Je kunt maximaal {pk['max_per_user']} passkeys hebben. Verwijder er eerst een.")
    origin = _origin(request)
    if not origin:
        return _bad("Dit adres is niet toegestaan voor passkeys.", status.HTTP_403_FORBIDDEN)
    if (problem := _ip_problem(origin)):
        return problem
    u, challenge = request.user, b64e(secrets.token_bytes(32))
    return Response({"state": _state("create", challenge, origin, u.pk), "options": {
        "challenge": challenge, "rp": {"name": settings.SITE_NAME if hasattr(settings, "SITE_NAME") else "Easy2edit", "id": _host(origin)},
        "user": {"id": b64e(f"user:{u.pk}".encode()), "name": u.email, "displayName": (u.display_name or u.get_full_name() or u.email)[:60]},
        "pubKeyCredParams": [{"type": "public-key", "alg": -7}, {"type": "public-key", "alg": -257}], "timeout": 60000, "attestation": "none",
        "authenticatorSelection": {"residentKey": "preferred", "userVerification": pk["verification"]},
        "excludeCredentials": [{"type": "public-key", "id": c.credential_id} for c in u.passkeys.all()]}})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def passkey_register(request):
    pk = security.get()["passkeys"]
    if not (pk["enabled"] and pk["add"]):
        return _bad("Passkeys toevoegen staat uit.", status.HTTP_403_FORBIDDEN)
    try:
        st = _open_state(request, "create")
        if st.get("u") != request.user.pk:
            raise ValueError("Onbekende aanvraag.")
        resp = request.data.get("response") or {}
        _client_data(resp, st, "webauthn.create")
        att, _ = cbor_decode(b64d(resp.get("attestationObject")))
        auth = att["authData"]
        if auth[:32] != hashlib.sha256(_host(st["o"]).encode()).digest() or not auth[32] & 0x40:
            raise ValueError("De controle van de passkey klopt niet.")
        if pk["verification"] == "required" and not auth[32] & 4:
            raise ValueError("Je apparaat moet je identiteit controleren (pincode, vingerafdruk of gezicht).")
        cid_len = int.from_bytes(auth[53:55], "big")
        cid = auth[55:55 + cid_len]
        _key, end = cbor_decode(auth, 55 + cid_len)
        cose = auth[55 + cid_len:end]
        if b64e(cid) != str(request.data.get("id") or ""):
            raise ValueError("De controle van de passkey klopt niet.")
        cbor_decode(cose)  # the key must be readable
    except Exception as e:  # noqa: BLE001
        logger.warning("Passkey registration refused: %s", e)
        return _bad(str(e) if isinstance(e, ValueError) else "De passkey kon niet worden toegevoegd.")
    if PasskeyCredential.objects.filter(credential_id=b64e(cid)).exists():
        return _bad("Deze passkey is al toegevoegd.")
    row = PasskeyCredential.objects.create(user=request.user, credential_id=b64e(cid), public_key=cose, name=str(request.data.get("name") or "")[:80] or "Passkey", transports=list(request.data.get("transports") or [])[:6])
    return Response({"id": row.pk, "name": row.name}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def passkeys(request):
    return Response([{"id": c.pk, "name": c.name, "created_at": c.created_at, "last_used_at": c.last_used_at} for c in request.user.passkeys.all()])


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def passkey_remove(request, pk):
    n, _ = PasskeyCredential.objects.filter(pk=pk, user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT if n else status.HTTP_404_NOT_FOUND)
