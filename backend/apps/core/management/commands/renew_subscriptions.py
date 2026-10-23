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
