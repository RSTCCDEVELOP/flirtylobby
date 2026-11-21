# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A hero or block background that rotates: more pictures and videos with the time and the animation of the change."""
import pytest

from apps.medialib.models import MediaItem
from apps.pages import layout


@pytest.fixture
def media(db):
    return [MediaItem.objects.create(key=f"t/{n}", name=n, kind=k) for n, k in (("a.jpg", "image"), ("b.jpg", "image"), ("c.mp4", "video"))]


def test_more_slides_are_kept_with_time_and_animation(media):
    a, b, c = media
    out = layout.clean_bg({"type": "image", "media": a.id, "more": [{"type": "image", "media": b.id}, {"type": "video", "media": c.id}, {"media": 999999}], "slide": {"sec": 8, "fx": "slide", "ms": 1200}})
    assert [m["media"] for m in out["more"]] == [b.id, c.id] and out["more"][1]["type"] == "video"  # an unknown picture is dropped, the type comes from the library
    assert out["slide"] == {"sec": 8, "fx": "slide", "ms": 1200}


def test_slide_settings_are_limited_and_default(media):
    a, b, _ = media
    out = layout.clean_bg({"type": "image", "media": a.id, "more": [{"media": b.id}], "slide": {"sec": 9999, "fx": "spin", "ms": "x"}})
    assert out["slide"] == {"sec": 60, "fx": "fade", "ms": 800}
    assert "more" not in layout.clean_bg({"type": "image", "media": a.id, "more": [], "slide": {"sec": 3}})  # one picture: nothing to rotate, no settings kept
    assert len(layout.clean_bg({"type": "image", "media": a.id, "more": [{"media": b.id}] * 40})["more"]) == layout.MAX_SLIDES - 1


def test_every_slide_gets_its_address(media):
    a, b, _ = media
    data = layout.with_urls({"rows": [{"bg": layout.clean_bg({"type": "image", "media": a.id, "more": [{"media": b.id}]})}], "bg": {}})
    bg = data["rows"][0]["bg"]
    assert bg["url"] and bg["more"][0]["url"] and bg["more"][0]["url"] != bg["url"]
