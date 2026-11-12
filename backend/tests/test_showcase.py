# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The plugin Showcase: loaded from a temporary copy of its folder, then used through its routes (public and admin), its system objects and its demo content."""
import shutil
from pathlib import Path

import pytest
from rest_framework.test import APIClient

SRC = Path(__file__).resolve().parents[2] / "plugins" / "showcase"
RUN = "/api/plugins/run/showcase/"


@pytest.fixture
def showcase(settings, tmp_path, media):
    from apps.plugins import installer, manifest, runtime, signing

    settings.PLUGINS_DIR = tmp_path / "plugins"
    shutil.copytree(SRC, settings.PLUGINS_DIR / "showcase", ignore=shutil.ignore_patterns("__pycache__", "plugin.sig"))
    signing.dev_mode_allowed = lambda: True
    p = installer.register(manifest.parse((settings.PLUGINS_DIR / "showcase" / "plugin.json").read_bytes()))
    p.enabled = True
    p.save()
    assert runtime.load(p) is None
    runtime.ensure_loaded(force=True)
    from django.db import connection

    with connection.cursor() as cur:  # the tables of a plugin are not known to the test database: start every test empty
        for name in ("itemtag", "itemgroup", "item", "design", "tag", "group"):  # (the ones that point at others first)
            if f"plg_showcase_{name}" in connection.introspection.table_names():
                cur.execute(f'DELETE FROM "plg_showcase_{name}"')
    yield p
    runtime.unload("showcase")


@pytest.fixture
def admin(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create(username="boss", email="b@example.com", is_staff=True, is_superuser=True)


def client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user)
    return c


@pytest.mark.django_db(transaction=True)
def test_admin_crud_and_public_reading(showcase, admin):
    c = client(admin)
    g = c.post(RUN + "admin/groups", {"name": "Websites"}, format="json").json()
    sub = c.post(RUN + "admin/groups", {"name": "Webshops", "parent": g["id"]}, format="json").json()
    assert c.patch(RUN + f"admin/groups/{g['id']}", {"parent": sub["id"]}, format="json").status_code == 400  # no cycles
    r = c.post(RUN + "admin/items", {"title": "Eerste <b>project</b>", "summary": "Kort", "goal": "Doel", "url": "https://example.com", "duration": "3 maanden", "budget": "€ 100", "status": "development",
                                     "description": "<p>Hallo<script>alert(1)</script></p>", "tags": ["web", "Mkb"], "groups": [sub["id"]], "videos": [{"url": "https://youtu.be/aqz-KE-bpKQ", "title": "Film"}]}, format="json")
    assert r.status_code == 201, r.content
    i = r.json()
    assert "<script" not in i["description"] and i["title"] == "Eerste project" and i["slug"] == "eerste-project"
    c.post(RUN + "admin/items", {"title": "Tweede", "status": "active", "tags": ["web"]}, format="json")
    assert c.post(RUN + "admin/items", {"title": "Fout", "url": "javascript:alert(1)"}, format="json").status_code == 400
    assert c.post(RUN + "admin/items", {"title": "Fout", "videos": [{"url": "https://example.com/x"}]}, format="json").status_code == 400
    assert len(c.get(RUN + "admin/tags").json()["items"]) == 2  # the tag "web" is shared
    anon = client()
    assert anon.get(RUN + "admin/items").status_code == 401
    lst = anon.get(RUN + "items").json()
    assert lst["total"] == 2
    assert anon.get(RUN + "items?q=eerste").json()["total"] == 1
    assert anon.get(RUN + "items?tag=web").json()["total"] == 2 and anon.get(RUN + "items?tag=web,mkb").json()["total"] == 1
    assert anon.get(RUN + "items?status=development").json()["total"] == 1
    assert anon.get(RUN + f"items?group={g['slug']}").json()["total"] == 1  # the parent group includes its subgroups
    d = anon.get(RUN + f"items/{i['slug']}").json()
    assert d["videos"][0]["embed"].startswith("https://www.youtube-nocookie.com/embed/") and d["related"]
    facets = anon.get(RUN + "facets").json()
    assert {x["slug"] for x in facets["tags"]} == {"web", "mkb"} and len(facets["groups"]) == 2


@pytest.mark.django_db(transaction=True)
def test_fields_can_be_switched_off(showcase, admin):
    showcase.config = {**showcase.config, "show_budget": False, "show_videos": False}
    showcase.save()
    from apps.plugins import runtime

    assert runtime.load(showcase) is None
    c = client(admin)
    c.post(RUN + "admin/items", {"title": "P", "budget": "€ 1", "duration": "1 jaar", "videos": [{"url": "https://youtu.be/aqz-KE-bpKQ"}]}, format="json")
    p = client().get(RUN + "items").json()["items"][0]
    assert "budget" not in p and p["duration"] == "1 jaar"
    full = client().get(RUN + f"items/{p['slug']}").json()
    assert "videos" not in full and "budget" not in full


@pytest.mark.django_db(transaction=True)
def test_designs_are_system_objects_and_demo(showcase, admin):
    from apps.plugins import installer, runtime
    from apps.sysobjects.models import SystemObject

    demo = dict(runtime.providers("demo"))["showcase"]
    made = demo.create()
    assert made["projecten"] == 9 and made["presentaties"] == 6 and demo.create() == {}  # a second time makes nothing
    assert demo.counts()["showcase_projecten"] == 9
    keys = {x["key"] for x in installer.all_parts(showcase)}
    assert {"showcase-preset-search", "showcase-preset-scroller", "showcase-preset-list"} <= keys and len(keys) == 9
    assert SystemObject.objects.filter(kind="plugin_part", slug__startswith="plugin-showcase-").count() == len(keys)
    c = client()
    d = c.get(RUN + "designs/uitgelichte-scroller").json()
    assert d["layout"] == "scroller" and d["open"] == "popup" and d["featured_only"]
    assert c.get(RUN + "items?design=uitgelichte-scroller").json()["total"] == 3
    assert c.get(RUN + "items?design=_search&limit=2").json()["items"].__len__() == 2
    from django.db import connection

    assert demo.remove()["showcase_projecten"] == 9 and demo.counts()["showcase_projecten"] == 0
    assert not SystemObject.objects.filter(slug__startswith="plugin-showcase-uitgelichte").exists()
    assert connection  # (tables stay)


@pytest.mark.django_db(transaction=True)
def test_demo_button_of_the_plugin_page(showcase, admin):
    """Admin > Plugins > Showcase: the button makes the demo content, and (when it is there) takes it away again."""
    c = client(admin)
    url = "/api/plugins/showcase/demo/"
    assert c.get(url).json() == {"available": True, "exists": False, "counts": {"showcase_projecten": 0, "showcase_presentaties": 0}}
    r = c.post(url, {"action": "create"}, format="json").json()
    assert r["exists"] and r["counts"]["showcase_projecten"] == 9
    assert c.get(RUN + "items").json()["total"] == 9
    r = c.post(url, {"action": "remove"}, format="json").json()
    assert not r["exists"] and c.get(RUN + "items").json()["total"] == 0
    assert c.post(url, {"action": "nonsense"}, format="json").status_code == 400
    assert client().get(url).status_code in (401, 403)


def test_effective_off_follows_the_installation(monkeypatch):
    """Modules outside the standard installation are off unless added on purpose (modules_extra); what the user switched off stays off."""
    from apps.core import sitecreator

    items = [{"key": "faq", "in_installation": True}, {"key": "seo", "in_installation": True}, {"key": "webshop", "in_installation": False}, {"key": "plugin:games", "in_installation": False}]
    assert sitecreator.effective_off({}, items) == {"webshop", "plugin:games"}
    assert sitecreator.effective_off({"modules_off": ["seo"], "modules_extra": ["webshop"]}, items) == {"seo", "plugin:games"}
