# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import views

urlpatterns = [
    path("ecologi/state/", views.state),
    path("ecologi/overview/", views.overview),
    path("ecologi/plant/", views.plant),
    path("ecologi/quote/", views.quote),
    path("ecologi/orders/", views.orders),
    path("ecologi/settings/", views.settings_view),
    path("ecologi/stats/", views.stats),
    path("ecologi/me/", views.me),
    path("ecologi/give/", views.give),
    path("ecologi/onboarding/", views.onboarding_trees),
]
