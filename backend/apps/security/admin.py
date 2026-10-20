from django.contrib import admin

from .models import LoginThrottle, SecuritySettings

admin.site.register(SecuritySettings)
admin.site.register(LoginThrottle)
