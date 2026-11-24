# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Back to a clean system ("reset"): everything that belongs to one website goes, the installation itself stays.

GOES:   every user except the superadmins (with photos, profiles, messages, chats, orders ...), the media library and its files, pages and their blocks,
        the texts edited on the website, the data of the plugins (the plugins stay installed, switched off), theme packages of the site, imported sites, system objects, products/orders,
        subscriptions and donations, notifications, dashboards, logos and home photos.
STAYS:  the standard superadmin (ADMIN_EMAIL / ADMIN_PASSWORD from the environment; it is made again with that password and every other superadmin goes; without those settings all superadmins stay), the languages, the settings of the installation (names, addresses, security, mail, API keys, roles) and the built-in themes.
THEN:   all modules off (only the core ones stay: users, dashboard, security, module management), all plugins off, the theme becomes easy2edit and the licence is emptied.
"""
import logging
import shutil
from pathlib import Path

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# tables of parts that became plugins (the plugin renames them to plg_<name>_* when it starts): a reset empties them too
LEGACY_TABLES = ("social_", "subscriptions_", "shop_", "stats_", "seo_", "siteimport_", "faq_faqentry")

# models (app_label.Model) of which every row goes
WIPE = [
    "core.ContentBlock", "core.SiteDesignJob", "core.DashboardLayout", "core.ThemeImportJob", "core.UserShortcuts", "core.UserPrefs",
    "accounts.PendingRegistration", "accounts.Invitation", "notifications.Notification", "notifications.NotificationPref", "accounts.UserGroup", "accounts.ModuleGrant",
    "branding.SiteAsset", "branding.HomePhoto", "plugin_seo.SeoPage",
    "sandbox.SandboxMessage", "sandbox.SandboxPayment", "plugin_orders.OrderItem", "plugin_orders.Order",
    "social.DirectMessage", "social.ChatMessage", "social.ChatSignal", "social.Like", "social.Favorite", "social.ProfileVisit", "social.Connection",
    "social.DirectRoom", "social.DirectSignal", "social.Pass", "social.ProfileAllow", "social.Block", "social.Notification",
    "subscriptions.Subscription", "subscriptions.Plan", "subscriptions.Donation", "subscriptions.DonationCampaign", "subscriptions.DonorAction", "subscriptions.ActionItem",
    "sysobjects.SystemObject", "plugin_siteimport.SiteImport", "security.LoginThrottle",
]


# The identity of the website that was on this system: name, tab title, company and contact details, address, social links and the logo link. After a reset they are gone: the name is easy2edit again.
# (The technical settings of the installation stay: addresses of the servers, security, e-mail, API keys, sizes, time zone.)
IDENTITY_KEYS = ("site_name", "tab_title", "tagline", "company_name", "footer_text", "kvk", "vat_id", "contact_email", "support_email", "phone", "address", "street", "house_number", "postal_code",
                 "city", "country", "social_instagram", "social_facebook", "social_x", "social_linkedin", "social_youtube", "social_tiktok", "footer_logo_height", "footer_logo_link", "installation_name",
                 "maintenance_message", "maintenance_messages")


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

    ai = {}
    try:  # the AI data of the database: calls, credit (of the users who stay: the superadmins) and the history of the credit
        from django.db.models import Sum

        from apps.integrations.models import AiAccount, AiLedger, AiTopup, AiUsage

        ai = {"ai_calls": AiUsage.objects.count(), "ai_ledger": AiLedger.objects.count() + AiTopup.objects.count(), "ai_credit": float(AiAccount.objects.filter(user__is_staff=False).aggregate(v=Sum("balance"))["v"] or 0)}
    except Exception:  # noqa: BLE001
        ai = {"ai_calls": 0, "ai_ledger": 0, "ai_credit": 0}
    designs = imports = 0
    try:  # the designs of the website designer and the imported websites
        designs = _model("core.SiteDesignJob").objects.count()
        m = _model("plugin_siteimport.SiteImport")
        imports = m.objects.count() if m else 0
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import siteowners

        remote_owner = siteowners.has_remote()
    except Exception:  # noqa: BLE001
        remote_owner = False
    return {**ai, "remote_owner": remote_owner, "designs": designs, "imports": imports, "users": User.objects.filter(is_staff=False).count(), "admins": len(_admin_ids()), "superadmins": User.objects.filter(is_staff=True).count(), "other_superadmins": User.objects.filter(is_staff=True).exclude(email__iexact=standard_email() or "-").count(), "standard_admin": standard_email(), "media": MediaItem.objects.count(),
            "pages": Page.objects.exclude(kind="system").count(), "plugins": Plugin.objects.count(), "themes": ThemePack.objects.count()}


def _admin_ids():
    """The administrators: users who are not superadmins but have a role (direct or through a group) or a module grant of their own."""
    from apps.accounts.models import ModuleGrant, User

    ids = set(User.objects.filter(is_staff=False, roles__isnull=False).values_list("pk", flat=True))
    try:
        ids |= set(User.objects.filter(is_staff=False, user_groups__roles__isnull=False).values_list("pk", flat=True))
        ids |= set(ModuleGrant.objects.filter(user__isnull=False, user__is_staff=False).values_list("user_id", flat=True))
    except Exception:  # noqa: BLE001
        pass
    return ids


def _files_of_removed(keep_ids=()):
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
    for u in User.objects.filter(is_staff=False).exclude(pk__in=list(keep_ids)):
        if getattr(u, "image", None) and u.image.name:
            fields.append(u.image.name)
    return keys + fields


def clear_license():
    """Empty the licence: number, client, end date and price. The reseller data stays (it says where a new licence can be bought)."""
    from .models import License
    from . import system

    License.objects.filter(pk=1).update(number="", client="", client_address="", valid_until=None, price=0, payment_ref="", issued_at=None)
    system.license_changed()


def stored_admin():
    """The standard superadmin set in Super admin (kept with the system settings): {email, name, password_hash}, or None (then ADMIN_EMAIL / ADMIN_PASSWORD of the environment count)."""
    from .models import SystemSettings

    d = (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get("standard_admin")
    return d if isinstance(d, dict) and d.get("email") and d.get("password_hash") else None


def standard_email():
    st = stored_admin()
    if st:
        return st["email"]
    import os

    return (os.getenv("ADMIN_EMAIL") or "").strip().lower() if os.getenv("ADMIN_PASSWORD") else ""


def standard_admin(others="deactivate"):
    """Make the standard superadmin of the installation (ADMIN_EMAIL / ADMIN_PASSWORD) with that password. The other superadmins: others="deactivate" (they can no longer log in; the default), "delete" or "keep". Returns the e-mail address, or "" when it is not set."""
    import os

    from apps.accounts.models import User

    st = stored_admin()
    email, password = (st["email"], "") if st else ((os.getenv("ADMIN_EMAIL") or "").strip().lower(), os.getenv("ADMIN_PASSWORD") or "")
    if not email or not (password or st):
        return ""
    user = User.objects.filter(email__iexact=email).first() or User(username=email, email=email)
    user.is_staff = user.is_superuser = user.is_active = True
    if st:  # the standard superadmin that was set in Super admin: the stored password (a hash) and name
        user.password = st["password_hash"]
        if st.get("name"):
            user.display_name = st["name"]
            user.first_name, _s, user.last_name = st["name"].partition(" ")
    else:
        user.set_password(password)
    user.twofa_method, user.totp_secret, user.totp_last_step = "", "", 0  # the standard admin can always log in with the password
    user.save()
    from apps.accounts import superplus

    superplus.ensure()
    if others == "delete":
        User.objects.filter(is_staff=True, is_superadmin_plus=False).exclude(pk=user.pk).delete()  # a superadmin+ stays
    elif others != "keep":
        User.objects.filter(is_staff=True, is_superadmin_plus=False).exclude(pk=user.pk).update(is_active=False)  # the other superadmins are switched off: they can no longer log in (they can be switched on again by the standard superadmin)
    from django.core.cache import cache
    from rest_framework.authtoken.models import Token

    Token.objects.all().delete()  # everybody is logged out, also the one who did the reset
    cache.clear()  # login throttles and lockouts
    return email


# What stays in the site folder (<project>/site) at a reset: the database, the back-ups, the settings and exports of the superadmin (content), the installed plugins and the notes. Everything else goes.
SITE_KEEP = {"Database", "backups", "content", "plugins", "themes", "media", "README.md"}  # (themes and media are cleaned apart, carefully)


def _empty(path, keep=()):
    """Remove what is in a folder (the folder itself stays). Returns the number of items removed. Never outside a real folder: a link or a path that is too short is left alone."""
    from pathlib import Path as _P

    d = _P(path)
    try:
        if d.is_symlink() or not d.is_dir() or len(d.resolve().parts) < 4:
            return 0
        n = 0
        for child in d.iterdir():
            if child.name in keep or child.name.startswith("."):
                continue
            if child.is_dir() and not child.is_symlink():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)
            n += 1
        return n
    except OSError:
        logger.exception("Reset: %s could not be cleaned completely", path)
        return 0


def clean_site_folder(keep_user_ids=()):
    """The site folder after a reset: back-ups, database, settings and plugins stay; the exports of pages (pages, public, private), imports, templates that were added, installed component sets
    (the standard one comes back), the packages of themes that were made and what is left in the media folder go. The media of the users who stay (superadmins, and the administrators who stay) is kept."""
    from django.conf import settings

    from . import componentpacks

    removed = 0
    site = settings.SITE_DIR
    if site.is_dir():
        for child in list(site.iterdir()):
            if child.name in SITE_KEEP or child.name.startswith(".") or child.is_symlink():
                continue
            if child.is_dir():
                removed += _empty(child)  # (the folder itself stays: it is a place that the system writes to)
            else:
                child.unlink(missing_ok=True)
                removed += 1
    for d in (settings.SITE_IMPORT_DIR, settings.TEMPLATES_DIR, settings.COMPONENTS_DIR):  # (these may be set to other places than the site folder)
        removed += _empty(d)
    for z in (settings.THEMES_DIR.glob("*.zip") if settings.THEMES_DIR.is_dir() else []):  # the theme packages that were made (the folders of built-in themes that were changed stay)
        z.unlink(missing_ok=True)
        removed += 1
    media = settings.MEDIA_ROOT
    if media.is_dir():
        for child in media.iterdir():
            if child.name.startswith(".") or child.is_symlink():
                continue
            if child.name == "users" and child.is_dir():
                for u in child.iterdir():
                    if u.name not in {str(i) for i in keep_user_ids} and u.is_dir():
                        shutil.rmtree(u, ignore_errors=True)
                        removed += 1
                continue
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)
            removed += 1
    try:
        componentpacks.ensure_default()  # the standard component set is installed again
    except Exception:  # noqa: BLE001
        logger.exception("Reset: the standard component set could not be put back")
    return removed


def perform(keep=None, ai=False, delete_admins=False, delete_superadmins=False, keep_identity=False, remove_remote=False):
    """Do the reset. Returns what was removed. keep = the superadmin who asks. The administrators (users with a role) and the other superadmins stay, unless delete_admins / delete_superadmins is asked; the standard superadmin always stays."""
    from apps.accounts.models import User
    from apps.core import modules, themepacks
    from apps.core.models import ModuleState, SiteSettings, ThemePack
    from apps.pages import service as pages_service
    from apps.pages.models import Page, PageLayout
    from apps.plugins import installer
    from apps.plugins.models import Plugin

    removed = dict(summary())
    if ai:  # asked: the AI data goes too (every call with its costs, the credit and its history); the settings (prices, margins, links) stay
        try:
            from apps.integrations.models import AiAccount, AiLedger, AiTopup, AiUsage

            AiLedger.objects.all().delete()
            AiTopup.objects.all().delete()
            AiAccount.objects.all().delete()
            AiUsage.objects.all().delete()
            removed["ai_removed"] = True
        except Exception:  # noqa: BLE001
            logger.exception("Reset: the AI data could not be removed")
    try:  # the demo data first, the careful way (also its pictures and the rows of plugins)
        from apps.core import demo

        removed["demo"] = sum(v for v in demo.remove().values() if isinstance(v, int))
    except Exception:  # noqa: BLE001 - the reset below clears everything anyway
        logger.exception("Reset: demo data could not be removed one by one")
    keep_ids = set() if delete_admins else _admin_ids()  # the administrators stay (without their content) unless they are to be removed too
    remote = {}
    if remove_remote:  # asked: the owner and the company of this website are also removed from the easy2edit master site (first: the local ids are needed for it)
        from . import siteowners

        remote = siteowners.remove_remote()
    if keep_identity:  # asked: the licence, the entities and all users stay (with the links between them); their content (messages, files) goes like the rest
        keep_ids = set(User.objects.filter(is_staff=False).values_list("pk", flat=True))
    files = _files_of_removed(keep_ids)
    gone_users = list(User.objects.filter(is_staff=False).exclude(pk__in=list(keep_ids)).values_list("pk", flat=True))

    from django.db import connection

    with transaction.atomic():
        # plugins: their data goes (it belongs to users and products that are removed) but the plugins themselves stay installed, switched off
        with connection.cursor() as cur:
            for pl in Plugin.objects.all():
                prefix = "plg_" + pl.name.replace("-", "_") + "_"
                for tb in [x for x in connection.introspection.table_names() if x.startswith(prefix)]:
                    cur.execute(f'DELETE FROM "{tb}"')
            # the tables of parts that were built into the system before and are plugins now (social_*, subscriptions_*, shop_*, stats_*, seo_*, siteimport_*, faq_faqentry): the plugin renames them
            # (plg_<name>_*) only when it starts, so for a plugin that never ran they are still there, with their data
            from django.apps import apps as django_apps

            live = {m._meta.db_table for m in django_apps.get_models()}
            for tb in [x for x in connection.introspection.table_names() if x.startswith(LEGACY_TABLES) and x not in live]:
                cur.execute(f'DELETE FROM "{tb}"')
        for label in WIPE:
            mdl = _model(label)
            if mdl:
                mdl.objects.all().delete()
        # users of the site go (their photos, profiles, messages ... follow); the superadmins stay
        User.objects.filter(is_staff=False).exclude(pk__in=list(keep_ids)).delete()
        removed["admin"] = standard_admin("delete" if delete_superadmins else "keep")  # the standard superadmin is made again; the other superadmins stay or go
        from apps.accounts import superplus as _sp

        removed["recovery_admin"] = _sp.ensure_recovery()  # no superadmin left at all: the recovery superadmin (stored encrypted) is made
        removed["kept_admins"] = len(keep_ids)
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
                ModuleState.objects.create(key=m["key"], enabled=m["key"] in modules.ALWAYS_ON)  # (the base stays on: system, plugins, storage, backups and the API keys, of which the links of the superadmin keep working)
        # look: the default (easy2edit)
        SiteSettings.objects.update_or_create(pk=1, defaults={"theme": {"default_mode": "light"}})  # the standard theme, starting in light mode
        from .models import UserPrefs

        for up in UserPrefs.objects.all():  # the light or dark choice of the people is cleared too: everybody starts in light mode again
            if "theme" in (up.data or {}):
                up.data = {k: v for k, v in up.data.items() if k != "theme"}
                up.save(update_fields=["data"])
        from apps.pages.models import MenuSettings

        MenuSettings.objects.all().delete()  # the look of the header menu (colours, size, form) goes back to the default too: an imported site leaves its own header colours there
        if not keep_identity:
            from .models import Entity

            Entity.objects.all().delete()  # the entities (the organisation behind the site, customers ...) go with the rest; their users went above
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
    from . import presets as _presets

    for name in _presets.DEFAULT_PLUGINS:  # Website ontwerpen stays on: it is how a new website gets its pages (the plugin has no data of its own that was kept: imports are cleared above)
        Plugin.objects.filter(name=name).update(enabled=True, error="")
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

    try:  # no standard installation is in use any more and there is no demo data: forget both (which installations administrators see stay; the pages saved in installations go too)
        from apps.core.models import SystemSettings

        row = SystemSettings.objects.filter(pk=1).first()
        if row:
            row.data = {k: v for k, v in (row.data or {}).items() if k not in ("active_preset", "demo_presets", "demo_ids", "welcome_asked", "entity_contact_done", "onboarding_complete", "onboarding_started", "preset_pages", "applied_templates", *IDENTITY_KEYS)}  # (also the pages that were saved in an installation: custom pages are gone after a reset and are no part of an installation)
            row.data["preset_edits"] = {pk: {ek: ev for ek, ev in (pv or {}).items() if ek != "pages"} for pk, pv in (row.data.get("preset_edits") or {}).items() if isinstance(pv, dict)}  # (the pages that were added to or taken out of an installation)  # also the name and the details of the website that was here: it is easy2edit again
            from . import sysupdate

            row.data["checked_build"] = sysupdate.build()  # a cleared site holds nothing from an older build: no "new version, check your site" question during the onboarding
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
    try:
        from .presets import bump_epoch

        bump_epoch()  # a new start: the left menu is open again in every browser
    except Exception:  # noqa: BLE001
        logger.exception("Reset: ui_epoch could not be set")
    for name in dict.fromkeys(files):
        try:
            default_storage.delete(name)
        except Exception:  # noqa: BLE001
            pass
    from apps.accounts.models import User as _U

    if remove_remote:
        removed["remote"] = remote  # {ok, error}: whether the owner and the company are gone from the easy2edit master site
    removed["site_folder"] = clean_site_folder([u.pk for u in _U.objects.filter(is_staff=True)] + list(keep_ids))  # the site folder: only back-ups, database, settings and plugins stay
    logger.warning("System reset: %s", removed)
    return removed


# ── the standard superadmin as an encrypted file ──────────────────────────────────────────────────────────────────────
FILE_FORMAT, FILE_ITER = "easy2edit-config", 600_000


def _key(password, salt, iterations):
    import base64

    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

    return base64.urlsafe_b64encode(PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations).derive(password.encode()))


def export_file(password):
    """The standard superadmin (name, e-mail, password hash) as an encrypted config file, locked with the password of that account: a dict that goes into a .json file."""
    import base64
    import json
    import os

    from cryptography.fernet import Fernet
    from django.contrib.auth.hashers import check_password

    st = stored_admin()
    if not st or not check_password(password, st["password_hash"]):
        raise ValueError("Het wachtwoord van de standaard superadmin klopt niet.")
    salt = os.urandom(16)
    token = Fernet(_key(password, salt, FILE_ITER)).encrypt(json.dumps({"standard_admin": st}).encode())
    return {"format": FILE_FORMAT, "version": 1, "kdf": "pbkdf2-sha256", "iterations": FILE_ITER, "salt": base64.b64encode(salt).decode(), "data": token.decode()}


def read_file(doc, password):
    """The settings in an encrypted config file ({standard_admin: {...}}), opened with the password of that account. Raises ValueError for a wrong file or password."""
    import base64
    import json

    from cryptography.fernet import Fernet, InvalidToken

    try:
        if doc.get("format") != FILE_FORMAT or int(doc.get("iterations", 0)) < 100_000:
            raise ValueError
        key = _key(password, base64.b64decode(doc["salt"]), int(doc["iterations"]))
        data = json.loads(Fernet(key).decrypt(str(doc["data"]).encode()))
    except InvalidToken:
        raise ValueError("Het wachtwoord past niet bij dit bestand.")
    except (ValueError, KeyError, TypeError, AttributeError):
        raise ValueError("Dit is geen geldig configuratiebestand van easy2edit.")
    st = data.get("standard_admin") if isinstance(data, dict) else None
    if not isinstance(st, dict) or not st.get("email") or not st.get("password_hash"):
        raise ValueError("Het bestand bevat geen standaard superadmin.")
    return st


# ── the onboarding again (the switch "Onboarding" of the reset screen): nothing is removed ─────────────────────────────────────────────────────────
REPLAY_KEY = "onboarding_replay"
FIRST_RUN_KEYS = ("welcome_asked", "sandbox_asked", "manual_asked")  # the first questions after the installation (language and light or dark, sandbox, manual)


def replay_pending():
    from .models import SystemSettings

    return bool((SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(REPLAY_KEY))


def replay_since():
    """When the onboarding was started again (a datetime), or None."""
    from .models import SystemSettings

    v = (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(REPLAY_KEY)
    if not v:
        return None
    from django.utils.dateparse import parse_datetime

    return parse_datetime(v) if isinstance(v, str) else timezone.now()


REPLAY_FORM_KEY = "onboarding_form_done"  # the set-up form (the licence screens) was saved during the onboarding


def replay_form_done():
    from .models import SystemSettings

    return bool((SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(REPLAY_FORM_KEY))


def mark_form_done():
    """The set-up form was saved: it does not open again, but the onboarding goes on (installation, then the design wizard as the last step)."""
    from .models import SystemSettings

    row = SystemSettings.objects.filter(pk=1).first()
    if row and (row.data or {}).get(REPLAY_KEY):
        row.data = {**row.data, REPLAY_FORM_KEY: True}
        row.save()


def clear_replay():
    """The onboarding is done (the last step, the design wizard, starts)."""
    from .models import SystemSettings

    row = SystemSettings.objects.filter(pk=1).first()
    if row and ((row.data or {}).get(REPLAY_KEY) or (row.data or {}).get(REPLAY_FORM_KEY)):
        row.data = {k: v for k, v in row.data.items() if k not in (REPLAY_KEY, REPLAY_FORM_KEY)}
        row.save()


def replay_onboarding():
    """Do the onboarding again at the next login of an administrator or superadmin: the first questions come again (welcome, sandbox, manual) and the set-up form opens, filled with what is there
    (only a check). All data stays: no user, page, setting, licence or installation is removed or overwritten. What is missing is made, so the system is complete: a standard superadmin when there is
    no superadmin at all, and the entity of the website with its contact person (as a user) from the basic data when the entity is not set up yet. Returns what was done."""
    from apps.accounts.models import User

    from . import entity, system
    from .models import SystemSettings

    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**{k: v for k, v in (row.data or {}).items() if k not in (*FIRST_RUN_KEYS, REPLAY_FORM_KEY, "onboarding_complete")}, REPLAY_KEY: timezone.now().isoformat()}  # (the moment it started: the terms must be signed again after it)
    row.save()
    out = {"admin_made": "", "entity": False, "user": ""}
    try:  # the explanation of the AI credit comes again (only the flag of "shown": no credit, no history, no setting is changed)
        from apps.integrations.models import AiAccount

        AiAccount.objects.update(welcomed=False)
    except Exception:  # noqa: BLE001
        logger.exception("Replay: the AI welcome could not be set again")
    if not User.objects.filter(is_staff=True).exists():
        out["admin_made"] = standard_admin("keep")
    from . import everyone

    everyone.ensure()  # the standard group "Everyone" with all users in it
    row.refresh_from_db()
    row.data = {k: v for k, v in (row.data or {}).items() if k != entity.CONTACT_KEY}  # (the contact person is checked again: made when he is missing)
    row.save()
    made = entity.sync_from_system(system.get())
    if not made["entity"] and not made["user"]:
        made = entity.ensure_from_licence()  # (the licence makes it when the basic data have no company)
    out["entity"], out["user"] = made["entity"], made["user"]
    return out
