# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The rights system: who may view, edit and delete what. Standard part of the system (always on).

Three kinds of things have rights, all with the same three rights and the same people (users and groups of users):
- a MODULE: stored as ModuleGrant (view = level 1, edit = level 2, delete = level 3, which also is "beheer"); nobody has a right that was not given, an administrator has all of them.
- a PAGE: lists on the page (Page.access); the rights of the module Pagina's still count, the lists narrow them down for this page.
- a RECORD of a plugin (a product, a document ...): lists in AccessTarget; the plugin asks `can()` next to its own checks, see apps/plugins/facade.py.

The lists ("rules"): {"view": {"users": [ids], "groups": [ids]}, "edit": {...}, "delete": {...}}. An empty list for a right = no restriction for that right.
A list restricts AND gives: only the people in it (and the owner and the administrators) have the right. A higher right includes the lower ones for this check: somebody who may delete may also edit and view,
somebody who may edit may also view. Administrators (staff) can always do everything.
"""
from django.db import models

from .models import AccessTarget

ACTIONS = ("view", "edit", "delete")
CHAIN = {"view": ("view", "edit", "delete"), "edit": ("edit", "delete"), "delete": ("delete",)}  # who counts for a right: the people of the right itself and of the higher ones
LEVELS = {"view": 1, "edit": 2, "delete": 3}  # a module grant: view = gebruik, edit = bewerken, delete = beheer (which includes deleting)
MAX_IDS = 200


def empty():
    return {a: {"users": [], "groups": []} for a in ACTIONS}


def clean(raw):
    """Rules from outside (an API call, a page): only known rights, only numbers, no doubles, existing users and groups. -> the rules without empty lists."""
    from .models import User, UserGroup

    raw = raw if isinstance(raw, dict) else {}
    out = {}
    for a in ACTIONS:
        part = raw.get(a) if isinstance(raw.get(a), dict) else {}
        ids = lambda k: sorted({int(x) for x in part.get(k) or [] if str(x).isdigit()})[:MAX_IDS]  # noqa: E731
        users = list(User.objects.filter(pk__in=ids("users")).values_list("id", flat=True).order_by("id"))
        groups = list(UserGroup.objects.filter(pk__in=ids("groups")).values_list("id", flat=True).order_by("id"))
        if users or groups:
            out[a] = {"users": users, "groups": groups}
    return out


def of_page(page):
    """The rules of a page. The old list of a page ({"users": [], "groups": []}) is the list of the right to view."""
    acc = dict(page.access or {})
    rules = {a: acc[a] for a in ("edit", "delete") if isinstance(acc.get(a), dict)}
    if acc.get("users") or acc.get("groups"):
        rules["view"] = {"users": acc.get("users") or [], "groups": acc.get("groups") or []}
    return rules


def to_page_access(rules):
    """The rules as they are stored on a page: the list of viewing stays at the top (like before), edit and delete next to it."""
    rules = clean(rules)
    out = {}
    if "view" in rules:
        out.update(rules["view"])
    for a in ("edit", "delete"):
        if a in rules:
            out[a] = rules[a]
    return out


def restricted(rules, action):
    """Does this right have a list of its own? (A list for editing does not restrict viewing.)"""
    part = (rules or {}).get(action) or {}
    return bool(part.get("users") or part.get("groups"))


def listed(rules, user, action):
    """Is this user (or a group of his) in the lists that count for this right?"""
    if not user or not user.is_authenticated:
        return False
    uid, gids = user.id, None
    for a in CHAIN[action]:
        part = (rules or {}).get(a) or {}
        if uid in (part.get("users") or []):
            return True
        if part.get("groups"):
            gids = set(user.user_groups.values_list("id", flat=True)) if gids is None else gids
            if gids & set(part["groups"]):
                return True
    return False


def allowed(rules, user, action, owner_id=None):
    """May this user do this with the thing that has these rules? Without a list for the right: yes (the rights of the module and the plugin decide). With a list: only those in it, the owner and administrators."""
    if user and user.is_authenticated and user.is_staff:
        return True
    if not restricted(rules, action):
        return True
    if owner_id and user and user.is_authenticated and user.id == owner_id:
        return True
    return listed(rules, user, action)


# ── modules ──

def module_entries(module):
    """Who has which right to a module: [{"type": "user"|"group", "id", "name", "view", "edit", "delete"}]. (Roles keep working as before; they are not listed here.)"""
    from .models import ModuleGrant

    out = []
    for g in ModuleGrant.objects.filter(module=module).exclude(user=None, group=None).select_related("user", "group").order_by("id"):
        lv = g.level
        out.append(_entry("user", g.user, lv) if g.user_id else _entry("group", g.group, lv))
    return out


def _entry(kind, obj, level):
    name = (" ".join(filter(None, [obj.first_name, obj.last_name])) or obj.email) if kind == "user" else obj.name
    return {"type": kind, "id": obj.id, "name": name, "view": level >= 1, "edit": level >= 2, "delete": level >= 3}


def level_of(entry):
    """The module level of an entry: the highest right that is ticked (a right includes the lower ones)."""
    return 3 if entry.get("delete") else 2 if entry.get("edit") else 1 if entry.get("view") else 0


def set_module_entries(module, entries):
    """Replace the rights of users and groups to a module. Roles are left alone. An entry without any right is removed."""
    from .models import ModuleGrant, User, UserGroup

    want = {}
    for e in entries or []:
        if not isinstance(e, dict) or e.get("type") not in ("user", "group") or not str(e.get("id")).isdigit():
            continue
        lv = level_of(e)
        if lv:
            want[(e["type"], int(e["id"]))] = lv
    users = {u.id for u in User.objects.filter(pk__in=[i for t, i in want if t == "user"])}
    groups = {g.id for g in UserGroup.objects.filter(pk__in=[i for t, i in want if t == "group"])}
    keep = {(t, i): lv for (t, i), lv in want.items() if (t == "user" and i in users) or (t == "group" and i in groups)}
    ModuleGrant.objects.filter(module=module).filter(models.Q(user__isnull=False) | models.Q(group__isnull=False)).delete()
    for (t, i), lv in keep.items():
        ModuleGrant.objects.create(module=module, level=lv, **({"user_id": i} if t == "user" else {"group_id": i}))
    return module_entries(module)


# ── the same lists as entries for a screen (pages and records) ──

def entries_of(rules):
    """Rules as one row per person or group: [{"type", "id", "name", "view", "edit", "delete"}]."""
    from .models import User, UserGroup

    rules = rules or {}
    rows = {}
    for a in ACTIONS:
        part = rules.get(a) or {}
        for i in part.get("users") or []:
            rows.setdefault(("user", i), {"view": False, "edit": False, "delete": False})[a] = True
        for i in part.get("groups") or []:
            rows.setdefault(("group", i), {"view": False, "edit": False, "delete": False})[a] = True
    users = {u.id: u for u in User.objects.filter(pk__in=[i for t, i in rows if t == "user"])}
    groups = {g.id: g for g in UserGroup.objects.filter(pk__in=[i for t, i in rows if t == "group"])}
    out = []
    for (t, i), flags in rows.items():
        obj = users.get(i) if t == "user" else groups.get(i)
        if obj is None:
            continue
        name = (" ".join(filter(None, [obj.first_name, obj.last_name])) or obj.email) if t == "user" else obj.name
        out.append({"type": t, "id": i, "name": name, **flags})
    return sorted(out, key=lambda r: (r["type"], r["name"].lower()))


def rules_of_entries(entries):
    """The other way round: rows of a screen to rules (cleaned)."""
    rules = empty()
    for e in entries or []:
        if not isinstance(e, dict) or e.get("type") not in ("user", "group") or not str(e.get("id")).isdigit():
            continue
        for a in ACTIONS:
            if e.get(a):
                rules[a]["users" if e["type"] == "user" else "groups"].append(int(e["id"]))
    return clean(rules)


# ── records of plugins ──

def _target(plugin, model, pk):
    return AccessTarget.objects.filter(plugin=str(plugin), model=str(model), pk_text=str(pk)).first()


def record_rules(plugin, model, pk):
    t = _target(plugin, model, pk)
    return (t.rules or {}) if t else {}


def protect(plugin, model, pk, owner=None, rules=None):
    """Set the rights of a record (when it is made, or later). `rules` as in the lists above. Only the owner and the lists remain with a right that has a list; no lists and no owner = nothing is stored."""
    rules = clean(rules)
    owner_id = getattr(owner, "id", owner) or None
    if not rules and not owner_id:
        AccessTarget.objects.filter(plugin=str(plugin), model=str(model), pk_text=str(pk)).delete()
        return None
    t, _ = AccessTarget.objects.update_or_create(plugin=str(plugin), model=str(model), pk_text=str(pk), defaults={"owner_id": owner_id, "rules": rules})
    return t


def forget(plugin, model, pk):
    """The record is deleted: its rights go too."""
    AccessTarget.objects.filter(plugin=str(plugin), model=str(model), pk_text=str(pk)).delete()


def can(user, plugin, model, pk, action="view"):
    """May this user do `action` with this record? Next to the checks of the plugin itself (who may see its records at all)."""
    t = _target(plugin, model, pk)
    return True if not t else allowed(t.rules or {}, user, action, t.owner_id)


def hidden_pks(user, plugin, model, action="view"):
    """The keys (text) of the records of this model that this user may NOT do `action` with. For `qs.exclude(pk__in=...)`."""
    if user and user.is_authenticated and user.is_staff:
        return []
    out = []
    for t in AccessTarget.objects.filter(plugin=str(plugin), model=str(model)).exclude(rules={}):
        if not allowed(t.rules or {}, user, action, t.owner_id):
            out.append(t.pk_text)
    return out


def exclude_hidden(qs, user, plugin, model, action="view"):
    """A queryset of records without the ones this user may not see (or edit, or delete)."""
    gone = hidden_pks(user, plugin, model, action)
    return qs.exclude(pk__in=[int(x) if str(x).isdigit() else x for x in gone]) if gone else qs


def may_manage_record(user, plugin, model, pk):
    """Who may change the rights of a record: administrators, and the owner when the plugin allows people who are no administrator to set rights (setting of the plugin)."""
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    t = _target(plugin, model, pk)
    if not t or not t.owner_id or t.owner_id != user.id:
        return False
    return members_may_set(plugin)


def members_may_set(plugin):
    from apps.plugins.models import Plugin

    return bool(Plugin.objects.filter(name=plugin, enabled=True, rights_members=True).exists())
