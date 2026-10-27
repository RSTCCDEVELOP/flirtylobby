# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net


"""De basis van de standaard installaties vastleggen of toepassen (backend/apps/core/installations.json)."""
from django.core.management.base import BaseCommand

from apps.core import installations_config


class Command(BaseCommand):
    help = "capture: de keuzes van deze site over de standaard installaties opslaan als basis. apply: de basis toepassen (alleen als het bestand nieuw is voor deze site; --force: altijd)."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["capture", "apply"])
        parser.add_argument("--force", action="store_true")

    def handle(self, *a, **o):
        if o["action"] == "capture":
            return self.stdout.write(str(installations_config.capture()))
        r = installations_config.apply(force=o["force"])
        self.stdout.write("installations_config: " + (f"toegepast ({', '.join(r['keys']) or 'leeg'})" if r["applied"] else "niets te doen"))
