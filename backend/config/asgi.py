import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django_app = get_asgi_application()


async def application(scope, receive, send):
    """HTTP goes to Django; the WebSocket for notifications (/ws/notifications/) is handled here; the server's start and stop messages are answered."""
    if scope["type"] == "lifespan":
        while True:
            msg = await receive()
            if msg["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif msg["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
    if scope["type"] == "websocket":
        if scope.get("path") == "/ws/notifications/":
            from apps.notifications.ws import notifications_socket

            return await notifications_socket(scope, receive, send)
        await receive()
        return await send({"type": "websocket.close", "code": 4404})
    return await django_app(scope, receive, send)
