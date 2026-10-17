from django.urls import path

from . import views

urlpatterns = [
    path("sysobjects/", views.public_list),
    path("sysobjects/admin/", views.admin_list),
    path("sysobjects/admin/<int:pk>/", views.admin_toggle),
]
