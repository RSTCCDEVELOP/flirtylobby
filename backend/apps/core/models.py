# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import uuid

from django.conf import settings
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


class Reseller(models.Model):
    """A reseller of easy2edit (kept on the installation that is the easy2edit server, Super admin+ -> Licence -> Resellers): company, three contact persons (sales, financial, support),
    websites, more information, and the share of RST for the use of easy2edit (the rest is the margin of the reseller). Websites (EasySite) and logins belong to a reseller."""

    name = models.CharField(max_length=150)
    active = models.BooleanField(default=True)  # only active resellers are shown on the public page
    website = models.CharField(max_length=300, blank=True)
    email = models.EmailField(blank=True)  # the general e-mail address and phone number of the company (the contact persons have their own)
    phone = models.CharField(max_length=30, blank=True)
    websites = models.JSONField(default=list, blank=True)  # more websites: [{"label", "url"}]
    info = models.TextField(blank=True)  # more information (small editor: "html:...")
    address = models.JSONField(default=dict, blank=True)  # street, house_number, postal_code, city, country
    kvk = models.CharField(max_length=40, blank=True)
    vat_id = models.CharField(max_length=40, blank=True)
    contacts = models.JSONField(default=list, blank=True)  # contact persons (a list; more than one of each kind): [{id, role: sales|financial|support|other, name, function, email, phone, mobile, same_address, address}]
    rst_share = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # percent of the software price RST gets for the use of easy2edit (empty = the default of the price list)
    notes = models.TextField(blank=True)  # internal, never public
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]


class ResellerLogin(models.Model):
    """A login of a reseller: an account that is made in the website of the customer (it is passed on to the website through the API) so the reseller can log in there."""

    reseller = models.ForeignKey(Reseller, on_delete=models.CASCADE, related_name="logins")
    email = models.EmailField()
    name = models.CharField(max_length=120, blank=True)
    password_hash = models.CharField(max_length=200, blank=True)  # the Django hash: the password itself is never kept
    access = models.CharField(max_length=10, default="admin")  # the rights in the website of the customer: user | admin | superadmin
    function = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    mobile = models.CharField(max_length=30, blank=True)  # also the number for the code by SMS
    otp = models.CharField(max_length=5, default="email")  # the code check (two-step verification) at every login: email | sms | "" (none)
    all_sites = models.BooleanField(default=True)  # may log in on every website of the reseller (otherwise only on site_ids)
    site_ids = models.JSONField(default=list, blank=True)
    host = models.BooleanField(default=True)  # may also log in on the easy2edit site itself (as a user without extra rights)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["email"]
        constraints = [models.UniqueConstraint(fields=["reseller", "email"], name="uniq_reseller_login")]


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
    defaults_state = models.JSONField(default=dict, blank=True)  # the standard settings on this website: {"keep": [tabs it does not want overwritten], "reported_at", "pushed_at", "forced", "applied": [], "kept": [], "error"}
    reseller = models.ForeignKey("core.Reseller", null=True, blank=True, on_delete=models.SET_NULL, related_name="sites")  # who sells this website (its logins are made in that website)

    class Meta:
        ordering = ["-last_seen", "-first_seen"]


class SystemSettings(models.Model):
    """Singleton (pk=1): basic data of this installation (name, addresses, contact). Secrets and server settings stay in the environment."""

    data = models.JSONField(default=dict, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        from . import system

        system.forget_cache()  # (the system cache keeps a copy of these settings)


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
    billed_monthly = models.DecimalField(max_digits=9, decimal_places=2, default=0)  # the price per month (incl. VAT) the licence was made or last updated for: when modules or plugins are switched on or off the price changes and the licence can be updated (0 = not known yet)
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


class Entity(models.Model):
    """An entity of this site (module Entiteit): the organisation behind the website (is_own, only one) and other organisations, companies, associations or clubs that users and
    user groups of this site belong to. All local in the site; there is no link with the easy2edit server."""

    KINDS = [("organisatie", "Organisatie"), ("bedrijf", "Bedrijf"), ("vereniging", "Vereniging"), ("club", "Club"), ("vrij", "Vrije naam")]

    is_own = models.BooleanField(default=False)  # the entity of the website itself; its kind comes from the standard installation
    uid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)  # the unique id of this company: never changes, shown in the company data
    domains = models.JSONField(default=list, blank=True)  # the websites (domains) of this company: on the easy2edit server one company can own several sites
    remote_id = models.CharField(max_length=40, blank=True, editable=False)  # the id of this company on the easy2edit server: set by the system, never changed by hand
    kind = models.CharField(max_length=20, choices=KINDS, default="bedrijf")
    kind_name = models.CharField(max_length=40, blank=True)  # the free name when kind is "vrij"
    name = models.CharField(max_length=120, blank=True)
    legal_name = models.CharField(max_length=160, blank=True)
    description = models.TextField(blank=True)  # small editor: "html:<clean html>"
    email = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    website = models.CharField(max_length=200, blank=True)
    street = models.CharField(max_length=120, blank=True)
    house_number = models.CharField(max_length=20, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, blank=True)
    registration_no = models.CharField(max_length=40, blank=True)
    vat_no = models.CharField(max_length=40, blank=True)
    color = models.CharField(max_length=7, blank=True)  # a colour an administrator gives this entity: a coloured dot before the name in the lists (#rrggbb)
    users = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="entities")
    groups = models.ManyToManyField("accounts.UserGroup", blank=True, related_name="entities")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_own", "name", "id"]
        constraints = [models.UniqueConstraint(fields=["is_own"], condition=models.Q(is_own=True), name="one_own_entity")]


class ComponentRequest(models.Model):
    """A component that a design needs and the component set does not have, asked for by a user of the creator (see componentrequests.py). It is never put in a site directly: it is judged first,
    then built in the code by the easy2edit developers. The same request from several designs or websites is ONE row (votes, designs, sites)."""

    STATUS = [("nieuw", "Nieuw"), ("beoordeling", "In beoordeling"), ("goedgekeurd", "Goedgekeurd"), ("afgewezen", "Afgewezen"), ("gebouwd", "Gebouwd")]

    uid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=12, choices=STATUS, default="nieuw")
    voorgesteld_type = models.CharField(max_length=60)
    naam = models.CharField(max_length=80)
    doel = models.TextField(blank=True)
    spec = models.JSONField(default=dict, blank=True)  # the full specification (props, example content, the closest existing components)
    extends = models.CharField(max_length=60, blank=True)  # "extend" is better than "new": the existing component that gets a variant instead
    votes = models.PositiveIntegerField(default=1)  # how many times it was asked for (merged requests)
    designs = models.JSONField(default=list, blank=True)  # [{"design": id, "site": domain}] the designs that wait for it
    sites = models.JSONField(default=list, blank=True)  # the domains that asked
    note = models.TextField(blank=True)  # the judgement
    built_tag = models.CharField(max_length=60, blank=True)  # the type of the component when it is built (ui-...)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    remote_id = models.CharField(max_length=40, blank=True)  # the id of the request on the easy2edit server (when it was sent there)
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-votes", "-created"]


class Tag(models.Model):
    """A tag with a colour that can be put on any part of easy2edit (users, groups, entities, pages, media, modules, plugins and what plugins make). Its scope decides what it may be put on:
    global (everything), module (the parts of one or more modules) or plugin (the parts of one or more plugins)."""

    SCOPES = [("global", "Overal"), ("module", "Modules"), ("plugin", "Plugins")]

    name = models.CharField(max_length=60, unique=True)
    color = models.CharField(max_length=7, default="#2563eb")  # #rrggbb
    description = models.CharField(max_length=200, blank=True)
    scope = models.CharField(max_length=10, choices=SCOPES, default="global")
    modules = models.JSONField(default=list, blank=True)  # module keys, when the scope is "module"
    plugins = models.JSONField(default=list, blank=True)  # plugin names, when the scope is "plugin"
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]


class TagLink(models.Model):
    """A tag on one thing: kind says what (user, group, entity, page, media, module, plugin, or plugin:<name>:<type> for what a plugin makes), ref which one."""

    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="links")
    kind = models.CharField(max_length=60)
    ref = models.CharField(max_length=120)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["tag", "kind", "ref"], name="one_tag_per_thing")]
        indexes = [models.Index(fields=["kind", "ref"])]
