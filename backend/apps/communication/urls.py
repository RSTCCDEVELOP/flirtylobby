# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .views import CommAddressViewSet

router = DefaultRouter()
router.register("communication", CommAddressViewSet, basename="communication")
urlpatterns = [
    path("communication/email-layout/", views.email_layout),
    path("communication/email-layout/preview/", views.email_layout_preview),
    path("communication/email-layout/test/", views.email_layout_test),
] + router.urls
