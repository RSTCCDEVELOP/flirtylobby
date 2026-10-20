from django.urls import path

from . import views

urlpatterns = [
    path("seo/public/", views.public),
    path("seo/robots.txt", views.robots_txt),
    path("seo/sitemap.xml", views.sitemap_xml),
    path("seo/llms.txt", views.llms_txt),
    path("seo/settings/", views.settings_admin),
    path("seo/pages/", views.pages_admin),
    path("seo/audit/", views.audit),
]
