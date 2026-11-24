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
    ok2, err2 = theme.validate({"side_menu_w": 360, "side_menu_size": 110, "side_menu_opacity": 70})  # the size and the transparency of the side menu
    assert not err2 and ok2 == {"side_menu_w": 360, "side_menu_size": 110, "side_menu_opacity": 70}
    assert theme.validate({"side_menu_w": 110})[1] and theme.validate({"side_menu_w": 120})[0] == {"side_menu_w": 120}  # narrower than before, down to 120 px (the menu items stop it at their own width)
    assert theme.validate({"side_menu_w": 100})[1] and theme.validate({"side_menu_size": 200})[1] and theme.validate({"side_menu_opacity": 10})[1]
    assert {"side_menu_w", "side_menu_size", "side_menu_opacity"} <= set(themepacks.COMPLETE_KEYS)
    css, _ = theme.build({**{k: f["default"] for k, f in theme.FIELDS.items()}, "side_menu_opacity": 60})
    assert "--side-menu-op:60" in css and "--side-menu-w:300px" in css


def test_the_side_menu_has_a_height_in_percent_and_a_place_along_the_edge():
    from apps.core import themepacks

    ok, err = theme.validate({"side_menu_h": 60, "header_side_v": "middle"})
    assert not err and ok == {"side_menu_h": 60, "header_side_v": "middle"}
    assert theme.validate({"side_menu_h": 10})[1] and theme.validate({"side_menu_h": 101})[1] and theme.validate({"header_side_v": "left"})[1]
    f = theme.FIELDS
    assert f["side_menu_h"]["default"] == 100 and f["header_side_v"]["default"] == "top" and f["side_menu_h"]["css"] == "--side-menu-h"
    assert {"side_menu_h", "header_side_v"} <= set(themepacks.COMPLETE_KEYS)


def test_the_design_of_the_side_menu_corners_lines_float_shadow_and_spacing():
    from apps.core import themepacks

    ok, err = theme.validate({"side_menu_radius": 16, "side_menu_float": 12, "side_menu_line": 2, "header_side_div": "yes", "side_menu_shadow": 60, "side_menu_igap": 6})
    assert not err and ok["side_menu_radius"] == 16 and ok["header_side_div"] == "yes"
    for bad in ({"side_menu_radius": 41}, {"side_menu_float": 41}, {"side_menu_line": 5}, {"side_menu_shadow": 101}, {"side_menu_igap": 17}, {"header_side_div": "maybe"}):
        assert theme.validate(bad)[1], bad
    f = theme.FIELDS
    assert f["side_menu_radius"]["default"] == 0 and f["side_menu_float"]["default"] == 0 and f["side_menu_line"]["default"] == 1 and f["header_side_div"]["default"] == "no"
    css, _ = theme.build({**{k: x["default"] for k, x in theme.FIELDS.items()}, "side_menu_radius": 18})
    assert "--side-menu-r:18" in css
    assert {"side_menu_radius", "side_menu_float", "side_menu_line", "header_side_div", "side_menu_shadow", "side_menu_igap"} <= set(themepacks.COMPLETE_KEYS)


def test_the_side_menu_stands_against_the_browser_or_against_the_start_of_the_content():
    from apps.core import themepacks

    assert theme.validate({"header_side_anchor": "browser"})[0] == {"header_side_anchor": "browser"}
    assert theme.validate({"header_side_anchor": "content"})[0] == {"header_side_anchor": "content"}
    assert theme.validate({"header_side_anchor": "middle"})[1]
    assert theme.FIELDS["header_side_anchor"]["default"] == "browser"  # as before: against the edge of the browser
    assert "header_side_anchor" in themepacks.COMPLETE_KEYS


def test_the_colours_of_the_side_menu_are_a_colour_of_the_theme_an_own_colour_or_like_the_theme():
    from apps.core import themepacks

    keys = ("side_menu_bg", "side_menu_fg", "side_menu_accent", "side_menu_linec", "side_button_bg", "side_button_fg")
    for k in keys:
        assert theme.FIELDS[k]["type"] == "colorref" and theme.FIELDS[k]["default"] == "" and k in themepacks.COMPLETE_KEYS  # the theme is the default
    ok, err = theme.validate({"side_menu_bg": "primary", "side_menu_fg": "#FFFFFF", "side_menu_accent": "", "side_menu_linec": "muted"})
    assert not err and ok == {"side_menu_bg": "primary", "side_menu_fg": "#ffffff", "side_menu_accent": "", "side_menu_linec": "muted"}
    assert theme.validate({"side_menu_bg": "pink"})[1] and theme.validate({"side_menu_bg": "#12"})[1] and theme.validate({"side_menu_bg": 5})[1]
    base = {k: f["default"] for k, f in theme.FIELDS.items()}
    css, _ = theme.build(base)
    assert "--side-menu-bg" not in css  # like the theme: nothing is set, the style sheet falls back on the colours of the theme
    css, _ = theme.build({**base, "side_menu_bg": "primary", "side_menu_fg": "#ffffff"})
    assert "--side-menu-bg:var(--blue)" in css and "--side-menu-fg:#ffffff" in css
