from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "Profile",
            {"fields": ("function", "role", "link", "link_external", "short", "description")},
        ),
        ("OTP", {"fields": ("otp_token", "otp_active")}),
    )
