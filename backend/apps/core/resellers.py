# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Resellers: one or more resellers of easy2edit, kept on the easy2edit server (Super admin+ -> Licence -> Resellers).
A reseller is complete: company, three contact persons (sales, financial, support), websites, more information and the share of RST for the use of easy2edit.
Logins: accounts that are passed on through the API to the websites of the reseller's customers, so the reseller can log in there. The public list (searchable) is read through the API
(on a website that is not the server it is asked from the easy2edit server)."""

import json
import re
import secrets
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation

from django.contrib.auth.hashers import make_password

from . import richtext
from .models import EasySite, Reseller, ResellerLogin

ROLES = ("sales", "financial", "support", "other")  # the kinds of contact persons; there can be more than one person of each kind
ADDRESS = ("street", "house_number", "postal_code", "city", "country")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
URL_RE = re.compile(r"^https?://[^\s]{3,290}$")
ACCESS = ("user", "admin", "superadmin")  # the rights of a login in the website of the customer
MARKER = "Reseller"  # the function of a user that was made from a reseller login


class ResellerError(ValueError):
    def __init__(self, errors):
        super().__init__(" ".join(errors.values()) if isinstance(errors, dict) else str(errors))
        self.errors = errors if isinstance(errors, dict) else {}


def _url(v):
    v = str(v or "").strip()
    if v and not re.match(r"^https?://", v):
        v = "https://" + v
    return v[:300]


def default_share():
    from . import pricing

    return Decimal(str(pricing.load().get("rst_share", 0)))


def share_of(r):
    return Decimal(str(r.rst_share)) if r.rst_share is not None else default_share()


def clean(d):
    """-> (values, errors) of a reseller from a form."""
    out, err = {}, {}
    if "name" in d:
        out["name"] = str(d["name"] or "").strip()[:150]
        if not out["name"]:
            err["name"] = "Vul de naam van de reseller in."
    if "active" in d:
        out["active"] = bool(d["active"])
    if "website" in d:
        out["website"] = _url(d["website"])
        if out["website"] and not URL_RE.match(out["website"]):
            err["website"] = "Gebruik een adres als https://www.voorbeeld.nl."
    if "email" in d:
        out["email"] = str(d["email"] or "").strip()[:254]
        if out["email"] and not EMAIL_RE.match(out["email"]):
            err["email"] = "Dit e-mailadres is ongeldig."
    if "phone" in d:
        out["phone"], bad = _phone(d["phone"])
        if bad:
            err["phone"] = bad
    if "websites" in d:
        rows = []
        for w in (d["websites"] if isinstance(d["websites"], list) else [])[:20]:
            u = _url((w or {}).get("url"))
            if u and URL_RE.match(u):
                rows.append({"label": str((w or {}).get("label") or "").strip()[:80], "url": u})
        out["websites"] = rows
    if "info" in d:
        out["info"] = richtext.clean_small(d["info"], 4000)
    if "address" in d and isinstance(d["address"], dict):
        out["address"] = {k: str(d["address"].get(k) or "").strip()[:100] for k in ADDRESS}
    for k in ("kvk", "vat_id"):
        if k in d:
            out[k] = str(d[k] or "").strip()[:40]
    if "notes" in d:
        out["notes"] = str(d["notes"] or "").strip()[:2000]
    if "contacts" in d and isinstance(d["contacts"], (list, dict)):
        people, bad = clean_people(d["contacts"])
        out["contacts"] = people
        err.update(bad)
    if "rst_share" in d:
        raw = str(d["rst_share"] if d["rst_share"] is not None else "").strip().replace(",", ".")
        if raw == "":
            out["rst_share"] = None
        else:
            try:
                v = Decimal(raw)
                if not (0 <= v <= 100):
                    raise InvalidOperation
                out["rst_share"] = v.quantize(Decimal("0.01"))
            except InvalidOperation:
                err["rst_share"] = "Vul een percentage tussen 0 en 100 in."
    return out, err


def people_of(raw):
    """The contact persons as a list (an older reseller has {sales|financial|support: {...}}: that becomes a list of three persons)."""
    if isinstance(raw, dict):
        raw = [{**(v or {}), "role": k} for k, v in raw.items() if any(str((v or {}).get(f) or "").strip() for f in ("name", "email", "phone"))]
    return raw if isinstance(raw, list) else []


def split_name(full):
    """"Jan van Dijk" -> ("Jan", "van Dijk"): the first word is the first name (for persons that were saved with one name field)."""
    parts = str(full or "").strip().split(None, 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0] if parts else "", "")


def phone_ok(v):
    """A phone number as the phone field makes it ("+31 612345678"): always with a country code (see phone.py)."""
    from . import phone

    return phone.valid(v) and 6 <= len(re.sub(r"\D", "", str(v or ""))) <= 15


def _phone(v, n=30):
    """-> (the number or "", an error text or ""). Only a country code (no number) counts as empty."""
    from . import phone

    return phone.check(v, n)


def clean_people(raw):
    """-> (the list of persons, errors). A person: role, first_name, last_name (both always needed; name is the two together), function, email, phone, mobile, same_address (default: the main address of the reseller) and an own address."""
    out, err = [], {}
    for n, row in enumerate(people_of(raw)[:25]):
        row = row if isinstance(row, dict) else {}
        first, last = str(row.get("first_name") or "").strip()[:60], str(row.get("last_name") or "").strip()[:60]
        if not first and not last and row.get("name"):  # a person from before: one name field
            first, last = (x[:60] for x in split_name(row.get("name")))
        email = str(row.get("email") or "").strip()[:254]
        if email and not EMAIL_RE.match(email):
            err[f"contact_{n}"] = "Dit e-mailadres is ongeldig."
        phone, e1 = _phone(row.get("phone"))
        mobile, e2 = _phone(row.get("mobile"))
        if e1 or e2:
            err[f"contact_phone_{n}"] = e1 or e2
        function = str(row.get("function") or "").strip()[:100]
        if (email or phone or mobile or function or first or last) and not (first and last):
            err[f"contact_name_{n}"] = "Vul de voornaam en de achternaam in."
        make_login = row.get("make_login") is True  # the switch "also make a login": the login is made when the reseller is saved (then the switch goes off)
        if make_login and not email:
            err[f"contact_{n}"] = "Een login heeft een e-mailadres nodig."
        addr = row.get("address") if isinstance(row.get("address"), dict) else {}
        out.append({"id": re.sub(r"[^a-zA-Z0-9-]", "", str(row.get("id") or ""))[:40] or secrets.token_hex(6), "role": row.get("role") if row.get("role") in ROLES else "other", "make_login": make_login,
                    "first_name": first, "last_name": last, "name": f"{first} {last}".strip(), "function": function, "email": email, "phone": phone, "mobile": mobile,
                    "same_address": row.get("same_address") is not False, "address": {k: str(addr.get(k) or "").strip()[:100] for k in ADDRESS}})
    return out, err


def first_of(people, role):
    return next((p for p in people if p.get("role") == role), None) or {}


def brief(r, full=True):
    """A reseller for the admin screen (full) or the public page (only what may be public)."""
    c = people_of(r.contacts)
    if not full:
        return {"id": r.pk, "name": r.name, "website": r.website, "email": r.email, "phone": r.phone, "websites": r.websites or [], "info": r.info, "city": (r.address or {}).get("city", ""), "country": (r.address or {}).get("country", ""),
                "sales": {"name": first_of(c, "sales").get("name", ""), "email": first_of(c, "sales").get("email", ""), "phone": first_of(c, "sales").get("phone", "")}, "support_email": first_of(c, "support").get("email", "")}
    return {"id": r.pk, "name": r.name, "active": r.active, "website": r.website, "email": r.email, "phone": r.phone, "websites": r.websites or [], "info": r.info, "address": {k: (r.address or {}).get(k, "") for k in ADDRESS}, "kvk": r.kvk, "vat_id": r.vat_id,
            "contacts": [{**p, "has_login": bool(p.get("email")) and any(l.email.lower() == str(p["email"]).lower() for l in r.logins.all()), "full_address": ({k: (r.address or {}).get(k, "") for k in ADDRESS} if p.get("same_address", True) else p.get("address", {}))} for p in c],
            "rst_share": None if r.rst_share is None else str(r.rst_share), "share": str(share_of(r)), "default_share": str(default_share()), "notes": r.notes,
            "sites": [{"id": s.pk, "name": s.name, "url": s.url} for s in r.sites.all()], "logins": [login_brief(x) for x in r.logins.all()], "created_at": r.created_at, **({"new_logins": r.new_logins} if getattr(r, "new_logins", None) else {})}


def login_brief(x):
    return {"id": x.pk, "email": x.email, "name": x.name, "function": x.function, "phone": x.phone, "mobile": x.mobile, "access": x.access, "otp": x.otp, "all_sites": x.all_sites, "site_ids": x.site_ids or [], "host": x.host, "active": x.active, "created_at": x.created_at}


def save(r, d, site_url=""):
    """Make or change a reseller. -> the reseller; r.new_logins = the logins that were made for persons with the switch "also make a login" [{email, password, sent}]. Raises ResellerError."""
    vals, err = clean(d)
    if r is None and not vals.get("name"):
        err.setdefault("name", "Vul de naam van de reseller in.")
    if err:
        raise ResellerError(err)
    if r is None:
        r = Reseller()
    for k, v in vals.items():
        setattr(r, k, v)
    r.save()
    r.new_logins = []
    people = people_of(r.contacts)
    for p in people:
        if not p.get("make_login"):
            continue
        email = str(p.get("email") or "").lower()
        if email and not ResellerLogin.objects.filter(reseller=r, email__iexact=email).exists():
            x, password = add_login(r, email, {"name": p.get("name"), "function": p.get("function"), "phone": p.get("phone"), "mobile": p.get("mobile"), "access": "admin", "otp": "email", "all_sites": True, "host": True}, send=False)
            try:
                mail_password(x, password, site_url)
                sent = True
            except Exception:  # noqa: BLE001 - the login exists; the password is shown on the screen then
                sent = False
            r.new_logins.append({"email": x.email, "password": password, "sent": sent})
        p["make_login"] = False  # (done, or it exists already)
    if any("make_login" in p for p in people):
        r.contacts = people
        r.save(update_fields=["contacts"])
    return r


def new_password():
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(12))


OTP = ("", "email", "sms")  # the code check at login: none, by e-mail, by SMS (to the mobile number)


def login_fields(d):
    """-> (values, errors) of a login from a form (everything but the e-mail address and the password)."""
    out, err = {}, {}
    for k, n in (("name", 120), ("function", 100)):
        if k in d:
            out[k] = str(d[k] or "").strip()[:n]
    if "name" in d and len(out["name"].split()) < 2:
        err["name"] = "Vul de voornaam en de achternaam in."
    for k in ("phone", "mobile"):
        if k in d:
            out[k], bad = _phone(d[k])
            if bad:
                err[k] = bad
    if "access" in d:
        if d["access"] not in ACCESS:
            err["access"] = "Kies user, admin of superadmin."
        out["access"] = d["access"]
    if "otp" in d:
        if d["otp"] not in OTP:
            err["otp"] = "Kies de codecontrole: e-mail, sms of geen."
        out["otp"] = d["otp"]
    if "all_sites" in d:
        out["all_sites"] = bool(d["all_sites"])
    if "site_ids" in d:
        out["site_ids"] = [int(x) for x in (d["site_ids"] if isinstance(d["site_ids"], list) else []) if str(x).isdigit()][:500]
    if "host" in d:
        out["host"] = bool(d["host"])
    if out.get("otp") == "sms" and not (out.get("mobile") or d.get("mobile")):
        err["mobile"] = "Een code per sms heeft een mobiel nummer nodig."
    return out, err


def add_login(r, email, d=None, password="", send=False, site_url=""):
    """A login for the reseller: an e-mail address and a password (made when empty) plus the fields of login_fields. send: the person gets an e-mail with the password. -> (login, the password)."""
    email = str(email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise ResellerError({"email": "Dit e-mailadres is ongeldig."})
    if ResellerLogin.objects.filter(reseller=r, email__iexact=email).exists():
        raise ResellerError({"email": "Dit e-mailadres heeft al een login."})
    vals, err = login_fields({"name": "", **(d or {})})  # a login always has a first name and a last name
    if err:
        raise ResellerError(err)
    password = str(password or "").strip() or new_password()
    if len(password) < 8:
        raise ResellerError({"password": "Een wachtwoord heeft minstens 8 tekens."})
    x = ResellerLogin.objects.create(reseller=r, email=email, password_hash=make_password(password), **vals)
    x.mail_sent = False
    if send:
        try:
            mail_password(x, password, site_url)
            x.mail_sent = True
        except Exception:  # noqa: BLE001 - the login exists; the password is shown on the screen then
            pass
    sync_host()
    return x, password


def change_login(x, d):
    """Change the fields of a login (not the e-mail address and the password)."""
    vals, err = login_fields({**d, **({"mobile": x.mobile} if "mobile" not in d else {})})
    if err:
        raise ResellerError(err)
    for k, v in vals.items():
        setattr(x, k, v)
    if "active" in d:
        x.active = bool(d["active"])
    x.save()
    sync_host()
    return x


def set_password(x, password="", send=False, site_url=""):
    password = str(password or "").strip() or new_password()
    if len(password) < 8:
        raise ResellerError({"password": "Een wachtwoord heeft minstens 8 tekens."})
    x.password_hash = make_password(password)
    x.save(update_fields=["password_hash"])
    sync_host()
    if send:
        mail_password(x, password, site_url)
    return password


def mail_password(x, password, site_url=""):
    """The e-mail with the login and the password (the reseller should change the password after the first login)."""
    from apps.communication import sending

    where = f"\n\nInloggen: {site_url}" if site_url else ""
    body = (f"Hallo {x.name or x.email},\n\nVoor {x.reseller.name} is een login gemaakt voor easy2edit.\n\nGebruikersnaam: {x.email}\nWachtwoord: {password}{where}\n\n"
            "Wijzig je wachtwoord na de eerste keer inloggen.")
    sending.send_email(x.email, "Je easy2edit login als reseller", body)


def public_list(q=""):
    """Active resellers for the public page, searchable (name, city, country, information). On a website that is not the easy2edit server they come from the easy2edit server."""
    from . import global_settings, sitemanager

    q = str(q or "").strip().lower()[:80]
    if sitemanager.server_enabled():
        out = []
        for r in Reseller.objects.filter(active=True):
            b = brief(r, full=False)
            if q and q not in " ".join([r.name, b["city"], b["country"], richtext.plain(r.info), r.website]).lower():
                continue
            out.append(b)
        return out
    api = (global_settings.get().get("api_url") or "").rstrip("/")
    if not api:
        return []
    try:
        req = urllib.request.Request(f"{api}/api/easy2edit/resellers/?q={urllib.parse.quote(q)}", headers={"User-Agent": "easy2edit-site"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read(500_000).decode("utf-8", "ignore") or "{}")
        return data.get("resellers", []) if isinstance(data, dict) else []
    except Exception:  # noqa: BLE001 - the page then shows an empty list
        return []


def account_of(x, access=None):
    return {"email": x.email, "name": x.name, "function": x.function, "phone": x.phone, "mobile": x.mobile, "password_hash": x.password_hash, "access": access or x.access, "otp": x.otp}


def accounts_for(site):
    """For the website (with its key): who sells it and the logins that must exist in it. {reseller: {...}|None, accounts: [{email, name, password_hash}]}"""
    r = site.reseller
    if not r or not r.active:
        return {"reseller": None, "accounts": []}
    return {"reseller": brief(r, full=False) | {"contacts": brief(r)["contacts"]}, "accounts": [account_of(x) for x in r.logins.filter(active=True) if x.all_sites or site.pk in (x.site_ids or [])]}


def apply_accounts(data):
    """This website: make, update and remove the users of the reseller's logins (as the easy2edit server says), and note the reseller in the licence. -> (made, removed)."""
    from django.contrib.auth import get_user_model

    from apps.accounts.models import Role

    from .models import License

    User = get_user_model()
    accounts = [a for a in (data.get("accounts") or []) if EMAIL_RE.match(str(a.get("email") or ""))]
    role = Role.objects.filter(slug="admin").first()
    made = 0
    keep = set()
    for a in accounts:
        email = a["email"].lower()
        keep.add(email)
        u = User.objects.filter(username__iexact=email).first() or User.objects.filter(email__iexact=email, function=MARKER).first()
        if u and u.function != MARKER:
            continue  # a real user with this address exists: not touched
        if not u:
            u = User(username=email, email=email, function=MARKER, is_active=True, email_verified=True)
            made += 1
        u.first_name = str(a.get("name") or "")[:150]
        u.role = str(a.get("function") or "")[:255]
        phone = re.sub(r"[^\d+]", "", str(a.get("mobile") or a.get("phone") or ""))[:20]
        if phone.startswith("+"):
            u.phone = phone
        otp = a.get("otp") if a.get("otp") in ("email", "sms") and (a.get("otp") == "email" or u.phone) else ""
        u.otp_active, u.twofa_method = bool(otp), otp  # the code check at every login (needs the two-step verification of the website to be on)
        access = a.get("access") if a.get("access") in ACCESS else "admin"
        u.is_staff = access == "superadmin"  # superadmin: the rights of a superadmin; admin: the Admin role; user: a normal user without extra rights
        if str(a.get("password_hash") or "").startswith(("pbkdf2_", "argon2", "bcrypt", "scrypt")):
            u.password = a["password_hash"]
        u.save()
        if role:
            if access == "admin":
                u.roles.add(role)
            else:
                u.roles.remove(role)
    removed = 0
    for u in User.objects.filter(function=MARKER):
        if (u.email or "").lower() not in keep:
            u.delete()
            removed += 1
    rs = data.get("reseller")
    lic = License.objects.filter(pk=1).first()
    if rs and lic:
        lic.reseller_name, lic.reseller_email, lic.reseller_url = str(rs.get("name") or "")[:120], str((rs.get("sales") or {}).get("email") or "")[:254], str(rs.get("website") or "")[:300]
        lic.save(update_fields=["reseller_name", "reseller_email", "reseller_url"])
    return made, removed


def sync_host():
    """The easy2edit site itself (this installation, when it is the server): the logins that may log in here are made as users without extra rights, with the code check. Never raises."""
    from . import sitemanager

    try:
        if not sitemanager.server_enabled():
            return
        accounts = [account_of(x, "user") for x in ResellerLogin.objects.filter(active=True, host=True, reseller__active=True)]
        apply_accounts({"accounts": accounts, "reseller": None})
    except Exception:  # noqa: BLE001
        pass


def sync():
    """This website asks the easy2edit server for its reseller and logins (only when linked to a server). Never raises. -> {ok, made, removed}."""
    from . import global_settings, sitemanager

    try:
        if sitemanager.server_enabled():
            return {"ok": True, "made": 0, "removed": 0}
        key = sitemanager._state().get("token") or ""
        api = (global_settings.get().get("api_url") or "").rstrip("/")
        if not key or not api:
            return {"ok": False, "made": 0, "removed": 0}
        req = urllib.request.Request(f"{api}/api/easy2edit/reseller/accounts/", headers={"User-Agent": "easy2edit-site", "X-Easy2edit-Key": key})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read(500_000).decode("utf-8", "ignore") or "{}")
        made, removed = apply_accounts(data)
        return {"ok": True, "made": made, "removed": removed}
    except Exception:  # noqa: BLE001
        return {"ok": False, "made": 0, "removed": 0}


def default_reseller():
    """The standard reseller (Standaard en globale instellingen -> Standaard reseller) as a record on this easy2edit server: found by its company name, made from the settings when it is not there yet.
    A new website on the server gets it as its reseller. None when no company is filled in. Never raises."""
    from . import global_settings

    try:
        d = global_settings.reseller()
        name = (d["company"] or d["contact"]).strip()
        if not name:
            return None
        r = Reseller.objects.filter(name__iexact=name).first()
        if r:
            return r if r.active else None
        first, last = split_name(d["contact"])
        person = {"id": secrets.token_hex(4), "role": "sales", "first_name": first, "last_name": last, "function": "", "email": d["email"], "phone": d["phone"], "mobile": d["mobile"]}
        vals, err = clean({"name": name, "website": d["website"], "email": d["email"], "phone": d["phone"],
                           "address": {"street": d["street"], "house_number": d["house_number"], "postal_code": d["postal_code"], "city": d["city"], "country": d["country"]},
                           "contacts": [person] if first and last else []})
        vals = {k: v for k, v in vals.items() if k not in err}  # (a detail that does not pass the check is left out: the reseller is still made)
        vals["name"] = name[:150]
        return Reseller.objects.create(**vals)
    except Exception:  # noqa: BLE001
        return None
