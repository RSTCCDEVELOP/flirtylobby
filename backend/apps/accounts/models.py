from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    permissions = models.JSONField(default=list, blank=True)  # keys from perms.PERMISSIONS
    order = models.PositiveSmallIntegerField(default=0)
    all_permissions = models.BooleanField(default=False)  # always every permission, also future ones (Admin)
    locked = models.BooleanField(default=False)  # built-in: cannot be edited or deleted

    class Meta:
        ordering = ["order", "name"]

    def keys(self):
        from .perms import KEYS

        return set(KEYS) if self.all_permissions else {k for k in self.permissions if k in KEYS}

    def __str__(self):
        return self.name


class UserGroup(models.Model):
    """A group of users. Members get the group's roles and any module access given to the group."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    roles = models.ManyToManyField("Role", blank=True, related_name="groups")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ModuleGrant(models.Model):
    """Gives a role (group) or a single user access to a module. level: 1 gebruik, 2 bewerken, 3 beheer."""

    module = models.CharField(max_length=50)
    role = models.ForeignKey("Role", null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    group = models.ForeignKey("UserGroup", null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    user = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    level = models.PositiveSmallIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["module", "role"], condition=models.Q(role__isnull=False), name="uniq_grant_role"),
            models.UniqueConstraint(fields=["module", "user"], condition=models.Q(user__isnull=False), name="uniq_grant_user"),
            models.UniqueConstraint(fields=["module", "group"], condition=models.Q(group__isnull=False), name="uniq_grant_group"),
        ]


class User(AbstractUser):
    roles = models.ManyToManyField(Role, blank=True, related_name="users")
    user_groups = models.ManyToManyField("UserGroup", blank=True, related_name="members")
    function = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=255, blank=True)
    link = models.CharField(max_length=255, blank=True)
    link_external = models.BooleanField(default=False)
    short = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    otp_token = models.CharField(max_length=255, blank=True)
    otp_active = models.BooleanField(default=False)  # two-step verification switched on
    twofa_method = models.CharField(max_length=10, blank=True)  # "email" | "sms"
    phone = models.CharField(max_length=20, blank=True)  # E.164, for SMS (and the profile)
    display_name = models.CharField(max_length=60, blank=True)  # profile name shown to others
    birth_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, blank=True)  # m | f | x
    VERIFICATION = [("open", "Open"), ("checked", "Gecontroleerd"), ("verified", "Geverifieerd")]
    verification = models.CharField(max_length=8, choices=VERIFICATION, default="open")  # set by admins; shown on profiles
    address = models.CharField(max_length=200, blank=True)  # street + number
    postal_code = models.CharField(max_length=12, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=2, blank=True)  # ISO 3166-1 alpha-2
    image = models.ImageField(upload_to="images/tms/coaches/", blank=True)  # profile photo
    show_public = models.BooleanField(default=False)  # show as member on the website
    last_seen = models.DateTimeField(null=True, blank=True)  # presence for chat
    otp_expires = models.DateTimeField(null=True, blank=True)
    otp_attempts = models.PositiveSmallIntegerField(default=0)
    otp_sent_at = models.DateTimeField(null=True, blank=True)

    def all_roles(self):
        """Roles given directly plus the roles of all groups the user is in."""
        return Role.objects.filter(models.Q(users=self) | models.Q(groups__members=self)).distinct()

    def permission_keys(self):
        """All permission keys of this user (beheerders: everything)."""
        if not hasattr(self, "_perm_cache"):
            from .perms import KEYS

            from apps.core import modules

            if self.is_staff:
                self._perm_cache = set(KEYS)
            elif not modules.enabled("roles"):
                self._perm_cache = set()
            else:
                self._perm_cache = {k for r in self.all_roles() for k in r.keys()}
        return self._perm_cache


class PendingRegistration(models.Model):
    """A sign-up that is not finished: the account is only created after the required verifications (see registration.py)."""

    token = models.CharField(max_length=64, unique=True)
    email = models.EmailField()
    data = models.JSONField(default=dict)  # name, birth date, ... and the password HASH (never the password)
    steps = models.JSONField(default=list)  # ["email"] | ["sms"] | ["email", "sms"] ...: still to do, first = current
    twofa_method = models.CharField(max_length=10, blank=True)  # set when 2FA is required for the new account
    code_hash = models.CharField(max_length=64, blank=True)
    code_expires = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    decoy = models.BooleanField(default=False)  # e-mail already has an account: look the same, never succeed
    created_at = models.DateTimeField(auto_now_add=True)
