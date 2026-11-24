# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The header that sticks: always, never, or after 10 / 25 / 50 / 100 percent of the screen is scrolled (theme value header_sticky)."""
from apps.core import theme


def test_the_header_can_stick_always_never_or_after_a_part_of_the_screen():
    for v in ("yes", "no", "after", "start"):  # "after" stays after the scrolling, "start" appears after it: one of the two
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


def test_the_side_menu_and_the_start_of_the_page_and_the_hero():
    from apps.core import themepacks

    ok, err = theme.validate({"header_side": "left", "header_side_unit": "px", "header_side_px": 400, "header_side_pct": 20, "page_start": -40, "hero_start": 120})
    assert not err and ok["header_side"] == "left" and ok["page_start"] == -40 and ok["hero_start"] == 120  # a negative start moves the page up, under a see-through header
    assert theme.validate({"header_side": "top"})[1] and theme.validate({"page_start": 900})[1] and theme.validate({"hero_start": -500})[1]
    f = theme.FIELDS
    assert f["header_side"]["default"] == "off" and f["page_start"]["default"] == 0 and f["hero_start"]["default"] == 0
    assert f["page_start"]["css"] == "--page-start" and f["hero_start"]["css"] == "--hero-start"
    css, _ = theme.build({**{k: f["default"] for k, f in theme.FIELDS.items()}, "page_start": 24})
    assert "--page-start:24px" in css
    assert {"header_side", "header_side_unit", "header_side_pct", "header_side_px", "page_start", "hero_start", "side_button_y", "side_menu_y"} <= set(themepacks.COMPLETE_KEYS)
    assert theme.validate({"side_button_y": 40, "side_menu_y": 20})[0] == {"side_button_y": 40, "side_menu_y": 20}  # the position of the arrow and of the menu of the side menu (% of the screen height)
    assert theme.validate({"side_button_y": 101})[1] and theme.validate({"side_menu_y": 61})[1]
