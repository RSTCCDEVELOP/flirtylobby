# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Google address search (Places API New, Text Search): find a business or an address on a name and a place ("RST Coaching Utrecht") or a name and a postcode ("RST Coaching 3542 DH").
The link is made in Admin -> API keys (provider "google_adres": the key of a Google Cloud project with Places API (New) switched on, and optionally a country).
The search asks only for the name and the address (cheap fields); the phone number and the website (a more expensive group) are only fetched for a place that was chosen: `place(id)`.
`search(q)` -> [{id, naam, adres, street, house_number, postal_code, city, country}], `place(id)` -> {phone, website}. Both raise ValueError with a readable message."""
import json
import re
import urllib.error
import urllib.request

TIMEOUT = 10
BASE = "https://places.googleapis.com/v1"
SEARCH_MASK = "places.id,places.displayName,places.formattedAddress,places.addressComponents"  # name and address only
DETAIL_MASK = "id,nationalPhoneNumber,internationalPhoneNumber,websiteUri"  # only for a chosen place


def settings():
    """{api_key, region, language} of the link that is switched on, or None."""
    from .models import Integration

    obj = Integration.objects.filter(provider="google_adres", enabled=True).order_by("id").first()
    if not obj:
        return None
    c = obj.config or {}
    key = (c.get("api_key") or "").strip()
    if not key:
        return None
    region = re.sub(r"[^A-Za-z]", "", str(c.get("region") or ""))[:2].upper()
    return {"api_key": key, "region": region, "language": re.sub(r"[^A-Za-z-]", "", str(c.get("language") or "nl"))[:10] or "nl"}


def _call(method, path, mask, body=None, cfg=None):
    cfg = cfg or settings()
    if not cfg:
        raise ValueError("De koppeling met Google adressen is niet ingesteld (Admin → API keys).")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method, headers={"X-Goog-Api-Key": cfg["api_key"], "X-Goog-FieldMask": mask, "Content-Type": "application/json", "User-Agent": "easy2edit"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return json.loads(res.read(2_000_000).decode("utf-8", "ignore") or "{}")
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read(20_000).decode("utf-8", "ignore")).get("error") or {}
        except Exception:  # noqa: BLE001
            err = {}
        msg = str(err.get("message") or "")[:200]
        if e.code == 429:
            raise ValueError("Google krijgt te veel aanvragen. Probeer het zo opnieuw.") from e
        if e.code in (401, 403) or "API key" in msg or "API_KEY" in json.dumps(err):
            raise ValueError("Google weigert de sleutel: controleer de API-sleutel en of 'Places API (New)' in je Google Cloud-project aanstaat." + (f" ({msg})" if msg else "")) from e
        if e.code == 404:
            raise LookupError("Niet gevonden bij Google.") from e
        raise ValueError(f"Google geeft een foutmelding (HTTP {e.code}){': ' + msg if msg else ''}.") from e
    except Exception as e:  # noqa: BLE001
        raise ValueError("Google is niet bereikbaar.") from e


def _components(comps):
    """street, house number (with addition), postcode, city and country out of the address components."""
    by = {}
    for c in comps or []:
        for t in c.get("types") or []:
            by.setdefault(t, str(c.get("longText") or c.get("shortText") or "").strip())
    nr = by.get("street_number", "")
    if by.get("subpremise"):
        nr = (nr + " " + by["subpremise"]).strip()
    return {"street": by.get("route", ""), "house_number": nr, "postal_code": by.get("postal_code", ""), "city": by.get("locality") or by.get("postal_town") or by.get("sublocality") or by.get("administrative_area_level_2", ""),
            "country": by.get("country", "")}


def _place(p):
    a = _components(p.get("addressComponents"))
    return {"id": str(p.get("id") or ""), "naam": str((p.get("displayName") or {}).get("text") or "")[:160], "adres": str(p.get("formattedAddress") or "")[:240], **a}


def search(q, limit=5, cfg=None):
    """Places that match a text like 'RST Coaching Utrecht' or 'RST Coaching 3542 DH' (at most `limit`)."""
    q = re.sub(r"\s+", " ", str(q or "")).strip()[:120]
    if len(q) < 3:
        return []
    cfg = cfg or settings()
    body = {"textQuery": q, "languageCode": (cfg or {}).get("language") or "nl", "pageSize": max(1, min(int(limit), 10))}
    if (cfg or {}).get("region"):
        body["regionCode"] = cfg["region"]
    try:
        d = _call("POST", "/places:searchText", SEARCH_MASK, body, cfg)
    except LookupError:
        d = {}
    return [_place(p) for p in (d.get("places") or []) if p.get("id")][:limit]


def place(place_id, cfg=None):
    """The phone number and the website of a chosen place."""
    pid = str(place_id or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{10,200}", pid):
        raise ValueError("Ongeldige plaats.")
    cfg = cfg or settings()
    try:
        d = _call("GET", f"/places/{pid}" + (f"?languageCode={cfg['language']}" if cfg else ""), DETAIL_MASK, None, cfg)
    except LookupError as e:
        raise ValueError("Deze plaats is niet gevonden.") from e
    out = {"phone": str(d.get("internationalPhoneNumber") or d.get("nationalPhoneNumber") or "").strip(), "website": str(d.get("websiteUri") or "").strip()}
    return {k: v for k, v in out.items() if v}
