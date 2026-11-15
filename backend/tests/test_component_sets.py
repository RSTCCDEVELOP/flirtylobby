# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The component sets: the standard set is there on every site, a set can be chosen, and every component has an easy2edit_tag."""
import io
import json
import zipfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from apps.core import componentpacks as cp


def _zip(key="mijn-set", comps=None):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("components.json", json.dumps({"key": key, "name": "Mijn set", "version": "1.0.0", "components": comps if comps is not None else [{"easy2edit_tag": "x-hero", "name": "Hero", "html": "<div data-easy2edit-tag=\"x-hero\">Hoi</div>"}]}))
        z.writestr("components.css", ".e2e-x{color:red}")
    return SimpleUploadedFile(f"{key}.zip", buf.getvalue(), content_type="application/zip")


@pytest.fixture
def site(tmp_path):
    with override_settings(COMPONENTS_DIR=tmp_path / "components"):
        cp._cache.clear()
        yield tmp_path
        cp._cache.clear()


@pytest.mark.django_db
def test_standard_set_is_installed_and_in_use(site):
    lst = cp.listing()
    assert lst["active"] == cp.DEFAULT_KEY and [m["key"] for m in lst["installed"]] == [cp.DEFAULT_KEY]
    s = cp.get()
    assert s["components"] and s["css"] and all(c["easy2edit_tag"] and c["html"] for c in s["components"])
    assert len({c["easy2edit_tag"] for c in s["components"]}) == len(s["components"])  # every tag is unique
    assert 'data-easy2edit-tag="' in s["components"][0]["html"]


@pytest.mark.django_db
def test_choose_another_set_and_back(site):
    cp.install_upload(_zip())
    assert cp.activate("mijn-set")["key"] == "mijn-set" and cp.active_key() == "mijn-set"
    with pytest.raises(cp.ComponentError):
        cp.remove("mijn-set")  # in use
    cp.activate(cp.DEFAULT_KEY)
    cp.remove("mijn-set")
    assert [m["key"] for m in cp.listing()["installed"]] == [cp.DEFAULT_KEY]
    with pytest.raises(cp.ComponentError):
        cp.remove(cp.DEFAULT_KEY)


@pytest.mark.django_db
def test_bad_sets_are_refused(site):
    with pytest.raises(cp.ComponentError):
        cp.install_upload(_zip(comps=[]))
    with pytest.raises(cp.ComponentError):
        cp.install_upload(_zip(comps=[{"easy2edit_tag": "a", "html": "x"}, {"easy2edit_tag": "a", "html": "y"}]))
    with pytest.raises(cp.ComponentError):
        cp.install_upload(_zip(key="Bad Key!"))


@pytest.mark.django_db
def test_rules_text_names_the_tags(site):
    t = cp.rules_text()
    assert "data-easy2edit-tag" in t and "ui-hero-split" in t
