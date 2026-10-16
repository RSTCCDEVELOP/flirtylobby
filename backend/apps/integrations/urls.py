from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("admin/integrations", views.IntegrationViewSet, basename="integration")

urlpatterns = [
    path("integrations/", views.active_integrations),
    path("admin/integrations/export/", views.export_all),
    path("admin/integrations/import/", views.import_all),
    path("admin/integration-providers/", views.provider_catalog),
] + router.urls
