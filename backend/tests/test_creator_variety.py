# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The creator does not make the same design every time: more heroes in the component set and a design direction per website."""
import random

import pytest

from apps.core import componentpacks, pageformat as pf, sitecreator as sc

NEW_HEROES = ["ui-hero-image", "ui-hero-image-center", "ui-hero-card", "ui-hero-collage", "ui-hero-type", "ui-hero-wide", "ui-hero-split-reverse"]


@pytest.mark.django_db
def test_the_standard_set_has_the_new_heroes_with_picture_places():
    comps = {c["easy2edit_tag"]: c for c in componentpacks.get("easy2edit-ui-kit")["components"]}
    for tag in NEW_HEROES:
        assert tag in comps, tag
        assert comps[tag]["category"] == "Hero"
    for tag in ("ui-hero-image", "ui-hero-card", "ui-hero-wide", "ui-hero-split-reverse", "ui-hero-collage"):
        kinds = [str(getattr(sl, "kind", sl.get("kind") if isinstance(sl, dict) else sl)) for sl in pf.schema_of(comps[tag])["slots"]]
        assert any("afbeelding" in k for k in kinds), (tag, kinds)


@pytest.mark.django_db
def test_every_direction_only_names_heroes_of_the_set():
    tags = {c["easy2edit_tag"] for c in componentpacks.get("easy2edit-ui-kit")["components"]}
    for key, d in sc.DIRECTIONS.items():
        assert d["heroes"] and all(h in tags for h in d["heroes"]), key


def test_a_direction_is_chosen_by_the_customer_or_varies_with_the_kind():
    assert sc.pick_direction({"hero_style": "editorial"}) == "editorial"
    seen = {sc.pick_direction({"kind": "blog"}, random.Random(i)) for i in range(60)}
    assert len(seen) >= 2 and seen <= set(sc.DIRECTIONS)
    assert "editorial" in seen
    assert sc.hero_key("Donker en krachtig") == "bold" and sc.hero_key("Laat de ontwerper kiezen") == "auto" and sc.hero_key("onzin") == ""


@pytest.mark.django_db
def test_the_questionnaire_always_asks_for_the_look_of_the_opening():
    qs = sc._with_installation([{"id": "name", "q": "Naam?", "type": "text"}], {"kind": "company"}, [])
    q = next(x for x in qs if x["id"] == sc.HERO_QID)
    assert q["options"] == list(sc.HERO_OPTIONS.values()) and q["default"] == sc.HERO_OPTIONS["auto"]


@pytest.mark.django_db
def test_the_brief_carries_the_direction_to_every_prompt():
    b = sc.clean_brief({"hero_style": "photo"}, {"name": "X"})
    assert b["hero_style"] == "photo" and sc.clean_brief({"hero_style": "nope"}, {})["hero_style"] == ""
    assert "DESIGN DIRECTION" in sc._brief_text(b) and "ui-hero-image" in sc._brief_text(b)
