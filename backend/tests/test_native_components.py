# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The hero and the split of the UI-kit are rebuilt as real blocks of the page editor (rows, cells, heading, text, buttons, picture), not as an html/css block."""
from apps.core.webtoolkit import parse_html
from siteimport_lib import designrows as DR

HERO = ('<div data-easy2edit-tag="ui-hero-split"><section class="e2e-hero"><div class="e2e-container e2e-hero__inner"><div><span class="e2e-eyebrow">Business Process Solutions</span>'
        '<h1>Smarter operations, <span>stronger</span> business</h1><p class="e2e-lead">We manage your operations.</p><div class="e2e-row"><a href="#contact" class="e2e-btn e2e-btn--lg">Request a Quote</a>'
        '<a href="#services" class="e2e-btn e2e-btn--outline e2e-btn--lg">Our Services</a></div></div><div class="e2e-hero__visual" role="img" aria-label="x"><img src="img/hero.jpg" alt="x"></div></div></section></div>')
SPLIT = ('<div data-easy2edit-tag="ui-split"><div class="e2e-split"><div class="e2e-split__media" role="img"><img src="img/about.jpg" alt="y"></div><div><span class="e2e-eyebrow">About us</span>'
         '<h2>Together</h2><p class="e2e-lead">Who we are.</p><ul><li>One</li><li>Two</li></ul><a href="#contact" class="e2e-btn">Request</a></div></div></div>')


def _node(html):
    return next(n for n in parse_html(html).walk() if n.attrs.get("data-easy2edit-tag"))


def test_hero_becomes_blocks_with_the_picture_in_its_own_cell():
    rows = DR.native_component_rows(_node(HERO), {"img/hero.jpg": 3})
    assert len(rows) == 1 and len(rows[0]["cells"]) == 2
    text, pic = rows[0]["cells"]
    kinds = [i["type"] for i in text["items"]]
    assert kinds == ["text", "heading", "text", "button", "button"]  # label, heading, lead text, two buttons
    assert text["items"][1]["html"] == "Smarter operations, stronger business"
    assert [i["style"] for i in text["items"] if i["type"] == "button"] == ["primary", "outline"]
    assert pic["items"] == [{"type": "image", "img": 3, "align": "center", "radius": 16, "w": "100%"}]


def test_split_keeps_the_order_picture_first_and_a_list():
    rows = DR.native_component_rows(_node(SPLIT), {"img/about.jpg": 5})
    pic, text = rows[0]["cells"]
    assert pic["items"][0]["type"] == "image" and pic["items"][0]["img"] == 5
    assert any(i["type"] == "text" and "<li>One</li>" in i["html"] for i in text["items"])


def test_without_a_picture_in_the_list_or_for_other_components_nothing_changes():
    assert DR.native_component_rows(_node(SPLIT), {}) is None  # the picture is not known: stays a component
    other = _node('<div data-easy2edit-tag="ui-faq"><div>x</div></div>')
    assert DR.native_component_rows(other, {}) is None


def test_the_first_picture_of_a_page_has_number_zero_and_still_gets_its_cell():
    rows = DR.native_component_rows(_node(HERO), {"img/hero.jpg": 0})  # the pictures are numbered from 0
    text, pic = rows[0]["cells"]
    assert text["width"] == "55" and pic["items"][0]["img"] == 0
