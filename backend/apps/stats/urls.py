from django.urls import path

from . import views

urlpatterns = [
    path("stats/hit/", views.hit),
    path("stats/bot/", views.bot),
    path("stats/event/", views.event),
    path("stats/tabs/", views.tabs),
    path("stats/general/", views.general),
    path("stats/module/<slug:key>/", views.module),
    path("stats/plugin/<slug:name>/", views.plugin),
]
