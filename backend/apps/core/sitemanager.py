# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The easy2edit site manager.

Every easy2edit website reports itself to the easy2edit server (the API address in Super admin -> Default and global settings):
- the first time (the website has no key yet): it registers with its name, address, version and IP address; the server makes the address when the website has none
  (<name>.<base domain>), keeps the website in its list and gives it a key for the next calls;
- every time an administrator, superadmin or superadmin+ logs in: the website calls the server with that key and the server updates its record.
The calls run in the background: a login never waits for them and never fails because of them.

The installation that is the easy2edit server switches "Site manager server" on (Super admin+ -> Site manager); only then it accepts these calls.
The list is shown to superadmin+ only. A website sends: its name, address, IP address, version, build, and the level of the administrator who logged in (no names or e-mail addresses)."""
import hashlib
import json
import logging
import os
import re
import secrets
import socket
import sys
import threading
import urllib.error
import urllib.request
import uuid
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from . import global_settings, system
from .models import EasySite, SystemSettings

logger = logging.getLogger(__name__)

KEY = "site_manager"  # where the state is kept inside SystemSettings.data (the basic data of the site does not read this key)
ROLES = ("admin", "superadmin", "superadmin+")
TIMEOUT = 6


# ── the state of this installation ──────────────────────────────────────────
def _state():
    return dict((SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get(KEY) or {})


def _save(**kw):
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    data = dict(obj.data or {})
    st = {**(data.get(KEY) or {}), **kw}
    data[KEY] = st
    obj.data = data
    obj.save(update_fields=["data"])
    return st


def server_enabled():
    return bool(_state().get("server"))


def set_server(on):
    return _save(server=bool(on))


def instance_id():
    st = _state()
    if not st.get("instance_id"):
        st = _save(instance_id=uuid.uuid4().hex)
    return st["instance_id"]


def info():
    """What the Site manager screen shows about this website itself."""
    st = _state()
    return {"server": bool(st.get("server")), "api_url": global_settings.get()["api_url"], "instance_id": st.get("instance_id") or "", "registered": bool(st.get("token")) or bool(st.get("server")),
            "last_ok_at": st.get("last_ok_at"), "last_error": st.get("last_error") or "", "last_event": st.get("last_event") or ""}


def build_number():
    try:
        return (settings.BASE_DIR / "BUILD").read_text().strip()
    except OSError:
        return ""


def own_ip(url):
    """The IP address of this website's own address (its server), or ''."""
    host = urlparse(url or "").hostname
    if not host:
        return ""
    try:
        socket.setdefaulttimeout(3)
        return socket.gethostbyname(host)
    except OSError:
        return ""
    finally:
        socket.setdefaulttimeout(None)


def payload(event, role=""):
    s = system.get()
    url = system.origin(s["frontend_url"])
    return {"instance_id": instance_id(), "name": system.site_name(), "url": url, "ip": own_ip(url), "version": str(settings.SYSTEM_VERSION), "build": build_number(), "event": event, "role": role if role in ROLES else ""}


# ── the server side: the list of websites ───────────────────────────────────
def slugify(text):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(text or "").lower())).strip("-")[:40]


def make_url(name):
    """https://<name>.<base domain>, unique in the list."""
    base = global_settings.get()["base_domain"]
    slug = slugify(name) or "site"
    url, n = f"https://{slug}.{base}", 2
    while EasySite.objects.filter(url=url).exists():
        url, n = f"https://{slug}-{n}.{base}", n + 1
    return url


def _clean_url(value):
    v = str(value or "").strip().rstrip("/")[:300]
    return v if re.match(r"^https?://[A-Za-z0-9.\-]+(:\d{2,5})?$", v) else ""


def _clean_ip(value):
    v = str(value or "").strip()
    try:
        import ipaddress

        return str(ipaddress.ip_address(v)) if v else None
    except ValueError:
        return None


def _fill(site, data, seen_ip):
    site.name = str(data.get("name") or site.name or "")[:150]
    url = _clean_url(data.get("url"))
    if url:
        site.url, site.url_generated = url, False
    elif not site.url:
        site.url, site.url_generated = make_url(site.name), True  # the address is made from the base domain of the easy2edit server
    ip = _clean_ip(data.get("ip"))
    if ip:
        site.ip = ip
    site.seen_ip = _clean_ip(seen_ip) or site.seen_ip
    site.version, site.build = str(data.get("version") or "")[:30], str(data.get("build") or "")[:20]
    site.last_seen = timezone.now()


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def register(data, seen_ip):
    """A website reports itself for the first time. -> (site, key). A website that is known already has to use its key (a ping)."""
    iid = re.sub(r"[^a-f0-9]", "", str(data.get("instance_id") or "").lower())[:40]
    if len(iid) < 16:
        raise ValueError("Ongeldige site-id.")
    if EasySite.objects.filter(instance_id=iid).exists():
        raise PermissionError("Deze website is al aangemeld: gebruik de sleutel.")
    key = f"{secrets.token_urlsafe(32)}"
    site = EasySite(instance_id=iid, token_hash=_hash(key))
    _fill(site, data, seen_ip)
    site.save()
    logger.info("Site manager: new website %s (%s)", site.name, site.url)
    return site, key


def site_for_key(key):
    """The (not blocked) website that belongs to this key, or None."""
    site = EasySite.objects.filter(token_hash=_hash(str(key or ""))).first() if key else None
    return site if site and site.status != "blocked" else None


def ping(key, data, seen_ip):
    """A call of a known website (with its key): update the record. -> the site."""
    site = EasySite.objects.filter(token_hash=_hash(str(key or ""))).first()
    if not site or site.status == "blocked":
        raise PermissionError("Onbekende of geblokkeerde website.")
    _fill(site, data, seen_ip)
    if data.get("event") == "login":
        site.last_login_at, site.last_login_role = timezone.now(), (data.get("role") if data.get("role") in ROLES else "")
        site.login_count += 1
    site.save()
    return site


def rate_ok(ip, limit=20):
    """Registering is open to the world: at most `limit` per hour per address."""
    k = f"sitemgr-reg:{ip}"
    n = cache.get(k, 0)
    if n >= limit:
        return False
    cache.set(k, n + 1, 3600)
    return True


def public(s):
    return {"id": s.pk, "instance_id": s.instance_id, "name": s.name, "url": s.url, "url_generated": s.url_generated, "ip": s.ip, "seen_ip": s.seen_ip, "version": s.version, "build": s.build, "status": s.status,
            "first_seen": s.first_seen, "last_seen": s.last_seen, "last_login_at": s.last_login_at, "last_login_role": s.last_login_role, "login_count": s.login_count, "notes": s.notes}


# ── this website: reporting to the easy2edit server ─────────────────────────
def _post(url, body, key=""):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json", "User-Agent": "easy2edit-site", **({"X-Easy2edit-Key": key} if key else {})})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read(200_000).decode("utf-8", "ignore") or "{}")


def report(event="login", role=""):
    """Tell the easy2edit server about this website (register the first time, ping after that). -> {ok, error}. Never raises."""
    try:
        data = payload(event, role)
        st = _state()
        if server_enabled():  # this installation is the server: its own website goes straight into its own list
            site = EasySite.objects.filter(instance_id=data["instance_id"]).first()
            if not site:
                site = EasySite(instance_id=data["instance_id"], token_hash="")
                _fill(site, data, "")
                site.save()
            _fill(site, data, "")
            if event == "login":
                site.last_login_at, site.last_login_role, site.login_count = timezone.now(), data["role"], site.login_count + 1
            site.save()
        else:
            api = global_settings.get()["api_url"]
            key = st.get("token") or ""
            if not key:
                r = _post(f"{api}/api/easy2edit/sites/register/", data)
                key = str(r.get("key") or "")
                if not key:
                    raise ValueError("De server gaf geen sleutel.")
                _save(token=key)
            if key and (event == "login" or st.get("token")):
                _post(f"{api}/api/easy2edit/sites/ping/", data, key)
        _save(last_ok_at=timezone.now().isoformat(timespec="seconds"), last_error="", last_event=event)
        return {"ok": True, "error": ""}
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):  # the key is no longer known: register again next time
            _save(token="", last_error=f"HTTP {e.code}")
        else:
            _save(last_error=f"HTTP {e.code}")
        return {"ok": False, "error": f"HTTP {e.code}"}
    except Exception as e:  # noqa: BLE001 - reporting never breaks anything
        try:
            _save(last_error=str(e)[:200])
        except Exception:  # noqa: BLE001
            pass
        return {"ok": False, "error": str(e)[:200]}


def disabled():
    return os.getenv("EASY2EDIT_REPORT", "1") == "0" or "pytest" in sys.modules  # (never in the tests)


def report_async(event="login", role=""):
    """In the background, so a login never waits for the call."""
    if disabled():
        return
    threading.Thread(target=report, args=(event, role), daemon=True, name="sitemanager-report").start()


def role_of(user):
    """admin | superadmin | superadmin+ for somebody who may administer; '' for everybody else."""
    from apps.accounts.access import can_admin

    if not (user and user.is_authenticated):
        return ""
    if user.is_staff and getattr(user, "is_superadmin_plus", False):
        return "superadmin+"
    if user.is_staff:
        return "superadmin"
    return "admin" if can_admin(user) else ""


def on_login(sender, request=None, user=None, **kwargs):
    """Signal: somebody logged in. An administrator makes the website report itself."""
    role = role_of(user)
    if role:
        report_async("login", role)
