# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path

from . import views

urlpatterns = [
    path("sandbox/status/", views.public_status),
    path("sandbox/settings/", views.settings),
    path("sandbox/messages/", views.messages),
    path("sandbox/clear/", views.clear),
    path("sandbox/payments/", views.payments),
    path("sandbox/payments/<str:ref>/outcome/", views.payment_outcome),
    path("sandbox/checkout/<str:ref>/", views.checkout),
    path("sandbox/checkout/<str:ref>/pay/", views.checkout_pay),
]
