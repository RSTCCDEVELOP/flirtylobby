# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Remove a user by e-mail address. The last superadmin cannot be removed."

    def add_arguments(self, parser):
        parser.add_argument("email")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            self.stdout.write(f"remove_user: {email} does not exist.")
            return
        if user.is_staff and not User.objects.filter(is_staff=True, is_active=True).exclude(pk=user.pk).exists():
            raise CommandError("This is the last superadmin: make another one first (ensure_admin).")
        user.delete()
        self.stdout.write(f"remove_user: {email} removed.")
