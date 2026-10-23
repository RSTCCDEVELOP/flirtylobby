# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""De standaard instellingen vastleggen of toepassen (backend/apps/core/site_defaults.json)."""
from django.core.management.base import BaseCommand

from apps.core import site_defaults
from apps.core.models import SiteSettings
from apps.security.models import SecuritySettings


class Command(BaseCommand):
    help = "capture: de instellingen van deze site als standaard opslaan. apply: de standaard instellingen toepassen (--if-new: alleen op een nieuwe, nog niet ingestelde site)."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["capture", "apply"])
        parser.add_argument("--if-new", action="store_true")

    def handle(self, *a, **o):
        if o["action"] == "capture":
            return self.stdout.write(str(site_defaults.capture()))
        if o["if_new"] and (SiteSettings.objects.exists() or SecuritySettings.objects.exists()):
            return self.stdout.write("site_defaults: deze site is al ingesteld, overgeslagen.")
        res = site_defaults.apply()
        self.stdout.write("site_defaults: " + (", ".join(f"{r['key']}={'ok' if r['ok'] else 'fout'}" for r in res) or "niets opgeslagen"))
