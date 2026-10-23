import os

from django.core.management.base import BaseCommand

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Create the initial admin from ADMIN_EMAIL / ADMIN_PASSWORD (idempotent, safe to run on every start)."

    def add_arguments(self, parser):
        parser.add_argument("--reset-password", action="store_true", help="Overwrite the password of an existing admin.")

    def handle(self, *args, **options):
        from apps.core import reset

        if reset.stored_admin():  # the standard superadmin was set in Super admin: that one counts (it is made again when it is gone)
            email = reset.stored_admin()["email"]
            if not User.objects.filter(email__iexact=email).exists():
                reset.standard_admin()
                self.stdout.write(f"ensure_admin: {email} made from the settings.")
            return
        email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
        password = os.getenv("ADMIN_PASSWORD") or ""
        if not email or not password:
            self.stdout.write("ensure_admin: ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping.")
            return

        user, created = User.objects.get_or_create(
            email__iexact=email, defaults={"username": email, "email": email}
        )
        user.is_staff = user.is_superuser = user.is_active = True
        if created or options["reset_password"]:
            user.set_password(password)
        user.save()
        self.stdout.write(f"ensure_admin: {email} {'created' if created else 'already exists'}.")
