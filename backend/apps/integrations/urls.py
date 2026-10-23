# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
