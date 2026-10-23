# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Visitor country lookup + allow/block decision."""
import ipaddress
import json
import logging
import time
import urllib.request

from . import service

logger = logging.getLogger(__name__)
_cache = {}  # ip -> (country, timestamp)
TTL = 24 * 3600


def _lookup(ip):
    """Country code for a public IP via ipwho.is (HTTPS, no key). None when unknown."""
    hit = _cache.get(ip)
    if hit and time.time() - hit[1] < TTL:
        return hit[0]
    country = None
    try:
        with urllib.request.urlopen(f"https://ipwho.is/{ip}?fields=success,country_code", timeout=3) as res:
            data = json.load(res)
            if data.get("success"):
                country = (data.get("country_code") or "").upper() or None
    except Exception as e:
        logger.warning("Geo lookup failed for %s: %s", ip, e)
        return None  # don't cache failures
    _cache[ip] = (country, time.time())
    return country


def _check(ip, header_country=None):
    """Returns (allowed, country)."""
    cfg = service.get()["geo"]
    if not cfg["enabled"]:
        return True, None
    from apps.sandbox import service as sandbox

    if sandbox.active("geo"):  # sandbox: every visitor comes from the chosen country
        country = sandbox.get()["geo_country"]
        listed = country in cfg["countries"]
        return (not listed if cfg["mode"] == "block" else listed), country
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return cfg["unknown_action"] == "allow", None
    if addr.is_private or addr.is_loopback or addr.is_link_local:
        if not cfg["test_local"]:
            return True, None  # local development / internal traffic
        ip = ""  # test mode: use this server's own public IP, i.e. the developer's real location
        addr = None
    if addr and any(addr in ipaddress.ip_network(n) for n in cfg["always_allow_ips"]):
        return True, None

    country = None
    if cfg["trust_country_header"] and header_country and len(header_country) == 2 and header_country.upper() != "XX":
        country = header_country.upper()
    if not country:
        country = _lookup(ip)
    if not country:
        return cfg["unknown_action"] == "allow", None

    listed = country in cfg["countries"]
    return (not listed if cfg["mode"] == "block" else listed), country


def check(ip, header_country=None):
    """Returns (allowed, country); a blocked visit is counted in Statistieken."""
    allowed, country = _check(ip, header_country)
    if not allowed:
        __import__("apps.stats.service", fromlist=["record"]).record("geo", "blocked", country or "onbekend")
    return allowed, country
