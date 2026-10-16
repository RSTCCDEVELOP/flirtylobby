from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    function = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=255, blank=True)
    link = models.CharField(max_length=255, blank=True)
    link_external = models.BooleanField(default=False)
    short = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    otp_token = models.CharField(max_length=255, blank=True)
    otp_active = models.BooleanField(default=False)
