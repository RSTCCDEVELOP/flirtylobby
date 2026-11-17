# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Report this website to the easy2edit server (Site manager) when it is live. Run at every start (entrypoint.sh): a live website that nobody has logged in on yet is then in the list."""
from django.core.management.base import BaseCommand

from apps.core import sitemanager


class Command(BaseCommand):
    help = "Register this website at the easy2edit server when it is live (a public address). Never fails."

    def handle(self, *args, **options):
        self.stdout.write("site_register: " + sitemanager.auto_register())
