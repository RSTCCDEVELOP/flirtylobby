from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("admin/home-photos", views.HomePhotoViewSet, basename="home-photos")

urlpatterns = [
    path("branding/", views.branding),
    path("branding/assets/<str:slot>/", views.asset),
] + router.urls
