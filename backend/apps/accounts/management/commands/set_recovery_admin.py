# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Keep the credentials of the recovery superadmin ENCRYPTED in the settings of this installation. When no superadmin exists at all, ensure_admin makes this account (at every start).
The password is read from the environment (RECOVERY_ADMIN_PASSWORD) or asked: it is never part of the code."""
import getpass
import os

from django.core.management.base import BaseCommand

from apps.accounts import superplus


class Command(BaseCommand):
    help = "Bewaar de gegevens van de herstel-superadmin versleuteld (gebruikt als er geen superadmin bestaat)."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=superplus.RECOVERY_EMAIL)
        parser.add_argument("--first-name", default=superplus.RECOVERY_FIRST)
        parser.add_argument("--last-name", default=superplus.RECOVERY_LAST)

    def handle(self, *args, **o):
        pw = os.getenv("RECOVERY_ADMIN_PASSWORD") or getpass.getpass("Wachtwoord van de herstel-superadmin: ")
        if len(pw) < 10:
            self.stderr.write("Een wachtwoord heeft minstens 10 tekens.")
            return
        superplus.store_recovery(o["email"], pw, o["first_name"], o["last_name"])
        self.stdout.write(f"Opgeslagen (versleuteld): {o['email'].lower()}")
