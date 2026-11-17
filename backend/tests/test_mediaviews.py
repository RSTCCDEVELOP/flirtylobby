# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The media system objects: the kinds, their settings (also the shape of the pictures) and the pictures or videos they show."""
import pytest

from apps.medialib import mediaviews
from apps.medialib.models import MediaItem, MediaView

NEW_PICTURE_TYPES = ("coverflow", "filmstrip", "mosaic", "stack", "book")
NEW_VIDEO_TYPES = ("videogrid", "playlist", "vcarousel")


def test_every_kind_has_complete_clean_settings():
    for kind, _ in MediaView.TYPES:
        s = mediaviews.clean_settings(kind, {"shape": "hexagon", "depth": 999, "thumb_size": 1, "bogus": 1})
        assert set(s) == set(mediaviews.DEFAULTS[kind]) and "bogus" not in s
    assert mediaviews.clean_settings("coverflow", {"depth": 999})["depth"] == 100
    assert mediaviews.clean_settings("filmstrip", {"thumb_size": 1})["thumb_size"] == 50
    assert mediaviews.clean_settings("carousel", {"shape": "circle"})["shape"] == "circle"
    assert mediaviews.clean_settings("carousel", {"shape": "star"})["shape"] == "rect"  # an unknown shape becomes the default
    assert mediaviews.clean_settings("mosaic", {"pattern": "random"})["pattern"] == "random"
    assert mediaviews.clean_settings("playlist", {"list_pos": "left"})["list_pos"] == "right"


@pytest.mark.django_db
def test_video_kinds_show_videos_and_picture_kinds_show_pictures():
    MediaItem.objects.create(key="site/a.jpg", name="a.jpg", kind="image", mime="image/jpeg")
    MediaItem.objects.create(key="site/b.mp4", name="b.mp4", kind="video", mime="video/mp4")
    for kind in NEW_VIDEO_TYPES + NEW_PICTURE_TYPES:
        v = mediaviews.apply(MediaView(), {"name": f"x {kind}", "type": kind, "source": {"mode": "all"}})
        got = mediaviews.out(v)["items"]
        want = "video" if kind in mediaviews.VIDEO_TYPES else "image"
        assert [i["kind"] for i in got] == [want], kind
    assert mediaviews.out(v)["type_label"]


@pytest.mark.django_db
def test_demo_makes_the_new_picture_objects():
    mediaviews.demo(replace=True, count=16)
    kinds = set(MediaView.objects.filter(slug__startswith="demo-").values_list("type", flat=True))
    assert set(NEW_PICTURE_TYPES) <= kinds


@pytest.mark.django_db
def test_media_objects_exist_from_the_start_once():
    from apps.sysobjects import service
    from apps.sysobjects.models import SystemObject

    service.sync()
    kinds = set(MediaView.objects.values_list("type", flat=True))
    assert kinds == {k for k, _ in MediaView.TYPES}
    assert SystemObject.objects.filter(kind="media").count() == len(MediaView.TYPES)  # all of them are system objects
    MediaView.objects.filter(type="stack").delete()
    service.sync()
    assert not MediaView.objects.filter(type="stack").exists()  # a deleted one does not come back
