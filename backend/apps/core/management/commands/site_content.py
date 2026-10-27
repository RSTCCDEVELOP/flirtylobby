# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The content of the website as a file in the site folder: save it (snapshot) or put it back in an empty database (restore --if-empty)."""
from django.core.management.base import BaseCommand

from apps.core import sitecontent


class Command(BaseCommand):
    help = "snapshot: de pagina's, ontwerpen en teksten opslaan in <site>/content. restore: terugzetten (met --if-empty alleen in een lege database)."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["snapshot", "restore"])
        parser.add_argument("--if-empty", action="store_true")

    def handle(self, *a, **o):
        if o["action"] == "snapshot":
            self.stdout.write(f"Opgeslagen: {sitecontent.snapshot()}")
        else:
            r = sitecontent.restore(if_empty=o["if_empty"])
            self.stdout.write("Niets te herstellen." if r is None else f"Teruggezet: {r}")
