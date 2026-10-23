# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
