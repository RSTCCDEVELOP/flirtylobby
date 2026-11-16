# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import logging
import os

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class BackupsConfig(AppConfig):
    name = "apps.backups"

    def ready(self):
        """The backup jobs (per day, week, month) are started by a small timer inside the web process. `python manage.py run_backups` does the same from a cron job."""
        from apps.core import background

        def run():
            from apps.core import license_billing

            from . import scheduler

            scheduler.run_due()
            license_billing.run_due()  # the licence subscription (automatic collection) is on the same controller

        background.register("backups", run, every=60, first=30, enabled=lambda: os.getenv("BACKUP_SCHEDULER", "1") == "1")
        background.start()
