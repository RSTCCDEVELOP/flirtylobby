from django.urls import path
from rest_framework.routers import DefaultRouter

from . import registration, views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="users")
router.register("roles", views.RoleViewSet, basename="roles")
router.register("user-groups", views.UserGroupViewSet, basename="user-groups")

urlpatterns = [
    path("auth/login/", views.login),
    path("auth/login/verify/", views.login_verify),
    path("auth/login/resend/", views.login_resend),
    path("auth/register/config/", registration.config),
    path("auth/register/", registration.start),
    path("auth/register/verify/", registration.verify),
    path("auth/register/resend/", registration.resend),
    path("auth/2fa/start/", views.twofa_start),
    path("auth/2fa/confirm/", views.twofa_confirm),
    path("auth/2fa/disable/", views.twofa_disable),
    path("module-grants/", views.module_grants),
    path("module-grants/<int:pk>/", views.module_grant),
    path("auth/logout/", views.logout),
    path("auth/me/", views.me),
    path("auth/me/image/", views.my_photo),
    path("auth/password/", views.change_password),
    path("auth/delete/", views.delete_me),
] + router.urls
