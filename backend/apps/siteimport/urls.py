from django.urls import path

from . import views

urlpatterns = [
    path("siteimport/", views.imports),
    path("siteimport/<int:pk>/", views.one),
    path("siteimport/<int:pk>/approve/", views.approve),
    path("siteimport/<int:pk>/theme/", views.theme),
    path("siteimport/<int:pk>/home/", views.home),
    path("siteimport/<int:pk>/asset/", views.asset),
]
