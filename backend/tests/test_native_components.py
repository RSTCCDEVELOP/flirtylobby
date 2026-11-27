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


@pytest.fixture
def taken_apart(monkeypatch):
    """Taken apart into blocks is the default since build 443; this fixture keeps the tests explicit about it."""
    monkeypatch.setattr(DR, "KEEP_KIT_COMPONENTS", False)


def test_kit_components_are_taken_apart_by_default():
    assert DR.KEEP_KIT_COMPONENTS is False  # every text, button and box is an object of the page editor
    root = parse_html(_kit("ui-testimonials"))
    rows = [{"title": "x", "cells": [{"items": [{"type": "code", "kit": True, "tag": "ui-testimonials"}]}]}]
    out = DR.expand_native(rows, root, {}, COLORS)
    assert "code" not in [it["type"] for r in out for c in r["cells"] for it in c["items"]]


def test_kit_components_stay_components_when_switched_on(monkeypatch):
    monkeypatch.setattr(DR, "KEEP_KIT_COMPONENTS", True)
    root = parse_html(_kit("ui-testimonials"))
    rows = [{"title": "x", "cells": [{"items": [{"type": "code", "kit": True, "tag": "ui-testimonials"}]}]}]
    assert DR.expand_native(rows, root, {}, COLORS) == rows


@pytest.mark.parametrize("tag", ["ui-hero-center", "ui-hero-dark"])
def test_centred_and_dark_hero_become_objects(tag):
    rows = DR.native_component_rows(_node(_kit(tag)), {})
    assert len(rows) == 1 and rows[0]["title"] == "hero" and rows[0]["min_height"] == 40
    cell = rows[0]["cells"][0]
    assert cell["halign"] == "center"
    kinds = [i["type"] for i in cell["items"]]
    assert kinds == ["text", "heading", "text", "button", "button"]  # label, heading, lead, two buttons: each an object of its own
    assert all(i["align"] == "center" for i in cell["items"] if i["type"] != "button")
    assert (rows[0]["bg"], rows[0]["color"]) == (("#111827", "#ffffff") if tag == "ui-hero-dark" else ("", ""))


def test_hero_buttons_keep_their_style_primary_ghost_and_light():
    center = DR.native_component_rows(_node(_kit("ui-hero-center")), {})[0]["cells"][0]["items"]
    assert [i["style"] for i in center if i["type"] == "button"] == ["primary", "ghost"]
    dark = DR.native_component_rows(_node(_kit("ui-hero-dark")), {})[0]["cells"][0]["items"]
    light = [i for i in dark if i["type"] == "button"][1]
    assert light["style"] == "outline" and light["color"] == "#ffffff"  # readable on the dark background


def _expand(tag):
    root = parse_html(_kit(tag))
    rows = [{"title": "x", "anchor": "sec", "cells": [{"items": [{"type": "code", "kit": True, "tag": tag}]}]}]
    return DR.expand_native(rows, root, {}, COLORS)


def _types(rows):
    return [it["type"] for r in rows for c in r["cells"] for it in c["items"]]


def test_features_become_separate_objects_with_icons(taken_apart):
    rows = _expand("ui-features")
    assert rows[0]["anchor"] == "sec" and "code" not in _types(rows)  # no component block is left
    t = _types(rows)
    assert t.count("icon") == 4 and t.count("heading") == 1 + 4 and t.count("text") == 1 + 1 + 4  # heading + eyebrow + lead, and per feature an icon, a heading and a text
    assert len(rows[1]["cells"]) == 4


def test_testimonials_faq_stats_cta_pricing_become_blocks(taken_apart):
    rows = _expand("ui-testimonials")
    assert len(rows[0]["cells"]) == 2 and rows[0]["cells"][0]["card"]["bg"] == "#f5f4f0" and "code" not in _types(rows)
    faq = _expand("ui-faq")
    assert _types(faq) == ["faq"] and len(faq[0]["cells"][0]["items"][0]["items"]) == 3
    stats = _expand("ui-stats")
    assert _types(stats) == ["widget"]
    cta = _expand("ui-cta")
    assert len(cta) == 2 and cta[0]["bg"] == "#1b97d3" and cta[1]["bg"] == "#1f2937" and "button" in _types(cta)  # the kit: primary colour, then its accent (the dark text colour of the theme)
    price = _expand("ui-pricing")
    assert len(price[0]["cells"]) == 3 and "code" not in _types(price) and _types(price).count("button") == 3


def test_a_row_with_more_than_the_component_stays_as_it_is(taken_apart):
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


def test_gallery_tag_becomes_the_photo_carousel_item(taken_apart):
    root = parse_html('<div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery"><img src="img/a.jpg"><img src="img/b.jpg"><img src="img/c.jpg"></div></div>')
    rows = [{"title": "g", "cells": [{"items": [{"type": "code", "kit": True, "tag": "ui-gallery"}]}]}]
    out = DR.expand_native(rows, root, {"img/a.jpg": 0, "img/b.jpg": 1, "img/c.jpg": 2}, COLORS)
    assert out[0]["cells"][0]["items"] == [{"type": "gallery", "imgs": [0, 1, 2]}]
    one = DR.expand_native(rows, parse_html('<div data-easy2edit-tag="ui-gallery"><div class="e2e-gallery"><img src="img/a.jpg"></div></div>'), {"img/a.jpg": 0}, COLORS)
    assert one == rows  # one picture is no gallery


def test_the_hero_keeps_its_picture_when_the_photo_has_capitals_in_its_name(db):
    """End result of the creator: the library keeps a photo in lower case, the page had the name with capitals: the import then lost the picture of the hero. The creator makes the names exact."""
    from apps.core import sitecreator

    hero = HERO.replace("img/hero.jpg", "img/unsplash-tR7rwqdv5M4.jpg")
    imgs = {"img/unsplash-tr7rwqdv5m4.jpg": 3}  # what the import knows: the exact names of the library
    assert len(DR.native_component_rows(_node(hero), imgs)[0]["cells"]) == 1  # (the old end result: text only, no picture on the live page)
    fixed = sitecreator.fix_photo_names({"index.html": hero}, {"photos": [{"id": 3, "file": "unsplash-tr7rwqdv5m4.jpg"}]})["index.html"]
    rows = DR.native_component_rows(_node(fixed), imgs)
    assert len(rows[0]["cells"]) == 2 and rows[0]["cells"][1]["items"][0]["img"] == 3  # the picture is in its own cell, like in the Creator tab


def test_two_components_of_the_same_kind_in_one_section_each_keep_their_own_html():
    """A section with two call to action boxes: the second item must not get the html of the first (or the other way round)."""
    root = parse_html('<section><div data-easy2edit-tag="ui-cta"><div class="e2e-cta"><h2>Eerste</h2></div></div><div data-easy2edit-tag="ui-cta"><div class="e2e-cta"><h2>Tweede</h2></div></div></section>')
    rows = [{"cells": [{"items": [{"type": "code", "kit": True, "tag": "ui-cta"}, {"type": "code", "kit": True, "tag": "ui-cta"}]}]}]
    out = DR.fill_components(rows, root, {})
    items = out[0]["cells"][0]["items"]
    assert "Eerste" in items[0]["html"] and "Tweede" not in items[0]["html"] and "Tweede" in items[1]["html"]


def test_a_section_that_is_itself_a_component_stays_that_component():
    """The band of figures of the creator is a component straight in the page (no band around it): it must not be taken apart into texts."""
    root = parse_html('<div data-easy2edit-tag="ui-stats"><div class="e2e-stack"><div class="e2e-grid"><div class="e2e-stat"><div class="e2e-stat__value">4</div><div class="e2e-stat__label">Kernwaarden</div></div></div></div></div>')
    rows = DR.rows_for(root, {}, {})
    assert rows and len(rows) == 1 and rows[0]["cells"][0]["items"][0]["type"] == "code" and rows[0]["cells"][0]["items"][0]["tag"] == "ui-stats"


def _hero(tag, inner, cls="e2e-hero"):
    return f'<div data-easy2edit-tag="{tag}"><section class="{cls}">{inner}</section></div>'


TEXT = ('<span class="e2e-eyebrow">Welkom</span><h1>Een kop</h1><p class="e2e-lead">Een lead.</p>'
        '<div class="e2e-row"><a href="#a" class="e2e-btn e2e-btn--lg">Actie</a><a href="#b" class="e2e-btn e2e-btn--light e2e-btn--lg">Meer</a></div>')
IMGS = {"img/a.jpg": 1, "img/b.jpg": 2, "img/c.jpg": 3}


def _rows(tag, html):
    return DR.native_component_rows(_node(html), IMGS)


@pytest.mark.parametrize("tag,cls", [("ui-hero-image", "e2e-hero e2e-hero--image"), ("ui-hero-image-center", "e2e-hero e2e-hero--image e2e-hero--center"), ("ui-hero-card", "e2e-hero e2e-hero--card")])
def test_hero_with_a_background_photo_is_blocks_on_a_row_with_that_photo(tag, cls):
    rows = _rows(tag, _hero(tag, '<div class="e2e-herobg" role="img"><img src="img/a.jpg" alt=""></div><div class="e2e-hero__shade"></div><div class="e2e-container e2e-hero__body">' + TEXT + "</div>", cls))
    row = rows[0]
    assert row["bg_image"] == 1 and row["title"] == "hero" and row["min_height"] >= 60
    items = row["cells"][0]["items"]
    assert [i["type"] for i in items] == ["text", "heading", "text", "button", "button"]  # every text and button an object
    assert (row["cells"][0]["halign"] == "center") == (tag == "ui-hero-image-center")
    assert bool(row["cells"][0]["card"]) == (tag == "ui-hero-card")


def test_wide_hero_puts_the_picture_under_the_text_and_the_collage_next_to_it():
    wide = _rows("ui-hero-wide", _hero("ui-hero-wide", '<div class="e2e-container">' + TEXT + '<div class="e2e-hero__panorama" role="img"><img src="img/a.jpg" alt=""></div></div>', "e2e-hero e2e-hero--wide e2e-hero--center"))
    kinds = [i["type"] for i in wide[0]["cells"][0]["items"]]
    assert kinds[-1] == "image" and kinds.count("button") == 2
    collage = _rows("ui-hero-collage", _hero("ui-hero-collage", '<div class="e2e-container e2e-hero__inner"><div>' + TEXT + '</div><div class="e2e-hero__mosaic"><div role="img"><img src="img/a.jpg" alt=""></div><div role="img"><img src="img/b.jpg" alt=""></div><div role="img"><img src="img/c.jpg" alt=""></div></div></div>'))
    text, pics = collage[0]["cells"]
    assert pics["items"] == [{"type": "gallery", "imgs": [1, 2, 3]}] and text["width"] == "55"


def test_reverse_split_has_the_picture_first_and_the_type_hero_is_only_text():
    rev = _rows("ui-hero-split-reverse", _hero("ui-hero-split-reverse", '<div class="e2e-hero__side" role="img"><img src="img/b.jpg" alt=""></div><div class="e2e-container e2e-hero__inner"><div class="e2e-hero__text">' + TEXT + "</div></div>", "e2e-hero e2e-hero--reverse"))
    pic, text = rev[0]["cells"]
    assert pic["items"][0]["img"] == 2 and [i["type"] for i in text["items"]][:2] == ["text", "heading"]
    typ = _rows("ui-hero-type", _hero("ui-hero-type", '<div class="e2e-container"><div class="e2e-hero__masthead"><span class="e2e-eyebrow">Editie</span></div><h1>Kop</h1><div class="e2e-hero__cols"><p class="e2e-lead">Een.</p><p>Twee.</p></div>' + TEXT + "</div>", "e2e-hero e2e-hero--type"))
    assert len(typ[0]["cells"]) == 1 and "image" not in [i["type"] for i in typ[0]["cells"][0]["items"]]


def test_a_hero_without_text_stays_a_component():
    assert _rows("ui-hero-image", _hero("ui-hero-image", '<div class="e2e-herobg" role="img"></div>', "e2e-hero")) is None


def test_the_two_boxes_of_a_call_to_action_keep_their_own_colours_and_a_small_space():
    cta = DR._native_cta(_node(_kit("ui-cta")), {}, {"primary": "#7b2ce0", "secondary": "#7b2ce1", "text": "#101820"})
    assert [r["bg"] for r in cta] == ["#7b2ce0", "#101820"]  # two different boxes, not two of the same blue
    assert [r["color"] for r in cta] == ["#ffffff", "#ffffff"]
    assert "mt" not in cta[0] and cta[1]["mt"] == 16  # the space between the boxes of the kit, not more
    assert all(r["pad_top"] == 32 for r in cta)


def test_the_text_on_a_light_box_is_dark():
    assert DR._on_color("#ffffff") == "#151515" and DR._on_color("#101820") == "#ffffff" and DR._on_color("#f5c542") == "#151515"


def _mode_ctx():
    from types import SimpleNamespace

    imp = SimpleNamespace(id=7, slug="demo-site", tag="import:7")
    return {"imp": imp, "lang": "nl", "media": {}, "path": "/", "texts": {}, "images": {}, "faq": [], "page_bg": "#fafcfc",
            "theme_colors": {"page": "#fafcfc", "bg": "#fafcfc", "card": "#ffffff", "text": "#1c312f", "primary": "#14b8a6", "secondary": "#f472b6"}}


@pytest.mark.django_db
def test_blocks_follow_the_light_and_the_dark_mode_not_a_fixed_background():
    """A band of the design in the colour of the page, of the cards or of the theme must not get a fixed hex: in the dark mode it stayed white."""
    from siteimport_lib import importer

    def row(bg, color="", card=None):
        return {"bg": bg, "color": color, "cells": [{"items": [{"type": "heading", "html": "Kop"}], **({"card": card} if card else {})}]}

    rows = [row("#fafcfc", "#1c312f"), row("#ffffff"), row("#14b8a6", "#ffffff"), row("#101820", "#ffffff"), row("", card={"bg": "#ffffff", "radius": 12})]
    out = importer._rows_from_ai(rows, _mode_ctx())
    st = [r.get("style", {}) for r in out]
    assert "bg" not in st[0] and "color" not in st[0]  # the colour of the page and of the text: the page shows, the text follows the mode
    assert st[1]["bg"] == "card" and st[2]["bg"] == "primary"  # colours of the theme stay colours of the theme
    assert st[2]["color"] == "#ffffff"  # (white text on the primary colour is the design)
    assert st[3]["bg"] == "#101820"  # an own colour of the design stays as it is
    assert "bg" not in st[4]  # a band without a colour: the page shows
    assert out[4]["cells"][0]["style"]["bg"] == "card"  # a card in the colour of the cards follows the mode too


def test_a_card_can_have_a_theme_colour_in_the_layout():
    from apps.pages import layout

    clean = layout._cell_style({"bg": "card", "border": "#cccccc", "radius": 10})
    assert clean["bg"] == "card" and clean["border"] == "#cccccc"
    assert layout._cell_style({"bg": "not-a-colour"}).get("bg") is None
