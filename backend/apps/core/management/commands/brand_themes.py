# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Zet de logo's van de huisstijlen (Easy2edit, RSTCC, Studio2) uit frontend/public/logos in hun themapakket: bij het kiezen van het thema worden ze ingesteld en in de media-bibliotheek gezet."""
from django.core.management.base import BaseCommand

from apps.core import themepacks


class Command(BaseCommand):
    help = "Zet de huisstijl-logo's in de themapakketten van Easy2edit, RSTCC en Studio2."

    def handle(self, *a, **o):
        for key, n in themepacks.seed_brand_logos().items():
            self.stdout.write(f"{key}: {n} afbeeldingen")
