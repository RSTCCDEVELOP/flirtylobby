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
