from django.urls import path

from . import views

urlpatterns = [
    path("notify/", views.inbox),
    path("notify/mark/", views.mark),
    path("notify/prefs/", views.prefs),
    path("notify/<int:pk>/", views.remove),
    path("notify/admin/", views.admin_settings),
    path("notify/admin/send/", views.admin_send),
]
