# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The height of a spacer (Tussenruimte): pixels (up to 800 in the editor) or a percentage of the screen height."""
from apps.pages import layout


def _spacer(style):
    data = {"rows": [{"id": "row00001", "cols": 1, "cells": [{"id": "cell0001", "halign": "left", "valign": "top", "items": [{"id": "item0001", "type": "spacer", "style": style}]}]}]}
    return layout.clean(data)["rows"][0]["cells"][0]["items"][0]["style"]


def test_height_in_percent_of_the_screen_is_kept_and_limited():
    assert _spacer({"h": 25, "hu": "pct"}) == {"h": 25, "hu": "pct"}
    assert _spacer({"h": 700, "hu": "pct"}) == {"h": 100, "hu": "pct"}  # never more than the whole screen


def test_pixels_stay_the_default():
    assert _spacer({"h": 800}) == {"h": 800}
    assert _spacer({"h": 800, "hu": "em"}) == {"h": 800}  # an unknown unit is not kept
