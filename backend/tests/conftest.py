# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import os
import sys

import pytest

PLUGIN = os.path.join(os.path.dirname(__file__), "..", "..", "plugins", "siteimport")
sys.path.insert(0, os.path.abspath(PLUGIN))


@pytest.fixture(autouse=True)
def _never_touch_the_real_site(settings, tmp_path):
    """No test may read or empty the real media library or site folder (a reset test used to wipe backend/media)."""
    base = tmp_path / "isolated"
    for name, sub in (("MEDIA_ROOT", "media"), ("SITE_DIR", "site"), ("SITE_IMPORT_DIR", "imports"), ("TEMPLATES_DIR", "templates"), ("COMPONENTS_DIR", "components")):
        if hasattr(settings, name):
            (base / sub).mkdir(parents=True, exist_ok=True)
            setattr(settings, name, base / sub)


@pytest.fixture(autouse=True)
def _never_write_the_real_defaults(monkeypatch, tmp_path):
    """No test may write the files that are part of the code (the saved default settings, the default links): a test used to overwrite default_links.json."""
    from apps.core import site_defaults
    from apps.integrations import default_links

    (tmp_path / "defaults").mkdir(exist_ok=True)
    monkeypatch.setattr(site_defaults, "PATH", tmp_path / "defaults" / "site_defaults.json")
    monkeypatch.setattr(default_links, "PATH", tmp_path / "defaults" / "default_links.json")


@pytest.fixture
def media(settings, tmp_path):
    """Everything the import writes (media library, theme folders) goes to a temporary folder."""
    settings.MEDIA_ROOT = tmp_path / "media"
    (tmp_path / "media").mkdir()
    return tmp_path / "media"


@pytest.fixture
def languages(db):
    from apps.core.models import Language

    Language.objects.update_or_create(code="nl", defaults=dict(name="Nederlands", native_name="Nederlands", enabled=True, is_default=True))
    Language.objects.update_or_create(code="en", defaults=dict(name="Engels", native_name="English", enabled=True, is_default=False))


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create(username="tester", email="t@example.com")


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """The tables of the plugin models (a plugin makes them itself when it is installed; a test database has none)."""
    from django.db import connection

    with django_db_blocker.unblock():
        from siteimport_lib import models as M

        existing = set(connection.introspection.table_names())
        for m in (v for v in vars(M).values() if isinstance(v, type) and getattr(v, "_meta", None) and v.__module__ == M.__name__):
            if m._meta.db_table not in existing:
                with connection.schema_editor() as se:
                    se.create_model(m)


@pytest.fixture
def plugin_tables(db):
    return None
