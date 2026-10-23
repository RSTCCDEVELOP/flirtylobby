# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand

from apps.medialib import service


class Command(BaseCommand):
    help = "Register files in MEDIA_ROOT that are not in the media library yet."

    def handle(self, *args, **options):
        self.stdout.write(f"{service.scan()} bestand(en) toegevoegd aan de mediabibliotheek.")
