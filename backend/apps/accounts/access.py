"""
Module access levels: 0 none, 1 gebruik (use), 2 bewerken (edit), 3 beheer (manage: add/delete items).
A user's level per module = the highest of: superadmin (3 everywhere), the permission keys of their roles,
and the grants given to them or to their roles (Admin -> Modules -> poppetje).
"""
LEVEL_NAMES = {1: "Gebruik", 2: "Bewerken", 3: "Beheer"}
SECURITY = ["security_basic", "geo", "age_gate", "gambling", "cookies", "word_filter", "twofa"]

# permission key (roles page) -> {module: level}
PERM_LEVELS = {
    "users.manage": {"users": 3}, "roles.manage": {"roles": 3}, "languages.manage": {"languages": 3},
    "integrations.manage": {"integrations": 3}, "communication.manage": {"communication": 3}, "seo.manage": {"seo": 3}, "community.manage": {"profiles": 3, "messages": 3, "chat": 3, "discover": 3, "directconnect": 3}, "products.manage": {"orders": 3}, "orders.manage": {"orders": 3}, "sandbox.manage": {"sandbox": 3}, "branding.manage": {"branding": 3}, "media.manage": {"media": 3},
    "theme.manage": {"theme": 3}, "pages.manage": {"pages": 3}, "security.manage": {m: 3 for m in SECURITY},
    "content.edit": {"edit_mode": 2, "media": 1},
}


def levels(user):
    """{module: level} for this user (cached on the user object for the request)."""
    if hasattr(user, "_levels"):
        return user._levels
    from apps.core import modules

    if user.is_staff:
        out = {m["key"]: 3 for m in modules.MODULES}
    else:
        out = {}
        bump = lambda m, lv: out.__setitem__(m, max(out.get(m, 0), lv))  # noqa: E731
        for key in user.permission_keys():
            for m, lv in PERM_LEVELS.get(key, {}).items():
                bump(m, lv)
        from .models import ModuleGrant

        role_ids = list(user.all_roles().values_list("id", flat=True)) if modules.enabled("roles") else []
        group_ids = list(user.user_groups.values_list("id", flat=True))
        from django.db.models import Q

        for g in ModuleGrant.objects.filter(Q(user=user) | Q(role_id__in=role_ids) | Q(group_id__in=group_ids)):
            bump(g.module, g.level)
    user._levels = out
    return out


def can_admin(user):
    """May this person still log in during the maintenance mode: superadmins and everybody who has edit rights (level 2+) in some module."""
    return bool(user and user.is_authenticated and (user.is_staff or any(v >= 2 for v in levels(user).values())))


def level(user, module):
    return levels(user).get(module, 0) if user and user.is_authenticated else 0
