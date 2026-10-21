from django.urls import path

from . import views

urlpatterns = [
    path("backups/", views.overview),
    path("backups/create/", views.create_now),
    path("backups/upload/", views.upload),
    path("backups/limits/", views.limits),
    path("backups/jobs/<str:frequency>/", views.job),
    path("backups/jobs/<str:frequency>/run/", views.job_run),
    path("backups/<int:pk>/", views.backup),
    path("backups/<int:pk>/download/", views.download),
    path("backups/<int:pk>/restore/", views.restore),
]
