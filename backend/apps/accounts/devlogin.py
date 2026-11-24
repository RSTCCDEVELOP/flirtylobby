# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The password of your own computer (DEV_LOGIN_PASSWORD in backend/.env): "@" in a password field of a screen that asks for it again (the reset ...).
It only exists while the backend runs in DEBUG, for a request that comes from this computer itself, for localhost: the same conditions as the dev login (which logs in without any password)."""
import hmac
import os

from django.conf import settings


def from_this_computer(request):
    from_here = request.META.get("REMOTE_ADDR", "") in ("127.0.0.1", "::1") and not request.META.get("HTTP_X_FORWARDED_FOR")
    return bool(settings.DEBUG and from_here and request.get_host().split(":")[0] in ("localhost", "127.0.0.1"))


def password_ok(request, password):
    """True when this is your own computer in DEBUG and the password is DEV_LOGIN_PASSWORD (the one that the @ fills in)."""
    want = os.getenv("DEV_LOGIN_PASSWORD", "")
    return bool(want and password and from_this_computer(request) and hmac.compare_digest(str(password).encode(), want.encode()))


def check(request, user, password):
    """The password of the person, or on your own computer the password that @ fills in."""
    return bool(user.check_password(str(password or "")) or password_ok(request, password))
