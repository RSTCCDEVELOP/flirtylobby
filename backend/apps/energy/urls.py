# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import views

urlpatterns = [
    path("energy/beacon/", views.beacon),
    path("energy/view/", views.view),
    path("energy/public/", views.public),
    path("energy/network/", views.network_view),
    path("admin/energy/", views.overview),
    path("admin/energy/settings/", views.settings),
    path("admin/energy/scan/", views.scan_now),
    path("admin/energy/objects/", views.objects),
    path("super/energy/", views.network_admin),
    path("super/energy/settings/", views.network_settings),
    path("super/energy/sites/", views.sites),
    path("super/energy/sites/<int:pk>/", views.site_one),
    path("super/energy/refresh/", views.network_refresh),
]
