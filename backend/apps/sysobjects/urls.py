# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import views

urlpatterns = [
    path("sysobjects/", views.public_list),
    path("sysobjects/admin/", views.admin_list),
    path("sysobjects/admin/<int:pk>/", views.admin_toggle),
]
