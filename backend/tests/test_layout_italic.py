# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The Lettertype tab of the page editor: italic for a heading, a text and a ready-made part is kept when the page is saved (the cleaning of the layout is a whitelist)."""
from apps.pages import layout


def _items(*styles):
    kinds = ["heading", "text", "widget"]
    items = [{"id": f"item000{i}", "type": kinds[i], **({"widget": "quote", "data": {"text": "Hoi"}} if kinds[i] == "widget" else {}), "style": st} for i, st in enumerate(styles)]
    return layout.clean({"rows": [{"id": "row00001", "cols": 1, "cells": [{"id": "cell0001", "halign": "left", "valign": "top", "items": items}]}]})["rows"][0]["cells"][0]["items"]


def test_italic_is_kept_and_other_values_are_not():
    items = _items({"italic": True, "weight": "800", "size": 5}, {"italic": "yes"}, {"italic": True, "font": "serif"})
    assert items[0]["style"]["italic"] is True and items[0]["style"]["weight"] == "800"  # next to the other font settings
    assert items[1]["style"]["italic"] is True and items[2]["style"]["italic"] is True
    off = _items({"italic": False}, {"italic": ""}, {"italic": "maybe"})
    assert all("italic" not in (i.get("style") or {}) for i in off)  # off or nonsense: the key is not there, the theme decides


def test_existing_pages_without_italic_stay_as_they_were():
    items = _items({"size": 2, "weight": "700"}, {}, {"color": "#112233"})
    assert items[0]["style"] == {"size": 2.0, "weight": "700"}
