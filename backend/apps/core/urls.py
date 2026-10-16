from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("theme/", views.theme_settings, name="theme"),
    path("theme/preview/", views.theme_preview, name="theme-preview"),
    path("theme/reset/", views.theme_reset, name="theme-reset"),
]
