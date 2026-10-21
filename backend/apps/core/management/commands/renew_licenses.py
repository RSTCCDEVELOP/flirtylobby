from django.core.management.base import BaseCommand

from apps.core import license_billing


class Command(BaseCommand):
    help = "Incasseer de licentie als het abonnement (automatische incasso) aan de beurt is. Voor een cron-job; de webserver doet dit zelf ook elke minuut."

    def handle(self, *args, **opts):
        done = license_billing.run_due()
        self.stdout.write(self.style.SUCCESS(f"Betalingen gemaakt: {', '.join(done) or 'geen'}"))
