# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Audit of the standard installations: every installation is complete and consistent (modules, plugins, kinds), can be set, and leaves the parts that must always be on (admin, widgets) on."""
import json
from pathlib import Path

import pytest

from apps.core import modules, presets

ROOT = Path(__file__).resolve().parents[2]
KEYS = [p["key"] for p in presets.PRESETS]


def test_there_are_the_standard_installations_and_each_one_is_complete():
    assert len(KEYS) == len(set(KEYS)) >= 11
    mods = {m["key"] for m in modules.MODULES}
    plugins = {p.parent.name for p in (ROOT / "plugins").glob("*/plugin.json")}
    for p in presets.PRESETS:
        assert p["name"] and p["icon"] and p["desc"] and p["theme"], p["key"]
        assert set(p["modules"]) <= mods, (p["key"], set(p["modules"]) - mods)  # no module that does not exist
        assert set(p["plugins"]) <= plugins, (p["key"], set(p["plugins"]) - plugins)  # no plugin that is not in the product
        assert "siteimport" in p["plugins"], p["key"]  # Website ontwerpen is in every installation: how a new website gets its pages
        assert len(p["plugins"]) == len(set(p["plugins"])) and len(p["modules"]) == len(set(p["modules"])), p["key"]
        assert p["entity_kind"] in {k for k, _ in __import__("apps.core.models", fromlist=["Entity"]).Entity.KINDS}, p["key"]


def test_the_plugins_that_the_widgets_take_their_data_from_are_in_the_installations_that_have_those_parts():
    """An installation with a webshop, an agenda or a FAQ gets the data in the widgets from them (see widgetdata.py): the plugins of the widgets are real plugins."""
    from apps.sysobjects import widgetdata

    plugins = {p.parent.name for p in (ROOT / "plugins").glob("*/plugin.json")}
    assert {"faq", "webshop", "agenda"} <= plugins
    assert {"faq"} <= {x for p in presets.PRESETS for x in p["plugins"]} and {"webshop", "agenda"} <= {x for p in presets.PRESETS for x in p["plugins"]}
    assert set(widgetdata.PROVIDERS) == {"faq", "webshop", "agenda", "entity", "hours"}


@pytest.mark.django_db
@pytest.mark.parametrize("key", KEYS)
def test_every_installation_can_be_set_and_the_parts_that_must_stay_on_stay_on(key):
    presets.apply(key, install_design=False, use_theme=False)
    want = presets._wanted_modules(presets.get(key))  # what the installation asks for, with what those need and the core
    skip = {m["key"] for m in modules.MODULES if m.get("auto") or m.get("plugin")}  # (a module that follows a link, like AI, or that belongs to a plugin: the plugins are loaded at the start of the server, not in a test)
    for m in sorted(want - skip):
        assert modules.enabled(m), (key, m)
    for m in presets.ALWAYS_ON:
        assert modules.enabled(m), (key, m)  # the admin itself
    assert modules.enabled("sysobjects"), key  # the widgets and the system objects of the page editor
    assert set(presets.get(key)["modules"]) <= want


@pytest.mark.django_db
def test_the_widgets_that_are_kept_in_an_installation_are_in_the_library():
    from apps.core import preset_design
    from apps.sysobjects import widgets

    lib = {w["key"] for w in widgets.library()}
    for key in KEYS:
        assert set(preset_design.widget_keys(key)) <= lib, (key, set(preset_design.widget_keys(key)) - lib)  # a widget that is not in the library is skipped at the setting; none may be kept for nothing
