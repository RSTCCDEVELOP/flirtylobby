# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
    "site_name": "", "tab_title": "", "tagline": "", "company_name": "", "environment": "production",
    "frontend_url": "", "backend_url": "", "extra_origins": [],
    "contact_email": "", "support_email": "", "admin_email": "", "phone": "", "kvk": "", "vat_id": "", "address": "",
    "street": "", "house_number": "", "postal_code": "", "city": "", "country": "",  # the address always in parts; "address" is made from them (one line) for what reads it as text
    "aliases": [],  # extra domain names of the website (www.x.nl, x.nl): visitors can be sent on to the main address
    "redirect_aliases": False,
    "timezone": "Europe/Amsterdam",
    "maintenance": False, "maintenance_message": "", "maintenance_messages": {},  # the notice per language: {code: text}
    "max_image_mb": "20", "max_video_mb": "300", "max_photo_mb": "5",
    "signal_seconds": "0",  # how often the browser asks for call signals (video and chat calls): 0 = 1.5 seconds
    "refresh_seconds": "0",  # how often the pages ask the server for news (messages, notifications, chat): 0 = every part at its own pace

    "footer_text": "",
    "footer_logo_height": "0",  # height of the logo in the footer in px (0 = the standard, 36)
    "footer_logo_link": "",  # where a click on the logo in the footer goes (empty = nowhere)
    "show_credit": True,  # "© Easy2edit <year>" with a link at the bottom of every page
    "social_facebook": "", "social_instagram": "", "social_x": "", "social_linkedin": "", "social_youtube": "", "social_tiktok": "",
}
SOCIAL = ["facebook", "instagram", "x", "linkedin", "youtube", "tiktok"]
HOST_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$")
INT_LIMITS = {"max_image_mb": (1, 200), "max_video_mb": (1, 2000), "max_photo_mb": (1, 50), "refresh_seconds": (0, 600), "signal_seconds": (0, 30), "footer_logo_height": (0, 200)}
ENVIRONMENTS = ["production", "staging", "development"]
URL_RE = re.compile(r"^https?://[A-Za-z0-9.\-]+(:\d{2,5})?$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


ADDRESS_PARTS = ("street", "house_number", "postal_code", "city", "country")
ADDRESS_RE = re.compile(r"^\s*(?P<street>.+?)\s+(?P<nr>\d+\s?[A-Za-z]?(?:[-/ ]?\d+[A-Za-z]?)?)\s*[,\n]?\s*(?P<zip>\d{4}\s?[A-Za-z]{2})\s+(?P<city>.+?)\s*$", re.S)


def compose_address(d):
    """The address as one line: 'Straat 12, 1234 AB Plaats' (and the country when it is not the Netherlands)."""
    line1 = " ".join(x for x in (d.get("street"), d.get("house_number")) if x)
    line2 = " ".join(x for x in (d.get("postal_code"), d.get("city")) if x)
    country = (d.get("country") or "").strip()
    return ", ".join(x for x in (line1, line2, country if country.lower() not in ("", "nl", "nederland", "netherlands") else "") if x)


def get():
    stored = SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    d = {**DEFAULTS, **{k: v for k, v in stored.items() if k in DEFAULTS}}
    if d["address"] and not any(d[k] for k in ADDRESS_PARTS):  # an address that was typed as one text: split it (once it is saved again, it is saved in parts)
        m = ADDRESS_RE.match(d["address"])
        if m:
            d.update(street=m["street"].strip(), house_number=m["nr"].strip(), postal_code=m["zip"].strip().upper(), city=m["city"].strip())
    elif any(d[k] for k in ADDRESS_PARTS):
        d["address"] = compose_address(d)
    return d


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
        if k in ADDRESS_PARTS:
            v = " ".join(str(v or "").split())[:12 if k == "house_number" else 80]
            out[k] = v.upper() if k == "postal_code" else v
            continue
        if k == "address" and any(x in incoming for x in ADDRESS_PARTS):
            continue  # made from the parts below
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
        elif k in ("contact_email", "support_email", "admin_email"):
            v = str(v or "").strip()
            if v and not EMAIL_RE.match(v):
                errors[k] = "Dit is geen geldig e-mailadres."
            out[k] = v
        elif k == "environment":
            out[k] = v if v in ENVIRONMENTS else "production"
        elif k == "aliases":
            items = [str(x).strip().lower().replace("https://", "").replace("http://", "").strip("/") for x in (v if isinstance(v, list) else str(v).split(",")) if str(x).strip()]
            bad = [x for x in items if not HOST_RE.match(x)]
            if bad:
                errors[k] = f"Ongeldige domeinnaam: {bad[0]} (bv. voorbeeld.nl, zonder https://)."
            out[k] = list(dict.fromkeys(items))[:20]
        elif k in ("redirect_aliases", "maintenance", "show_credit"):
            out[k] = bool(v)
        elif k == "timezone":
            try:
                from zoneinfo import ZoneInfo

                ZoneInfo(str(v))
                out[k] = str(v)
            except Exception:  # noqa: BLE001
                errors[k] = "Onbekende tijdzone (bv. Europe/Amsterdam)."
        elif k in INT_LIMITS:
            lo, hi = INT_LIMITS[k]
            try:
                out[k] = str(max(lo, min(hi, int(v))))
            except (TypeError, ValueError):
                errors[k] = "Geef een geheel getal op."
        elif k == "footer_logo_link":
            v = str(v or "").strip()
            if v and not re.match(r"^(https?://[^\s]{3,200}|/[^\s/][^\s]{0,199}|/)$", v):
                errors[k] = "Gebruik een volledig adres (https://…) of een pagina van de website (bijvoorbeeld /contact)."
            out[k] = v
        elif k.startswith("social_"):
            v = str(v or "").strip()
            if v and not re.match(r"^https?://[^\s]{3,200}$", v):
                errors[k] = "Gebruik een volledig adres, bv. https://www.instagram.com/jouwnaam."
            out[k] = v
        elif k == "maintenance_messages":
            out[k] = {str(c)[:10]: str(t or "").strip()[:500] for c, t in (v.items() if isinstance(v, dict) else []) if re.fullmatch(r"[a-zA-Z-]{2,10}", str(c)) and str(t or "").strip()}
        elif k in ("maintenance_message", "footer_text"):
            out[k] = str(v or "").strip()[:500]
        else:
            out[k] = str(v or "").strip()[:200]
    if any(k in out for k in ADDRESS_PARTS):  # the one-line address follows the parts
        cur = get()
        out["address"] = compose_address({k: out.get(k, cur[k]) for k in ADDRESS_PARTS})
    return out, errors


def save(cleaned):
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    old = get()
    obj.data = {**(obj.data or {}), **cleaned}
    obj.save()
    _sync_seo(old, get())
    return get()


def _sync_seo(old, new):
    """The website address is also what the sitemap and canonical links use. (The name is applied by apps.seo.service on the fly.)"""
    from apps.plugins import facade

    seo = facade.mod("seo", "service")  # (the plugin SEO; without it there is no sitemap to keep in step)
    if seo is None:
        return
    cur = seo.raw()["site"]
    if new["frontend_url"] and cur["site_url"] in ("", old["frontend_url"]):
        seo.save({"site": {"site_url": new["frontend_url"]}})


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


def site_name():
    """The name of the website: what the header, browser tab, e-mails, the app icon and the 2-step app show."""
    return get()["site_name"] or "Studio2"


def limit_mb(key):
    try:
        return int(get()[key])
    except (TypeError, ValueError):
        return int(DEFAULTS[key])


def primary_host():
    return urlparse(get()["frontend_url"]).netloc


_lic = {"t": 0, "v": None}


def license_info():
    """{number, client, valid_until, expired}: the licence of this installation (cached a few seconds)."""
    import time
    from datetime import date

    if _lic["v"] is None or time.time() - _lic["t"] > 15:
        from .models import License

        try:
            lic = License.objects.filter(pk=1).first()
        except Exception:  # noqa: BLE001 (before the first migration)
            lic = None
        _lic.update(t=time.time(), v={"number": lic.number if lic else "", "client": lic.client if lic else "", "client_address": lic.client_address if lic else "",
                                      "valid_until": lic.valid_until.isoformat() if lic and lic.valid_until else None, "has": bool(lic and lic.number),
                                      "reseller": {"name": lic.reseller_name, "email": lic.reseller_email, "url": lic.reseller_url} if lic else {"name": "", "email": "", "url": ""},
                                      "expired": bool(lic and lic.number and lic.valid_until and lic.valid_until < date.today())})
    return _lic["v"]


def license_changed():
    _lic["v"] = None


def maintenance_on():
    """Maintenance mode of Basisgegevens, or a licence that has run out: the website then shows the maintenance page (administrators keep working to renew it)."""
    return bool(get()["maintenance"] or license_info()["expired"])


def public():
    """What the website itself needs (no secrets): name, domains, contact, footer, maintenance."""
    s = get()
    return {"site_name": site_name(), "tagline": s["tagline"], "company_name": s["company_name"], "frontend_url": s["frontend_url"], "backend_url": s["backend_url"],
            "primary_host": primary_host(), "aliases": s["aliases"], "redirect_aliases": s["redirect_aliases"], "timezone": s["timezone"],
            "maintenance": maintenance_on(), "license_expired": license_info()["expired"], "license_missing": not license_info()["has"], "license_client": license_info()["client"], "maintenance_message": s["maintenance_message"], "maintenance_messages": s["maintenance_messages"], "footer_text": s["footer_text"], "footer_logo_height": int(s["footer_logo_height"] or 0), "footer_logo_link": s["footer_logo_link"], "show_credit": s["show_credit"],
            "contact_email": s["contact_email"], "phone": s["phone"], "kvk": s["kvk"], "vat_id": s["vat_id"], "address": s["address"], **{k: s[k] for k in ADDRESS_PARTS},
            "social": {k: s[f"social_{k}"] for k in SOCIAL if s[f"social_{k}"]}, "refresh_seconds": int(s["refresh_seconds"] or 0), "signal_seconds": int(s["signal_seconds"] or 0)}
