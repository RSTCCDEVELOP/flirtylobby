# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The entity of the website: the organisation behind it (module "entities", a core module like Users, always on).

Everything is local in the site. The model Entity holds the organisation of the site itself (is_own, only one) and other entities (companies, organisations, associations, clubs ...)
that users and user groups of the site are linked to. There is NO link with the easy2edit server (site manager); a link can be added later without changing the screens.

What the entity IS called is decided by the standard installation: `entity_kind` of the installation (organisation, company, association, club or a free name).
Default is "bedrijf" (company). A superadmin changes it per installation (Super admin -> Standaard installaties -> Inhoud -> Entiteit); the title of the admin tile follows it at once.

Texts can use variables ({{organisatie.naam}} ...): the website fills them in with the data of the entity, so a change in the admin works through on every page."""
import re

from . import richtext
from .models import Entity, SystemSettings

KEY = "entity"  # where it is kept inside SystemSettings.data (the basic data of the site does not read this key)
DEFAULT_KIND = "bedrijf"
FREE = "vrij"
KINDS = [  # key, label (Dutch source text; translated in the screens)
    ("organisatie", "Organisatie"),
    ("bedrijf", "Bedrijf"),
    ("vereniging", "Vereniging"),
    ("club", "Club"),
    (FREE, "Vrije naam"),
]
KIND_KEYS = [k for k, _ in KINDS]
FREE_DEFAULT = "Entiteit"
FREE_MAX = 40

# the fields of the entity: key -> (maximum length, variable name in texts)
FIELDS = {
    "name": (120, "naam"), "legal_name": (160, "juridische_naam"), "description": (4000, "omschrijving"),
    "email": (160, "email"), "phone": (40, "telefoon"), "website": (200, "website"),
    "street": (120, "straat"), "house_number": (20, "huisnummer"), "postal_code": (20, "postcode"), "city": (80, "plaats"), "country": (80, "land"),
    "registration_no": (40, "kvk"), "vat_no": (40, "btw"),
}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
URL_RE = re.compile(r"^https?://[^\s]{3,190}$")
VAR_RE = re.compile(r"\{\{\s*organisatie\.([a-z_]+)\s*\}\}")


def _data():
    return dict(SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {})


def kind_setting():
    """What the active standard installation says: {kind, name} (name only for a free name). The default is a company."""
    from . import presets

    key = presets.active()
    cfg = (presets.edits(key).get("entity") or {}) if key else {}
    kind = cfg.get("kind") if cfg.get("kind") in KIND_KEYS else (presets.BY_KEY.get(key, {}).get("entity_kind") if key else None)
    kind = kind if kind in KIND_KEYS else DEFAULT_KIND
    return {"kind": kind, "name": str(cfg.get("name") or "")[:FREE_MAX]}


def label(setting=None):
    """The word for the entity in this installation: Bedrijf, Organisatie, Vereniging, Club or the free name."""
    s = setting or kind_setting()
    if s["kind"] == FREE:
        return s["name"].strip() or FREE_DEFAULT
    return dict(KINDS)[s["kind"]]


LOC_FIELDS = {"name": 80, "street": 120, "house_number": 20, "postal_code": 20, "city": 80, "country": 80, "phone": 40, "email": 160}
LOC_MAX = 25  # more locations than this is not a company with a few addresses any more


def clean_locations(value):
    """The extra addresses of a company: a list of {name, street, house_number, postal_code, city, country, phone, email}. Empty rows are dropped; every location needs a name. Raises ValueError."""
    from . import phone as _phone

    if not isinstance(value, list):
        return []
    out = []
    for row in value[:LOC_MAX]:
        row = row if isinstance(row, dict) else {}
        loc = {k: str(row.get(k) or "").strip()[:lim] for k, lim in LOC_FIELDS.items()}
        if not any(loc.values()):
            continue
        if not loc["name"]:
            raise ValueError("Geef elke locatie een naam.")
        if loc["email"] and not EMAIL_RE.match(loc["email"]):
            raise ValueError("Het e-mailadres is niet geldig.")
        loc["phone"], bad = _phone.check(loc["phone"], 40)
        if bad:
            raise ValueError(bad)
        out.append(loc)
    return out


def clean(incoming):
    """Validate what the screen sends. Returns the clean dict; raises ValueError with a message for the person."""
    out = {}
    for k, (limit, _) in FIELDS.items():
        v = incoming.get(k, "")
        v = richtext.clean_small(v, limit) if k == "description" else str(v or "").strip()[:limit]
        out[k] = v
    if out["email"] and not EMAIL_RE.match(out["email"]):
        raise ValueError("Het e-mailadres is niet geldig.")
    if out["website"] and not URL_RE.match(out["website"]):
        raise ValueError("Het websiteadres moet beginnen met http:// of https://.")
    from . import phone as _phone

    out["phone"], bad = _phone.check(out["phone"], 40)
    if bad:
        raise ValueError(bad)
    return out


def own():
    """The entity of the website itself (made when it is first needed; an older save in the system settings is taken over once)."""
    e = Entity.objects.filter(is_own=True).first()
    if e:
        return e
    old = _data().get(KEY) or {}
    e = Entity.objects.create(is_own=True, kind=kind_setting()["kind"], **{k: str(old.get(k, "") or "")[:lim] for k, (lim, _) in FIELDS.items()})
    try:
        from . import everyone

        everyone.add_entity(e)  # in the group Everyone, like all users
    except Exception:  # noqa: BLE001
        pass
    return e


def get():
    """The saved data of the entity of the website (every field present, empty when not set)."""
    e = Entity.objects.filter(is_own=True).first()
    if not e:
        old = _data().get(KEY) or {}
        return {**{k: str(old.get(k, "") or "") for k in FIELDS}, "color": "", "locations": []}
    return {**{k: str(getattr(e, k) or "") for k in FIELDS}, "color": e.color or "", "locations": list(e.locations or [])}


def filled():
    """The entity counts as set up as soon as it has a name."""
    return bool(get()["name"].strip())


def save(incoming):
    """Save the entity of the website itself."""
    incoming = incoming if isinstance(incoming, dict) else {}
    cleaned = clean(incoming)
    e = own()
    for k, v in cleaned.items():
        setattr(e, k, v)
    if "color" in incoming:
        from .tags import clean_color

        try:
            e.color = clean_color(incoming.get("color"))
        except ValueError as x:
            raise ValueError(str(x))
    if "locations" in incoming:
        e.locations = clean_locations(incoming.get("locations"))
    e.save()
    return cleaned


# ── other entities, with the users and user groups that belong to them ──
def kind_label(e):
    if e.is_own:
        return label()
    return (e.kind_name.strip() or FREE_DEFAULT) if e.kind == FREE else dict(KINDS).get(e.kind, e.kind)


def serialize(e, detail=False, actor=None):
    out = {"id": e.id, "is_own": e.is_own, "name": e.name, "kind": kind_setting()["kind"] if e.is_own else e.kind, "kind_name": kind_setting()["name"] if e.is_own else e.kind_name, "kind_label": kind_label(e),
           "city": e.city, "email": e.email, "color": e.color or "", "user_count": e.users.count(), "group_count": e.groups.count()}
    if detail:
        out["data"] = {**{k: str(getattr(e, k) or "") for k in FIELDS}, "locations": list(e.locations or [])}
        out["ids"] = {"uid": str(e.uid), "remote_id": e.remote_id or "", "domains": list(e.domains or [])}  # read only: the unique id, the "easy2edit id" and the websites
        users = e.users.order_by("email")
        if actor is not None and not actor.is_staff:  # a delegated manager never sees the beheerders (like the users list)
            users = users.exclude(is_staff=True)
        out["users"] = [{"id": u.id, "name": (u.get_full_name() if hasattr(u, "get_full_name") else "") or u.email, "email": u.email} for u in users]
        out["groups"] = [{"id": g.id, "name": g.name} for g in e.groups.order_by("name")]
    return out


def save_other(e, body, actor=None):
    """Create or change an entity that is not the website's own: {kind, kind_name, ...the fields, user_ids, group_ids}. Raises ValueError with a message for the person."""
    from django.contrib.auth import get_user_model

    from apps.accounts.models import UserGroup

    body = body if isinstance(body, dict) else {}
    data = clean({**{k: getattr(e, k) for k in FIELDS}, **{k: v for k, v in body.items() if k in FIELDS}} if e.pk else body)
    if not data["name"].strip():
        raise ValueError("Vul een naam in.")
    if not e.is_own:
        kind = str(body.get("kind") or e.kind or DEFAULT_KIND)
        if kind not in KIND_KEYS:
            raise ValueError("Kies een soort: organisatie, bedrijf, vereniging, club of een vrije naam.")
        kind_name = str(body.get("kind_name", e.kind_name) or "").strip()[:FREE_MAX]
        if kind == FREE and not kind_name:
            raise ValueError("Geef de vrije naam een naam.")
        e.kind, e.kind_name = kind, kind_name if kind == FREE else ""
    for k, v in data.items():
        setattr(e, k, v)
    if "color" in body:
        from .tags import clean_color

        e.color = clean_color(body.get("color"))
    if "locations" in body:
        e.locations = clean_locations(body.get("locations"))
    e.save()
    if "user_ids" in body:
        ids = [int(x) for x in (body.get("user_ids") or []) if str(x).isdigit()]
        users = get_user_model().objects.filter(pk__in=ids)
        if actor is not None and not actor.is_staff:  # and cannot link them either
            users = users.exclude(is_staff=True)
            keep = list(e.users.filter(is_staff=True).values_list("pk", flat=True))  # the links to beheerders that the manager cannot see stay as they are
            e.users.set([*users.values_list("pk", flat=True), *keep])
        else:
            e.users.set(users)
    if "group_ids" in body:
        ids = [int(x) for x in (body.get("group_ids") or []) if str(x).isdigit()]
        e.groups.set(UserGroup.objects.filter(pk__in=ids))
    return e


def address(d=None):
    d = d or get()
    line1 = " ".join(x for x in (d["street"], d["house_number"]) if x)
    line2 = " ".join(x for x in (d["postal_code"], d["city"]) if x)
    return ", ".join(x for x in (line1, line2, d["country"]) if x)


def variables():
    """{variable name: text} for the texts of the website ({{organisatie.naam}} ...). The description is plain text here; the kind is {{organisatie.soort}}."""
    d = get()
    out = {name: (richtext.plain(d[k][5:]) if k == "description" and d[k].startswith("html:") else d[k]) for k, (_, name) in FIELDS.items()}
    out["adres"] = address(d)
    out["soort"] = label()
    return out


def fill(text):
    """Fill the variables of a text with the data of the entity; an unknown or empty variable is left out."""
    if not text or "{{" not in text:
        return text
    v = variables()
    return VAR_RE.sub(lambda m: v.get(m.group(1), ""), text)


def public():
    """What the website and the screens need: the kind and the title of the tile, the data and the variables (no secrets: all of it is meant to be shown)."""
    s = kind_setting()
    return {"id": own().pk, "kind": s["kind"], "label": label(s), "title": label(s), "kinds": [{"key": k, "label": lb} for k, lb in KINDS], "filled": filled(), "data": get(), "variables": variables()}


def creator_text():
    """The paragraph for the AI creator ("Over je organisatie"): who the website is for, so texts, colours, contact page and footer fit. Empty when nothing is set."""
    if not filled():
        return ""
    d, lb = get(), label()
    lines = [f"- {lb}: {d['name']}" + (f" ({d['legal_name']})" if d["legal_name"] else "")]
    for k, title in (("description", "About"), ("email", "E-mail"), ("phone", "Phone"), ("website", "Website")):
        v = richtext.plain(d[k][5:]) if k == "description" and d[k].startswith("html:") else d[k]
        if v:
            lines.append(f"- {title}: {v}")
    if address(d):
        lines.append(f"- Address: {address(d)}")
    for loc in d.get("locations") or []:
        lines.append(f"- Location {loc['name']}: " + ", ".join(x for x in (" ".join(y for y in (loc['street'], loc['house_number']) if y), " ".join(y for y in (loc['postal_code'], loc['city']) if y), loc['country']) if x))
    for k, title in (("registration_no", "Chamber of commerce"), ("vat_no", "VAT")):
        if d[k]:
            lines.append(f"- {title}: {d[k]}")
    return "\n".join(lines)


CONTACT_KEY = "entity_contact_done"  # the contact person was made a user once (when he is unlinked later, he is not linked again by itself)
ADMINS_SLUG, ADMINS_NAME = "admins", "Admins"
_pending = {"password": ""}


def generate_password(n=14):
    """A strong password that is easy to type: letters and digits without look-alikes, and a few signs."""
    import secrets

    pool = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    pw = [secrets.choice("abcdefghijkmnopqrstuvwxyz"), secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ"), secrets.choice("23456789"), secrets.choice("-_!?")]
    pw += [secrets.choice(pool) for _ in range(n - len(pw))]
    secrets.SystemRandom().shuffle(pw)
    return "".join(pw)


def set_pending_password(password):
    """The password that the set-up wizard showed for the contact person (used when he is made a user a moment later)."""
    _pending["password"] = str(password or "")[:128]


def ensure_admins_group(user):
    """The standard group "Admins" (with the role Admin: every right to administer) and this user in it."""
    from apps.accounts.models import Role, UserGroup

    role = Role.objects.filter(slug="admin").first()
    g = UserGroup.objects.filter(slug=ADMINS_SLUG).first() or UserGroup.objects.create(name=ADMINS_NAME, slug=ADMINS_SLUG, description="Beheerders van deze website.")
    if role and not g.roles.filter(pk=role.pk).exists():
        g.roles.add(role)
    g.members.add(user)
    if role:
        user.roles.add(role)  # (also directly: administering does not depend on the group)
    return g


def _mail_account(u, password, s):
    """Mail the new user his login and password (a failure is not fatal: the password is on the overview and the pdf too)."""
    try:
        from apps.communication import sending

        from . import system

        site, url = system.site_name(), (s.get("frontend_url") or "").rstrip("/")
        text = (f"Hallo {u.first_name or u.email},\n\nEr is een account voor je gemaakt voor {site}, met beheerrechten.\n\nInloggen: {url + '/login' if url else 'de website'}\n"
                f"E-mailadres: {u.email}\nWachtwoord: {password}\n\nVerander het wachtwoord na het inloggen (profiel).")
        sending.send_email(u.email, f"Je account voor {site}", text, purpose="security")
        return True
    except Exception:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).exception("account mail not sent")
        return False


def ensure_contact_user(s=None, force=False):
    """When the licence is there: the contact person of the basic data is made a **user with admin rights** (the role Admin, in the group Admins), linked to the entity of the website, with a
    password that is mailed to him (the one the wizard showed, else a new one). An existing account with that e-mail address is only linked (no rights, no password). Made once; needs an entity with
    a name. Returns "created", "linked" or "" (nothing to do or already done)."""
    from django.contrib.auth import get_user_model

    from . import system

    s = s or system.get()
    row, _ = SystemSettings.objects.get_or_create(pk=1)
    email = str(s.get("contact_email") or "").strip().lower()
    if not filled() or not EMAIL_RE.match(email):
        return ""
    mark = f"e{own().pk}"  # done for THIS entity (a new entity, after a reset for instance, is done again)
    if (row.data or {}).get(CONTACT_KEY) == mark and not force:
        return ""
    User = get_user_model()
    u = User.objects.filter(email__iexact=email).first()
    if u:
        out = "linked"  # an account that is there is linked at once (also before the licence)
    else:
        if not system.license_info()["has"] and not force:  # a new user (with admin rights and a password) is made when the licence is there
            return ""
        password = _pending["password"] or generate_password()
        u = User(username=email, email=email, first_name=str(s.get("contact_first_name") or "")[:60], last_name=str(s.get("contact_last_name") or "")[:60],
                 phone=re.sub(r"[^\d+]", "", str(s.get("mobile") or s.get("phone") or ""))[:20])  # (E.164: digits and +, at most 20)
        u.set_password(password)
        u.save()
        ensure_admins_group(u)
        _mail_account(u, password, s)
        out = "created"
    _pending["password"] = ""
    own().users.add(u)
    row.refresh_from_db()
    row.data = {**(row.data or {}), CONTACT_KEY: mark}
    row.save()
    return out


def sync_from_system(s):
    """At start up (the set-up wizard or the first save of Systeem > Basisgegevens): "Bedrijf en contact" becomes the entity of the website, and the contact person a user linked to it.
    The entity is made only while it has no name yet (an entity that was filled in is never overwritten); the contact person is made once, also when the entity was there already.
    Returns what was done: {"entity": bool, "user": "created" | "linked" | ""}."""
    out = {"entity": False, "user": ""}
    name = str(s.get("company_name") or "").strip()
    if name and not filled():
        e = own()
        web = str(s.get("frontend_url") or "")
        mapped = {"name": name, "email": s.get("contact_email"), "phone": s.get("phone"), "website": web if URL_RE.match(web) else "", "street": s.get("street"), "house_number": s.get("house_number"),
                  "postal_code": s.get("postal_code"), "city": s.get("city"), "country": s.get("country"), "registration_no": s.get("kvk"), "vat_no": s.get("vat_id")}
        for k, v in mapped.items():
            setattr(e, k, str(v or "").strip()[:FIELDS[k][0]])
        e.save()
        out["entity"] = True
    out["user"] = ensure_contact_user(s)
    return out


def ensure_from_licence():
    """The licence makes the entity: once the website has a licence, the company of the licence is the entity of the website and the contact person is a user linked to it. Called when the
    licence is made and whenever the entity is looked at while it is still empty (an older licence that was made before the entity existed). Only while the entity has no name; returns what was done."""
    from . import system

    out = {"entity": False, "user": ""}
    if filled():  # the entity is there: the contact person is linked or made (once for this entity)
        out["user"] = ensure_contact_user()
        return out
    if not system.license_info()["has"]:
        return out
    from .models import License

    lic = License.objects.filter(pk=1).first()
    s = dict(system.get())
    s["company_name"] = s.get("company_name") or (lic.client if lic else "") or s.get("site_name") or ""
    if lic and not s.get("frontend_url"):
        s["frontend_url"] = lic.main_url
    return sync_from_system(s)


# The variables that can be used in the texts of the pages and are also system objects of the page editor (kind "variable"): the company ({{organisatie.*}}) and the person who looks ({{user.*}}).
COMPANY_VARIABLES = [("organisatie.naam", "Naam"), ("organisatie.juridische_naam", "Juridische naam"), ("organisatie.omschrijving", "Omschrijving"), ("organisatie.email", "E-mail"), ("organisatie.telefoon", "Telefoon"),
                     ("organisatie.website", "Website"), ("organisatie.adres", "Adres"), ("organisatie.plaats", "Plaats"), ("organisatie.postcode", "Postcode"), ("organisatie.land", "Land"),
                     ("organisatie.kvk", "Registratienummer (KvK)"), ("organisatie.btw", "Btw-nummer"), ("organisatie.soort", "Soort")]
USER_VARIABLES = [("user.naam", "Naam"), ("user.voornaam", "Voornaam"), ("user.achternaam", "Achternaam"), ("user.email", "E-mail"), ("user.functie", "Functie"), ("user.bedrijf", "Bedrijf")]
VARIABLES = {k: ("Bedrijf" if k.startswith("organisatie.") else "Gebruiker") + ": " + label for k, label in COMPANY_VARIABLES + USER_VARIABLES}
