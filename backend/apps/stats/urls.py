# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import views

urlpatterns = [
    path("stats/hit/", views.hit),
    path("stats/bot/", views.bot),
    path("stats/event/", views.event),
    path("stats/tabs/", views.tabs),
    path("stats/general/", views.general),
    path("stats/module/<slug:key>/", views.module),
    path("stats/plugin/<slug:name>/", views.plugin),
]
