"""
Basic data of the installation ("Systeem -> Basisgegevens"): site name, the addresses of the website (frontend) and the API (backend),
contact data. Server settings (secret key, database, hosts) live in the environment: they are shown here as a checklist and can be
generated as a ready-made .env / Coolify list from the addresses entered here.
"""
import os
import re
from urllib.parse import urlparse

from django.conf import settings

from .models import SystemSettings

DEFAULTS = {
    "site_name": "", "tagline": "", "company_name": "", "environment": "production",
    "frontend_url": "", "backend_url": "", "extra_origins": [],
    "contact_email": "", "support_email": "", "phone": "", "kvk": "", "vat_id": "",
}
ENVIRONMENTS = ["production", "staging", "development"]
URL_RE = re.compile(r"^https?://[A-Za-z0-9.\-]+(:\d{2,5})?$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get():
    stored = SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    return {**DEFAULTS, **{k: v for k, v in stored.items() if k in DEFAULTS}}


def origin(url):
    """https://example.com/path -> https://example.com (what browsers send as Origin)."""
    u = urlparse(url or "")
    return f"{u.scheme}://{u.netloc}" if u.scheme and u.netloc else ""


def clean(incoming):
    out, errors = {}, {}
    for k, default in DEFAULTS.items():
        if k not in incoming:
            continue
        v = incoming[k]
        if k == "extra_origins":
            items = [str(x).strip().rstrip("/") for x in (v if isinstance(v, list) else str(v).split(",")) if str(x).strip()]
            bad = [x for x in items if not URL_RE.match(x)]
            if bad:
                errors[k] = f"Ongeldig adres: {bad[0]} (gebruik bv. https://www.voorbeeld.nl, zonder pad)."
            out[k] = items[:20]
        elif k in ("frontend_url", "backend_url"):
            v = str(v or "").strip().rstrip("/")
            if v and not URL_RE.match(v):
                errors[k] = "Gebruik een adres als https://www.voorbeeld.nl (zonder pad of slash erachter)."
            out[k] = v
        elif k in ("contact_email", "support_email"):
            v = str(v or "").strip()
            if v and not EMAIL_RE.match(v):
                errors[k] = "Dit is geen geldig e-mailadres."
            out[k] = v
        elif k == "environment":
            out[k] = v if v in ENVIRONMENTS else "production"
        else:
            out[k] = str(v or "").strip()[:200]
    return out, errors


def save(cleaned):
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    old = get()
    obj.data = {**(obj.data or {}), **cleaned}
    obj.save()
    _sync_seo(old, get())
    return get()


def _sync_seo(old, new):
    """The site name and address are also what SEO, sitemap and e-mails use: keep those in step (only what was still the old value)."""
    from apps.seo import service as seo

    cur = seo.raw()["site"]
    upd = {}
    if new["site_name"]:
        for k in ("name", "default_title"):
            if cur[k] in ("Studio2", old["site_name"], ""):
                upd[k] = new["site_name"]
        if cur["title_template"] in ("%s | Studio2", f"%s | {old['site_name']}", ""):
            upd["title_template"] = f"%s | {new['site_name']}"
    if new["frontend_url"] and cur["site_url"] in ("", old["frontend_url"]):
        upd["site_url"] = new["frontend_url"]
    if upd:
        seo.save({"site": upd})


def allowed_origins():
    s = get()
    return {o for o in [origin(s["frontend_url"]), *s["extra_origins"]] if o}


# ── checklist ────────────────────────────────────────────────────────────────
def _row(key, label, value, status, hint=""):
    return {"key": key, "label": label, "value": value, "status": status, "hint": hint}


def checks(request=None):
    s = get()
    prod = not settings.DEBUG
    fo, bo = origin(s["frontend_url"]), origin(s["backend_url"])
    rows = []
    secret = settings.SECRET_KEY
    weak = secret in ("insecure-dev-key", "change-me") or len(secret) < 32
    rows.append(_row("DJANGO_SECRET_KEY", "Geheime sleutel", "ingesteld" if not weak else "zwak of standaard", "bad" if weak and prod else "warn" if weak else "ok",
                     "Gebruik een lange willekeurige waarde (minstens 32 tekens) en bewaar die veilig."))
    rows.append(_row("DJANGO_DEBUG", "Debug-modus", "aan" if settings.DEBUG else "uit", "bad" if settings.DEBUG and s["environment"] == "production" else "ok",
                     "Zet DJANGO_DEBUG op False op een live website."))
    hosts = settings.ALLOWED_HOSTS
    host = urlparse(bo).hostname if bo else ""
    ok_host = "*" in hosts or not host or host in hosts
    rows.append(_row("DJANGO_ALLOWED_HOSTS", "Toegestane hosts", ", ".join(hosts), "ok" if ok_host else "bad", "" if ok_host else f"Voeg {host} toe."))
    cors = set(settings.CORS_ALLOWED_ORIGINS) | allowed_origins()
    rows.append(_row("CORS_ALLOWED_ORIGINS", "Websites die de API mogen gebruiken (CORS)", ", ".join(sorted(cors)) or "-", "ok" if not fo or fo in cors else "bad",
                     "" if not fo or fo in cors else f"Voeg {fo} toe."))
    csrf = settings.CSRF_TRUSTED_ORIGINS
    need = [o for o in (fo, bo) if o and o not in csrf]
    rows.append(_row("CSRF_TRUSTED_ORIGINS", "Vertrouwde adressen (CSRF)", ", ".join(csrf) or "-", "warn" if need and prod else "ok",
                     f"Voeg toe: {', '.join(need)}." if need else ""))
    db = settings.DATABASES["default"]["ENGINE"].rsplit(".", 1)[-1]
    rows.append(_row("DB_ENGINE", "Database", db, "warn" if db == "sqlite3" and prod else "ok", "Gebruik PostgreSQL voor een live website." if db == "sqlite3" and prod else ""))
    for key, label, path in (("MEDIA_ROOT", "Map voor uploads", settings.MEDIA_ROOT), ("STATIC_ROOT", "Map voor statische bestanden", settings.STATIC_ROOT)):
        os.makedirs(path, exist_ok=True) if key == "MEDIA_ROOT" else None
        w = os.path.isdir(path) and os.access(path, os.W_OK)
        rows.append(_row(key, label, str(path), "ok" if w else "bad", "" if w else "De map bestaat niet of is niet beschrijfbaar."))
    from apps.medialib import filecrypt

    src = filecrypt.master_source()
    shown = {"environment": "ingesteld in de omgeving", "database": "ingesteld bij API keys (S3)", "derived": "afgeleid van de geheime sleutel"}[src]
    rows.append(_row("FILE_ENCRYPTION_KEY", "Hoofdsleutel voor bestandsversleuteling", shown, "ok" if src != "derived" else "warn" if prod else "ok",
                     "" if src != "derived" else "Zet een eigen sleutel (omgeving of API keys → S3) zodat je de geheime sleutel kunt vernieuwen zonder bestanden kwijt te raken."))
    rows.append(_row("ADMIN_EMAIL", "Eerste beheerder (bij opstarten)", os.getenv("ADMIN_EMAIL") or "niet ingesteld", "ok", "Alleen nodig om de eerste keer in te loggen."))
    for key, label, url in (("frontend_url", "Website-adres", s["frontend_url"]), ("backend_url", "API-adres", s["backend_url"])):
        if not url:
            rows.append(_row(key, label, "niet ingevuld", "warn" if prod else "ok", "Vul dit hieronder in."))
        elif url.startswith("http://") and prod and "localhost" not in url and not re.search(r"//(\d+\.){3}\d+", url):
            rows.append(_row(key, label, url, "warn", "Gebruik https op een live website."))
        else:
            rows.append(_row(key, label, url, "ok"))
    return rows


def env_files():
    """Ready-made settings for the backend and the frontend, derived from the addresses entered."""
    s = get()
    fo, bo = origin(s["frontend_url"]) or "https://www.voorbeeld.nl", origin(s["backend_url"]) or "https://api.voorbeeld.nl"
    host = urlparse(bo).hostname
    origins = ",".join([fo, *s["extra_origins"]])
    trusted = ",".join([fo, bo, *s["extra_origins"]])
    backend = f"""DJANGO_SECRET_KEY=<lange willekeurige waarde>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS={host},backend
CORS_ALLOWED_ORIGINS={origins}
CSRF_TRUSTED_ORIGINS={trusted}
FILE_ENCRYPTION_KEY=<32 bytes base64>
ADMIN_EMAIL={s["contact_email"] or "<beheerder@voorbeeld.nl>"}
ADMIN_PASSWORD=<tijdelijk wachtwoord>
DB_ENGINE=postgres
POSTGRES_DB=app
POSTGRES_USER=app
POSTGRES_PASSWORD=<wachtwoord>
POSTGRES_HOST=db"""
    frontend = f"""NEXT_PUBLIC_API_URL={bo}
API_URL_INTERNAL=http://backend:8000"""
    return {"backend": backend, "frontend": frontend}
