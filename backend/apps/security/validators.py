import re

from django.core.exceptions import ValidationError

from . import service


class ConfiguredPasswordValidator:
    """Minimum length / complexity as configured on the security page."""

    def validate(self, password, user=None):
        cfg = service.get()["basic"]
        if len(password) < cfg["password_min_length"]:
            raise ValidationError(f"Wachtwoord moet minimaal {cfg['password_min_length']} tekens bevatten.")
        if cfg["password_complexity"] and not all(
            re.search(p, password) for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^\w\s]")
        ):
            raise ValidationError("Wachtwoord moet een hoofdletter, kleine letter, cijfer en leesteken bevatten.")

    def get_help_text(self):
        return "Minimale lengte en complexiteit staan in de beveiligingsinstellingen."
