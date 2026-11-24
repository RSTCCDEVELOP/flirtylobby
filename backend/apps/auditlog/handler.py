# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Errors of the server go into the log (Logboek) as lines "Storing" with the rank of a superadmin, so a superadmin can follow a malfunction there. Always on: it is part of the
logging of the server (config/settings.py LOGGING). The same errors and warnings also go to a rotating file in <site folder>/logs/easy2edit.log.
The same message is written once a minute (a loop of errors must not fill the log); this handler never raises and never logs itself."""
import hashlib
import logging
import threading

_busy = threading.local()
SKIP = ("apps.auditlog", "django.db", "django.server")


class DbErrorHandler(logging.Handler):
    def __init__(self, level=logging.ERROR):
        super().__init__(level)

    def emit(self, record):
        if getattr(_busy, "on", False) or record.name.startswith(SKIP):
            return
        _busy.on = True
        try:
            from django.core.cache import cache

            msg = record.getMessage()[:300]
            if record.exc_info and record.exc_info[1] is not None:
                msg += f" | {type(record.exc_info[1]).__name__}: {str(record.exc_info[1])[:150]}"
            if not cache.add("auditlog:err:" + hashlib.md5(f"{record.name}:{msg[:160]}".encode()).hexdigest(), 1, 60):
                return
            from . import service

            service.log("system.error", None, detail=msg[:500], target=record.name[:200], level=2)
        except Exception:  # noqa: BLE001 - the log must never stop what it logs
            pass
        finally:
            _busy.on = False
