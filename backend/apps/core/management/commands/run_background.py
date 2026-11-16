# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand

from apps.core import background


class Command(BaseCommand):
    help = "Runs every background job that is due (backups, energy, licence billing) once: for a cron job when the web process has no timer."

    def handle(self, *args, **opts):
        for t in background.TASKS.values():
            t["next"] = 0
        self.stdout.write(", ".join(background.run_due()) or "nothing due")
