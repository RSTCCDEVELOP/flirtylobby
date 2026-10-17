from django.urls import path, re_path

from . import views as v

urlpatterns = [
    path("plugins/", v.plugins),
    path("plugins/upload/", v.upload),
    path("plugins/scan/", v.scan),
    path("plugins/menu/", v.menu),
    path("plugins/sdk.js", v.sdk),
    path("plugins/public/", v.public),
    path("plugins/lang/<slug:name>/", v.lang),
    path("plugins/example/", v.example),
    re_path(r"^plugins/web/(?P<name>[a-z0-9-]+)/(?P<path>.*)$", v.web),
    re_path(r"^plugins/run/(?P<name>[a-z0-9-]+)/(?P<path>.*)$", v.run),
    path("plugins/<slug:name>/", v.plugin),
]
