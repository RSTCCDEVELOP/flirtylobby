import copy
import re
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from apps.core import modules
from apps.core.models import Language

from . import themes
from .models import Block, Profile, ProfileAllow, SocialSettings

DEFAULTS = {
    "profiles": {"max_photos": 10, "default_visibility": "members", "private_photos": True, "requests_enabled": True, "decline_days": 14, "max_private_photos": 10,
                 **themes.theme_payload("normal")},
    "messages": {"max_length": 5000, "rate_per_minute": 20},
    "discover": {
        "min_age": 18, "max_age": 99, "max_results": 60, "require_photo": 0, "default_sort": "active", "suggestions": True,
        "require_to_search": True, "require_to_like": True, "show_non_participants": False,
        "show_visitors": True, "visitors_days": 30, "show_likes_received": True, "match_email": True, "like_email": False, "swipe": "auto", "pass_days": 30,
        "distance_enabled": True, "radii": [5, 10, 25, 50, 100, 250], "max_distance_km": 500, "geocoder_contact": "",
    },
    "chat": {"method": "portal", "display": "both", "style": "floating", "popup_position": "", "show_on": ["home", "website", "dashboard", "backend"], "photos": True, "videos": True, "video_chat": True,
             "max_image_mb": 10, "max_video_mb": 50, "direct_hours": 2, "stun": ["stun:stun.l.google.com:19302"],
             "turn_url": "", "turn_user": "", "turn_credential": ""},
}
CHOICES = {("discover", "default_sort"): ["active", "newest", "distance"], ("discover", "swipe"): ["auto", "on", "off"], ("profiles", "default_visibility"): ["public", "members", "friends", "selected"], ("chat", "method"): ["portal", "webrtc"],
           ("chat", "display"): ["popup", "page", "both"], ("chat", "style"): ["floating", "button"],
           ("chat", "popup_position"): ["", "top-left", "top-right", "bottom-left", "bottom-right", "center"]}
INTS = {("discover", "min_age"): (13, 99), ("discover", "max_age"): (18, 120), ("discover", "max_results"): (10, 200), ("discover", "require_photo"): (0, 5),
        ("discover", "visitors_days"): (1, 365), ("discover", "pass_days"): (1, 365), ("discover", "max_distance_km"): (5, 2000), ("profiles", "max_photos"): (1, 30), ("profiles", "decline_days"): (0, 365), ("profiles", "max_private_photos"): (0, 30), ("messages", "max_length"): (100, 20000), ("messages", "rate_per_minute"): (1, 120),
        ("chat", "max_image_mb"): (1, 50), ("chat", "direct_hours"): (1, 72), ("chat", "max_video_mb"): (1, 500)}
BOOLS = {("discover", "like_email"), ("profiles", "private_photos"), ("profiles", "requests_enabled"), ("discover", "show_visitors"), ("discover", "suggestions"), ("discover", "require_to_search"), ("discover", "require_to_like"),
         ("discover", "show_non_participants"), ("discover", "show_likes_received"), ("discover", "match_email"), ("discover", "distance_enabled"), ("chat", "photos"), ("chat", "videos"), ("chat", "video_chat")}
STRS = {("discover", "geocoder_contact"), ("chat", "turn_url"), ("chat", "turn_user"), ("chat", "turn_credential")}


import re as _re


def clean_fields(raw):
    """Validate the admin-defined profile fields (see themes.py for the spec)."""
    if not isinstance(raw, list):
        raise Invalid("Velden moeten een lijst zijn.")
    out, seen = [], set()
    for n, x in enumerate(raw[:40], 1):
        if not isinstance(x, dict):
            raise Invalid(f"Veld {n} is ongeldig.")
        key, label = str(x.get("key", "")).strip(), str(x.get("label", "")).strip()[:60]
        if not _re.fullmatch(r"[a-z][a-z0-9_]{1,30}", key) or key in seen:
            raise Invalid(f"Veld {n}: de sleutel moet uniek zijn (a-z, 0-9, _; 2-31 tekens).")
        if not label:
            raise Invalid(f"Veld {key}: geef een naam.")
        typ = x.get("type")
        if typ not in themes.TYPES:
            raise Invalid(f"Veld {label}: ongeldig type.")
        options = [str(o).strip()[:60] for o in (x.get("options") or []) if str(o).strip()][:40]
        if typ in ("select", "multiselect") and len(set(options)) < 1:
            raise Invalid(f"Veld {label}: voeg minimaal één keuze toe.")
        vis = x.get("visibility", "members")
        if vis not in themes.VISIBILITY:
            raise Invalid(f"Veld {label}: ongeldige zichtbaarheid.")
        seen.add(key)
        out.append({"key": key, "label": label, "type": typ, "options": list(dict.fromkeys(options)) if typ in ("select", "multiselect") else [],
                    "unit": str(x.get("unit", ""))[:12], "required": bool(x.get("required")), "visibility": vis, "card": bool(x.get("card")),
                    "filter": bool(x.get("filter")) and typ != "textarea", "group": str(x.get("group", "")).strip()[:40]})
    return out


def clean_values(fields, incoming, old):
    """Validate the member's values for the configured fields. Returns (data, error)."""
    from apps.security.words import find_forbidden

    data = dict(old or {})
    inc = incoming if isinstance(incoming, dict) else {}
    for fl in fields:
        k = fl["key"]
        if k not in inc:
            continue
        v, t = inc[k], fl["type"]
        if t == "checkbox":
            v = bool(v)
        elif v in (None, "", []):
            v = [] if t == "multiselect" else ""
        elif t == "number":
            try:
                v = float(v)
            except (TypeError, ValueError):
                return None, f"{fl['label']}: vul een getal in."
            if not -1e9 < v < 1e9:
                return None, f"{fl['label']}: getal buiten bereik."
            v = int(v) if v == int(v) else round(v, 2)
        elif t == "select":
            if v not in fl["options"]:
                return None, f"{fl['label']}: ongeldige keuze."
        elif t == "multiselect":
            if not isinstance(v, list) or any(o not in fl["options"] for o in v):
                return None, f"{fl['label']}: ongeldige keuze."
            v = list(dict.fromkeys(v))
        elif t == "date":
            from datetime import date as _d
            try:
                v = _d.fromisoformat(str(v)).isoformat()
            except ValueError:
                return None, f"{fl['label']}: ongeldige datum."
        elif t == "url":
            v = str(v).strip()[:300]
            if not _re.fullmatch(r"https?://[^\s]{3,290}", v):
                return None, f"{fl['label']}: gebruik een volledige link (https://…)."
        else:
            v = str(v).strip()[: 4000 if t == "textarea" else 200]
            if words := find_forbidden(v):
                return None, f"{fl['label']}: bevat niet toegestane woorden ({', '.join(words)})."
        data[k] = v
    return data, None


def can_see_field(fl, viewer, owner_id):
    vis = fl["visibility"]
    authed = bool(viewer and getattr(viewer, "is_authenticated", False))
    if authed and (viewer.id == owner_id or viewer.is_staff):
        return True
    if vis == "public":
        return True
    if vis == "members":
        return authed
    if vis == "friends":
        return authed and are_friends(viewer.id, owner_id)
    return False


def mask(card, builtin=None):
    """Hide the built-in profile fields the admin switched off (Admin -> Community -> Profielvelden)."""
    b = builtin or get()["profiles"]["builtin"]
    off = {"headline": ["headline"], "bio": ["bio"], "gender": ["gender"], "birth_date": ["age"], "city": ["city", "country", "distance_km"],
           "interests": ["interests"], "aim": ["aim"]}
    for key, names in off.items():
        if not b.get(key, True):
            for n in names:
                if n in card:
                    card[n] = [] if isinstance(card[n], list) else None if n in ("age", "distance_km") else ""
    return card


def empty(v):
    return v in (None, "", [], False)


def visible_fields(p, viewer, only_card=False):
    """[{key,label,type,group,unit,value}] of the configured fields this viewer may see, with a value."""
    out = []
    for fl in get()["profiles"]["fields"]:
        if only_card and not fl["card"]:
            continue
        v = (p.data or {}).get(fl["key"])
        if empty(v) or not can_see_field(fl, viewer, p.user_id):
            continue
        out.append({"key": fl["key"], "label": fl["label"], "type": fl["type"], "group": fl["group"], "unit": fl["unit"], "value": v})
    return out


def get():
    d = copy.deepcopy(DEFAULTS)
    stored = SocialSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    for sec, vals in stored.items():
        if sec in d and isinstance(vals, dict):
            d[sec].update({k: v for k, v in vals.items() if k in d[sec]})
    return d


class Invalid(Exception):
    pass


def save(incoming, sections):
    """Validate + store only the sections the caller may edit."""
    cur = get()
    for sec, vals in (incoming or {}).items():
        if sec not in cur or sec not in sections or not isinstance(vals, dict):
            continue
        for k, v in vals.items():
            if k not in cur[sec]:
                continue
            key = (sec, k)
            if key in CHOICES:
                if v not in CHOICES[key]:
                    raise Invalid("Ongeldige keuze.")
            elif key in INTS:
                if isinstance(v, bool) or not isinstance(v, int) or not INTS[key][0] <= v <= INTS[key][1]:
                    raise Invalid(f"Getal tussen {INTS[key][0]} en {INTS[key][1]}.")
            elif key in BOOLS:
                v = bool(v)
            elif key in STRS:
                v = str(v or "").strip()[:300]
            elif k == "radii":
                v = sorted({int(x) for x in (v or []) if str(x).isdigit() and 1 <= int(x) <= 5000})[:10]
                if not v:
                    raise Invalid("Minimaal één afstand.")
            elif key == ("profiles", "theme"):
                if v not in themes.THEMES:
                    raise Invalid("Onbekend thema.")
            elif key == ("profiles", "builtin"):
                v = {b: bool((v or {}).get(b, cur[sec]["builtin"].get(b, True))) for b in themes.BUILTIN_KEYS}
            elif key == ("profiles", "fields"):
                v = clean_fields(v)
            elif k == "show_on":
                v = [x for x in dict.fromkeys(v or []) if x in ("home", "website", "dashboard", "backend")]
            elif k == "stun":
                v = [str(s).strip() for s in (v or []) if str(s).strip()][:5]
                if any(not re.match(r"^stuns?:[\w.\-:]+$", s) for s in v):
                    raise Invalid("STUN-adressen beginnen met stun: (bv. stun:stun.example.com:3478).")
            cur[sec][k] = v
    obj, _ = SocialSettings.objects.get_or_create(pk=1)
    obj.data = cur
    obj.save()
    return cur


# ── names, photos, blocking ─────────────────────────────────────────────────
def display_name(u):
    return u.display_name or f"{u.first_name} {u.last_name}".strip() or u.email.split("@")[0]


PHOTO_VISIBILITY = ("public", "members", "private", "hidden")


def photo_for(ph, viewer, owner_id=None):
    """(url, blurred) of a profile photo for `viewer`, or (None, False) when he may not see it at all.
    public: everybody who can see the page; members: logged-in members; private: blurred until access (friends / granted);
    hidden: only the owner (and superadmins). The original is never sent to someone who may only see the blurred copy."""
    from django.core.files.storage import default_storage

    owner_id = owner_id or ph.profile.user_id
    authed = bool(viewer and getattr(viewer, "is_authenticated", False))
    if authed and (viewer.id == owner_id or viewer.is_staff):
        return default_storage.url(ph.image.name), False
    v = ph.visibility
    if v == "hidden" or (v == "members" and not authed):
        return None, False
    if v == "private" and not can_see_private(viewer, owner_id):
        return (default_storage.url(ph.blurred.name), True) if ph.blurred else (None, False)
    return default_storage.url(ph.image.name), False


def photo_url(u, viewer=None):
    """Avatar of a member: the first photo this viewer may see (blurred when private); no photos at all: the account picture."""
    from django.core.files.storage import default_storage

    p = getattr(u, "profile", None) if hasattr(u, "profile") else None
    photos = list(p.photos.all()) if p else []
    for ph in photos:
        url, _ = photo_for(ph, viewer, u.id)
        if url:
            return url
    if photos:
        return None  # has photos, but none for this viewer: placeholder
    return default_storage.url(u.image.name) if u.image else None


def make_blur(photo):
    """Create the blurred copy: reduced to a few colour blocks, so the person can not be recognised."""
    from io import BytesIO

    from django.core.files.base import ContentFile
    from PIL import Image, ImageFilter, ImageOps

    photo.image.open("rb")
    try:
        img = ImageOps.exif_transpose(Image.open(photo.image)).convert("RGB")
    finally:
        photo.image.close()
    # keep only a few big colour blocks, then smooth them: shapes, faces and details are gone for good
    img = img.resize((6, 6), Image.BOX)
    img = img.resize((240, 240), Image.BICUBIC).filter(ImageFilter.GaussianBlur(28))
    buf = BytesIO()
    img.save(buf, "JPEG", quality=50)
    photo.blurred.save("b.jpg", ContentFile(buf.getvalue()), save=False)


# ── friends and access requests ─────────────────────────────────────────────
def _accepted(a_id, b_id, kind):
    from .models import Connection

    return Connection.objects.filter(status="accepted", kind=kind).filter(
        Q(from_user_id=a_id, to_user_id=b_id) | Q(from_user_id=b_id, to_user_id=a_id)).exists()


def are_friends(a_id, b_id):
    return _accepted(a_id, b_id, "friend")


def can_see_private(viewer, owner_id):
    """May `viewer` see the private photos of member `owner_id`? Owner, superadmins, friends, and members the owner granted."""
    from .models import Connection

    if not viewer or not getattr(viewer, "is_authenticated", False):
        return False
    if viewer.id == owner_id or viewer.is_staff:
        return True
    return are_friends(viewer.id, owner_id) or Connection.objects.filter(status="accepted", kind="photos", from_user=viewer, to_user_id=owner_id).exists()


def hidden_ids(user):
    """Users that block me or that I blocked: invisible to me, and I am invisible to them."""
    pairs = Block.objects.filter(Q(blocker=user) | Q(blocked=user)).values_list("blocker_id", "blocked_id")
    return {i for a, b in pairs for i in (a, b)} - {user.id}


def is_blocked_between(a, b):
    return Block.objects.filter(Q(blocker=a, blocked=b) | Q(blocker=b, blocked=a)).exists()


def unique_slug(base, exclude_pk=None):
    base = slugify(base) or "lid"
    slug, n = base, 2
    while Profile.objects.filter(slug=slug).exclude(pk=exclude_pk).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


def profile_of(user):
    p = Profile.objects.filter(user=user).first()
    if not p:
        p = Profile.objects.create(user=user, slug=unique_slug(display_name(user)), visibility=get()["profiles"]["default_visibility"],
                                   gender=user.gender, birth_date=user.birth_date)
    return p


def can_view(viewer, p, lang=None):
    """May `viewer` (a user or anonymous) see profile `p`? Owner and superadmins always; blocks hide both ways."""
    authed = bool(viewer and viewer.is_authenticated)
    if authed and (viewer.id == p.user_id or viewer.is_staff):
        return True
    if not p.enabled or not p.user.is_active:
        return False
    if authed and is_blocked_between(viewer, p.user):
        return False
    if p.languages and lang and lang not in p.languages:
        return False
    if p.visibility == "public":
        return True
    if not authed:
        return False
    if p.visibility == "members":
        return True
    if p.visibility == "friends":
        return are_friends(viewer.id, p.user_id)
    if ProfileAllow.objects.filter(profile=p, user=viewer).exists() or are_friends(viewer.id, p.user_id):
        return True
    from .models import Connection

    return Connection.objects.filter(status="accepted", kind="profile", from_user=viewer, to_user_id=p.user_id).exists()


def can_interact(a, b):
    """Messages/chat between two users: both active, not blocked."""
    return a.id != b.id and b.is_active and not is_blocked_between(a, b)


def touch(user):
    """Presence: remember that the user is active now (at most once per 20 seconds)."""
    if not user.last_seen or timezone.now() - user.last_seen > timedelta(seconds=20):
        type(user).objects.filter(pk=user.pk).update(last_seen=timezone.now())


def online(u):
    return bool(u.last_seen and timezone.now() - u.last_seen < timedelta(seconds=45))


def module_on(key):
    return modules.enabled(key)


def active_languages():
    return list(Language.objects.filter(enabled=True).values_list("code", flat=True))
