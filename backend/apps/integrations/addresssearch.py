# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Find a business or an address on a text like "RST Coaching Utrecht" or "RST Coaching 3542 DH", WITHOUT a key.
Google search itself cannot be called from a server (no official way, it blocks programs and its terms forbid it). Two free sources are used:
  - PDOK Locatieserver (the Dutch government, all addresses of the Netherlands, by postcode and house number)  -> the address behind a postcode
  - OpenStreetMap Nominatim (businesses and places by name, usually together with a town)                     -> a business by name (small businesses are often not on the map)
`search(q)` -> {"source": "free", "results": [{id, naam, adres, street, house_number, postal_code, city, country, bron}]}. Raises ValueError with a readable message."""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from django.core.cache import cache

TIMEOUT = 8
UA = "easy2edit/1.0 (address search)"
PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
POSTCODE = re.compile(r"\b(\d{4})\s?([A-Za-z]{2})\b")


def _http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return json.loads(res.read(1_000_000).decode("utf-8", "ignore") or "null")
    except urllib.error.HTTPError as e:
        raise ValueError(f"De adressenbron geeft een foutmelding (HTTP {e.code}).") from e
    except Exception as e:  # noqa: BLE001
        raise ValueError("De adressenbron is niet bereikbaar.") from e


def _pdok(q, rows=5):
    url = PDOK + "?" + urllib.parse.urlencode({"q": q, "rows": rows, "fq": "type:adres", "fl": "weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam"})
    out = []
    for d in ((_http_json(url) or {}).get("response") or {}).get("docs") or []:
        nr = (str(d.get("huisnummer") or "") + str(d.get("huisletter") or "")).strip()
        if d.get("huisnummertoevoeging"):
            nr += " " + str(d["huisnummertoevoeging"])
        pc = str(d.get("postcode") or "")
        out.append({"id": "pdok:" + str(d.get("weergavenaam") or ""), "naam": "", "adres": str(d.get("weergavenaam") or ""), "street": str(d.get("straatnaam") or ""), "house_number": nr,
                    "postal_code": (pc[:4] + " " + pc[4:]).strip(), "city": str(d.get("woonplaatsnaam") or ""), "country": "Nederland", "bron": "PDOK"})
    return out


def _nominatim(q, rows=5):
    """One request per second at most (the rules of the free service)."""
    wait = cache.get("nominatim:last")
    if wait:
        time.sleep(max(0.0, min(1.2, 1.1 - (time.time() - wait))))
    cache.set("nominatim:last", time.time(), 5)
    url = NOMINATIM + "?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "addressdetails": 1, "limit": rows, "accept-language": "nl", "countrycodes": "nl"})
    out = []
    for d in _http_json(url) or []:
        a = d.get("address") or {}
        name = str(d.get("name") or "")[:160]
        if not name or a.get("road") is None and a.get("postcode") is None:
            continue
        city = a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or ""
        out.append({"id": f"osm:{d.get('osm_type', '')[:1]}{d.get('osm_id', '')}", "naam": name, "adres": str(d.get("display_name") or "")[:240], "street": str(a.get("road") or ""), "house_number": str(a.get("house_number") or ""),
                    "postal_code": str(a.get("postcode") or ""), "city": str(city), "country": str(a.get("country") or "Nederland"), "bron": "OpenStreetMap"})
    return out


def _one_per_street(rows, limit):
    """A postcode has many houses in the same street: the street comes once (street, postcode and town), without a house number."""
    seen, out = set(), []
    for r in rows:
        k = (r["street"].lower(), r["postal_code"], r["city"].lower())
        if k in seen:
            continue
        seen.add(k)
        out.append({**r, "id": "pdok:" + "|".join(k), "house_number": "", "adres": f"{r['street']}, {r['postal_code']} {r['city']}"})
    return out[:limit]


def _same_once(rows):
    """The same address (name, street, number, postcode, town) only once."""
    seen, out = set(), []
    for r in rows:
        k = tuple(str(r.get(x) or "").lower() for x in ("naam", "street", "house_number", "postal_code", "city"))
        if k not in seen:
            seen.add(k)
            out.append(r)
    return out


def free_search(q, limit=5):
    """The free sources. 'RST Coaching 3542 DH' -> the town of that postcode is added to the name; a postcode with a house number gives the exact address."""
    m = POSTCODE.search(q)
    rest = re.sub(r"\s+", " ", POSTCODE.sub(" ", q)).strip(" ,")
    out = []
    if m:
        pc = m.group(1) + m.group(2).upper()
        nr = re.search(r"\b(\d{1,5}\s?[A-Za-z]?)\b", rest)
        if nr and len(rest) <= 8:  # only a postcode and a house number: the exact address
            out += _pdok(f"{pc} {nr.group(1).replace(' ', '')}", 1)
            return out[:limit]
        addr = _pdok(pc, 1)
        city = addr[0]["city"] if addr else ""
        if rest:
            out += _nominatim(f"{rest} {city}".strip(), limit)
        if not out:
            out += _one_per_street(_pdok(pc, 20), limit)  # no business found: the street of that postcode, once (the house number is typed by the person)
        return out[:limit]
    return _nominatim(q, limit)[:limit]


def search(q, limit=5):
    q = re.sub(r"\s+", " ", str(q or "")).strip()[:120]
    if len(q) < 3:
        return {"source": "free", "results": []}
    key = "addrsearch:" + q.lower()
    hit = cache.get(key)
    if hit is None:
        hit = free_search(q, limit)
        cache.set(key, hit, 86400)
    return {"source": "free", "results": _same_once(hit)}
