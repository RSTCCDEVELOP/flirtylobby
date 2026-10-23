# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
