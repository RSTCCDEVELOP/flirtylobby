# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Links that have to be opened with a password first. A superadmin+ marks a link in its settings ("Eerst met wachtwoord openen") and chooses the password. Until a person has
opened the link with that password (for 30 minutes, per person) it is only a closed card: no settings, no test result, no change, no delete, no test message. The password is only
kept as a hash. The key itself is never in the screen (it is always masked); this lock keeps the link, its settings and its use away from people who should not touch it."""
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache

OPEN_SECONDS = 30 * 60
MAX_TRIES = 5


def _key(user, obj):
    return f"intunlock:{user.pk}:{obj.pk}"


def is_open(user, obj):
    """True when the link is not locked, or this person opened it less than 30 minutes ago."""
    return (not obj.locked) or bool(cache.get(_key(user, obj)))


def try_open(user, obj, password):
    """'ok' | 'wrong' | 'blocked' (too many wrong tries: wait 10 minutes)."""
    tries = f"intunlock-tries:{user.pk}:{obj.pk}"
    if (cache.get(tries) or 0) >= MAX_TRIES:
        return "blocked"
    if obj.lock_password and check_password(str(password or ""), obj.lock_password):
        cache.set(_key(user, obj), 1, OPEN_SECONDS)
        cache.delete(tries)
        return "ok"
    cache.set(tries, (cache.get(tries) or 0) + 1, 600)
    return "wrong"


def close(user, obj):
    cache.delete(_key(user, obj))


def hash_password(raw):
    return make_password(raw)
