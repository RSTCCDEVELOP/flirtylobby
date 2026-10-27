# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Na een update: de plugins (en modules) van de actieve standaard installatie komen terug als ze door de update verdwenen zijn."""
from django.core.management.base import BaseCommand

from apps.core import presets
from apps.plugins import installer


class Command(BaseCommand):
    help = "Zet de plugins en modules van de actieve standaard installatie terug (uit de bibliotheek) als een update ze kwijt was."

    def handle(self, *a, **o):
        installer.scan()
        fixed = presets.repair_active()
        self.stdout.write("Teruggezet: " + ", ".join(fixed) if fixed else "Niets te herstellen.")
