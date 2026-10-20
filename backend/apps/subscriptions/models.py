from django.conf import settings
from django.db import models

INTERVALS = [("once", "Eenmalig"), ("week", "Per week"), ("month", "Per maand"), ("quarter", "Per kwartaal"), ("year", "Per jaar")]
# access that a subscription (or a donation) can give; see service.GRANT_TYPES
GRANTS_HELP = "[{'type': 'site|page|content|service|chat|chat_media|video_chat|likes', 'ref': '…', 'value': n}]"


class Plan(models.Model):
    """A subscription that can be bought. It gives access (grants) and creates an order, once or repeating every period."""

    slug = models.SlugField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # per period, incl. VAT
    vat_rate = models.DecimalField(max_digits=4, decimal_places=1, default=21)
    interval = models.CharField(max_length=8, choices=INTERVALS, default="month")  # "once" = one order, access for `duration_days`
    duration_days = models.PositiveIntegerField(default=0)  # only for interval "once": 0 = unlimited
    trial_days = models.PositiveIntegerField(default=0)
    grants = models.JSONField(default=list, blank=True)
    highlight = models.BooleanField(default=False)  # "popular" ribbon
    system_object = models.BooleanField(default=False)  # can be put on a page in edit mode (module Systeemobjecten)
    button = models.JSONField(default=dict, blank=True)
    active = models.BooleanField(default=True)  # off = cannot be bought, existing subscribers keep access
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "price", "id"]

    @property
    def recurring(self):
        return self.interval != "once"


class Subscription(models.Model):
    STATUSES = [("pending", "Wacht op betaling"), ("trial", "Proefperiode"), ("active", "Actief"), ("past_due", "Betaling achterstallig"),
                ("canceled", "Opgezegd (loopt af)"), ("expired", "Verlopen")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=10, choices=STATUSES, default="pending", db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)  # access until; null = no end
    cancel_at_period_end = models.BooleanField(default=False)
    periods = models.PositiveIntegerField(default=0)  # how many orders were paid
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # price when it was bought (stays the same on repeats)
    manual = models.BooleanField(default=False)  # given by an admin, no order
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class DonationCampaign(models.Model):
    """A one-off gift to the makers, with an amount chosen on a slider between min and max."""

    slug = models.SlugField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    recipient = models.CharField(max_length=120, blank=True)  # "de makers", a name
    recipient_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")  # member who receives it
    min_amount = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    max_amount = models.DecimalField(max_digits=10, decimal_places=2, default=100)
    step = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    default_amount = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    goal = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # optional target
    allow_message = models.BooleanField(default=True)
    allow_anonymous = models.BooleanField(default=True)
    names = models.JSONField(default=dict, blank=True)  # {"nl": "...", "en": "..."}; `name` stays the default-language fallback
    descriptions = models.JSONField(default=dict, blank=True)
    recipients = models.JSONField(default=dict, blank=True)
    button = models.JSONField(default=dict, blank=True)  # {"as_button", "labels": {lang: text}, "icon", "variant", "size", "radius", "color"}
    system_object = models.BooleanField(default=False)  # can be put on a page in edit mode (module Systeemobjecten)
    actions = models.JSONField(default=list, blank=True)  # what a donor may use now: [{type, ref, value, from, until, uses, session_only, min_amount}]
    info = models.JSONField(default=dict, blank=True)  # popup before donating: {"titles": {lang}, "texts": {lang}, "media": MediaItem id}
    thanks = models.JSONField(default=dict, blank=True)  # popup after donating, same shape
    grants = models.JSONField(default=list, blank=True)  # a thank-you: access for `grant_days` after donating
    grant_days = models.PositiveIntegerField(default=30)
    min_for_grants = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # donate at least this much to get the access
    active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]


class Donation(models.Model):
    STATUSES = [("pending", "Wacht op betaling"), ("paid", "Betaald"), ("failed", "Mislukt")]
    campaign = models.ForeignKey(DonationCampaign, on_delete=models.PROTECT, related_name="donations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="donations")
    name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    message = models.CharField(max_length=300, blank=True)
    anonymous = models.BooleanField(default=False)
    status = models.CharField(max_length=8, choices=STATUSES, default="pending", db_index=True)
    payment_ref = models.CharField(max_length=30, blank=True, db_index=True)  # online payment (sandbox / provider); donations have no order
    paid_at = models.DateTimeField(null=True, blank=True)
    access_until = models.DateTimeField(null=True, blank=True)  # thank-you access
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class SubscriptionSettings(models.Model):
    """Singleton (pk=1): which parts of the site need a subscription, and how repeats and grace work."""

    data = models.JSONField(default=dict, blank=True)


class DonorAction(models.Model):
    """One thing a donor may use because of a donation: valid between two moments, a number of times (0 = as often as he likes),
    and optionally only in the session (login) he is in; logging out ends it."""

    donation = models.ForeignKey(Donation, on_delete=models.CASCADE, related_name="rewards")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="donor_actions")
    type = models.CharField(max_length=20)
    ref = models.CharField(max_length=80, blank=True)
    value = models.PositiveIntegerField(default=0)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)  # the deadline; empty = no deadline
    uses_total = models.PositiveIntegerField(default=0)  # 0 = unlimited (within the dates)
    uses_used = models.PositiveIntegerField(default=0)
    session_only = models.BooleanField(default=False)
    bound_token = models.CharField(max_length=60, blank=True)  # the login (token) it is tied to; gone after logout
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["valid_until", "id"]


class ActionItem(models.Model):
    """One thing in the system that can be paid for or earned with a donation (chat, likes, a page, a piece of content, a service …).
    Not gated = free for everybody. Gated = a visitor must meet the conditions (one of them or all of them)."""

    key = models.CharField(max_length=100, unique=True)  # built-in: chat, likes, …  custom: page:<key>, content:<key>, service:<product id>
    kind = models.CharField(max_length=10, default="builtin")  # builtin | page | content | service
    ref = models.CharField(max_length=80, blank=True)
    name = models.CharField(max_length=120, blank=True)  # custom items only; built-in names come from the catalog
    description = models.CharField(max_length=300, blank=True)
    gated = models.BooleanField(default=False)
    mode = models.CharField(max_length=3, default="any")  # any = one condition is enough, all = every condition
    share = models.BooleanField(default=False)  # also valid for the other party the member is chatting / connected with (not only for the member himself)
    conditions = models.JSONField(default=list, blank=True)  # [{"type": …, params}]; empty = the default: a subscription or donor action that gives this item
    rule = models.JSONField(default=dict, blank=True)  # "Geldig tot": what a donor gets when a donation gives this item: {valid_for, from, until, uses, session_only, min_amount}
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
