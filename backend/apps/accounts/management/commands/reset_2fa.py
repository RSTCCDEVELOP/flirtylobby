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
