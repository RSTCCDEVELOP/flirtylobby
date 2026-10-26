# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import tip_views, views

urlpatterns = [
    path("help/", views.help_view),
    path("help/tips/", tip_views.tips),
    path("help/tips/<str:key>/", tip_views.tip),
    path("faq/settings/", tip_views.settings_view),
]
