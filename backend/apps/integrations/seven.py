# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""seven.io (SMS, https://www.seven.io): a second SMS link next to Spryng. Top up the balance and send at once; the sender is free (up to 11 letters/digits or up to 16 digits,
no registration). Settings of the link: API key, sender (from), and the use ("verification": only verification codes; "messages": codes and other messages, same as Spryng).
POST https://gateway.seven.io/api/sms (header X-Api-Key; to, from, text); GET https://gateway.seven.io/api/balance. The answer of a send holds the price and the balance left."""
import json
import re
import urllib.error
import urllib.parse
import urllib.request

from .spryng import allows, usage  # the use of the link is the same setting as at Spryng

BASE = "https://gateway.seven.io/api"
TIMEOUT = 10
__all__ = ["SevenError", "allows", "usage", "number", "sender", "send", "delivery", "test"]


class SevenError(Exception):
    pass


def number(phone):
    """International number without + (31612345678). Raises SevenError when it is not a usable number."""
    raw = str(phone or "").strip()
    n = re.sub(r"\D", "", raw)
    if not (raw.startswith("+") or n.startswith("00")):  # a number without a country code (06 12345678) cannot be sent: it would go nowhere
        raise SevenError("Begin het nummer met + en het landnummer, bijvoorbeeld +31612345678.")
    if n.startswith("00"):
        n = n[2:]
    if len(n) < 8 or len(n) > 15:
        raise SevenError("Het telefoonnummer is niet geldig (internationaal formaat, bijvoorbeeld +31612345678).")
    return n


def sender(c):
    """The sender: up to 11 letters/digits, or up to 16 digits. Empty = the default sender of the seven.io account."""
    raw = re.sub(r"[^A-Za-z0-9]", "", str((c or {}).get("originator") or ""))
    return raw[:16] if raw.isdigit() else raw[:11]


def _call(c, method, path, fields=None):
    key = str((c or {}).get("api_key") or "").strip()
    if not key:
        raise SevenError("seven.io: de API-sleutel ontbreekt.")
    req = urllib.request.Request(BASE + path, method=method, data=urllib.parse.urlencode(fields).encode() if fields is not None else None,
                                 headers={"X-Api-Key": key, "SentWith": "easy2edit", "Accept": "application/json", "User-Agent": "easy2edit"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            raw = res.read().decode("utf-8", "replace").strip()
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise SevenError("seven.io: toegang geweigerd, controleer de API-sleutel.")
        if e.code == 429:
            raise SevenError("seven.io: te veel aanvragen, probeer het zo opnieuw.")
        raise SevenError(f"seven.io: verzenden mislukt (HTTP {e.code}).")
    except Exception as e:  # noqa: BLE001
        raise SevenError(f"seven.io: geen verbinding: {e}")
    try:
        return json.loads(raw) if raw else {}
    except ValueError:
        return raw


def send(c, phone, text, purpose="verification"):
    """Send one text message. Returns {"price", "balance"} when seven.io tells them. Raises SevenError."""
    fields = {"to": number(phone), "text": str(text)[:1000], "json": "1"}
    if sender(c):
        fields["from"] = sender(c)
    d = _call(c, "POST", "/sms", fields)
    if isinstance(d, dict):
        msgs = d.get("messages") or []
        bad = next((m for m in msgs if isinstance(m, dict) and m.get("success") is False), None)
        if bad:
            raise SevenError("seven.io: het bericht is afgewezen" + (f" ({str(bad.get('error_text') or bad.get('error'))[:120]})." if (bad.get("error_text") or bad.get("error")) else "."))
        if str(d.get("success", "100")) not in ("100", "101", "True", "true", "1"):
            raise SevenError(f"seven.io: het bericht is afgewezen (code {d.get('success')}).")
        first = msgs[0] if msgs and isinstance(msgs[0], dict) else {}
        return {"price": d.get("total_price"), "balance": d.get("balance"), "id": first.get("id")}
    return {}


def delivery(c, message_id, wait=6):
    """What happened to a message at the operator: (state, error) with state 'DELIVERED' | 'REJECTED' | 'FAILED' | 'EXPIRED' | 'PENDING' | None (unknown). seven.io accepts a message and only
    then the operator says yes or no, so the answer comes from the log of sent messages (read-only). Waits up to `wait` seconds for a final state."""
    import time

    if not message_id:
        return None, ""
    end = time.time() + wait
    state, err = "PENDING", ""
    while True:
        try:
            d = _call(c, "GET", "/journal/outbound?" + urllib.parse.urlencode({"id": message_id}))
        except SevenError:
            return None, ""
        row = d[0] if isinstance(d, list) and d else (d if isinstance(d, dict) else {})
        state, err = str(row.get("dlr") or "PENDING").upper(), str(row.get("error") or "")
        if state in ("DELIVERED", "REJECTED", "FAILED", "EXPIRED", "NOTDELIVERED", "UNDELIVERED") or time.time() >= end:
            return state, err
        time.sleep(1)


def test(c):
    """(ok, message) for the Test button: the balance can be read with this key."""
    if not str((c or {}).get("api_key") or "").strip():
        return False, "API-sleutel ontbreekt."
    try:
        d = _call(c, "GET", "/balance")
    except SevenError as e:
        return False, str(e)
    bal = d.get("amount") if isinstance(d, dict) else (d if isinstance(d, (int, float, str)) and str(d).strip() else None)
    try:
        if bal not in (None, "") and float(bal) <= 0:
            return False, "Geen tegoed meer: waardeer het account op, anders worden er geen sms-berichten aangeboden."
    except (TypeError, ValueError):
        pass
    what = "alleen verificatiecodes" if usage(c) == "verification" else "verificatie en berichten"
    return True, f"Verbinding gelukt{f' (tegoed {bal})' if bal not in (None, '') else ''}. Gebruik: {what}."
