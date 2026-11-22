# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import os

from django.apps import AppConfig


class EcologiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ecologi"
    label = "ecologi"

    def ready(self):
        """The automatic monthly planting is checked by the small timer inside the web process (like the backups and the energy measuring)."""
        from apps.core import background

        def run():
            from . import service

            service.run_auto()

        background.register("ecologi", run, every=3600, first=90, enabled=lambda: os.getenv("ECOLOGI_SCHEDULER", "1") == "1")
        background.start()
