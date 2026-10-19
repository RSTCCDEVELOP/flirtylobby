"""Back to a clean system ("reset"): everything that belongs to one website goes, the installation itself stays.

GOES:   every user except the superadmins (with photos, profiles, messages, chats, orders ...), the media library and its files, pages and their blocks,
        the texts edited on the website, plugins (with their data and files), theme packages of the site, imported sites, system objects, products/orders,
        subscriptions and donations, notifications, dashboards, logos and home photos.
STAYS:  the superadmins, the languages, the settings of the installation (names, addresses, security, mail, API keys, roles) and the built-in themes.
THEN:   all modules off (the ones that are always on stay on), the theme becomes Easy2edit.
"""
import logging
from pathlib import Path

from django.core.files.storage import default_storage
from django.db import transaction

logger = logging.getLogger(__name__)

# models (app_label.Model) of which every row goes
WIPE = [
    "core.ContentBlock", "core.DashboardLayout", "core.ThemeImportJob", "core.UserShortcuts", "core.UserPrefs",
    "accounts.PendingRegistration", "accounts.UserGroup", "accounts.ModuleGrant",
    "branding.SiteAsset", "branding.HomePhoto", "seo.SeoPage",
    "sandbox.SandboxMessage", "sandbox.SandboxPayment", "shop.OrderItem", "shop.Order",
    "social.DirectMessage", "social.ChatMessage", "social.ChatSignal", "social.Like", "social.Favorite", "social.ProfileVisit", "social.Connection",
    "social.DirectRoom", "social.DirectSignal", "social.Pass", "social.ProfileAllow", "social.Block", "social.Notification",
    "subscriptions.Plan", "subscriptions.Subscription", "subscriptions.DonationCampaign", "subscriptions.Donation", "subscriptions.DonorAction", "subscriptions.ActionItem",
    "sysobjects.SystemObject", "siteimport.SiteImport", "security.LoginThrottle",
]


def _model(label):
    from django.apps import apps

    try:
        return apps.get_model(label)
    except LookupError:
        return None


def summary():
    """What a reset would remove, in numbers (for the confirmation window)."""
    from apps.accounts.models import User
    from apps.core.models import ThemePack
    from apps.medialib.models import MediaItem
    from apps.pages.models import Page
    from apps.plugins.models import Plugin

    return {"users": User.objects.filter(is_staff=False).count(), "superadmins": User.objects.filter(is_staff=True).count(), "media": MediaItem.objects.count(),
            "pages": Page.objects.exclude(kind="system").count(), "plugins": Plugin.objects.count(), "themes": ThemePack.objects.count()}


def _files_of_removed():
    """The files that go with the rows that are about to be deleted (collected first; the rows know where they are)."""
    from apps.accounts.models import User
    from apps.medialib.models import MediaItem

    keys = [m.key for m in MediaItem.objects.all() if getattr(m, "key", "")]
    fields = []
    for label, names in (("branding.SiteAsset", ("image",)), ("branding.HomePhoto", ("image",)), ("social.ProfilePhoto", ("image",))):
        mdl = _model(label)
        if mdl:
            for row in (mdl.objects.exclude(user__is_staff=True) if label == "social.ProfilePhoto" and hasattr(mdl, "user") else mdl.objects.all()):
                for n in names:
                    f = getattr(row, n, None)
                    if f and getattr(f, "name", ""):
                        fields.append(f.name)
    for u in User.objects.filter(is_staff=False):
        if getattr(u, "image", None) and u.image.name:
            fields.append(u.image.name)
    return keys + fields


def perform(keep=None):
    """Do the reset. Returns what was removed. keep = the superadmin who asks (stays in any case; all superadmins stay)."""
    from apps.accounts.models import User
    from apps.core import modules, themepacks
    from apps.core.models import ModuleState, SiteSettings, ThemePack
    from apps.pages import service as pages_service
    from apps.pages.models import Page, PageLayout
    from apps.plugins import installer
    from apps.plugins.models import Plugin

    removed = dict(summary())
    files = _files_of_removed()
    gone_users = list(User.objects.filter(is_staff=False).values_list("pk", flat=True))

    with transaction.atomic():
        for label in WIPE:
            mdl = _model(label)
            if mdl:
                mdl.objects.all().delete()
        # users of the site go (their photos, profiles, messages ... follow); the superadmins stay
        User.objects.filter(is_staff=False).delete()
        # pages and blocks; the built-in pages come back as they were
        PageLayout.objects.all().delete()
        Page.objects.all().delete()
        # the library
        from apps.medialib.models import FileKey, MediaItem

        MediaItem.objects.all().delete()
        FileKey.objects.exclude(scope__in=[f"user:{u.pk}" for u in User.objects.filter(is_staff=True)]).delete()
        # modules: all off, except the ones that are always on (users, dashboard, security, modules)
        ModuleState.objects.all().delete()
        for m in modules.MODULES:
            if not m.get("core"):
                ModuleState.objects.create(key=m["key"], enabled=False)
        # look: the default (Easy2edit)
        SiteSettings.objects.update_or_create(pk=1, defaults={"theme": {}})

    # plugins (with their data and files) and the theme packages of the site (their folders)
    from django.db import connection

    from apps.plugins import runtime

    for p in list(Plugin.objects.all()):
        try:
            runtime.unload(p.name)
            installer.remove(p)
            prefix = "plg_" + p.name.replace("-", "_") + "_"  # the tables of the plugin go as well
            with connection.cursor() as cur:
                for t in [t for t in connection.introspection.table_names() if t.startswith(prefix)]:
                    cur.execute(f'DROP TABLE IF EXISTS "{t}"')
        except Exception:  # noqa: BLE001
            logger.exception("Reset: plugin %s could not be removed completely", p.name)
    for key in list(ThemePack.objects.values_list("key", flat=True)):
        themepacks.remove(key)
    for d in Path(themepacks.root()).glob("*/theme.json") if themepacks.root().exists() else []:
        if d.parent.name not in themepacks.BUILTIN_KEYS():  # a folder of a package that was not registered (yet)
            themepacks.remove(d.parent.name)

    # what is left on the disk of the library: the folders of imported sites, the old image folders and the folders of the removed users
    import shutil

    from django.conf import settings

    media = Path(settings.MEDIA_ROOT)
    for sub in ("themes", "images", "videos", "podcast", "library"):
        shutil.rmtree(media / sub, ignore_errors=True)
    for uid in gone_users:
        shutil.rmtree(media / "users" / str(uid), ignore_errors=True)

    pages_service.ensure_defaults()
    modules.invalidate()
    for name in dict.fromkeys(files):
        try:
            default_storage.delete(name)
        except Exception:  # noqa: BLE001
            pass
    logger.warning("System reset: %s", removed)
    return removed
