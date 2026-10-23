# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand

from apps.plugins import facade, runtime


class Command(BaseCommand):
    help = "Create repeat orders for subscriptions whose period ended, and end unpaid / cancelled ones (the plugin Abonnementen). Run daily (cron)."

    def handle(self, *args, **opts):
        runtime.ensure_loaded(True)
        p = facade.provider("subscriptions")
        if p is None:
            return self.stdout.write("renew_subscriptions: de plugin Abonnementen staat uit.")
        self.stdout.write(f"renew_subscriptions: {p.renew()} subscription(s) processed.")
