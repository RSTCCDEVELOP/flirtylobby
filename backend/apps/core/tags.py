# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The tag system (module "tags"): a tag has a name, a colour and a scope, and can be put on any part of easy2edit.

What a tag is put on is named by `kind` and `ref`: user, group, entity, page, media, module (ref = the module key), plugin (ref = the plugin name) and, for what a plugin makes,
`plugin:<name>:<type>` (ref = the id the plugin uses). The scope of a tag decides where it may be used: global (on everything), module (only on the parts of the chosen modules) or
plugin (only on the parts of the chosen plugins). A part tells its module through KIND_MODULE; a plugin kind belongs to that plugin."""
import re

from . import modules
from .models import Tag, TagLink

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
KIND_RE = re.compile(r"^(user|group|entity|page|media|module|plugin|plugin:[a-z][a-z0-9-]{1,38}:[a-z0-9_-]{1,30})$")
KIND_MODULE = {"user": "users", "group": "users", "entity": "entities", "page": "pages", "media": "media"}  # the module a kind belongs to
KIND_LABEL = {"user": "Gebruikers", "group": "User groups", "entity": "Entiteiten", "page": "Pagina's", "media": "Media", "module": "Modules", "plugin": "Plugins"}


def clean_color(v, default=""):
    v = str(v or "").strip()
    if not v:
        return default
    if not COLOR_RE.match(v):
        raise ValueError("Kies een kleur als #rrggbb.")
    return v.lower()


def place_of(kind, ref):
    """("module", key) or ("plugin", name) or (None, None): where a thing belongs."""
    if kind in KIND_MODULE:
        return "module", KIND_MODULE[kind]
    if kind == "module":
        return "module", ref
    if kind == "plugin":
        return "plugin", ref
    if kind.startswith("plugin:"):
        return "plugin", kind.split(":")[1]
    return None, None


def allowed(tag, kind, ref):
    """May this tag be put on this thing?"""
    if tag.scope == "global":
        return True
    where, key = place_of(kind, ref)
    if tag.scope == "module":
        return where == "module" and key in (tag.modules or [])
    return where == "plugin" and key in (tag.plugins or [])


def clean_tag(body, instance=None):
    """Validate what the screen sends: {name, color, description, scope, modules, plugins}. Raises ValueError with a message for the person."""
    body = body if isinstance(body, dict) else {}
    name = str(body.get("name", instance.name if instance else "") or "").strip()[:60]
    if not name:
        raise ValueError("Geef de tag een naam.")
    dup = Tag.objects.filter(name__iexact=name)
    if instance:
        dup = dup.exclude(pk=instance.pk)
    if dup.exists():
        raise ValueError("Er is al een tag met deze naam.")
    scope = str(body.get("scope", instance.scope if instance else "global") or "global")
    if scope not in ("global", "module", "plugin"):
        raise ValueError("Kies overal, modules of plugins.")
    mods = [str(m) for m in (body.get("modules", instance.modules if instance else []) or [])]
    plugs = [str(p) for p in (body.get("plugins", instance.plugins if instance else []) or [])]
    unknown = [m for m in mods if m not in modules.BY_KEY]
    if unknown:
        raise ValueError(f"Deze module bestaat niet: {unknown[0]}.")
    if scope == "module" and not mods:
        raise ValueError("Kies minstens één module.")
    if scope == "plugin" and not plugs:
        raise ValueError("Kies minstens één plugin.")
    return {"name": name, "color": clean_color(body.get("color", instance.color if instance else ""), "#2563eb"), "description": str(body.get("description", instance.description if instance else "") or "").strip()[:200],
            "scope": scope, "modules": list(dict.fromkeys(mods)) if scope == "module" else [], "plugins": list(dict.fromkeys(plugs)) if scope == "plugin" else []}


def serialize(t, count=None):
    return {"id": t.id, "name": t.name, "color": t.color, "description": t.description, "scope": t.scope, "modules": t.modules or [], "plugins": t.plugins or [],
            "count": t.links.count() if count is None else count}


def save(instance, body):
    data = clean_tag(body, instance)
    t = instance or Tag()
    for k, v in data.items():
        setattr(t, k, v)
    t.save()
    if instance:  # a narrower scope drops the links that no longer fit
        for ln in list(t.links.all()):
            if not allowed(t, ln.kind, ln.ref):
                ln.delete()
    return t


def tags_of(kind, ref):
    return [ln.tag for ln in TagLink.objects.filter(kind=kind, ref=str(ref)).select_related("tag")]


def available_for(kind, ref):
    return [t for t in Tag.objects.all() if allowed(t, kind, str(ref))]


def set_tags(kind, ref, tag_ids):
    """Put exactly these tags on the thing (only tags whose scope allows it). Raises ValueError for a kind that does not exist or a tag that does not fit."""
    ref = str(ref)
    if not KIND_RE.match(kind) or not re.match(r"^[\w:.@+-]{1,120}$", ref):
        raise ValueError("Onbekend onderdeel.")
    want = Tag.objects.filter(pk__in=[int(i) for i in tag_ids if str(i).isdigit()])
    for t in want:
        if not allowed(t, kind, ref):
            raise ValueError(f"De tag \"{t.name}\" mag hier niet op.")
    keep = {t.pk for t in want}
    TagLink.objects.filter(kind=kind, ref=ref).exclude(tag_id__in=keep).delete()
    for t in want:
        TagLink.objects.get_or_create(tag=t, kind=kind, ref=ref)
    return [t.pk for t in want]


def map_for(kind):
    """{ref: [tag id]} for every thing of this kind that has a tag (for the lists)."""
    out = {}
    for ln in TagLink.objects.filter(kind=kind):
        out.setdefault(ln.ref, []).append(ln.tag_id)
    return out
