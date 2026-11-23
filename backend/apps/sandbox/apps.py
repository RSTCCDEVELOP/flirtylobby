# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.apps import AppConfig


class SandboxConfig(AppConfig):
    name = "apps.sandbox"

    def ready(self):
        """The planned restores of the demo mode run on the background controller (one timer for everything)."""
        import os

        from apps.core import background

        def run():
            from . import demo

            demo.run_due()

        background.register("demo-restore", run, every=60, first=45, enabled=lambda: os.getenv("BACKUP_SCHEDULER", "1") == "1")
        background.start()
