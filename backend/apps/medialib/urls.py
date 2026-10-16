from django.urls import path

from . import storage_views, views

urlpatterns = [
    path("media/", views.library),
    path("media/upload/", views.upload),
    path("media/move/", views.move),
    path("media/delete/", views.delete_many),
    path("media/scan/", views.scan),
    path("media/tags/", views.tag_many),
    path("media/replace/", views.replace),
    path("media/<int:pk>/", views.rename),
    path("storage/", storage_views.settings_view),
    path("storage/apply/", storage_views.apply_view),
    path("files/<str:token>/", storage_views.serve),
]
