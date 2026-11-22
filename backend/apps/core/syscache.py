# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The cache of the system: which cache is in use (the shared one for all workers), and the system cache that makes the website faster and lighter.

1. The cache itself (Admin -> Basisgegevens -> Cache): standard "database" (all workers share it, no extra service), "memory" (one process) or "redis". The choice is read at start (config/cacheconf.py): a change needs a restart.
2. The system cache: system.get() and the public answers of the website that every anonymous visitor asks (/api/site/, /api/modules/, /api/theme/ ...) are kept for `system_cache_seconds`.
   Every successful change (a POST/PUT/PATCH/DELETE on /api/) starts a new "generation": the kept answers of the old one are never used again, so an edit shows at once.
"""
import hashlib
import logging

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse

from . import system

logger = logging.getLogger(__name__)

GEN_KEY = "sys:gen"
PUBLIC_PREFIXES = ("/api/site/", "/api/modules/", "/api/theme/", "/api/languages/", "/api/pages/menu/", "/api/pages/menu-settings/", "/api/pages/backgrounds/", "/api/content/")
NO_BUMP = ("/api/auth/activity/", "/api/energy/beacon/", "/api/stats/", "/api/notifications/", "/api/health")  # these change nothing that a visitor sees
MAX_BYTES = 512_000


def enabled():
    return bool(system.get().get("system_cache"))


def generation():
    try:
        g = cache.get(GEN_KEY)
        if g is None:
            g = 1
            cache.set(GEN_KEY, g, None)
        return g
    except Exception:  # noqa: BLE001
        return 0


def clear():
    """Forget everything the system cache kept (the settings and all public answers)."""
    system.forget_cache()
    try:
        cache.incr(GEN_KEY)
    except ValueError:
        cache.set(GEN_KEY, 2, None)
    except Exception:  # noqa: BLE001
        pass


def info():
    """What the screen shows: the cache in use, whether it is shared, and the choice that is saved (it takes effect after a restart)."""
    from config import cacheconf

    now = settings.CACHE_CONF
    saved = cacheconf._configured(settings.SITE_DIR, {}) if now["source"] != "env" else now
    backend = now["backend"]
    live = "?"
    try:
        cache.set("sys:probe", 1, 5)
        live = "ok" if cache.get("sys:probe") == 1 else "fail"
    except Exception:  # noqa: BLE001
        live = "fail"
    return {"backend": backend, "source": now["source"], "shared": backend != "memory", "redis_url": now["redis_url"] and "(ingesteld)", "saved": {"backend": saved["backend"], "redis_url": saved["redis_url"]},
            "restart_needed": saved["backend"] != backend or (saved["backend"] == "redis" and saved["redis_url"] != now["redis_url"]), "standard": cacheconf.STANDARD, "backends": list(cacheconf.BACKENDS), "works": live == "ok",
            "locked_by_env": now["source"] == "env", "fallback": now["source"] == "fallback", "fallback_from": now.get("fallback_from", "")}


def save_backend(conf):
    """Remember the choice (site/cache.json); it takes effect at the next start. -> (info, error)"""
    from config import cacheconf

    if info()["locked_by_env"]:
        return info(), "De cache is vastgezet door de omgeving (CACHE_BACKEND) van de server."
    clean, err = cacheconf.valid(conf)
    if err:
        return info(), err
    cacheconf.write_file(settings.SITE_DIR, clean)
    return info(), ""


class SystemCacheMiddleware:
    """Anonymous GETs of the public answers come from the cache; a change by a logged-in person starts a new generation."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        auth = request.META.get("HTTP_AUTHORIZATION")
        cacheable = request.method == "GET" and not auth and path.startswith(PUBLIC_PREFIXES) and enabled()
        key = None
        if cacheable:
            raw = f"{generation()}|{request.get_host()}|{request.get_full_path()}|{request.META.get('HTTP_ACCEPT_LANGUAGE', '')[:40]}"
            key = "sys:r:" + hashlib.sha1(raw.encode()).hexdigest()
            try:
                hit = cache.get(key)
            except Exception:  # noqa: BLE001
                hit = None
            if hit:
                r = HttpResponse(hit["body"], status=200, content_type=hit["ctype"])
                r["X-System-Cache"] = "hit"
                return r
        response = self.get_response(request)
        if key and response.status_code == 200 and not getattr(response, "streaming", False) and len(response.content) <= MAX_BYTES and not response.has_header("Set-Cookie"):
            try:
                cache.set(key, {"body": response.content, "ctype": response["Content-Type"]}, system.cache_seconds(system.get()))
                response["X-System-Cache"] = "miss"
            except Exception:  # noqa: BLE001
                pass
        elif request.method in ("POST", "PUT", "PATCH", "DELETE") and response.status_code < 400 and path.startswith("/api/") and not path.startswith(NO_BUMP):
            clear()
        return response
