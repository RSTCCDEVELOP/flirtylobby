# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The standard user group "Everyone": made by the onboarding (the licence, and the onboarding done again) with all users of the website in it.
It has no roles and no module access of its own: it is only a group to address everybody (entities, notifications, access). Once it exists, every new user is added to it by itself;
a superadmin can rename it, give it roles or remove it (it is then made again by the next onboarding)."""
import logging

logger = logging.getLogger(__name__)

SLUG = "everyone"
NAME = "Everyone"
DESCRIPTION = "Alle gebruikers van deze website."


def ensure():
    """Make the group when it is not there and put every user in it. Returns {"created": bool, "added": number of users that were put in}."""
    from apps.accounts.models import User, UserGroup

    g = UserGroup.objects.filter(slug=SLUG).first()
    created = g is None
    if created:
        g = UserGroup.objects.filter(name__iexact=NAME).first() or UserGroup.objects.create(name=NAME, slug=SLUG, description=DESCRIPTION)
    from .models import Entity

    for e in Entity.objects.filter(is_own=True):  # the company of the licence (the entity of the website) is in the group too
        e.groups.add(g)
    have = set(g.members.values_list("pk", flat=True))
    new = [u for u in User.objects.values_list("pk", flat=True) if u not in have]
    if new:
        g.members.add(*new)
    return {"created": created, "added": len(new)}


def add_entity(entity):
    """The entity of the website that is made after the group exists goes into the group too."""
    from apps.accounts.models import UserGroup

    g = UserGroup.objects.filter(slug=SLUG).first()
    if g and entity.is_own:
        entity.groups.add(g)


def connect():
    """A new user goes into the group "Everyone" (when that group exists)."""
    from django.db.models.signals import post_save

    from apps.accounts.models import User

    def add(sender, instance, created, **kwargs):
        if not created:
            return
        try:
            from apps.accounts.models import UserGroup

            g = UserGroup.objects.filter(slug=SLUG).first()
            if g:
                g.members.add(instance)
        except Exception:  # noqa: BLE001 - never stop making a user for this (e.g. before the migrations)
            logger.debug("everyone: user not added", exc_info=True)

    post_save.connect(add, sender=User, dispatch_uid="easy2edit-everyone-group", weak=False)
