"""City -> coordinates. Public OpenStreetMap Nominatim (free, rate limited) or a fake lookup in the sandbox. Rounded to ~1 km."""
import hashlib
import json
import logging
import math
import time
import urllib.parse
import urllib.request

from apps.sandbox import service as sandbox

from . import service

logger = logging.getLogger(__name__)
_cache = {}
TTL = 7 * 24 * 3600


def geocode(city, country):
    city, country = (city or "").strip(), (country or "").strip().upper()
    if not city or not service.get()["discover"]["distance_enabled"]:
        return None
    key = (city.lower(), country)
    if key in _cache and time.time() - _cache[key][1] < TTL:
        return _cache[key][0]
    if sandbox.active("geocoding"):  # simulated: a stable fake spot in the Netherlands for each place
        h = int(hashlib.sha256(f"{key}".encode()).hexdigest(), 16)
        res = (round(50.8 + (h % 3000) / 1000, 2), round(3.5 + ((h >> 16) % 3500) / 1000, 2))
    else:
        q = urllib.parse.urlencode({"city": city, "countrycodes": country.lower(), "format": "json", "limit": 1})
        contact = service.get()["discover"]["geocoder_contact"] or "unknown"
        req = urllib.request.Request(f"https://nominatim.openstreetmap.org/search?{q}", headers={"User-Agent": f"easy2edit/1.0 ({contact})"})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                data = json.load(r)
            res = (round(float(data[0]["lat"]), 2), round(float(data[0]["lon"]), 2)) if data else None
        except Exception as e:
            logger.warning("Geocoding failed for %s: %s", city, e)
            return None  # do not cache failures
    _cache[key] = (res, time.time())
    return res


def km(a_lat, a_lon, b_lat, b_lon):
    r, p = 6371, math.pi / 180
    d = math.sin((b_lat - a_lat) * p / 2) ** 2 + math.cos(a_lat * p) * math.cos(b_lat * p) * math.sin((b_lon - a_lon) * p / 2) ** 2
    return 2 * r * math.asin(math.sqrt(d))
