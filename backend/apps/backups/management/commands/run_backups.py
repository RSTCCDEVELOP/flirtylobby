from django.core.management.base import BaseCommand

from apps.backups import scheduler


class Command(BaseCommand):
    help = "Maak de backups die nu aan de beurt zijn (dag, week, maand). Voor een cron-job; de webserver doet dit zelf ook elke minuut."

    def handle(self, *args, **opts):
        ran = scheduler.run_due()
        self.stdout.write(self.style.SUCCESS(f"Backups gemaakt: {', '.join(ran) or 'geen'}"))
