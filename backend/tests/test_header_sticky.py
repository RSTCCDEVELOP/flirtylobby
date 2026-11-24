# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The header that sticks: always, never, or after 10 / 25 / 50 / 100 percent of the screen is scrolled (theme value header_sticky)."""
from apps.core import theme


def test_the_header_can_stick_always_never_or_after_a_part_of_the_screen():
    for v in ("yes", "no", "after10", "after25", "after50", "after100"):
        clean, errors = theme.validate({"header_sticky": v})
        assert clean == {"header_sticky": v} and not errors, v
    clean, errors = theme.validate({"header_sticky": "after75"})
    assert not clean and "header_sticky" in errors  # only the percentages that are offered
    assert theme.FIELDS["header_sticky"]["default"] == "yes"  # as before: a theme that says nothing keeps the header on top
