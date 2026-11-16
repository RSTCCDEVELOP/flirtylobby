# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The controller of the background jobs: ONE small timer thread for everything that must happen now and then (backups, energy measuring, licence billing ...), instead of a thread per module.
A module registers its job with `register(name, fn, every=seconds)`; the controller sleeps until the first job is due and then runs every job that is due in one go (one database clean-up per round).
So the server stays quiet when nothing is due, and it needs one thread instead of several. `python manage.py run_background` runs one round from a cron job."""
import logging
import os
import sys
import threading
import time

logger = logging.getLogger(__name__)

TASKS = {}  # name -> {"fn", "every", "next", "enabled"}
_lock = threading.Lock()
_wake = threading.Event()
_started = {"on": False}
MAX_SLEEP = 300  # never longer asleep than this: a job that is registered later is found within five minutes


def register(name, fn, every=60, first=30, enabled=None):
    """Add (or replace) a job. every = seconds between two runs; first = seconds until the first run; enabled = a function that says whether the job is switched on (checked each round)."""
    with _lock:
        TASKS[name] = {"fn": fn, "every": max(5, int(every)), "next": time.time() + max(0, first), "enabled": enabled}
    _wake.set()


def run_due(now=None):
    """Run every job that is due, one after the other, and plan the next run. Returns the names that ran. A job that fails is logged and tried again at its next turn."""
    now = now or time.time()
    with _lock:
        due = [n for n, t in TASKS.items() if t["next"] <= now]
    ran = []
    for name in due:
        t = TASKS.get(name)
        if not t:
            continue
        t["next"] = now + t["every"]
        try:
            if t["enabled"] is None or t["enabled"]():
                t["fn"]()
                ran.append(name)
        except Exception:  # noqa: BLE001 - the controller must never stop
            logger.exception("background job %s", name)
    if ran:
        try:
            from django.db import close_old_connections

            close_old_connections()
        except Exception:  # noqa: BLE001
            pass
    return ran


def seconds_until_next(now=None):
    now = now or time.time()
    with _lock:
        nxt = min((t["next"] for t in TASKS.values()), default=now + MAX_SLEEP)
    return max(1.0, min(MAX_SLEEP, nxt - now))


def _loop():
    while True:
        try:
            run_due()
        except Exception:  # noqa: BLE001
            logger.exception("background controller")
        _wake.wait(seconds_until_next())  # asleep until the first job is due (or a new job is registered)
        _wake.clear()


def serving():
    """True in a process that serves the website (not in migrate, tests, shell ...)."""
    argv0 = os.path.basename(sys.argv[0] or "")
    if argv0 == "manage.py":
        return len(sys.argv) > 1 and sys.argv[1] == "runserver" and os.environ.get("RUN_MAIN") == "true"
    return "pytest" not in (sys.argv[0] or "") and "PYTEST_CURRENT_TEST" not in os.environ


def start():
    """Start the one thread (once per process)."""
    with _lock:
        if _started["on"] or not serving():
            return False
        _started["on"] = True
    threading.Thread(target=_loop, name="background-controller", daemon=True).start()
    return True
