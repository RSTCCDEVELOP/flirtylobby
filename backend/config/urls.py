from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

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
    path("api/", include("apps.social.urls")),
    path("api/", include("apps.plugins.urls")),
    path("api/", include("apps.pages.urls")),
    path("api/", include("apps.siteimport.urls")),
    path("api/", include("apps.subscriptions.urls")),
    path("api/", include("apps.sysobjects.urls")),
    path("api/", include("apps.faq.urls")),
    path("api/", include("apps.stats.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.backups.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
