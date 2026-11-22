# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The html of a kit component on a page is cleaned on the server (whitelist), and what the kit needs is kept."""
from apps.core import richtext
from apps.pages import layout


def _code(data):
    page = {"rows": [{"id": "row00001", "cols": 1, "cells": [{"id": "cell0001", "halign": "left", "valign": "top", "items": [{"id": "item0001", "type": "widget", "widget": "code", "data": data}]}]}]}
    return layout.clean(page)["rows"][0]["cells"][0]["items"][0]


def test_bad_html_is_removed():
    out = richtext.clean_kit('<div class="a" onclick="x()"><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a><iframe src="//e.com"></iframe><svg><animate onbegin="x()"/></svg></div>')
    for bad in ("<script", "onclick", "onerror", "javascript:", "<iframe", "onbegin"):
        assert bad not in out


def test_what_the_kit_needs_is_kept():
    html = '<section class="e2e-tabs" data-set="x" aria-label="t"><button data-md="a" aria-selected="true">A</button><svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="currentColor"/></svg><a href="https://e.com/p">x</a><img src="__MEDIA__/a.jpg" alt=""></section>'
    out = richtext.clean_kit(html)
    for ok in ('class="e2e-tabs"', 'data-set="x"', 'aria-label="t"', 'data-md="a"', 'viewBox="0 0 10 10"', 'd="M0 0L10 10"', 'href="https://e.com/p"', 'src="__MEDIA__/a.jpg"'):
        assert ok in out


def test_a_kit_widget_in_a_layout_is_cleaned():
    kit = _code({"kit": True, "tag": "tabs", "html": '<div onclick="x()"><script>1</script>hi</div>'})
    assert "onclick" not in kit["data"]["html"] and "<script" not in kit["data"]["html"]
