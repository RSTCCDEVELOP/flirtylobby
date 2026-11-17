# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Superadmin+: the level above a superadmin. A superadmin+ is a superadmin who also sees and manages the easy2edit modules (the modules that are marked
"Alleen superadmin+" in Super admin -> Modules). A normal superadmin does not see those and has no access to them.

The standard superadmin+ accounts are made again at every start and at an installation or reset, and they are never switched off by a reset."""
DEFAULT_EMAILS = ("ronald@rstcc.net", "admin@easy2edit.com")


def ensure():
    """Mark the standard superadmin+ accounts that exist (a superadmin+ is always a superadmin too). Returns the e-mail addresses that were changed."""
    from .models import User

    changed = []
    for email in DEFAULT_EMAILS:
        for u in User.objects.filter(email__iexact=email):
            if not (u.is_staff and u.is_superuser and u.is_superadmin_plus):
                User.objects.filter(pk=u.pk).update(is_staff=True, is_superuser=True, is_superadmin_plus=True)
                changed.append(u.email)
    return changed
