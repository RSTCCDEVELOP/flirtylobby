from django.urls import path

from . import tip_views, user_views, views

urlpatterns = [
    path("help/", views.help_view),
    path("help/tips/", tip_views.tips),
    path("help/tips/<str:key>/", tip_views.tip),
    path("faq/", user_views.public),
    path("faq/settings/", tip_views.settings_view),
    path("faq/admin/", user_views.admin),
    path("faq/admin/<int:pk>/", user_views.entry),
    path("faq/translate/", user_views.translate),
]
