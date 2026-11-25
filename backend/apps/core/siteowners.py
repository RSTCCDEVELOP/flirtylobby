# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The site owner and the company of a website on the easy2edit server (the master site / site manager).

When a website gets its licence, ONLY the owner (the contact person, a user with a login) and the company (the entity of the website) are made on the master site, so that invoices
can be linked to them. Nothing else of the website goes there (no other users, no content).

Both have a unique id (`uid`). The master site looks first whether the person (by e-mail address) or the company (by registration number, VAT number, or name + e-mail address)
is there already and uses that one; when the same person or company has another website, the domain of this website is added to `domains`. The id on the master site is kept in the
local database (`remote_id`, shown in the user and company data, never changed by hand). A reset can also remove them from the master site again.

Client side: `push()`, `remove_remote()`. Server side (only when this installation is the site manager): `register()`, `remove()`."""
import logging
import re
from urllib.parse import urlparse

from django.contrib.auth import get_user_model

from . import entity, sitemanager, system
from .models import Entity

logger = logging.getLogger(__name__)
EMAIL_RE = entity.EMAIL_RE


def host_of(url):
    """The domain of an address ("https://www.shop.nl/x" -> "www.shop.nl"), lower case; "" when there is none."""
    u = str(url or "").strip()
    if not u:
        return ""
    host = urlparse(u if "//" in u else "//" + u).hostname or ""
    return host.lower()[:200]


def _add_domain(obj, domain):
    if domain and domain not in (obj.domains or []):
        obj.domains = [*(obj.domains or []), domain]
        obj.save(update_fields=["domains"])


def _drop_domain(obj, domain):
    obj.domains = [d for d in (obj.domains or []) if d != domain]
    obj.save(update_fields=["domains"])


# ── client side: this website tells the master site about its owner and company ──
def owner_user():
    """The site owner of this website: the user with the e-mail address of the contact person (made together with the entity by the licence). None when there is none."""
    email = str(system.get().get("contact_email") or "").strip().lower()
    if not EMAIL_RE.match(email):
        return None
    return get_user_model().objects.filter(email__iexact=email).first()


def payload():
    """What goes to the master site: {user, company, url}; None when there is no licence, no company or no owner yet."""
    if not system.license_info()["has"] or not entity.filled():
        return None
    u, e = owner_user(), entity.own()
    if not u:
        return None
    url = sitemanager.payload("sync")["url"]
    return {"url": url, "user": {"uid": str(u.uid), "remote_id": str(u.remote_id or ""), "email": u.email, "first_name": u.first_name, "last_name": u.last_name, "phone": u.phone, "mobile": u.mobile},
            "company": {"uid": str(e.uid), "remote_id": str(e.remote_id or ""), **{k: str(getattr(e, k) or "") for k in entity.FIELDS if k != "description"}}}


def has_remote():
    """True when the master site holds an owner or a company of this website (for the question at a reset)."""
    try:
        if sitemanager.server_enabled():
            return False
        u, e = owner_user(), entity.own() if entity.filled() else None
        return bool((u and u.remote_id) or (e and e.remote_id))
    except Exception:  # noqa: BLE001
        return False


def synced():
    """True when the master site knows the owner and the company of this website (their ids are kept here)."""
    u, e = owner_user(), entity.own() if entity.filled() else None
    return bool(u and e and u.remote_id and e.remote_id)


def mark_local():
    """The address of this website is kept with the owner and the company here too (their data show on which website they live)."""
    dom = host_of(sitemanager.payload("sync")["url"])
    u = owner_user()
    if u:
        _add_domain(u, dom)
    if entity.filled():
        _add_domain(entity.own(), dom)


def push(force=False, fresh=False):
    """Make or find the owner and the company on the master site and keep their ids here. Never raises. -> {ok, skipped, error}. This installation being the master itself: nothing to do.
    After a reset that removed them from the master site nothing is sent again (also not at the next login) until a new licence is made (fresh)."""
    try:
        if sitemanager.server_enabled():  # this installation IS the master site: the owner and the company are the records of the master, their id is the easy2edit id
            return _own_ids_here()
        if fresh:
            sitemanager._save(owner_removed=False)
        elif sitemanager._state().get("owner_removed"):
            return {"ok": True, "skipped": "removed", "error": ""}
        data = payload()
        if not data:
            return {"ok": False, "skipped": "no-data", "error": ""}
        if synced() and not force:
            return {"ok": True, "skipped": "done", "error": ""}
        key = sitemanager._state().get("token") or ""
        api = (sitemanager.global_settings.get().get("api_url") or "").rstrip("/")
        if not key or not api:
            return {"ok": False, "skipped": "not-registered", "error": ""}
        r = sitemanager._post(f"{api}/api/easy2edit/sites/owner/", data, key)
        uid_user, uid_company = str(r.get("user_id") or "")[:40], str(r.get("company_id") or "")[:40]
        if not uid_user or not uid_company:
            return {"ok": False, "skipped": "", "error": str(r.get("detail") or "no ids")[:200]}
        u, e = owner_user(), entity.own()
        get_user_model().objects.filter(pk=u.pk).update(remote_id=uid_user)
        Entity.objects.filter(pk=e.pk).update(remote_id=uid_company)
        for obj in (get_user_model().objects.get(pk=u.pk), Entity.objects.get(pk=e.pk)):
            _add_domain(obj, host_of(data["url"]))  # (the same domain, also kept here: the user and the company show on which website they live)
        return {"ok": True, "skipped": "", "error": ""}
    except Exception as ex:  # noqa: BLE001 - the licence never fails because of this
        logger.warning("site owner not sent to the master site: %s", ex)
        return {"ok": False, "skipped": "", "error": str(ex)[:200]}


def _own_ids_here():
    """On the master site itself there is no other server: the owner and the company of this website already live here, so their own id is also their easy2edit id."""
    data = payload()
    if not data:
        return {"ok": False, "skipped": "no-data", "error": ""}
    u, e = owner_user(), entity.own()
    get_user_model().objects.filter(pk=u.pk).update(remote_id=str(u.uid))
    Entity.objects.filter(pk=e.pk).update(remote_id=str(e.uid))
    mark_local()
    return {"ok": True, "skipped": "", "error": ""}


def push_async(fresh=False, force=False):
    import threading

    threading.Thread(target=push, kwargs={"fresh": fresh, "force": force}, name="siteowner-push", daemon=True).start()


def remove_remote():
    """At a reset: ask the master site to remove the owner and the company of this website. The remote ids here are cleared when it worked. Never raises. -> {ok, error}."""
    try:
        if sitemanager.server_enabled():
            return {"ok": True, "error": ""}
        key = sitemanager._state().get("token") or ""
        api = (sitemanager.global_settings.get().get("api_url") or "").rstrip("/")
        u, e = owner_user(), entity.own() if entity.filled() else None
        ids = {"user_id": u.remote_id if u else "", "company_id": e.remote_id if e else ""}
        if not (ids["user_id"] or ids["company_id"]):
            return {"ok": True, "error": ""}
        if not key or not api:
            return {"ok": False, "error": "not registered at the easy2edit server"}
        sitemanager._post(f"{api}/api/easy2edit/sites/owner/remove/", {**ids, "url": sitemanager.payload("sync")["url"]}, key)
        if u:
            get_user_model().objects.filter(pk=u.pk).update(remote_id="")
        if e:
            Entity.objects.filter(pk=e.pk).update(remote_id="")
        sitemanager._save(owner_removed=True)
        return {"ok": True, "error": ""}
    except Exception as ex:  # noqa: BLE001
        logger.warning("site owner not removed from the master site: %s", ex)
        return {"ok": False, "error": str(ex)[:200]}


# ── server side: the master site ──
def _clean(v, n):
    return re.sub(r"[\r\n\t]+", " ", str(v or "")).strip()[:n]


def _find_company(c):
    """The company that is there already: by registration number, then VAT number, then name + e-mail address. The own entity of the master site is never used."""
    qs = Entity.objects.filter(is_own=False)
    for field in ("registration_no", "vat_no"):
        v = _clean(c.get(field), 40)
        if v:
            hit = qs.filter(**{f"{field}__iexact": v}).first()
            if hit:
                return hit
    name, mail = _clean(c.get("name"), 120), _clean(c.get("email"), 160)
    if name and mail:
        return qs.filter(name__iexact=name, email__iexact=mail).first()
    return None


def register(site, data):
    """The owner and the company of an approved website: found or made, the domain of the website added. -> {user_id, company_id, user_new, company_new}. Raises ValueError (message) when the data is not usable."""
    if not site or site.status != "active":
        raise ValueError("Deze website is nog niet goedgekeurd op de easy2edit server.")
    ud, cd = data.get("user") if isinstance(data.get("user"), dict) else {}, data.get("company") if isinstance(data.get("company"), dict) else {}
    email = _clean(ud.get("email"), 150).lower()
    name = _clean(cd.get("name"), 120)
    domain = host_of(data.get("url") or site.url)
    if not EMAIL_RE.match(email) or not name or not domain:
        raise ValueError("E-mailadres van de eigenaar, naam van het bedrijf en het adres van de website zijn nodig.")
    User = get_user_model()
    user = None
    if ud.get("remote_id"):  # the owner is known here by its id: the same person gets the changed data (the id never changes)
        cand = User.objects.filter(uid=_uuid(ud.get("remote_id"))).first()
        if cand and domain in (cand.domains or []):
            user = cand
            if email != str(cand.email or "").lower() and not User.objects.filter(email__iexact=email).exclude(pk=cand.pk).exists():
                if str(cand.username or "").lower() == str(cand.email or "").lower():
                    cand.username = email[:150]
                cand.email = email
            cand.first_name = _clean(ud.get("first_name"), 60) or cand.first_name
            cand.last_name = _clean(ud.get("last_name"), 60) or cand.last_name
            phone = re.sub(r"[^\d+]", "", str(ud.get("phone") or ""))[:20]
            cand.phone = phone or cand.phone
            mobile = re.sub(r"[^\d+]", "", str(ud.get("mobile") or ""))[:20]
            cand.mobile = mobile or cand.mobile
            cand.save()
    if user is None:
        user = User.objects.filter(email__iexact=email).first()
    user_new = user is None
    if user_new:
        password = entity.generate_password()
        user = User(username=email[:150], email=email, first_name=_clean(ud.get("first_name"), 60), last_name=_clean(ud.get("last_name"), 60), phone=re.sub(r"[^\d+]", "", str(ud.get("phone") or ""))[:20],
                    mobile=re.sub(r"[^\d+]", "", str(ud.get("mobile") or ""))[:20])
        user.set_password(password)
        user.save()  # an ordinary user with a login: no roles, no admin rights on the master site
        entity._mail_account(user, password, system.get())
    comp = None
    if cd.get("remote_id"):  # the company is known by its id: the same company gets the changed name and address (the id never changes)
        cand = Entity.objects.filter(uid=_uuid(cd.get("remote_id")), is_own=False).first()
        if cand and domain in (cand.domains or []):
            comp = cand
            for k, (n, _var) in entity.FIELDS.items():
                if k != "description" and k in cd:
                    setattr(comp, k, _clean(cd.get(k), n))
            comp.website = comp.website if entity.URL_RE.match(comp.website or "") else ""
            comp.save()
    if comp is None:
        comp = _find_company(cd)
    company_new = comp is None
    if company_new:
        comp = Entity(kind="bedrijf", is_own=False)
        for k, (n, _var) in entity.FIELDS.items():
            if k != "description":
                setattr(comp, k, _clean(cd.get(k), n))
        comp.website = comp.website if entity.URL_RE.match(comp.website or "") else ""
        comp.save()
    comp.users.add(user)
    _add_domain(user, domain)
    _add_domain(comp, domain)
    return {"user_id": str(user.uid), "company_id": str(comp.uid), "user_new": user_new, "company_new": company_new}


def remove(site, data):
    """A website asks to remove its owner and company (after a reset): the domain of the website goes from both; a person or company that has no website left is deleted
    (a person with a role or admin rights is never deleted). -> {user_removed, company_removed}."""
    if not site or site.status == "blocked":
        raise ValueError("Onbekende website.")
    domain = host_of(data.get("url") or site.url)
    User = get_user_model()
    out = {"user_removed": False, "company_removed": False}
    comp = Entity.objects.filter(is_own=False, uid=_uuid(data.get("company_id"))).first() if data.get("company_id") else None
    if comp:
        _drop_domain(comp, domain)
        if not comp.domains:
            comp.delete()
            out["company_removed"] = True
    user = User.objects.filter(uid=_uuid(data.get("user_id"))).first() if data.get("user_id") else None
    if user:
        _drop_domain(user, domain)
        if not user.domains and not user.is_staff and not user.is_superuser and not user.roles.exists():
            user.delete()
            out["user_removed"] = True
    return out


def _uuid(v):
    import uuid

    try:
        return uuid.UUID(str(v))
    except (ValueError, TypeError):
        return uuid.UUID(int=0)
