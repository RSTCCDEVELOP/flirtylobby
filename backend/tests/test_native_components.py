# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The hero and the split of the UI-kit are rebuilt as real blocks of the page editor (rows, cells, heading, text, buttons, picture), not as an html/css block."""
import pytest

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


def test_photos_under_each_other_become_one_gallery():
    def pic(n):
        return {"type": "image", "img": n}

    side = [{"cells": [{"items": [pic(0)]}, {"items": [pic(1)]}, {"items": [pic(2)]}]}]
    assert DR.galleries(side)[0]["cells"][0]["items"] == [{"type": "gallery", "imgs": [0, 1, 2]}]
    run = [{"cells": [{"items": [{"type": "heading"}, pic(3), pic(4), pic(5), {"type": "text"}]}]}]
    assert [i["type"] for i in DR.galleries(run)[0]["cells"][0]["items"]] == ["heading", "gallery", "text"]
    two = [{"cells": [{"items": [pic(0), pic(1)]}]}]
    assert [i["type"] for i in DR.galleries(two)[0]["cells"][0]["items"]] == ["image", "image"]


def _kit(tag):
    import json
    import os

    path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "lib", "ui-kit", "components.json")
    return next(c["html"] for c in json.load(open(path)) if c.get("easy2edit_tag") == tag)


COLORS = {"primary": "#1b97d3", "secondary": "#f08a35", "card": "#f5f4f0", "muted": "#777777"}


def _expand(tag):
    root = parse_html(_kit(tag))
    rows = [{"title": "x", "anchor": "sec", "cells": [{"items": [{"type": "code", "kit": True, "tag": tag}]}]}]
    return DR.expand_native(rows, root, {}, COLORS)


def _types(rows):
    return [it["type"] for r in rows for c in r["cells"] for it in c["items"]]


def test_features_become_separate_objects_with_icons():
    rows = _expand("ui-features")
    assert rows[0]["anchor"] == "sec" and "code" not in _types(rows)  # no component block is left
    t = _types(rows)
    assert t.count("icon") == 4 and t.count("heading") == 1 + 4 and t.count("text") == 1 + 1 + 4  # heading + eyebrow + lead, and per feature an icon, a heading and a text
    assert len(rows[1]["cells"]) == 4


def test_testimonials_faq_stats_cta_pricing_become_blocks():
    rows = _expand("ui-testimonials")
    assert len(rows[0]["cells"]) == 2 and rows[0]["cells"][0]["card"]["bg"] == "#f5f4f0" and "code" not in _types(rows)
    faq = _expand("ui-faq")
    assert _types(faq) == ["faq"] and len(faq[0]["cells"][0]["items"][0]["items"]) == 3
    stats = _expand("ui-stats")
    assert _types(stats) == ["widget"]
    cta = _expand("ui-cta")
    assert len(cta) == 2 and cta[0]["bg"] == "#1b97d3" and cta[1]["bg"] == "#f08a35" and "button" in _types(cta)
    price = _expand("ui-pricing")
    assert len(price[0]["cells"]) == 3 and "code" not in _types(price) and _types(price).count("button") == 3


def test_a_row_with_more_than_the_component_stays_as_it_is():
    root = parse_html(_kit("ui-faq"))
    rows = [{"cells": [{"items": [{"type": "code", "kit": True, "tag": "ui-faq"}, {"type": "text", "html": "<p>x</p>"}]}]}]
    assert DR.expand_native(rows, root, {}, COLORS) == rows


@pytest.mark.django_db
def test_icon_item_becomes_a_picture_file_of_its_own():
    from types import SimpleNamespace

    from siteimport_lib import importer

    imp = SimpleNamespace(id=7, slug="demo-site", tag="import:7")
    ctx = {"imp": imp, "lang": "nl", "media": {}, "path": "/", "texts": {}, "images": {}, "faq": []}
    rows = [{"cells": [{"items": [{"type": "icon", "svg": '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path>', "color": "#1b97d3", "size": 44}, {"type": "heading", "html": "Snel"}]}]}]
    out = importer._rows_from_ai(rows, ctx)
    items = out[0]["cells"][0]["items"]
    assert [i["type"] for i in items] == ["image", "heading"] and items[0]["style"]["w"] == "44px"
    assert ctx["images"][items[0]["ref"]]  # a media item (the svg file) belongs to the icon


def test_gallery_tag_becomes_the_photo_carousel_item():
    root = parse_html('<div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery"><img src="img/a.jpg"><img src="img/b.jpg"><img src="img/c.jpg"></div></div>')
    rows = [{"title": "g", "cells": [{"items": [{"type": "code", "kit": True, "tag": "ui-gallery"}]}]}]
    out = DR.expand_native(rows, root, {"img/a.jpg": 0, "img/b.jpg": 1, "img/c.jpg": 2}, COLORS)
    assert out[0]["cells"][0]["items"] == [{"type": "gallery", "imgs": [0, 1, 2]}]
    one = DR.expand_native(rows, parse_html('<div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery"><img src="img/a.jpg"></div></div>'), {"img/a.jpg": 0}, COLORS)
    assert one == rows  # one picture is no gallery
