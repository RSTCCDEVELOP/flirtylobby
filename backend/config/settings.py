import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/ (Docker: /app/backend)
PROJECT_ROOT = BASE_DIR.parent  # Docker: /app

# ── System and site apart ───────────────────────────────────────────────────
# The SYSTEM is backend/ + frontend/ (updated as a whole, never holds anything of one website).
# Everything of ONE website lives in SITE_DIR (default <project-root>/site): Database/, media/, plugins/, themes/, content/.
# An update of the system never touches SITE_DIR. A path can still be set one by one (DB_PATH, MEDIA_ROOT, PLUGINS_DIR, THEMES_DIR);
# an installation from before this layout keeps working: when site/<x> does not exist yet but the old place does, the old place is used.
SITE_DIR = Path(os.getenv("SITE_DIR") or PROJECT_ROOT / "site")


def _site_path(name, legacy):
    new = SITE_DIR / name
    def filled(d):
        return d.is_dir() and any(not x.name.startswith(".") for x in d.iterdir())
    if new.exists() and (filled(new) or not filled(legacy)):  # an empty site folder (made by a visit) must not hide the folder that holds the real content
        return new
    return new if not legacy.exists() else legacy

load_dotenv(BASE_DIR / ".env")


def env_list(name, default=""):
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "insecure-dev-key")
DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() == "true"
if not DEBUG and (SECRET_KEY in ("insecure-dev-key", "change-me") or len(SECRET_KEY) < 32):  # production: the secret signs logins, files and passkey sessions
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured("DJANGO_SECRET_KEY is not set or too weak (min. 32 characters). Set a long random value in the environment.")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "apps.core",
    "apps.accounts",
    "apps.members",
    "apps.integrations",
    "apps.branding",
    "apps.security",
    "apps.medialib",
    "apps.communication",
    "apps.seo",
    "apps.sandbox",
    "apps.social",
    "apps.plugins",
    "apps.pages",
    "apps.siteimport",
    "apps.subscriptions",
    "apps.sysobjects",
    "apps.faq",
    "apps.notifications",
    "apps.backups",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.SiteTimezoneMiddleware",
    "apps.core.middleware.MaintenanceMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# ── Database ────────────────────────────────────────────────────────────────
# SQLite lives in <project-root>/Database/db.sqlite3 for local runs AND Docker
# (/app/Database/db.sqlite3). Override with DB_PATH if needed.
if os.getenv("DB_ENGINE", "sqlite") == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "app"),
            "USER": os.getenv("POSTGRES_USER", "app"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "db"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }
else:
    DB_PATH = Path(os.getenv("DB_PATH") or _site_path("Database", PROJECT_ROOT / "Database") / "db.sqlite3")
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": DB_PATH}}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "apps.security.validators.ConfiguredPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "nl"
TIME_ZONE = "Europe/Amsterdam"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = Path(os.getenv("STATIC_ROOT") or BASE_DIR / "staticfiles")
STORAGES = {
    # files are registered in the media library; each lives on local disk or S3 (see apps/medialib)
    "default": {"BACKEND": "apps.medialib.storage.LibraryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT") or _site_path("media", BASE_DIR / "media"))
_VERSION_FILE = next((f for f in (BASE_DIR / "VERSION", PROJECT_ROOT / "VERSION") if f.is_file()), None)  # backend/VERSION: it is inside the Docker image too
SYSTEM_VERSION = _VERSION_FILE.read_text().strip() if _VERSION_FILE else "0.0.0"  # the version of this system; plugins are built for one
_BUILD_FILE = BASE_DIR / "BUILD"  # the build number: goes up by one with every push to GitHub (see CONTENT/github_repo_list.txt)
SYSTEM_BUILD = int(_BUILD_FILE.read_text().strip() or 0) if _BUILD_FILE.is_file() and _BUILD_FILE.read_text().strip().isdigit() else 0
PLUGINS_DIR = Path(os.getenv("PLUGINS_DIR") or _site_path("plugins", PROJECT_ROOT / "plugins"))  # the plugins of this site: developed or uploaded here (not in the system repository)
THEMES_DIR = Path(os.getenv("THEMES_DIR") or _site_path("themes", PROJECT_ROOT / "themes"))  # the theme packages of this site: one folder per theme with a theme.json
THEMES_DIST_DIR = Path(os.getenv("THEMES_DIST_DIR") or PROJECT_ROOT / "themes" / ".dist")  # the exported zips of themes (<dir>/themes) and languages (<dir>/languages), in the project folder (git-ignored)
BACKUPS_DIR = Path(os.getenv("BACKUPS_DIR") or PROJECT_ROOT / "backups")  # the backup files (Admin -> Backup); not part of the repository

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.security.authentication.ExpiringTokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}

# ── CORS / CSRF ─────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

if DEBUG:
    # development only: also reachable from phones / other computers on the local network (10.x, 192.168.x, 172.16-31.x)
    ALLOWED_HOSTS = ["*"]
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^https?://(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|localhost|127\.0\.0\.1|([a-z0-9-]+\.)+easy2edit\.com):5173$"]  # also https (./dev-certs.sh) and a local test domain such as siten.easy2edit.com
else:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ── Logging ─────────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"std": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "filters": {"quiet_polls": {"()": "config.logfilters.QuietPolls"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "std", "filters": ["quiet_polls"]}},
    "loggers": {"django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False}},  # with the filter that leaves out the polling addresses (and without Django's own second line)
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
}
