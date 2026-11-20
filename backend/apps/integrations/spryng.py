# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Spryng (SMS, https://www.spryng.nl): the link that sends text messages, through the Spryng REST API v2 (https://developer.spryng.nl).
Settings of the link: API key, account reference (the customer number of the Spryng account), sender (from), and the use:
- "verification": the link may only be used for verification codes (two-step login, sign-up, consent, forgot password);
- "messages": the link may also be used for other text messages (notifications, reminders).
Every call goes to https://api.spryng.nl with the headers X-API-Key and accountReference; POST /v2/messages sends, GET /v2/balance tells the balance."""
import json
import re
import urllib.error
import urllib.request

BASE = "https://api.spryng.nl/v2"
TIMEOUT = 10
USAGE = ("verification", "messages")


class SpryngError(Exception):
    pass


def usage(c):
    """What the link may be used for: 'verification' (default, the safe choice) or 'messages' (verification and other messages)."""
    return "messages" if (c or {}).get("usage") == "messages" else "verification"


def allows(c, purpose):
    """purpose: 'verification' (always allowed) or 'message' (only when the link is set to messages)."""
    return purpose == "verification" or usage(c) == "messages"


def number(phone):
    """International number with a + (+31612345678). Raises SpryngError when it is not a usable number."""
    n = re.sub(r"\D", "", str(phone or ""))
    if n.startswith("00"):
        n = n[2:]
    if len(n) < 8 or len(n) > 15:
        raise SpryngError("Het telefoonnummer is niet geldig (internationaal formaat, bijvoorbeeld +31612345678).")
    return "+" + n


def sender(c):
    """The sender (from): alphanumeric, at most 11 characters; empty = the sender that is set in the Spryng account."""
    return re.sub(r"[^A-Za-z0-9]", "", str((c or {}).get("originator") or ""))[:11]


def _call(c, method, path, payload=None):
    key = str((c or {}).get("api_key") or "").strip()
    ref = str((c or {}).get("account_reference") or "").strip()
    if not key:
        raise SpryngError("Spryng: de API-sleutel ontbreekt.")
    if not ref:
        raise SpryngError("Spryng: het account-nummer (accountReference) ontbreekt. Je vindt het in Spryng bij Mijn account.")
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"X-API-Key": key, "accountReference": ref, "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "easy2edit"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            raw = res.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = (json.loads(e.read()).get("errors") or [{}])[0].get("errorMessage", "")
        except Exception:  # noqa: BLE001
            pass
        if e.code == 401:
            raise SpryngError("Spryng: toegang geweigerd, controleer de API-sleutel.")
        if e.code == 404 and "Account not found" in detail:
            raise SpryngError("Spryng: het account-nummer (accountReference) bestaat niet, controleer het.")
        if e.code == 403:
            raise SpryngError("Spryng: de sleutel heeft niet genoeg rechten (de gebruiker moet Developer- en Admin-rechten hebben).")
        if e.code == 429:
            raise SpryngError("Spryng: te veel aanvragen, probeer het zo opnieuw.")
        if "nverified" in detail or "registered msisdn" in detail:
            raise SpryngError("Spryng: dit account is nog niet geverifieerd (proefaccount). Een proefaccount kan alleen sms'en naar nummers die je in Spryng hebt geregistreerd. Registreer dit nummer in je Spryng-portaal, of laat je account verifiëren.")
        if e.code == 400:
            raise SpryngError("Spryng: het bericht of het nummer is afgewezen" + (f" ({detail[:120]})." if detail else "."))
        raise SpryngError(f"Spryng: verzenden mislukt (HTTP {e.code}).")
    except Exception as e:  # noqa: BLE001
        raise SpryngError(f"Spryng: geen verbinding: {e}")


def send(c, phone, text, purpose="verification"):
    """Send one text message. purpose: 'verification' (a code) or 'message'. Raises SpryngError."""
    body = {"accountReference": str((c or {}).get("account_reference") or "").strip(), "channel": "SMS", "body": {"text": str(text)[:1000]},
            "recipients": [{"msisdn": number(phone)}], "characterSet": "Auto",
            "messageType": "AuthenticationAndSecurity" if purpose == "verification" else "NotificationsAndReminders"}
    if sender(c):
        body["from"] = sender(c)
    _call(c, "POST", "/messages", body)


def test(c):
    """(ok, message) for the Test button: the balance can be read with this key and account reference."""
    if not str((c or {}).get("api_key") or "").strip():
        return False, "API-sleutel ontbreekt."
    if not str((c or {}).get("account_reference") or "").strip():
        return False, "Account-nummer (accountReference) ontbreekt: je vindt het in Spryng bij Mijn account."
    try:
        d = _call(c, "GET", "/balance")
    except SpryngError as e:
        return False, str(e)
    bal = (d.get("available") if isinstance(d, dict) else None) or ((d.get("data") or {}).get("available") if isinstance(d, dict) else None)
    what = "alleen verificatiecodes" if usage(c) == "verification" else "verificatie en berichten"
    return True, f"Verbinding gelukt{f' (tegoed {bal})' if bal not in (None, '') else ''}. Gebruik: {what}."
