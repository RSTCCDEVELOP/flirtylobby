# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.conf import settings
from django.conf.urls.static import static
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
    path("api/", include("apps.seo.urls")),
    path("api/", include("apps.sandbox.urls")),
    path("api/", include("apps.plugins.urls")),
    path("api/", include("apps.pages.urls")),
    path("api/", include("apps.siteimport.urls")),
    path("api/", include("apps.sysobjects.urls")),
    path("api/", include("apps.faq.urls")),
    path("api/", include("apps.stats.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.backups.urls")),
    re_path(r"^api/(?P<rest>.+)$", plugin_mount.dispatch),  # the routes of plugins that bring a part of the system (Community, Abonnementen): last, so the system itself wins
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
