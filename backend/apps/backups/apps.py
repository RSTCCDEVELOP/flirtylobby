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


class BackupsConfig(AppConfig):
    name = "apps.backups"

    def ready(self):
        """The backup jobs (per day, week, month) are started by a small timer inside the web process. `python manage.py run_backups` does the same from a cron job."""
        if os.getenv("BACKUP_SCHEDULER", "1") != "1":
            return
        serving = ("gunicorn" in (sys.argv[0] or "")) or ("runserver" in sys.argv and os.environ.get("RUN_MAIN") == "true")
        if not serving:
            return
        threading.Thread(target=self._loop, name="backup-scheduler", daemon=True).start()

    @staticmethod
    def _loop():
        from django.db import close_old_connections

        time.sleep(30)
        while True:
            try:
                from . import scheduler

                scheduler.run_due()
                from apps.core import license_billing

                license_billing.run_due()  # the licence subscription (automatic collection) is on the same timer
            except Exception:  # noqa: BLE001 - the timer must never stop
                logger.exception("backup scheduler")
            finally:
                close_old_connections()
            time.sleep(60)
