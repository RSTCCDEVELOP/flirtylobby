# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The header that sticks: always, never, or after 10 / 25 / 50 / 100 percent of the screen is scrolled (theme value header_sticky)."""
from apps.core import theme


def test_the_header_can_stick_always_never_or_after_a_part_of_the_screen():
    for v in ("yes", "no", "after"):
        clean, errors = theme.validate({"header_sticky": v})
        assert clean == {"header_sticky": v} and not errors, v
    assert theme.validate({"header_sticky": "after75"})[1]  # only the values that are offered
    assert theme.FIELDS["header_sticky"]["default"] == "yes"  # as before: a theme that says nothing keeps the header on top


def test_after_how_much_scrolling_is_a_slider_in_percent_or_pixels():
    assert theme.validate({"header_sticky_unit": "px", "header_sticky_px": 350, "header_sticky_pct": 40}) == ({"header_sticky_unit": "px", "header_sticky_px": 350, "header_sticky_pct": 40}, {})
    assert theme.validate({"header_sticky_unit": "em"})[1] and theme.validate({"header_sticky_pct": 500})[1] and theme.validate({"header_sticky_px": -1})[1]
    f = theme.FIELDS
    assert f["header_sticky_unit"]["default"] == "pct" and f["header_sticky_pct"]["default"] == 25 and f["header_sticky_px"]["default"] == 200
    from apps.core import themepacks

    assert {"header_sticky_unit", "header_sticky_pct", "header_sticky_px"} <= set(themepacks.COMPLETE_KEYS)  # a theme and a standard installation keep them
