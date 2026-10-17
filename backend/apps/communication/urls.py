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
