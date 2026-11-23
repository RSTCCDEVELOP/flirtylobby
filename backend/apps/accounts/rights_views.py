# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The API of the rights system (see rights.py): rights of modules, pages and records of plugins, and the setting of a plugin about who may set rights."""
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import rights
from .access import level
from .models import AccessTarget, User, UserGroup

NO = {"detail": "Je hebt hier geen rechten voor."}


def _admin(user):
    return bool(user and user.is_authenticated and user.is_staff)


def _bad(text, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": text}, status=code)


def _rights_modules():
    from apps.core import modules

    return [m for m in modules.MODULES if m.get("acl") is not False and m.get("key") != "rights"]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def people(request):
    """The users and groups to choose from. For administrators and for those who manage the pages (they set the rights of pages)."""
    if not (_admin(request.user) or level(request.user, "pages") >= 3):
        return Response(NO, status=status.HTTP_403_FORBIDDEN)
    q = str(request.query_params.get("q") or "").strip()[:60]
    users = User.objects.filter(is_active=True).order_by("first_name", "last_name", "email")
    if q:
        from django.db.models import Q

        users = users.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q))
    return Response({"users": [{"id": u.id, "name": " ".join(filter(None, [u.first_name, u.last_name])) or u.email, "email": u.email} for u in users[:300]],
                     "groups": [{"id": g.id, "name": g.name} for g in UserGroup.objects.all()[:300]]})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    """For the screen Rechten: the modules and plugins with how many users and groups have rights, and the setting of each plugin."""
    if not _admin(request.user):
        return Response(NO, status=status.HTTP_403_FORBIDDEN)
    from apps.core import modules
    from apps.plugins.models import Plugin

    from .models import ModuleGrant

    counts = {}
    for g in ModuleGrant.objects.exclude(user=None, group=None).values_list("module", flat=True):
        counts[g] = counts.get(g, 0) + 1
    mods = [{"key": m["key"], "label": m["label"], "group": m.get("group", ""), "entries": counts.get(m["key"], 0), "on": modules.enabled(m["key"])} for m in _rights_modules()]
    recs = {}
    for t in AccessTarget.objects.exclude(rules={}).values_list("plugin", flat=True):
        recs[t] = recs.get(t, 0) + 1
    plugins = [{"name": p.name, "title": p.title, "enabled": p.enabled, "rights_members": p.rights_members, "models": list(((p.manifest or {}).get("rights") or {}).get("models") or []), "restricted_records": recs.get(p.name, 0)}
               for p in Plugin.objects.all()]
    return Response({"modules": mods, "plugins": plugins})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def module_rights(request, key):
    if not _admin(request.user):
        return Response(NO, status=status.HTTP_403_FORBIDDEN)
    m = next((x for x in _rights_modules() if x["key"] == key), None)
    if not m:
        return _bad("Deze module bestaat niet of heeft geen rechten.", status.HTTP_404_NOT_FOUND)
    if request.method == "PUT":
        entries = request.data.get("entries")
        if not isinstance(entries, list):
            return _bad("Geef de lijst met rechten.")
        return Response({"module": key, "label": m["label"], "entries": rights.set_module_entries(key, entries)})
    return Response({"module": key, "label": m["label"], "entries": rights.module_entries(key)})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def page_rights(request, key):
    from apps.pages.models import Page

    if not (_admin(request.user) or level(request.user, "pages") >= 3):
        return Response(NO, status=status.HTTP_403_FORBIDDEN)
    p = Page.objects.filter(key=key).first()
    if not p:
        return _bad("Deze pagina bestaat niet.", status.HTTP_404_NOT_FOUND)
    if request.method == "PUT":
        entries = request.data.get("entries")
        if not isinstance(entries, list):
            return _bad("Geef de lijst met rechten.")
        p.access = rights.to_page_access(rights.rules_of_entries(entries))
        p.save(update_fields=["access", "updated_at"])
    return Response({"page": p.key, "entries": rights.entries_of(rights.of_page(p))})


_KEY = re.compile(r"^[a-z0-9_-]{1,60}$")


def _record_info(plugin, model, pk, user):
    t = AccessTarget.objects.filter(plugin=plugin, model=model, pk_text=pk).first()
    owner = None
    if t and t.owner:
        owner = {"id": t.owner_id, "name": " ".join(filter(None, [t.owner.first_name, t.owner.last_name])) or t.owner.email}
    return {"plugin": plugin, "model": model, "pk": pk, "owner": owner, "entries": rights.entries_of((t.rules if t else {}) or {}), "can_manage": rights.may_manage_record(user, plugin, model, pk) or _admin(user),
            "members_may_set": rights.members_may_set(plugin)}


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def record_rights(request, plugin, model, pk):
    """The rights of one record of a plugin. Administrators always; the owner of the record when the plugin allows people who are no administrator to set rights."""
    if not (_KEY.match(plugin) and _KEY.match(model) and re.match(r"^[\w.-]{1,60}$", pk)):
        return _bad("Ongeldig adres.", status.HTTP_404_NOT_FOUND)
    from apps.plugins.models import Plugin

    if not Plugin.objects.filter(name=plugin, enabled=True).exists():
        return _bad("Deze plugin staat uit of bestaat niet.", status.HTTP_404_NOT_FOUND)
    allowed = _admin(request.user) or rights.may_manage_record(request.user, plugin, model, pk)
    if request.method == "GET":
        if not allowed:
            return Response(NO, status=status.HTTP_403_FORBIDDEN)
    elif not allowed:
        return Response(NO, status=status.HTTP_403_FORBIDDEN)
    if request.method == "PUT":
        entries = request.data.get("entries")
        if not isinstance(entries, list):
            return _bad("Geef de lijst met rechten.")
        t = AccessTarget.objects.filter(plugin=plugin, model=model, pk_text=pk).first()
        rights.protect(plugin, model, pk, owner=t.owner_id if t else None, rules=rights.rules_of_entries(entries))
    elif request.method == "DELETE":
        t = AccessTarget.objects.filter(plugin=plugin, model=model, pk_text=pk).first()
        rights.protect(plugin, model, pk, owner=t.owner_id if t else None, rules={})
    return Response(_record_info(plugin, model, pk, request.user))


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def plugin_rights(request, name):
    """The setting of a plugin: may people who are no administrator set the rights of their own records?"""
    from apps.plugins.models import Plugin

    if not _admin(request.user):
        return Response(NO, status=status.HTTP_403_FORBIDDEN)
    pl = Plugin.objects.filter(name=name).first()
    if not pl:
        return _bad("Deze plugin bestaat niet.", status.HTTP_404_NOT_FOUND)
    if request.method == "PUT":
        pl.rights_members = bool(request.data.get("rights_members"))
        pl.save(update_fields=["rights_members", "updated_at"])
    return Response({"name": pl.name, "title": pl.title, "rights_members": pl.rights_members, "models": list(((pl.manifest or {}).get("rights") or {}).get("models") or [])})
