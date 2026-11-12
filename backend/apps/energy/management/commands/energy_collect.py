# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand

from apps.energy import service


class Command(BaseCommand):
    help = "Reads the energy figures of all connected websites (the collector) and cleans up old measurements. Run it from cron, e.g. every night."

    def handle(self, *args, **opts):
        done = service.refresh_all()
        service.prune()
        self.stdout.write(f"{len([s for s in done if s.last_ok])} of {len(done)} websites read.")
