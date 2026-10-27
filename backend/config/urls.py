# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from apps.plugins import mount as plugin_mount

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.members.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.integrations.urls")),
    path("api/", include("apps.branding.urls")),
    path("api/", include("apps.security.urls")),
    path("api/", include("apps.medialib.urls")),
    path("api/", include("apps.communication.urls")),
    path("api/", include("apps.sandbox.urls")),
    path("api/", include("apps.plugins.urls")),
    path("api/", include("apps.pages.urls")),
    path("api/", include("apps.sysobjects.urls")),
    path("api/", include("apps.faq.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.backups.urls")),
    re_path(r"^api/(?P<rest>.+)$", plugin_mount.dispatch),  # the routes of plugins that bring a part of the system (Community, Abonnementen): last, so the system itself wins
]

# The files of the library (/media/...). A server that has nothing in front of the backend (Coolify) must hand them out itself, otherwise every picture is a dead link; with nginx in front
# (deploy/nginx) the request never gets here. The library is public by design (the pictures of the website); private files are encrypted and go through /api/files/<token>/.
from django.views.static import serve as serve_media  # noqa: E402

urlpatterns += [re_path(r"^media/(?P<path>.+)$", serve_media, {"document_root": settings.MEDIA_ROOT})]
