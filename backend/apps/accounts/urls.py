# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import fakeusers, invitations, pwreset, registration, sso, views

router = DefaultRouter()
router.register("users", views.UserViewSet, basename="users")
router.register("roles", views.RoleViewSet, basename="roles")
router.register("user-groups", views.UserGroupViewSet, basename="user-groups")

urlpatterns = [
    path("users/fake/", fakeusers.fake_users),
    path("profile/me/fill-test/", fakeusers.fill_own_profile),
    path("auth/login/", views.login),
    path("auth/dev-login/", views.dev_login),
    path("auth/sso/config/", sso.config),
    path("auth/google/", sso.google_login),
    path("auth/apple/", sso.apple_login),
    path("auth/passkey/login/options/", sso.passkey_login_options),
    path("auth/passkey/login/", sso.passkey_login),
    path("auth/passkey/register/options/", sso.passkey_register_options),
    path("auth/passkey/register/", sso.passkey_register),
    path("auth/passkeys/", sso.passkeys),
    path("auth/passkeys/<int:pk>/", sso.passkey_remove),
    path("auth/password-reset/request/", pwreset.request_code),
    path("auth/password-reset/confirm/", pwreset.confirm),
    path("auth/login/verify/", views.login_verify),
    path("auth/login/resend/", views.login_resend),
    path("auth/register/config/", registration.config),
    path("auth/register/name/", registration.free_name),
    path("auth/register/email/", registration.check_email),
    path("auth/register/", registration.start),
    path("auth/register/verify/", registration.verify),
    path("auth/register/resend/", registration.resend),
    path("auth/2fa/start/", views.twofa_start),
    path("auth/2fa/confirm/", views.twofa_confirm),
    path("auth/2fa/disable/", views.twofa_disable),
    path("invitations/", invitations.invitations),
    path("invitations/<int:pk>/", invitations.invitation),
    path("invitations/<int:pk>/resend/", invitations.invitation_resend),
    path("invite/<str:token>/", invitations.invite),
    path("invite/<str:token>/verify/", invitations.invite_verify),
    path("invite/<str:token>/resend/", invitations.invite_resend),
    path("module-grants/", views.module_grants),
    path("module-grants/<int:pk>/", views.module_grant),
    path("auth/logout/", views.logout),
    path("auth/me/", views.me),
    path("auth/me/image/", views.my_photo),
    path("auth/password/", views.change_password),
    path("auth/delete/", views.delete_me),
] + router.urls
