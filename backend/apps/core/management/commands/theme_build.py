"""Write a zip of every theme (and of all themes together) into <project>/themes/.dist/themes, like plugin_build does for plugins."""
from django.core.management.base import BaseCommand

from apps.core import themepacks


class Command(BaseCommand):
    help = "Maak van elk thema een zip in themes/.dist/themes/ (en alle-themas.zip met alles), om ergens anders te importeren."

    def handle(self, *a, **o):
        names = themepacks.build_dist()
        self.stdout.write(self.style.SUCCESS(f"{len(names)} zips in {themepacks.dist_dir()}"))
