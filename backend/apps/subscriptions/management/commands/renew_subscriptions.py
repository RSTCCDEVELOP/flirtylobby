from django.core.management.base import BaseCommand

from apps.subscriptions import service


class Command(BaseCommand):
    help = "Create repeat orders for subscriptions whose period ended, and end unpaid / cancelled ones. Run daily (cron)."

    def handle(self, *args, **opts):
        self.stdout.write(f"renew_subscriptions: {service.process_due()} subscription(s) processed.")
