# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models



def avatar_path(instance, filename):
    import os
    import uuid

    from apps.medialib import areas

    return areas.user_path(instance.pk, "profile", f"{uuid.uuid4().hex[:12]}{os.path.splitext(filename)[1].lower()[:6]}")


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


class AccessTarget(models.Model):
    """The rights of one record of a plugin (a product, a document ...): `plugin`, `model` and `pk_text` say which one. No row = no restriction (the plugin decides). See rights.py."""

    plugin = models.CharField(max_length=40)
    model = models.CharField(max_length=60)
    pk_text = models.CharField(max_length=60)  # the key of the record (a number or a text)
    owner = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")  # who made it: may always do everything with it
    rules = models.JSONField(default=dict, blank=True)  # {"view": {"users": [], "groups": []}, "edit": {...}, "delete": {...}}
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["plugin", "model", "pk_text"], name="uniq_access_target")]
        indexes = [models.Index(fields=["plugin", "model"])]


class User(AbstractUser):
    uid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)  # the unique id of this person: never changes, shown in the user data
    domains = models.JSONField(default=list, blank=True)  # the websites (domains) this person belongs to: on the easy2edit server one person can own several sites
    remote_id = models.CharField(max_length=40, blank=True, editable=False)  # the id of this person on the easy2edit server (site owner): set by the system, never changed by hand
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
    twofa_method = models.CharField(max_length=10, blank=True)  # "email" | "sms" | "app"
    payments_enc = models.TextField(blank=True, editable=False)  # the payment details of this person, ONE encrypted blob (core/entity_payments.py): nothing in it is readable in the database
    pays_via_company = models.BooleanField(default=False)  # this person pays (orders, invoices) through a company; False = pays privately, by himself
    billing_entity = models.PositiveIntegerField(null=True, blank=True)  # the id of that company (one of the companies this person belongs to); no foreign key: the companies live in the core app
    twofa_required = models.BooleanField(default=False)  # a superadmin requires two-step verification for this person: it has to be set up after the first login
    totp_secret = models.TextField(blank=True)  # authenticator-app secret, encrypted (pending until confirmed)
    totp_last_step = models.BigIntegerField(default=0)  # last accepted 30 s step: a code works only once
    email_verified = models.BooleanField(default=False)  # confirmed with a code sent to the address
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
    image = models.ImageField(upload_to=avatar_path, blank=True)  # profile photo
    show_public = models.BooleanField(default=False)  # show as member on the website
    last_seen = models.DateTimeField(null=True, blank=True)  # presence for chat
    otp_expires = models.DateTimeField(null=True, blank=True)
    otp_attempts = models.PositiveSmallIntegerField(default=0)
    otp_sent_at = models.DateTimeField(null=True, blank=True)
    color = models.CharField(max_length=7, blank=True)  # a colour an administrator gives this user: a coloured dot before the name in the lists (#rrggbb)
    is_superadmin_plus = models.BooleanField(default=False)  # superadmin+: a superadmin who also sees and manages the easy2edit modules (see accounts/superplus.py)

    @property
    def is_superplus(self):
        return bool(self.is_staff and self.is_superadmin_plus)

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


class Invitation(models.Model):
    """An invitation to create an account (Admin → Users → Nodig uit). The link holds a secret token; only its hash is stored."""

    token_hash = models.CharField(max_length=64, unique=True)
    email = models.EmailField()
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    roles = models.ManyToManyField(Role, blank=True, related_name="+")
    groups = models.ManyToManyField("UserGroup", blank=True, related_name="+")
    grants = models.JSONField(default=list, blank=True)  # [{"module": key, "level": 1-3}]
    require_terms = models.BooleanField(default=True)
    terms_url = models.CharField(max_length=300, blank=True)
    require_email_verify = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    created_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    user = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    pending = models.JSONField(default=dict, blank=True)  # password HASH while the e-mail code is still to be entered
    code_hash = models.CharField(max_length=64, blank=True)
    code_expires = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    code_sent_at = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=40, blank=True)  # who made it: "" = an administrator (Admin -> Users), else the key of a plugin (e.g. "coach-video")
    after_path = models.CharField(max_length=200, blank=True)  # where the new person goes right after the account is made (a path of this website)
    context = models.JSONField(default=dict, blank=True)  # for the plugin that made it (e.g. {"coach_id": 5}); the plugin hears about the account through the event invitation_accepted

    class Meta:
        ordering = ["-created_at"]


class PasskeyCredential(models.Model):
    """A passkey (WebAuthn) of a user: the public key of a device (phone, laptop, security key). The secret never leaves the device."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="passkeys")
    credential_id = models.CharField(max_length=512, unique=True)  # base64url
    public_key = models.BinaryField()  # the COSE key as the device made it
    sign_count = models.PositiveBigIntegerField(default=0)
    name = models.CharField(max_length=80, blank=True)
    transports = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class SocialIdentity(models.Model):
    """The account of a user at Google or Apple (the subject of the identity token): later logins find the user by it."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_identities")
    provider = models.CharField(max_length=20)  # google | apple
    subject = models.CharField(max_length=255)
    email = models.CharField(max_length=254, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "subject"], name="uniq_social_identity")]


class PasswordReset(models.Model):
    """A request to set a new password: a code that went to the e-mail address of the account (see pwreset.py). The code itself is never stored, only a hash."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="password_reset")
    code_hash = models.CharField(max_length=64)
    expires = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    sent_at = models.DateTimeField()
