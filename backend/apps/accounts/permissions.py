from rest_framework.permissions import BasePermission


LEVEL = {"use": 1, "edit": 2, "manage": 3}


def has_level(module, needed="use"):
    """DRF permission: access level on a module (gebruik < bewerken < beheer). Superadmins always pass."""
    from .access import level

    class _HasLevel(BasePermission):
        message = "Je hebt hier geen rechten voor."

        def has_permission(self, request, view):
            return level(request.user, module) >= LEVEL[needed]

    return _HasLevel


def has_level_for(module, rules, default="edit"):
    """Level depends on the view action (viewsets) or HTTP method (function views): rules = {"list": "use", ...}."""
    from .access import level

    class _ByAction(BasePermission):
        message = "Je hebt hier geen rechten voor."

        def has_permission(self, request, view):
            key = getattr(view, "action", None) or request.method
            return level(request.user, module) >= LEVEL[rules.get(key, rules.get(request.method, default))]

    return _ByAction


def has_level_any(*pairs):
    """Like has_level, but any of the (module, level) pairs is enough."""
    from .access import level

    class _Any(BasePermission):
        message = "Je hebt hier geen rechten voor."

        def has_permission(self, request, view):
            return any(level(request.user, m) >= LEVEL[lv] for m, lv in pairs)

    return _Any


def has_perm(*keys):
    """DRF permission: user is a beheerder or has at least one of the given permission keys via a role."""

    class _HasPerm(BasePermission):
        message = "Je hebt hier geen rechten voor."

        def has_permission(self, request, view):
            u = request.user
            return bool(u and u.is_authenticated and (u.is_staff or set(keys) & u.permission_keys()))

    return _HasPerm
