from django.db import models


class SiteSettings(models.Model):
    """Singleton (pk=1) holding site-wide settings. `theme` stores only values that differ from the defaults."""

    theme = models.JSONField(default=dict, blank=True)

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


class ModuleState(models.Model):
    """Switch for a module (see apps/core/modules.py). No row = default (on)."""

    key = models.CharField(max_length=50, unique=True)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)


class SystemSettings(models.Model):
    """Singleton (pk=1): basic data of this installation (name, addresses, contact). Secrets and server settings stay in the environment."""

    data = models.JSONField(default=dict, blank=True)


class License(models.Model):
    """Singleton (pk=1): the licence number of this installation and the client (opdrachtgever). Made by the superadmin."""

    number = models.CharField(max_length=40, blank=True)
    client = models.CharField(max_length=200, blank=True)
    client_address = models.CharField(max_length=300, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)  # empty = no end date
    price = models.DecimalField(max_digits=9, decimal_places=2, default=0)  # what a renewal costs (0 = renewing is not offered online)
    renew_months = models.PositiveSmallIntegerField(default=12)
    base_price = models.DecimalField(max_digits=9, decimal_places=2, default=0)  # the price of the platform itself (incl. VAT); the parts in use come on top
    payment_ref = models.CharField(max_length=40, blank=True)  # the open renewal payment
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
