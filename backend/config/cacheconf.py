# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Which cache the system uses (read at start, before the database is there): the environment (CACHE_BACKEND, CACHE_REDIS_URL) first, then site/cache.json (made by Admin -> Basisgegevens -> Cache), else the standard.

The standard is "database": one cache that all workers share (the limits per hour, the idle logout and the system cache need that), without a service of its own. "memory" is per process (fine for one worker / development).
"redis" is a shared cache in a Redis server (fastest; needs the address)."""
import json
import re
from pathlib import Path

BACKENDS = ("database", "memory", "redis")
STANDARD = "database"
REDIS_RE = re.compile(r"^rediss?://[^\s]+$")


def valid(conf):
    """-> (clean conf, error text or "")."""
    backend = str((conf or {}).get("backend") or STANDARD).strip().lower()
    url = str((conf or {}).get("redis_url") or "").strip()
    if backend not in BACKENDS:
        return {"backend": STANDARD, "redis_url": ""}, "Onbekende cache."
    if backend == "redis" and not REDIS_RE.match(url):
        return {"backend": STANDARD, "redis_url": ""}, "Een Redis-cache heeft een adres nodig, bv. redis://localhost:6379/1."
    return {"backend": backend, "redis_url": url if backend == "redis" else ""}, ""


def file_path(site_dir):
    return Path(site_dir) / "cache.json"


def read_file(site_dir):
    try:
        return json.loads(file_path(site_dir).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def write_file(site_dir, conf):
    p = file_path(site_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(conf, indent=1), encoding="utf-8")


def configured(site_dir, env):
    """The cache choice that is in force: {"backend", "redis_url", "source": "env" | "file" | "standard"}."""
    if env.get("CACHE_BACKEND"):
        conf, err = valid({"backend": env.get("CACHE_BACKEND"), "redis_url": env.get("CACHE_REDIS_URL", "")})
        return {**conf, "source": "env" if not err else "standard"}
    f = read_file(site_dir)
    if f:
        conf, err = valid(f)
        return {**conf, "source": "file" if not err else "standard"}
    return {"backend": STANDARD, "redis_url": "", "source": "standard"}


def caches(conf):
    if conf["backend"] == "redis":
        return {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": conf["redis_url"], "KEY_PREFIX": "e2e"}}
    if conf["backend"] == "memory":
        return {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "easy2edit"}}
    return {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "django_cache"}}
