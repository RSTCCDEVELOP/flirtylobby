# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Audit of the library that ships with the product: plugins (source, signature, zip), themes, templates, component sets, profile themes and the sealed API file."""
import json
import tempfile
import zipfile
from pathlib import Path

import pytest

from apps.core import templatepacks, theme
from apps.plugins import manifest as mf
from apps.plugins import signing

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "resource"
PLUGINS = sorted(p.parent for p in (ROOT / "plugins").glob("[a-z]*/plugin.json"))  # not the hidden temp folders of the installer
THEMES = sorted(f for f in (RES / "themas").glob("*.zip") if f.name != "alle-themas.zip")
LANGS = {"ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "nl", "pl", "pt", "ru", "tr", "uk", "zh"}


@pytest.mark.parametrize("d", PLUGINS, ids=lambda d: d.name)
def test_every_plugin_is_valid_signed_and_has_a_current_zip(d):
    raw = (d / "plugin.json").read_text()
    m = mf.parse(raw)
    assert m["name"] == d.name
    assert signing.verify(d) == "valid", "de bron is gewijzigd na het tekenen: draai plugin_build"
    zips = list((RES / "plugins").glob(f"{d.name}-*.zip"))
    assert len(zips) == 1, zips  # one zip per plugin, no stale versions
    assert zips[0].stem == f"{d.name}-{m['version']}"
    with tempfile.TemporaryDirectory() as t:
        zipfile.ZipFile(zips[0]).extractall(t)
        sub = list(Path(t).iterdir())
        root = sub[0] if len(sub) == 1 and sub[0].is_dir() else Path(t)
        assert signing.digest(root) == signing.digest(d), "de zip wijkt af van de bron: draai plugin_build"
    for f in d.rglob("*.py"):
        compile(f.read_text(), str(f), "exec")
    if (d / "lang").is_dir():
        assert LANGS <= {p.stem for p in (d / "lang").glob("*.json")}


def test_there_is_no_zip_without_a_plugin():
    names = {d.name for d in PLUGINS}
    for z in (RES / "plugins").glob("*.zip"):
        assert z.stem.rsplit("-", 1)[0] in names, z.name


@pytest.mark.parametrize("f", THEMES, ids=lambda f: f.name)
def test_every_theme_zip_is_a_valid_theme(f):
    with zipfile.ZipFile(f) as z:
        d = json.loads(z.read(f"{f.stem.rsplit('-', 1)[0]}/theme.json"))
    key, ver = f.stem.rsplit("-", 1)
    assert d["key"] == key and d["version"] == ver and d["name"]
    clean, errors = theme.validate(d["values"])
    assert not errors, errors
    assert len(clean) == len(d["values"])


def test_theme_keys_are_unique():
    keys = [f.stem.rsplit("-", 1)[0] for f in THEMES]
    assert len(keys) == len(set(keys))


def test_the_templates_are_valid():
    zs = list((RES / "templates").glob("*.zip"))
    assert zs
    for f in zs:
        m = templatepacks.read(f)
        assert m["key"] and m["name"] and m["previews"]


def test_component_sets_and_profile_themes_are_valid():
    for f in (RES / "components").glob("*.zip"):
        with zipfile.ZipFile(f) as z:
            assert {"components.json", "components.css", "components.js"} <= set(z.namelist()), f.name
            json.loads(z.read("components.json"))
    for f in (RES / "profielthemas").glob("*.json"):
        d = json.loads(f.read_text())
        assert d["key"] == f.stem and d["label"] and isinstance(d["fields"], list), f.name


def test_the_sealed_api_file_has_its_envelope():
    d = json.loads((RES / "api" / "easy2edit-api-koppelingen.json").read_text())
    assert d["format"] == "easy2edit-api-keys" and d["v"] == 1 and d["salt"] and d["data"]
