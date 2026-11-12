# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand

from apps.energy import scheduler, service


class Command(BaseCommand):
    help = "Measures when it is due (the setting 'Automatisch meten'), reads the connected websites and cleans up old measurements. The web process does this by itself; this is for a cron job (e.g. every 15 minutes). --force measures now."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="measure now, whatever the schedule says")

    def handle(self, *args, **opts):
        if opts["force"]:
            ok, err = scheduler.run()
            self.stdout.write("measured" if ok else f"failed: {err}")
        else:
            self.stdout.write("measured" if scheduler.run_due() else "nothing due")
        done = service.refresh_all() if not opts["force"] else []
        service.prune()
        self.stdout.write(f"{len([s for s in done if s.last_ok])} of {len(done)} websites read.")
