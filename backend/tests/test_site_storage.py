# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Everything an implementation makes goes to the SITE folder, never to the product library (resource/)."""
import pytest


@pytest.fixture
def dirs(settings, tmp_path):
    settings.THEMES_DIR = tmp_path / "site" / "themes"
    settings.RESOURCE_DIR = tmp_path / "resource"
    return tmp_path


@pytest.mark.django_db
def test_a_theme_made_on_the_site_is_kept_in_site_themes(dirs):
    from apps.core import resources

    man = resources.save_theme("Mijn eigen thema", "test", "light", {"primary": "#112233"})
    key = man["key"]
    assert (dirs / "site" / "themes" / f"{key}-1.0.0.zip").is_file()
    assert not list((dirs / "resource" / "themas").glob("*.zip"))  # the product library stays untouched
    entry = next(e for e in resources.catalog("themas") if e["name"] == key)
    assert entry["origin"] == "site"
    assert resources._zip_bytes("themas", entry)  # and it can be installed from there
    assert resources.delete_theme(key) == key
    assert not list((dirs / "site" / "themes").glob("*.zip"))


def test_backups_and_imports_default_to_the_site_folder():
    import re
    from pathlib import Path

    src = (Path(__file__).resolve().parents[1] / "config" / "settings.py").read_text()
    assert re.search(r'BACKUPS_DIR = .*_site_path\("backups"', src) and re.search(r'SITE_IMPORT_DIR = .*_site_path\("imports"', src)
