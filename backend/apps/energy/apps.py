# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging
import os
import sys
import threading
import time

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class EnergyConfig(AppConfig):
    name = "apps.energy"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        """The automatic measuring (once a day by default) is started by a small timer inside the web process, like the backups. `python manage.py energy_collect` does the same from a cron job."""
        if os.getenv("ENERGY_SCHEDULER", "1") != "1":
            return
        argv0 = os.path.basename(sys.argv[0] or "")
        if argv0 == "manage.py" and not (len(sys.argv) > 1 and sys.argv[1] == "runserver" and os.environ.get("RUN_MAIN") == "true"):
            return  # migrate, check, shell, tests… do not start a timer
        threading.Thread(target=self._loop, name="energy-scheduler", daemon=True).start()

    @staticmethod
    def _loop():
        from django.db import close_old_connections

        time.sleep(45)
        while True:
            try:
                from . import scheduler

                scheduler.run_due()
            except Exception:  # noqa: BLE001 - the timer must never stop
                logger.exception("energy scheduler")
            finally:
                close_old_connections()
            time.sleep(60)
