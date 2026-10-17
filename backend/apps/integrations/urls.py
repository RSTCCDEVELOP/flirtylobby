from django.urls import path
from rest_framework.routers import DefaultRouter

from . import s3browser, views

router = DefaultRouter()
router.register("admin/integrations", views.IntegrationViewSet, basename="integration")

urlpatterns = [
    path("integrations/", views.active_integrations),
    path("admin/integrations/models/", views.model_list),
    path("admin/integrations/export/", views.export_all),
    path("admin/integrations/import/", views.import_all),
    path("admin/integrations/<int:pk>/s3/list/", s3browser.listing),
    path("admin/integrations/<int:pk>/s3/url/", s3browser.file_url),
    path("admin/integrations/<int:pk>/s3/upload/", s3browser.upload),
    path("admin/integrations/<int:pk>/s3/mkdir/", s3browser.mkdir),
    path("admin/integrations/<int:pk>/s3/delete/", s3browser.delete),
    path("admin/integration-providers/", views.provider_catalog),
] + router.urls
