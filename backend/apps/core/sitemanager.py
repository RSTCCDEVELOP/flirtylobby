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

from apps.integrations import crypto

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
    return {"server": bool(st.get("server")), "disconnected": bool(st.get("disconnected")), "auto_approve": bool(st.get("auto_approve")), "api_url": global_settings.get()["api_url"], "instance_id": st.get("instance_id") or "", "registered": bool(st.get("token")) or bool(st.get("server")),
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


def live_url():
    """The public address of this website when it is live: the address in Admin -> Basisgegevens, else the first public https address of the environment (CORS_ALLOWED_ORIGINS). '' on a development machine."""
    import ipaddress

    cands = [system.origin(system.get()["frontend_url"]), *[system.origin(o) for o in (getattr(settings, "CORS_ALLOWED_ORIGINS", None) or [])]]
    for u in cands:
        p = urlparse(u or "")
        host = p.hostname or ""
        if p.scheme != "https" or "." not in host or host in ("localhost",) or host.endswith((".local", ".localhost", ".internal")):
            continue
        try:
            if not ipaddress.ip_address(host).is_global:
                continue
        except ValueError:
            pass  # (a name, not an IP address)
        return u
    return ""


def licence_and_installation():
    """The licence of this website (none | active | expired, with the end date) and whether it is set up (installed) or still an empty standard installation."""
    from . import presets

    lic = system.license_info()
    state = "none" if not lic["has"] else ("expired" if lic["expired"] else "active")
    s = system.get()
    active = presets._data().get("active_preset")  # (the wizard is an installation too, though it is not one of the standard ones)
    installed = bool(active not in (None, "standaard-website") or str(s["site_name"] or "").strip())  # a website with a name of its own, or one of the other installations / the wizard
    return {"license": {"state": state, "until": lic["valid_until"] or ""}, "installation": {"state": "installed" if installed else "empty", "name": str(s["installation_name"] or active or "")[:100]}}


def payload(event, role=""):
    s = system.get()
    url = system.origin(s["frontend_url"]) or live_url()
    name = str(s["site_name"] or "").strip() or url or system.site_name()  # a website that has no name yet (not set up) is shown by its address
    return {"instance_id": instance_id(), "name": name, "url": url, "api_url": system.origin(s["backend_url"]), "ip": own_ip(url), "version": str(settings.SYSTEM_VERSION), "build": build_number(), "event": event, "role": role if role in ROLES else "", **licence_and_installation()}


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
    if not site.name_locked:  # a name that was changed here stays
        site.name = str(data.get("name") or site.name or "")[:150]
    url = _clean_url(data.get("url"))
    if url:
        site.url, site.url_generated = url, False
    elif not site.url:
        site.url, site.url_generated = make_url(site.name), True  # the address is made from the base domain of the easy2edit server
    api = _clean_url(data.get("api_url"))
    if api:
        site.api_url = api
    ip = _clean_ip(data.get("ip"))
    if ip:
        site.ip = ip
    site.seen_ip = _clean_ip(seen_ip) or site.seen_ip
    site.version, site.build = str(data.get("version") or "")[:30], str(data.get("build") or "")[:20]
    lic, ins = data.get("license") or {}, data.get("installation") or {}
    if isinstance(lic, dict) and lic.get("state") in ("none", "active", "expired"):
        site.license_state, site.license_until = lic["state"], str(lic.get("until") or "")[:10]
    if isinstance(ins, dict) and ins.get("state") in ("installed", "empty"):
        site.install_state, site.install_name = ins["state"], str(ins.get("name") or "")[:100]
    site.last_seen = timezone.now()


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def register(data, seen_ip):
    """A website reports itself for the first time. -> (site, key). A website that is known already has to use its key (a ping)."""
    iid = re.sub(r"[^a-f0-9]", "", str(data.get("instance_id") or "").lower())[:40]
    if len(iid) < 16:
        raise ValueError("Ongeldige site-id.")
    existing = EasySite.objects.filter(instance_id=iid).first()
    if existing and existing.status != "disconnected":
        raise PermissionError("Deze website is al aangemeld: gebruik de sleutel.")
    key = f"{secrets.token_urlsafe(32)}"
    site = existing or EasySite(instance_id=iid)  # a website that disconnected itself registers again: its record is used again
    site.token_hash = _hash(key)
    site.status = "active" if _state().get("auto_approve") else "pending"  # a new website waits for approval (unless that is switched on): registering is open to the world
    _fill(site, data, seen_ip)
    callback = _new_callback(site)
    site.save()
    logger.info("Site manager: new website %s (%s)", site.name, site.url)
    return site, key, callback


def site_for_key(key):
    """The website that belongs to this key (not blocked), or None. Its status says whether it is approved (active) or still waiting (pending)."""
    site = EasySite.objects.filter(token_hash=_hash(str(key or ""))).first() if key else None
    return site if site and site.status != "blocked" else None


def disconnect_site(key):
    """The website itself disconnects from this server: its key and callback key are gone, the record stays (status disconnected)."""
    site = site_for_key(key)
    if not site:
        raise PermissionError("Onbekende of geblokkeerde website.")
    site.status, site.token_hash, site.callback_key_enc = "disconnected", "", ""
    site.save(update_fields=["status", "token_hash", "callback_key_enc"])
    return site


def set_auto_approve(on):
    return _save(auto_approve=bool(on))


def _new_callback(site):
    """A key for the calls of the easy2edit server TO the website (kept encrypted here); the website gets it once and checks it."""
    key = secrets.token_urlsafe(32)
    site.callback_key_enc = crypto.encrypt({"k": key})
    return key


def ping(key, data, seen_ip):
    """A call of a known website (with its key): update the record. -> (the site, a callback key when the website has none yet, else None)."""
    site = EasySite.objects.filter(token_hash=_hash(str(key or ""))).first()
    if not site or site.status == "blocked":
        raise PermissionError("Onbekende of geblokkeerde website.")
    _fill(site, data, seen_ip)
    if data.get("event") == "login":
        site.last_login_at, site.last_login_role = timezone.now(), (data.get("role") if data.get("role") in ROLES else "")
        site.login_count += 1
    callback = None if site.callback_key_enc and data.get("callback") != "missing" else _new_callback(site)  # (a website that lost its key asks for a new one)
    site.save()
    return site, callback


def rate_ok(ip, limit=20):
    """Registering is open to the world: at most `limit` per hour per address."""
    k = f"sitemgr-reg:{ip}"
    n = cache.get(k, 0)
    if n >= limit:
        return False
    cache.set(k, n + 1, 3600)
    return True


def public(s):
    return {"id": s.pk, "instance_id": s.instance_id, "name": s.name, "url": s.url, "block_message": s.block_message, "license_state": s.license_state, "license_until": s.license_until, "install_state": s.install_state, "install_name": s.install_name, "blocked_offline": s.blocked_offline, "api_url": s.api_url, "has_callback": bool(s.callback_key_enc), "url_generated": s.url_generated, "ip": s.ip, "seen_ip": s.seen_ip, "version": s.version, "build": s.build, "status": s.status,
            "first_seen": s.first_seen, "last_seen": s.last_seen, "last_login_at": s.last_login_at, "last_login_role": s.last_login_role, "login_count": s.login_count, "notes": s.notes}


# ── this website: reporting to the easy2edit server ─────────────────────────
def _post(url, body, key=""):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json", "User-Agent": "easy2edit-site", **({"X-Easy2edit-Key": key} if key else {})})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read(200_000).decode("utf-8", "ignore") or "{}")


def report(event="login", role=""):
    """Tell the easy2edit server about this website (register the first time, ping after that). -> {ok, error}. Never raises."""
    try:
        if _state().get("disconnected") and not server_enabled():  # disconnected on purpose: no calls at all
            return {"ok": False, "error": "disconnected"}
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
                _save(token=key, **({"callback_key": str(r["callback_key"])} if r.get("callback_key") else {}))
            if key and (event == "login" or st.get("token")):
                r = _post(f"{api}/api/easy2edit/sites/ping/", {**data, **({} if _state().get("callback_key") else {"callback": "missing"})}, key)
                if r.get("callback_key"):  # the key for the calls of the easy2edit server to this website
                    _save(callback_key=str(r["callback_key"]))
                from . import resellers

                resellers.sync()  # who sells this website and which logins the reseller has (made here)
                from . import siteowners

                siteowners.push()  # the owner and the company of this website on this server (once; a website that was not approved yet tries again at the next login)
        _save(last_ok_at=timezone.now().isoformat(timespec="seconds"), last_error="", last_event=event)
        _released()
        return {"ok": True, "error": ""}
    except urllib.error.HTTPError as e:
        if e.code == 403 and _blocked_by_server(e):  # blocked: offline with the message; the key stays
            return {"ok": False, "error": "blocked"}
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


def _blocked_by_server(e):
    """The easy2edit server says that this website is blocked (a 403 with reason "blocked"): take this website offline with the message of the server. -> True when that was it."""
    try:
        data = json.loads(e.read(2000).decode("utf-8", "ignore"))
    except (ValueError, OSError, AttributeError):
        return False
    if data.get("reason") != "blocked":
        return False
    from . import remote_info

    try:
        remote_info.set_online(False, str(data.get("message") or BLOCK_MESSAGE))
    finally:
        _save(blocked_offline=True, last_error="blocked")
    return True


def _released():
    """The website was taken offline because it was blocked, and the server answers again: put it online again."""
    if _state().get("blocked_offline"):
        from . import remote_info

        remote_info.set_online(True)
        _save(blocked_offline=False)


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


# ── the calls of the easy2edit server TO a website (information, offline/online) ─
def callback_ok(key, ip=""):
    """This website: is this the key the easy2edit server was given? Wrong guesses are counted per address (20 per hour)."""
    import hmac

    from django.core.cache import cache

    ck = f"sitemgr-cb:{ip}"
    if cache.get(ck, 0) >= 20:
        return False
    mine = str(_state().get("callback_key") or "")
    ok = bool(mine) and hmac.compare_digest(str(key or ""), mine)
    if not ok:
        cache.set(ck, cache.get(ck, 0) + 1, 3600)
    return ok


class RemoteError(ValueError):
    """The call to a website did not work; reason: "pending" | "nokey" | "unsafe" | "unreachable" | "refused"."""

    def __init__(self, reason, message):
        super().__init__(message)
        self.reason = reason


def _safe_base(site):
    """The API address of an approved website, only when it is safe to call: https, and not an address inside our own network (except on a development machine)."""
    import ipaddress

    base = (site.api_url or site.url or "").rstrip("/")
    u = urlparse(base)
    if not u.hostname or u.scheme not in ("https", "http") or (u.scheme == "http" and not settings.DEBUG):
        raise RemoteError("unsafe", "Het API-adres van deze website is niet veilig om aan te roepen (https is nodig).")
    if not settings.DEBUG:
        try:
            infos = socket.getaddrinfo(u.hostname, u.port or 443, proto=socket.IPPROTO_TCP)
            if not infos or any(not ipaddress.ip_address(i[4][0]).is_global for i in infos):
                raise RemoteError("unsafe", "Het adres van deze website wijst naar een intern netwerk: dat roepen we niet aan.")
        except socket.gaierror:
            raise RemoteError("unreachable", "Het adres van deze website is niet te vinden.")
    return base


def call_site(site, path, params=None, body=None, allow_blocked=False):
    """Ask / tell a website (an approved one) something with the callback key. -> the answer (a dict). Never for the website that is this installation: use remote_info directly.
    allow_blocked: also a website that is blocked (to take it offline when it is blocked, and to put it online again when it is released)."""
    if site.status != "active" and not (allow_blocked and site.status == "blocked"):
        raise RemoteError("pending", "Keur deze website eerst goed.")
    key = crypto.decrypt(site.callback_key_enc).get("k") if site.callback_key_enc else ""
    if not key:
        raise RemoteError("nokey", "Deze website heeft nog geen koppelsleutel: die wordt uitgewisseld bij het eerstvolgende inloggen van een beheerder op die website.")
    import urllib.parse

    url = f"{_safe_base(site)}/api/easy2edit/remote/{path}/" + (("?" + urllib.parse.urlencode(params)) if params else "")
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"Content-Type": "application/json", "User-Agent": "easy2edit-server", "X-Easy2edit-Callback": key})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read(1_000_000).decode("utf-8", "ignore") or "{}")
    except urllib.error.HTTPError as e:
        try:
            why = str(json.loads(e.read(2000).decode("utf-8", "ignore")).get("detail") or "")[:300]
        except (ValueError, OSError, AttributeError):
            why = ""
        raise RemoteError("refused", why or f"De website weigert de aanvraag (HTTP {e.code}).")
    except Exception:  # noqa: BLE001
        raise RemoteError("unreachable", "De website is niet bereikbaar via zijn API.")


def activate_site(site):
    """Superadmin+ on the easy2edit server: activate the connection with a website through its API. The website is asked (without a key: it only starts its own report) to exchange a new callback key
    with this server, using its own key. -> {ok, has_callback}. RemoteError when the website cannot be reached or refuses."""
    if site.instance_id == instance_id():
        return {"ok": True, "has_callback": True}
    if site.status not in ("active", "pending"):
        raise RemoteError("pending", "Keur deze website eerst goed.")
    url = f"{_safe_base(site)}/api/easy2edit/remote/activate/"
    req = urllib.request.Request(url, data=b"{}", method="POST", headers={"Content-Type": "application/json", "User-Agent": "easy2edit-server"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            answer = json.loads(r.read(100_000).decode("utf-8", "ignore") or "{}")
    except urllib.error.HTTPError as e:
        raise RemoteError("refused", "De website weigert de activatie (HTTP %s)." % e.code)
    except Exception:  # noqa: BLE001
        raise RemoteError("unreachable", "De website is niet bereikbaar via zijn API.")
    site.refresh_from_db()
    if not answer.get("ok"):
        raise RemoteError("refused", "De website kon zich niet bij deze server melden: %s" % str(answer.get("error") or "")[:150])
    return {"ok": True, "has_callback": bool(site.callback_key_enc)}


def reactivate():
    """This website: ask the easy2edit server for a new callback key (with this website's own key) and report. -> {ok, error}."""
    if server_enabled():
        return {"ok": True, "error": ""}
    _save(callback_key="")
    return report("sync")


def site_info(site, part):
    """The information of a website (part: status | users | reseller | ai), asked through its API; this installation's own website is read directly."""
    from . import remote_info

    if part not in remote_info.PARTS:
        raise ValueError("Onbekend onderdeel.")
    data = remote_info.build(part) if site.instance_id == instance_id() else call_site(site, "info", {"part": part})
    if part == "maintenance":  # the newest version that this (easy2edit) server runs: the website is compared with it
        data = {**data, "latest": {"version": str(settings.SYSTEM_VERSION), "build": build_number()}}
    return data


def site_action(site, body):
    """Tell a website to do something: switch the plugin Statistics, start a measurement of the energy use."""
    from . import remote_info

    if site.instance_id == instance_id():
        return remote_info.action(body)
    return call_site(site, "action", body=body)


def set_site_online(site, online, message="", allow_blocked=False):
    from . import remote_info

    if site.instance_id == instance_id():
        return remote_info.set_online(online, message)
    return call_site(site, "state", body={"online": bool(online), "message": str(message or "")[:500]}, allow_blocked=allow_blocked)


BLOCK_MESSAGE = "Deze website is geblokkeerd en tijdelijk niet beschikbaar. Neem contact op met de beheerder."


def apply_status_change(site, new, message=""):
    """A website changes status (the Site manager): blocking takes it offline with a message, through its API (while its key still works); releasing it puts it online again, when we took it offline.
    The website itself is not touched when it is this installation. -> {ok, reason, detail} of that call, or None when there was nothing to do. The status itself is changed by the caller."""
    old = site.status
    own = site.instance_id == instance_id()
    if new == "blocked" and old != "blocked":
        site.block_message = (str(message or "").strip() or BLOCK_MESSAGE)[:500]
        if own or old != "active":
            return None  # (a website that is not approved has no key to call with: it is blocked here and goes offline itself at its next report)
        try:
            set_site_online(site, False, site.block_message, allow_blocked=True)
            site.blocked_offline = True
            return {"ok": True}
        except RemoteError as e:
            return {"ok": False, "reason": e.reason, "detail": str(e)}
    if old == "blocked" and new in ("active", "pending") and site.blocked_offline and not own:
        try:
            set_site_online(site, True, "", allow_blocked=True)
            site.blocked_offline = False
            return {"ok": True}
        except RemoteError as e:
            return {"ok": False, "reason": e.reason, "detail": str(e)}
    return None


# ── this website as a client of the easy2edit server: is it connected, disconnect, connect again ──
def check():
    """A live check of the connection with the easy2edit server. -> {state, ...}: server (this installation IS the server) | disconnected | connected | pending (known, waits for approval) |
    refused (not known or blocked) | disabled (the server has no site manager on) | offline (not reachable; error says why)."""
    if server_enabled():
        return {"state": "server"}
    if _state().get("disconnected"):
        return {"state": "disconnected"}
    api = global_settings.get()["api_url"]
    try:
        key = _state().get("token") or ""
        if not key:
            r = report("sync")  # not registered yet: that is done now
            key = _state().get("token") or ""
            if not key:
                return {"state": "offline", "error": r.get("error") or "geen sleutel"}
        resp = _post(f"{api}/api/easy2edit/sites/ping/", {**payload("check"), **({} if _state().get("callback_key") else {"callback": "missing"})}, key)
        if resp.get("callback_key"):
            _save(callback_key=str(resp["callback_key"]))
        _save(last_ok_at=timezone.now().isoformat(timespec="seconds"), last_error="", last_event="check")
        _released()
        status = resp.get("status") or "active"
        return {"state": "connected" if status == "active" else status, "status": status, "server_url": api}
    except urllib.error.HTTPError as e:
        if e.code == 403 and _blocked_by_server(e):
            return {"state": "blocked"}
        _save(last_error=f"HTTP {e.code}")
        if e.code == 404:
            return {"state": "disabled"}
        if e.code in (401, 403):
            _save(token="")  # the key is not known any more: it registers again at the next report
            return {"state": "refused"}
        return {"state": "offline", "error": f"HTTP {e.code}"}
    except Exception as e:  # noqa: BLE001
        _save(last_error=str(e)[:200])
        return {"state": "offline", "error": str(e)[:200]}


def disconnect():
    """Disconnect this website from the easy2edit server: the server is told (when it can be reached), the keys are removed here, and nothing is reported or fetched until it connects again."""
    st = _state()
    if st.get("token"):
        try:
            _post(f"{global_settings.get()['api_url']}/api/easy2edit/sites/disconnect/", {}, st["token"])
        except Exception:  # noqa: BLE001 - not reachable: it is disconnected here anyway
            pass
    _save(token="", callback_key="", disconnected=True)


def connect():
    """Connect to the easy2edit server again: this website reports itself (a new registration; the server may ask for approval). -> {ok, error}."""
    _save(disconnected=False)
    return report("sync")


def auto_register():
    """At every start of the backend: a website that is live (it has a public address) and is not registered yet reports itself, so it is in the Site manager of the easy2edit server
    without anybody having logged in; a registered website reports that it is alive. Not on a development machine, not when disconnected, never an error. -> what happened."""
    if disabled() or _state().get("disconnected"):
        return "skipped"
    if not live_url():
        return "not live"
    try:
        if server_enabled():
            return "ok" if report("sync")["ok"] else "failed"  # (the server puts its own website in its own list)
        first = not _state().get("token")  # (looked at before the call: a call that registers makes the key)
        return ("registered" if first else "alive") if report("register" if first else "sync")["ok"] else "failed"
    except Exception:  # noqa: BLE001
        return "failed"
