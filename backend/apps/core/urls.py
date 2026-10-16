from django.urls import path

from . import backup_views, dashboard, views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("languages/", views.languages_public),
    path("languages/all/", views.languages_all),
    path("languages/config/", views.languages_config),
    path("languages/<str:code>/", views.language_update),
    path("languages/<str:code>/default/", views.language_set_default),
    path("dashboard/layout/", dashboard.layout),
    path("dashboard/layout/default/", dashboard.default_layout),
    path("dashboard/stats/", dashboard.stats),
    path("modules/", views.modules_public),
    path("modules/all/", views.modules_admin),
    path("modules/<str:key>/", views.module_update),
    path("content/", views.content_public),
    path("content/save/", views.content_save),
    path("settings-backup/sections/", backup_views.sections),
    path("settings-backup/export/", backup_views.export),
    path("settings-backup/inspect/", backup_views.inspect),
    path("settings-backup/load/", backup_views.load),
    path("theme/", views.theme_settings, name="theme"),
    path("theme/preview/", views.theme_preview, name="theme-preview"),
    path("theme/reset/", views.theme_reset, name="theme-reset"),
]
