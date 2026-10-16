from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("admin/integrations", views.IntegrationViewSet, basename="integration")

urlpatterns = [
    path("integrations/", views.active_integrations),
    path("admin/integration-providers/", views.provider_catalog),
] + router.urls
