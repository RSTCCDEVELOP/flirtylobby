# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from decimal import Decimal

from django.db import models

from . import crypto


class Integration(models.Model):
    name = models.CharField(max_length=100)
    # Stable key that portal features refer to, e.g. is_active("anthropic")
    slug = models.SlugField(max_length=50, unique=True)
    provider = models.CharField(max_length=30)
    enabled = models.BooleanField(default=False)
    superadmin_only = models.BooleanField(default=False)  # a link of the superadmins: only they see and change it (for example the AI link that the reseller pays for)
    config_encrypted = models.TextField(blank=True)  # all settings incl. secrets, encrypted at rest
    last_test_ok = models.BooleanField(null=True, blank=True)
    last_test_at = models.DateTimeField(null=True, blank=True)
    last_test_message = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def config(self):
        return crypto.decrypt(self.config_encrypted)

    @config.setter
    def config(self, value):
        self.config_encrypted = crypto.encrypt(value)


class AiSettings(models.Model):
    """The prices and the margin of the AI use (one row): what a million tokens cost (in and out, per model family) and what is added on top of it for every group."""

    currency = models.CharField(max_length=5, default="EUR")  # the currency of the prices that are charged
    cost_currency = models.CharField(max_length=5, default="USD")  # the currency of what the AI supplier charges us
    rate = models.DecimalField(max_digits=14, decimal_places=6, default=Decimal("0.92"))  # 1 unit of the purchase currency = this much of the selling currency
    rate_at = models.DateTimeField(null=True, blank=True)
    rate_note = models.CharField(max_length=200, blank=True)  # where the rate came from
    margin_in = models.DecimalField(max_digits=7, decimal_places=2, default=0)  # percent on top of the price of an input token
    margin_out = models.DecimalField(max_digits=7, decimal_places=2, default=0)  # percent on top of the price of an output token
    bill_internal = models.BooleanField(default=False)  # the AI use of superadmins and of the system is also for the account of the customer (booked on the group of the site)
    credit_required = models.BooleanField(default=True)  # users and admins can only use AI with a credit they bought (the superadmin manages this)
    topup_min = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("5"))
    topup_max = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("100"))
    topup_step = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("5"))
    margins = models.JSONField(default=dict, blank=True)  # the margin per group: {"user": {"in": %, "out": %}, "admin": {...}, "super": {...}}; "super" is the reseller (also for the site group)
    prices = models.JSONField(default=dict, blank=True)  # {"sonnet": {"in": 3, "out": 15}, ...} per million tokens, in the currency above; the key is a part of the model name
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def load(cls):
        return cls.objects.first() or cls.objects.create()


class AiUsage(models.Model):
    """One call to the AI: who, from where in the system, which model, how many tokens, how long, and what it cost (at the prices and the margin of that moment)."""

    GROUPS = [("user", "Gebruiker"), ("admin", "Admin"), ("super", "Superadmin"), ("system", "Systeem"), ("site", "Website")]
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    user_label = models.CharField(max_length=254, blank=True)  # the e-mail address at that moment (stays when the account is deleted)
    group = models.CharField(max_length=7, choices=GROUPS, default="system", db_index=True)
    source = models.CharField(max_length=80, blank=True, db_index=True)  # where in the system: the part of the code that asked
    purpose = models.CharField(max_length=80, blank=True)
    provider = models.CharField(max_length=12, default="anthropic", db_index=True)  # anthropic, openai, gemini
    model = models.CharField(max_length=60, blank=True)
    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)
    ok = models.BooleanField(default=True)
    owner = models.CharField(max_length=6, default="system", db_index=True)  # "system" = the AI of the superadmin (reseller); "tenant" = the own AI and Stripe of an admin, for his users
    billable = models.BooleanField(default=True)  # False = a cost of the reseller himself (no margin, not charged to the customer)
    error = models.CharField(max_length=120, blank=True)
    web = models.BooleanField(default=False)  # with the web search of Claude
    images = models.PositiveSmallIntegerField(default=0)
    cost = models.DecimalField(max_digits=12, decimal_places=6, default=0)  # what it costs us, in the purchase currency (price of the tokens)
    rate = models.DecimalField(max_digits=14, decimal_places=6, default=1)  # the rate of that moment: purchase currency -> selling currency
    charged = models.DecimalField(max_digits=12, decimal_places=6, default=0)  # what is charged, in the selling currency (with the margin)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["created_at", "group"])]


class AiAccount(models.Model):
    """The AI credit of one user, in the currency that is charged."""

    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="ai_account")
    balance = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    welcomed = models.BooleanField(default=False)  # the explanation of the AI credit was shown (first login as admin)
    updated_at = models.DateTimeField(auto_now=True)


class AiLedger(models.Model):
    """Every change of a credit: bought (topup), used (usage), put in or taken out by the superadmin (adjust)."""

    KINDS = [("topup", "Gekocht"), ("usage", "Gebruikt"), ("adjust", "Aangepast door de superadmin")]
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="+")
    kind = models.CharField(max_length=8, choices=KINDS)
    amount = models.DecimalField(max_digits=12, decimal_places=4)  # + put in, - used
    balance_after = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    note = models.CharField(max_length=200, blank=True)
    payment_ref = models.CharField(max_length=40, blank=True, db_index=True)
    by = models.CharField(max_length=254, blank=True)  # who did it (superadmin), for an adjustment
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class AiTopup(models.Model):
    """A purchase of credit that is being paid: the credit is added when the payment is paid."""

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="+")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    payment_ref = models.CharField(max_length=40, unique=True)
    session_id = models.CharField(max_length=120, blank=True)  # the Stripe Checkout session of the system Stripe account
    via = models.CharField(max_length=10, default="")  # stripe (the system Stripe account) or the payment engine (sandbox)
    status = models.CharField(max_length=8, default="open")  # open, paid, failed
    created_at = models.DateTimeField(auto_now_add=True)


class AiTenant(models.Model):
    """The own AI credit system of an admin for his users: it works when the admin has his own AI link and his own Stripe link (not marked as superadmin links).
    Then his users use his AI link, pay him through his Stripe link, and the margin is his."""

    enabled = models.BooleanField(default=False)
    credit_required = models.BooleanField(default=True)
    topup_min = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("5"))
    topup_max = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("100"))
    topup_step = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("5"))
    margin_in = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0"))
    margin_out = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0"))
    updated_at = models.DateTimeField(auto_now=True)
