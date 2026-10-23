# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import views

urlpatterns = [
    path("siteimport/", views.imports),
    path("siteimport/<int:pk>/", views.one),
    path("siteimport/<int:pk>/approve/", views.approve),
    path("siteimport/<int:pk>/theme/", views.theme),
    path("siteimport/<int:pk>/home/", views.home),
    path("siteimport/<int:pk>/asset/", views.asset),
]
