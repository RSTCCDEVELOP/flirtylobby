# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Write a zip of every theme (and of all themes together) into <project>/resource/themas, like plugin_build does for plugins."""
from django.core.management.base import BaseCommand

from apps.core import themepacks


class Command(BaseCommand):
    help = "Maak van elk thema een zip in resource/themas/ (en alle-themas.zip met alles), om ergens anders te importeren."

    def handle(self, *a, **o):
        names = themepacks.build_dist()
        self.stdout.write(self.style.SUCCESS(f"{len(names)} zips in {themepacks.dist_dir()}"))
