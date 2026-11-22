# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Restart the server from Admin -> Basisgegevens -> Cache (a superadmin): a setting that is read at start (the kind of cache) takes effect.

How, depends on how the server runs:
- gunicorn (production): a graceful reload (SIGHUP to the master): the workers are replaced one by one, no request is lost;
- uvicorn with --reload (development): the settings file is touched, the reloader starts the server again;
- anything else: it can not be done from here ("manual": the person is told to restart the service or container)."""
import logging
import os
import signal
import subprocess
import threading
import time
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)


def _command_of(pid):
    try:
        return subprocess.run(["ps", "-o", "command=", "-p", str(pid)], capture_output=True, text=True, timeout=3).stdout.strip()
    except Exception:  # noqa: BLE001
        return ""


def mode():
    """How this server can be restarted: "gunicorn" | "reload" | "manual"."""
    parent = _command_of(os.getppid())
    if "gunicorn" in parent:
        return "gunicorn"
    me = _command_of(os.getpid()) + " " + parent
    if "uvicorn" in me and "--reload" in me or "multiprocessing" in me and "uvicorn" in parent:
        return "reload"
    return "manual"


def _do(how):
    time.sleep(1.2)  # (the answer to the browser goes out first)
    try:
        if how == "gunicorn":
            os.kill(os.getppid(), signal.SIGHUP)
        elif how == "reload":
            Path(settings.BASE_DIR, "config", "settings.py").touch()
    except Exception:  # noqa: BLE001
        logger.exception("Restart failed")


def restart():
    """Start the restart in the background. -> {ok, mode}"""
    how = mode()
    if how == "manual":
        return {"ok": False, "mode": how}
    threading.Thread(target=_do, args=(how,), daemon=True, name="restart").start()
    return {"ok": True, "mode": how}
