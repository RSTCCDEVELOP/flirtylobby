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
