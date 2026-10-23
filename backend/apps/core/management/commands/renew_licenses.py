# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand

from apps.core import license_billing


class Command(BaseCommand):
    help = "Incasseer de licentie als het abonnement (automatische incasso) aan de beurt is. Voor een cron-job; de webserver doet dit zelf ook elke minuut."

    def handle(self, *args, **opts):
        done = license_billing.run_due()
        self.stdout.write(self.style.SUCCESS(f"Betalingen gemaakt: {', '.join(done) or 'geen'}"))
