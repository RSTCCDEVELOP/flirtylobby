# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""
Folder structure of all files. Three areas, each with its own root folder, place (local disk or S3) and encryption switch:

  users  content of members      <folder>/<user id>/profile|photos|chat/…   (one sub folder per user: easy to find and to erase)
  site   content of the website  <folder>/library|branding|home|themes/…
  other  everything else

Files that already exist keep their old place (legacy prefixes below are recognised), new files follow the structure.
"""
import copy
import re

LABELS = {"users": "Gebruikers", "site": "Website", "other": "Overig"}
DEFAULTS = {
    "users": {"folder": "users", "storage": "local", "encrypt": False},
    "site": {"folder": "", "storage": "local", "encrypt": False},
    "other": {"folder": "", "storage": "local", "encrypt": False},
}
LEGACY_USERS = ("profiles/", "images/tms/coaches/", "chat/")
LEGACY_SITE = ("library/", "branding/", "home/", "themes/")
FOLDER_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,30}(/[a-z0-9][a-z0-9_-]{0,30})?$")


def config():
    from .models import StorageSettings

    stored = StorageSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    cfg = copy.deepcopy(DEFAULTS)
    for area, vals in (stored.get("areas") or {}).items():
        if area in cfg and isinstance(vals, dict):
            cfg[area].update({k: v for k, v in vals.items() if k in cfg[area]})
    return cfg


def clean(incoming, s3_ok):
    """Validate what the admin sent; returns the full config or raises ValueError with a readable text."""
    cfg = config()
    for area, vals in (incoming or {}).items():
        if area not in cfg or not isinstance(vals, dict):
            continue
        folder = str(vals.get("folder", cfg[area]["folder"])).strip().strip("/").lower()
        if (folder or area == "users") and not FOLDER_RE.match(folder):
            raise ValueError(f"{LABELS[area]}: de mapnaam mag alleen a-z, 0-9, - en _ bevatten (maximaal één submap).")
        storage = vals.get("storage", cfg[area]["storage"])
        if storage not in ("local", "s3") or (storage == "s3" and not s3_ok):
            raise ValueError(f"{LABELS[area]}: S3 is niet gekoppeld of staat uit (Admin → API keys).")
        cfg[area] = {"folder": folder, "storage": storage, "encrypt": bool(vals.get("encrypt", cfg[area]["encrypt"]))}
    folders = [c["folder"] for c in cfg.values() if c["folder"]]
    if len(folders) != len(set(folders)):
        raise ValueError("Elk onderdeel heeft een eigen map nodig: twee onderdelen kunnen niet dezelfde map gebruiken.")
    return cfg


def area_of(key, cfg=None):
    cfg = cfg or config()
    uf, sf = cfg["users"]["folder"], cfg["site"]["folder"]
    if key.startswith(uf + "/") or key.startswith(LEGACY_USERS):
        return "users"
    if (sf and key.startswith(sf + "/")) or key.startswith(LEGACY_SITE):
        return "site"
    return "other"


def user_path(uid, sub, filename):
    return f"{config()['users']['folder']}/{int(uid)}/{sub}/{filename}"


def site_path(sub, filename=""):
    f = config()["site"]["folder"]
    p = "/".join(x for x in (f, sub.strip("/"), filename) if x)
    return p


def owner_of(key, cfg=None):
    cfg = cfg or config()
    m = re.match(rf"^{re.escape(cfg['users']['folder'])}/(\d+)/", key)
    return int(m.group(1)) if m else None


def scope_of(key, owner=None, cfg=None):
    cfg = cfg or config()
    area = area_of(key, cfg)
    owner = owner or (owner_of(key, cfg) if area == "users" else None)
    return f"user:{owner}" if owner else f"area:{area}"


def user_prefixes():
    return (config()["users"]["folder"] + "/",) + LEGACY_USERS
