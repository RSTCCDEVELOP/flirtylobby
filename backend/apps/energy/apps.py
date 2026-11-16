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


class EnergyConfig(AppConfig):
    name = "apps.energy"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        """The automatic measuring (once a day by default) is started by a small timer inside the web process, like the backups. `python manage.py energy_collect` does the same from a cron job."""
        from apps.core import background

        def run():
            from . import scheduler

            scheduler.run_due()

        background.register("energy", run, every=300, first=45, enabled=lambda: os.getenv("ENERGY_SCHEDULER", "1") == "1")  # (the measuring is once a day: a check every five minutes is plenty)
        background.start()
