# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""WebSocket for notifications: the browser keeps one connection open and the server says when there is news ("notify"), so the bell does not have to ask every few seconds.

Plain ASGI (no extra packages): /ws/notifications/ (the login token is sent as the first message). The server looks at the user's notifications every two seconds (one small query) and only sends a message when
something changed, which also works with several worker processes (no shared memory or Redis needed). The browser then loads the list itself with its normal API call."""
import asyncio
import json
import logging
import re
from urllib.parse import parse_qs

logger = logging.getLogger(__name__)

EVERY = 2  # seconds between two looks in the database
TOKEN_CHECK = 30  # seconds between two checks that the login is still valid


def _origin_ok(origin):
    from django.conf import settings

    if not origin or getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False):
        return True
    if origin in getattr(settings, "CORS_ALLOWED_ORIGINS", []):
        return True
    return any(re.match(rx, origin) for rx in getattr(settings, "CORS_ALLOWED_ORIGIN_REGEXES", []))


def _user_of(token):
    from django.db import close_old_connections
    from rest_framework.authtoken.models import Token

    close_old_connections()
    try:
        row = Token.objects.select_related("user").filter(key=token).first()
        return row.user.pk if row and row.user.is_active else None
    finally:
        close_old_connections()


def _snapshot(user_id):
    from django.db import close_old_connections

    from .models import Notification

    close_old_connections()
    try:
        qs = Notification.objects.filter(user_id=user_id)
        return (qs.order_by("-id").values_list("id", flat=True).first() or 0, qs.filter(read_at__isnull=True).count())
    finally:
        close_old_connections()


async def notifications_socket(scope, receive, send):
    from asgiref.sync import sync_to_async

    headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
    if (await receive())["type"] != "websocket.connect":
        return
    if not _origin_ok(headers.get("origin")):
        await send({"type": "websocket.close", "code": 4403})
        return
    await send({"type": "websocket.accept"})
    # the login token is not in the address (addresses end up in logs): the first message is {"auth": token}
    token, user_id = "", None
    try:
        first = await asyncio.wait_for(receive(), 5)
        token = str((json.loads(first.get("text") or "{}")).get("auth") or "") if first["type"] == "websocket.receive" else ""
        user_id = await sync_to_async(_user_of, thread_sensitive=False)(token) if token else None
    except Exception:  # noqa: BLE001
        user_id = None
    if not user_id:
        await send({"type": "websocket.close", "code": 4401})
        return
    closed = asyncio.Event()

    async def reader():
        while True:
            msg = await receive()
            if msg["type"] == "websocket.disconnect":
                closed.set()
                return
            if msg.get("text") == "ping":
                await send({"type": "websocket.send", "text": "pong"})

    task = asyncio.ensure_future(reader())
    try:
        last = await sync_to_async(_snapshot, thread_sensitive=False)(user_id)
        await send({"type": "websocket.send", "text": json.dumps({"type": "hello", "last": last[0], "unread": last[1]})})
        waited = 0
        while not closed.is_set():
            try:
                await asyncio.wait_for(closed.wait(), EVERY)
                break
            except asyncio.TimeoutError:
                pass
            waited += EVERY
            if waited >= TOKEN_CHECK:
                waited = 0
                if not await sync_to_async(_user_of, thread_sensitive=False)(token):
                    await send({"type": "websocket.close", "code": 4401})
                    break
            now = await sync_to_async(_snapshot, thread_sensitive=False)(user_id)
            if now != last:
                last = now
                await send({"type": "websocket.send", "text": json.dumps({"type": "notify", "last": now[0], "unread": now[1]})})
    except Exception:  # noqa: BLE001 - a closed connection ends here
        logger.debug("notification socket ended", exc_info=True)
    finally:
        task.cancel()
