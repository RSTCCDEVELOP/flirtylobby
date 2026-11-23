# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import demo_views, views

urlpatterns = [
    path("sandbox/status/", views.public_status),
    path("demo/settings/", demo_views.settings),
    path("demo/backup/", demo_views.make_backup),
    path("demo/restore/", demo_views.restore_now),
    path("demo/seed/", demo_views.seed),
    path("demo/installation/", demo_views.installation),
    path("demo/entities/", demo_views.entities),
    path("demo/entities/<int:pk>/", demo_views.entity),
    path("demo/users/", demo_views.users),
    path("demo/users/candidates/", demo_views.candidates),
    path("demo/users/<int:pk>/", demo_views.user),
    path("sandbox/settings/", views.settings),
    path("sandbox/messages/", views.messages),
    path("sandbox/clear/", views.clear),
    path("sandbox/payments/", views.payments),
    path("sandbox/payments/<str:ref>/outcome/", views.payment_outcome),
    path("sandbox/checkout/<str:ref>/", views.checkout),
    path("sandbox/checkout/<str:ref>/pay/", views.checkout_pay),
]
