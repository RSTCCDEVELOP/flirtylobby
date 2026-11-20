# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Superadmin+: the level above a superadmin. A superadmin+ is a superadmin who also sees and manages the easy2edit modules (the modules that are marked
"Alleen superadmin+" in Super admin -> Modules). A normal superadmin does not see those and has no access to them.

The standard superadmin+ accounts are made again at every start and at an installation or reset, and they are never switched off by a reset."""
RECOVERY_EMAIL = "admin@easy2edit.com"  # can always log in as superadmin+: when the account is gone it is made again through the password reset (see pwreset.py)
RECOVERY_FIRST, RECOVERY_LAST = "Ronald", "Stolk"
DEFAULT_EMAILS = ("ronald@rstcc.net", RECOVERY_EMAIL)


def restore(user):
    """Make the account the standard superadmin+ again: active, name Ronald Stolk, superadmin and superadmin+."""
    user.first_name, user.last_name = user.first_name or RECOVERY_FIRST, user.last_name or RECOVERY_LAST
    user.is_active = user.is_staff = user.is_superuser = user.is_superadmin_plus = True
    user.email_verified = True  # the code went to this address and was confirmed
    user.save()


def ensure():
    """Mark the standard superadmin+ accounts that exist (a superadmin+ is always a superadmin too). Returns the e-mail addresses that were changed."""
    from .models import User

    changed = []
    for email in DEFAULT_EMAILS:
        for u in User.objects.filter(email__iexact=email):
            if not (u.is_staff and u.is_superuser and u.is_superadmin_plus and u.is_active) and (u.is_active or u.has_usable_password()):  # (an account that waits for the recovery code stays switched off)
                User.objects.filter(pk=u.pk).update(is_staff=True, is_superuser=True, is_superadmin_plus=True, is_active=True)
                changed.append(u.email)
    return changed
