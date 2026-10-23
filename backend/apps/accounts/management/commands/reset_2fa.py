# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Switch off two-step verification for a user (use when locked out)."

    def add_arguments(self, parser):
        parser.add_argument("email")

    def handle(self, *args, email, **options):
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError("Gebruiker niet gevonden.")
        user.otp_active, user.twofa_method, user.otp_token = False, "", ""
        user.save(update_fields=["otp_active", "twofa_method", "otp_token"])
        self.stdout.write(f"2FA uitgezet voor {user.email}.")
