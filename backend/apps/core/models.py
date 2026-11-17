# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.db import models


class SiteSettings(models.Model):
    """Singleton (pk=1) holding site-wide settings. `theme` stores only values that differ from the defaults."""

    theme = models.JSONField(default=dict, blank=True)
    component_set = models.CharField(max_length=60, blank=True, default="")  # the key of the set of easy2edit objects (components) in use ("" = the standard set)

    class Meta:
        verbose_name_plural = "Site settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Language(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)  # Dutch name, for the admin
    native_name = models.CharField(max_length=100)
    rtl = models.BooleanField(default=False)
    enabled = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.name


class ContentBlock(models.Model):
    """Editable website text (see the bewerkmodus). One row per key + language."""

    key = models.CharField(max_length=100)
    lang = models.CharField(max_length=10)
    text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("key", "lang")


class LanguageSettings(models.Model):
    """Site-wide language options (one row): how the language switch looks in the header."""

    SWITCHER = [("dropdown", "Tekst (pulldown)"), ("flags", "Vlaggetjes")]
    switcher = models.CharField(max_length=10, choices=SWITCHER, default="dropdown")


class DashboardLayout(models.Model):
    """Block layout of the user dashboard. user=None is the default for everybody without own layout."""

    user = models.OneToOneField("accounts.User", null=True, blank=True, on_delete=models.CASCADE, related_name="dashboard_layout")
    widgets = models.JSONField(default=list)  # [{"id": "messages", "col": 0}, ...] (order = order inside the column)
    columns = models.PositiveSmallIntegerField(default=2)  # 1-4 columns
    updated_at = models.DateTimeField(auto_now=True)


class UserShortcuts(models.Model):
    """The shortcut tiles on a user's dashboard: [{"href": "/dashboard/...", "title": "Dutch page name"}]."""

    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="shortcuts")
    items = models.JSONField(default=list)


class UserPrefs(models.Model):
    """The settings of a person that follow them to every computer: which blocks are open, tiles or list, menu or tiles, light or dark, language, ... {"collapse:admin-pages": "1", ...}."""

    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="prefs")
    data = models.JSONField(default=dict)


class BackupPassword(models.Model):
    """The password of the back-up zip that this person chose to remember. Encrypted at rest, never sent back to the browser."""

    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="backup_password")
    secret = models.TextField()  # integrations.crypto: {"password": "..."}


class ModuleState(models.Model):
    """Switch for a module (see apps/core/modules.py). No row = default (on)."""

    key = models.CharField(max_length=50, unique=True)
    enabled = models.BooleanField(default=True)
    owner_only = models.BooleanField(default=False)  # an easy2edit module: only a superadmin+ sees and manages it
    updated_at = models.DateTimeField(auto_now=True)


class EasySite(models.Model):
    """An easy2edit website that has reported itself to the easy2edit server (Super admin+ -> Site manager). Kept on the installation that is the site manager server."""

    instance_id = models.CharField(max_length=40, unique=True)  # made once by the website itself
    name = models.CharField(max_length=150, blank=True)
    url = models.CharField(max_length=300, blank=True)  # the address of the website (reported, or made from the base domain of the easy2edit server)
    url_generated = models.BooleanField(default=False)
    ip = models.GenericIPAddressField(null=True, blank=True)  # the IP address the website itself reports (its server)
    seen_ip = models.GenericIPAddressField(null=True, blank=True)  # the address the last call came from
    version = models.CharField(max_length=30, blank=True)
    build = models.CharField(max_length=20, blank=True)
    token_hash = models.CharField(max_length=64, blank=True)  # of the key the website uses for its next calls (the key itself is not kept)
    api_url = models.CharField(max_length=300, blank=True)  # the API address of the website (backend): where the easy2edit server asks for information (users, reseller, AI) and switches it offline/online
    license_state = models.CharField(max_length=10, blank=True)  # none | active | expired: the licence of the website itself (as it reported)
    license_until = models.CharField(max_length=10, blank=True)  # the end date of that licence (YYYY-MM-DD)
    install_state = models.CharField(max_length=10, blank=True)  # installed (set up) | empty (a standard installation that is still empty)
    install_name = models.CharField(max_length=100, blank=True)  # which installation (the name of the standard installation or of the wizard)
    name_locked = models.BooleanField(default=False)  # the name was changed in the Site manager: the website no longer overwrites it
    blocked_offline = models.BooleanField(default=False)  # the easy2edit server took the website offline when it was blocked (so it is put online again when it is released)
    block_message = models.CharField(max_length=500, blank=True)  # the message that visitors see while the website is blocked
    callback_key_enc = models.TextField(blank=True)  # the key the easy2edit server shows to the website when it calls it (encrypted); the website checks it
    status = models.CharField(max_length=10, default="pending")  # pending (waits for approval: it can report, but gets no library and no keys) | active | blocked
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)  # the last time an administrator logged in on that website
    last_login_role = models.CharField(max_length=20, blank=True)  # admin | superadmin | superadmin+
    login_count = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-last_seen", "-first_seen"]


class SystemSettings(models.Model):
    """Singleton (pk=1): basic data of this installation (name, addresses, contact). Secrets and server settings stay in the environment."""

    data = models.JSONField(default=dict, blank=True)


class SalesVerification(models.Model):
    """E-mail confirmation of the calculation form by a link: the visitor opens the link in the mail, the form (waiting for it) then gets its proof."""

    nonce = models.CharField(max_length=60, unique=True)
    email = models.EmailField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class MarketingText(models.Model):
    """The marketing text of a module in one language, made or improved with the AI (Super admin → Prijzen → Marketing). The built-in Dutch and English texts are in marketing_content.py."""

    module = models.CharField(max_length=40)
    lang = models.CharField(max_length=10)
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("module", "lang")]


class License(models.Model):
    """Singleton (pk=1): the licence number of this installation and the client (opdrachtgever). Made by the superadmin."""

    number = models.CharField(max_length=40, blank=True)
    client = models.CharField(max_length=200, blank=True)
    client_address = models.CharField(max_length=300, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)  # empty = no end date
    price = models.DecimalField(max_digits=9, decimal_places=2, default=0)  # what a renewal costs = the price per month x renew_months (0 = renewing is not offered online)
    renew_months = models.PositiveSmallIntegerField(default=1)  # the period that is paid at once: 1 (month), 3 (quarter) or 12 (year)
    base_price = models.DecimalField(max_digits=9, decimal_places=2, default=0)  # the price of the platform itself PER MONTH (incl. VAT); the parts in use come on top
    backup_included = models.PositiveSmallIntegerField(default=5)  # backups (all limits of the backup module added up) that are in the base price
    backup_slot_price = models.DecimalField(max_digits=9, decimal_places=2, default=0)  # per month, for every backup above that (incl. VAT)
    payment_method = models.CharField(max_length=8, default="online")  # how the administrator pays: online (a payment every period) | auto (automatic collection, a subscription) | invoice (on account)
    allowed_methods = models.JSONField(default=list, blank=True)  # which of these the superadmin offers (empty = online and invoice)
    sub_status = models.CharField(max_length=10, blank=True)  # the licence subscription: "" (none) | active | cancelled
    sub_provider = models.CharField(max_length=10, blank=True)  # mollie | stripe
    sub_ref = models.CharField(max_length=60, blank=True)  # the reference of the subscription / mandate at the provider
    sub_started_at = models.DateTimeField(null=True, blank=True)
    sub_amount = models.DecimalField(max_digits=9, decimal_places=2, default=0)  # the amount that the subscription at Stripe collects now (kept in line with the price)
    stripe_config_encrypted = models.TextField(blank=True)  # the Stripe account of whoever sells the licence (keys encrypted): NOT the Stripe link of the website's own shop
    payment_ref = models.CharField(max_length=40, blank=True)  # the open renewal payment
    client_parts = models.JSONField(default=dict, blank=True)  # the address of the client in parts: street, house_number, postal_code, city, country (client_address is the same on one line)
    hosting = models.CharField(max_length=30, blank=True)  # the hosting that is paid with the licence (a key of the hosting options in the price list); empty = none / own hosting
    main_url = models.CharField(max_length=300, blank=True)  # the main address of the website (https://...): the licence is for this address
    reseller_name = models.CharField(max_length=120, blank=True)  # who sells the licence: shown to administrators when there is none
    reseller_email = models.EmailField(blank=True)
    reseller_url = models.CharField(max_length=300, blank=True)  # the page where a licence is ordered and paid


class ComponentPrice(models.Model):
    """The price (incl. VAT) of a module, a plugin or a game of a plugin. While it is in use it counts towards the price of the licence (see license_price.py)."""

    kind = models.CharField(max_length=8)  # module | plugin | game
    key = models.CharField(max_length=120)  # module key · plugin name · "plugin:game"
    price = models.DecimalField(max_digits=9, decimal_places=2, default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["kind", "key"], name="uniq_component_price")]


class ThemePack(models.Model):
    """A theme package from the themes folder (<root>/themes/<key>/theme.json): switched on = offered in Admin -> Vormgeving."""

    key = models.SlugField(max_length=40, unique=True)
    enabled = models.BooleanField(default=False)
    manifest = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]


class ThemeImportJob(models.Model):
    """A theme made from a website address: runs in the background (progress), ends as a draft that the user checks before it is saved as a package."""

    id = models.UUIDField(primary_key=True, default=__import__("uuid").uuid4, editable=False)
    user = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    url = models.CharField(max_length=500)
    status = models.CharField(max_length=10, default="running")  # running | done | error
    progress = models.PositiveSmallIntegerField(default=0)
    step = models.CharField(max_length=120, blank=True)
    error = models.TextField(blank=True)
    draft = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class SiteDesignJob(models.Model):
    """A website designed by AI (Website ontwerpen -> AI-creator): runs in the background, holds the files (html, css, svg) and the chat with the AI to adjust them."""

    id = models.UUIDField(primary_key=True, default=__import__("uuid").uuid4, editable=False)
    user = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    name = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=10, default="running")  # draft | running | stopping (stop was asked) | done | error
    progress = models.PositiveSmallIntegerField(default=0)
    step = models.CharField(max_length=160, blank=True)
    error = models.TextField(blank=True)
    brief = models.JSONField(default=dict, blank=True)
    files = models.JSONField(default=dict, blank=True)  # {"index.html": "...", "style.css": "...", "img/hero.svg": "..."}
    messages = models.JSONField(default=list, blank=True)  # [{"role": "user"|"ai", "text": "..."}]
    files_prev = models.JSONField(default=dict, blank=True)  # the files as they were before the last improvement: "put the previous version back"
    docs = models.JSONField(default=list, blank=True)  # the documents (pdf, word) with the goals of the website: [{"id", "name", "key", "status", "percent", "step", "summary", "goals", "applied", "result", ...}]
    translations = models.JSONField(default=dict, blank=True)  # supplied translations from the ZIP: {"en": {"formaat": ..., "paginas": {...}}}
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class TermsVersion(models.Model):
    """A published version of the terms and conditions: the text in every language ({lang: {"title", "body"}}, body = "html:<clean html>"). Admins and superadmins sign a version."""

    version = models.PositiveIntegerField(unique=True)
    texts = models.JSONField(default=dict)
    published_at = models.DateTimeField(auto_now_add=True)
    published_by = models.CharField(max_length=254, blank=True)

    class Meta:
        ordering = ["-version"]


class TermsSignature(models.Model):
    """A signature: this person confirmed with a code from an e-mail that they accept this version."""

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="terms_signatures")
    version = models.PositiveIntegerField()
    role = models.CharField(max_length=20, blank=True)  # superadmin | admin
    name = models.CharField(max_length=200, blank=True)
    email = models.CharField(max_length=254, blank=True)
    lang = models.CharField(max_length=10, blank=True)  # the language of the text that was shown
    method = models.CharField(max_length=10, default="email")  # email (code from the e-mail) | auto (a superadmin typed @: the code was filled in by the system) | skipped (a superadmin signed without the e-mail code)
    ip = models.CharField(max_length=60, blank=True)
    signed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-signed_at"]


class TermsCode(models.Model):
    """The code from the e-mail (only a hash is stored): valid for 15 minutes, five tries."""

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="terms_codes")
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    tries = models.PositiveSmallIntegerField(default=0)
    auto = models.BooleanField(default=False)  # made for a superadmin who typed @ (the code is filled in by the system): the signature is recorded as such
    created_at = models.DateTimeField(auto_now_add=True)


def _remove_design_files(sender, instance, **kwargs):
    """A design that is thrown away takes its uploaded documents with it."""
    from django.core.files.storage import default_storage

    for d in instance.docs or []:
        try:
            if d.get("key"):
                default_storage.delete(d["key"])
        except Exception:  # noqa: BLE001
            pass


models.signals.post_delete.connect(_remove_design_files, sender=SiteDesignJob, dispatch_uid="sitedesign_files")
