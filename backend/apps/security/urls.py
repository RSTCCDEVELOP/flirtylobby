from django.urls import path

from . import views

urlpatterns = [
    path("security/public/", views.public_settings),
    path("security/check/", views.check_visitor),
    path("security/settings/", views.settings_admin),
    path("security/words/check/", views.check_words),
]
