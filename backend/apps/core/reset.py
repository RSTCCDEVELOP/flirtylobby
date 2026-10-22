"""Back to a clean system ("reset"): everything that belongs to one website goes, the installation itself stays.

GOES:   every user except the superadmins (with photos, profiles, messages, chats, orders ...), the media library and its files, pages and their blocks,
        the texts edited on the website, the data of the plugins (the plugins stay installed, switched off), theme packages of the site, imported sites, system objects, products/orders,
        subscriptions and donations, notifications, dashboards, logos and home photos.
STAYS:  the superadmins, the languages, the settings of the installation (names, addresses, security, mail, API keys, roles) and the built-in themes.
THEN:   all modules off (only the core ones stay: users, dashboard, security, module management), all plugins off, the theme becomes Easy2edit and the licence is emptied.
"""
import logging
import shutil
from pathlib import Path

from django.core.files.storage import default_storage
from django.db import transaction

logger = logging.getLogger(__name__)

# models (app_label.Model) of which every row goes
WIPE = [
    "core.ContentBlock", "core.DashboardLayout", "core.ThemeImportJob", "core.UserShortcuts", "core.UserPrefs",
    "accounts.PendingRegistration", "accounts.Invitation", "notifications.Notification", "notifications.NotificationPref", "accounts.UserGroup", "accounts.ModuleGrant",
    "branding.SiteAsset", "branding.HomePhoto", "seo.SeoPage",
    "sandbox.SandboxMessage", "sandbox.SandboxPayment", "plugin_orders.OrderItem", "plugin_orders.Order",
    "social.DirectMessage", "social.ChatMessage", "social.ChatSignal", "social.Like", "social.Favorite", "social.ProfileVisit", "social.Connection",
    "social.DirectRoom", "social.DirectSignal", "social.Pass", "social.ProfileAllow", "social.Block", "social.Notification",
    "subscriptions.Subscription", "subscriptions.Plan", "subscriptions.Donation", "subscriptions.DonationCampaign", "subscriptions.DonorAction", "subscriptions.ActionItem",
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


def clear_license():
    """Empty the licence: number, client, end date and price. The reseller data stays (it says where a new licence can be bought)."""
    from .models import License
    from . import system

    License.objects.filter(pk=1).update(number="", client="", client_address="", valid_until=None, price=0, payment_ref="", issued_at=None)
    system.license_changed()


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
    try:  # the demo data first, the careful way (also its pictures and the rows of plugins)
        from apps.core import demo

        removed["demo"] = sum(v for v in demo.remove().values() if isinstance(v, int))
    except Exception:  # noqa: BLE001 - the reset below clears everything anyway
        logger.exception("Reset: demo data could not be removed one by one")
    files = _files_of_removed()
    gone_users = list(User.objects.filter(is_staff=False).values_list("pk", flat=True))

    from django.db import connection

    with transaction.atomic():
        # plugins: their data goes (it belongs to users and products that are removed) but the plugins themselves stay installed, switched off
        with connection.cursor() as cur:
            for pl in Plugin.objects.all():
                prefix = "plg_" + pl.name.replace("-", "_") + "_"
                for tb in [x for x in connection.introspection.table_names() if x.startswith(prefix)]:
                    cur.execute(f'DELETE FROM "{tb}"')
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
        clear_license()  # a clean system has no licence either

    # plugins: all switched off (they stay installed; their files of data are cleared) and the theme packages of the site (their folders)
    from apps.plugins import runtime

    for p in list(Plugin.objects.all()):
        try:
            runtime.unload(p.name)
            shutil.rmtree(installer.root() / ".data" / p.name, ignore_errors=True)
            Plugin.objects.filter(pk=p.pk).update(enabled=False, error="")
        except Exception:  # noqa: BLE001
            logger.exception("Reset: plugin %s could not be switched off completely", p.name)
    for key in list(ThemePack.objects.values_list("key", flat=True)):
        themepacks.remove(key)
    for d in Path(themepacks.root()).glob("*/theme.json") if themepacks.root().exists() else []:
        if d.parent.name not in themepacks.BUILTIN_KEYS():  # a folder of a package that was not registered (yet)
            themepacks.remove(d.parent.name)

    # what is left on the disk of the library: the folders of imported sites, the old image folders and the folders of the removed users
    from django.conf import settings

    media = Path(settings.MEDIA_ROOT)
    for sub in ("themes", "images", "videos", "podcast", "library"):
        shutil.rmtree(media / sub, ignore_errors=True)
    for uid in gone_users:
        shutil.rmtree(media / "users" / str(uid), ignore_errors=True)

    try:  # no standard installation is in use any more and there is no demo data: forget both (the pages saved in installations and which ones administrators see stay)
        from apps.core.models import SystemSettings

        row = SystemSettings.objects.filter(pk=1).first()
        if row:
            row.data = {k: v for k, v in (row.data or {}).items() if k not in ("active_preset", "demo_presets", "demo_ids")}
            row.save()
    except Exception:  # noqa: BLE001
        logger.exception("Reset: the choice of the standard installation could not be cleared")

    try:  # a clean system starts with the default settings that were saved (when there are any)
        from apps.core import site_defaults

        site_defaults.apply()
    except Exception:  # noqa: BLE001
        logger.exception("Reset: the default settings could not be applied")

    pages_service.ensure_defaults()
    modules.invalidate()
    for name in dict.fromkeys(files):
        try:
            default_storage.delete(name)
        except Exception:  # noqa: BLE001
            pass
    logger.warning("System reset: %s", removed)
    return removed
