# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""
Erase a user completely (own request or by an admin):
  1. every file of the user (profile photo, photos, chat attachments, library items) from disk and from S3, with its record
  2. the user's encryption key (what could still be left in a backup can no longer be read)
  3. removal from groups and roles, own module rights, tokens and sessions
  4. the account itself; everything linked to it (profile, messages, likes, notifications, direct rooms…) goes with it
Orders are legal records: they stay, but name and address are blanked and the link to the account is cut.
"""
import logging
import os
import shutil

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)
ORDER_BLANK = {"name": "Verwijderd", "email": "", "phone": "", "street": "", "postal_code": "", "city": "", "note": ""}


def _remove_item(item):
    from apps.medialib import s3

    try:
        if item.storage == "s3":
            s3.delete(item)
        elif os.path.exists(item.local_path):
            os.remove(item.local_path)
    except Exception as e:  # noqa: BLE001  keep going: the rest must still be erased
        logger.warning("Erase: could not remove %s: %s", item.key, e)
    item.delete()


def erase_user(user):
    from apps.medialib import areas, filecrypt
    from apps.medialib.models import MediaItem
    from apps.plugins import facade
    ChatMessage, ProfilePhoto = facade.models("community", "ChatMessage", "ProfilePhoto")  # (the plugin Community)

    uid, folder = user.pk, areas.config()["users"]["folder"]
    keys = set()
    if user.image:
        keys.add(user.image.name)
    keys |= {n for n in ProfilePhoto.objects.filter(profile__user=user).values_list("image", flat=True) if n}
    keys |= {n for n in ProfilePhoto.objects.filter(profile__user=user).values_list("blurred", flat=True) if n}
    keys |= {n for n in ChatMessage.objects.filter(sender=user).values_list("attachment", flat=True) if n}
    items = list(MediaItem.objects.filter(key__in=keys) | MediaItem.objects.filter(owner_id=uid) | MediaItem.objects.filter(key__startswith=f"{folder}/{uid}/")
                 | MediaItem.objects.filter(uploaded_by=user))
    for item in {i.pk: i for i in items}.values():
        _remove_item(item)
    for name in keys:  # files without a record
        try:
            os.remove(os.path.join(str(settings.MEDIA_ROOT), name))
        except OSError:
            pass
    shutil.rmtree(os.path.join(str(settings.MEDIA_ROOT), folder, str(uid)), ignore_errors=True)
    with transaction.atomic():
        filecrypt.drop_key(f"user:{uid}")
        from apps import commerce

        if commerce.orders():
            commerce.orders().anonymize(user, ORDER_BLANK)
        user.roles.clear()
        user.user_groups.clear()
        user.grants.all().delete()
        from rest_framework.authtoken.models import Token

        Token.objects.filter(user=user).delete()
        user.delete()
    logger.info("User %s erased", uid)
