# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""KVK (Dutch Chamber of Commerce) Handelsregister: find a Dutch company by name, KVK number or postcode and take over its data.
The link is made in Admin -> API keys (provider "kvk": key + environment). Search (Zoeken) costs nothing per request; the basic profile (Basisprofiel) costs a few cents per request,
so a profile is only fetched when somebody has chosen a company. The key never leaves this server.
`search(q)` -> [{kvk, naam, straat, postcode, plaats, type}], `profile(kvk)` -> {fields: licence/entity field names}. Both raise ValueError with a readable message."""
import json
import re
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 10
BASES = {"production": "https://api.kvk.nl/api", "test": "https://api.kvk.nl/test/api"}
TEST_KEY = "l7xx1f2691f2520d487b902f4e0b57a0b197"  # the public key of the KVK test environment (made-up companies); see developers.kvk.nl
POSTCODE_RE = re.compile(r"^\s*(\d{4})\s*([A-Za-z]{2})\s*$")


def settings():
    """{api_key, omgeving} of the link that is switched on, or None."""
    from .models import Integration

    obj = Integration.objects.filter(provider="kvk", enabled=True).order_by("id").first()
    if not obj:
        return None
    c = obj.config or {}
    key = (c.get("api_key") or "").strip()
    env = "test" if (c.get("omgeving") or "production") == "test" else "production"
    if env == "test" and not key:
        key = TEST_KEY
    return {"api_key": key, "omgeving": env} if key else None


def _get(path, params, cfg=None):
    """One call to the KVK API -> parsed JSON. Raises ValueError (Dutch message)."""
    cfg = cfg or settings()
    if not cfg:
        raise ValueError("De koppeling met de KVK is niet ingesteld (Admin → API keys).")
    url = f"{BASES[cfg['omgeving']]}{path}" + ("?" + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")}) if params else "")
    req = urllib.request.Request(url, headers={"apikey": cfg["api_key"], "Accept": "application/json", "User-Agent": "easy2edit"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return json.loads(res.read(2_000_000).decode("utf-8", "ignore") or "{}")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise ValueError("De KVK weigert de sleutel: controleer de API-sleutel en de omgeving.") from e
        if e.code == 404:
            raise LookupError("Niet gevonden bij de KVK.") from e
        if e.code == 429:
            raise ValueError("De KVK krijgt te veel aanvragen. Probeer het zo opnieuw.") from e
        raise ValueError(f"De KVK geeft een foutmelding (HTTP {e.code}).") from e
    except Exception as e:  # noqa: BLE001
        raise ValueError("De KVK is niet bereikbaar.") from e


def _addr(a):
    """The street, number, postcode and city out of the address block of the KVK (domestic address, or foreign)."""
    a = a or {}
    b = a.get("binnenlandsAdres") or a.get("buitenlandsAdres") or a
    street = str(b.get("straatnaam") or b.get("straatHuisnummer") or "").strip()
    nr = (str(b.get("huisnummer") or "") + str(b.get("huisletter") or "")).strip()
    toev = str(b.get("huisnummerToevoeging") or "").strip()
    return {"street": street, "house_number": (nr + ("-" + toev if toev else "")).strip(), "postal_code": str(b.get("postcode") or "").strip(), "city": str(b.get("plaats") or "").strip(),
            "country": str(b.get("land") or "").strip()}


def search(q, limit=10):
    """Companies that match a name, a KVK number (8 digits) or a postcode (1234AB). Only the main establishments, one line per company."""
    q = re.sub(r"\s+", " ", str(q or "")).strip()[:80]
    if len(re.sub(r"\s", "", q)) < 3:
        return []
    if re.fullmatch(r"\d{8}", q):
        params = {"kvkNummer": q}
    elif POSTCODE_RE.match(q):
        m = POSTCODE_RE.match(q)
        params = {"postcode": m.group(1) + m.group(2).upper(), "type": "hoofdvestiging"}
    else:
        params = {"naam": q, "type": "hoofdvestiging"}
    params["resultaatPerPagina"] = str(max(1, min(int(limit), 20)))
    cfg = settings()
    try:
        d = _get("/v2/zoeken", params, cfg)
    except LookupError:
        d = {}
    out, seen = [], set()
    for r in d.get("resultaten") or []:
        kvk = str(r.get("kvkNummer") or "").strip()
        if not kvk or kvk in seen:
            continue
        seen.add(kvk)
        a = _addr(r.get("adres"))
        out.append({"kvk": kvk, "naam": str(r.get("naam") or "")[:160], "straat": a["street"], "postcode": a["postal_code"], "plaats": a["city"], "type": str(r.get("type") or "")})
    return out[:limit]


def profile(kvk):
    """The data of one company (Basisprofiel) in the field names of the licence form / entity. Costs a few cents: only for a chosen company."""
    kvk = re.sub(r"\D", "", str(kvk or ""))
    if len(kvk) != 8:
        raise ValueError("Een KVK-nummer heeft 8 cijfers.")
    try:
        d = _get(f"/v1/basisprofielen/{kvk}", {"geoData": "false"})
    except LookupError as e:
        raise ValueError("Dit KVK-nummer is niet gevonden.") from e
    emb = d.get("_embedded") or d.get("embedded") or {}
    main = emb.get("hoofdvestiging") or {}
    adres = None
    for x in main.get("adressen") or []:
        if x.get("type") == "bezoekadres":
            adres = x
            break
    adres = adres or ((main.get("adressen") or [None])[0]) or {}
    a = _addr(adres)
    names = [str(h.get("naam") or "").strip() for h in (d.get("handelsnamen") or main.get("handelsnamen") or []) if h.get("naam")]
    owner = emb.get("eigenaar") or {}
    fields = {"company_name": str(d.get("naam") or (names[0] if names else "")).strip(), "legal_name": str(d.get("naam") or "").strip(), "registration_no": kvk,
              "street": a["street"], "house_number": a["house_number"], "postal_code": a["postal_code"], "city": a["city"], "country": a["country"] or "Nederland",
              "website": str((main.get("websites") or [""])[0] or "").strip(), "legal_form": str(owner.get("rechtsvorm") or owner.get("uitgebreideRechtsvorm") or "").strip(), "trade_names": names[:10]}
    return {"fields": {k: v for k, v in fields.items() if v}}
