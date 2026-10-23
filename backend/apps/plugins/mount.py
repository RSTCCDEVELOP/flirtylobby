# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The routes that plugins bring with System.mount(urlpatterns): ordinary Django/DRF routes (views, viewsets, routers) at the addresses of the API (/api/...).

config/urls.py ends with a catch-all that comes here when no route of the system itself matched. Only plugins that are on are asked; a plugin that is off gives 404."""
from django.http import Http404
from django.views.decorators.csrf import csrf_exempt
from django.urls import Resolver404
from django.urls.resolvers import RegexPattern, URLResolver

from . import runtime

_cache = {}  # id(list) -> resolver


def _resolver(patterns):
    key = id(patterns)
    if key not in _cache:
        _cache[key] = URLResolver(RegexPattern(r"^/"), patterns)
        if len(_cache) > 50:
            _cache.pop(next(iter(_cache)))
    return _cache[key]


@csrf_exempt  # (the views of the plugin are DRF views: they handle the login themselves)
def dispatch(request, rest):
    runtime.ensure_loaded()
    path = "/" + rest
    for lp in list(runtime.LOADED.values()):
        if not lp.urlpatterns:
            continue
        try:
            hit = _resolver(lp.urlpatterns).resolve(path)
        except Resolver404:
            continue
        return hit.func(request, *hit.args, **hit.kwargs)
    raise Http404()
