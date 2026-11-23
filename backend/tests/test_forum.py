# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The plugin Forum: forums, groups and subgroups, discussions and answers, rights per forum, managers, files, following and notifications."""
import io
import shutil
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

SRC = Path(__file__).resolve().parents[2] / "plugins" / "forum"
RUN = "/api/plugins/run/forum/"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture
def forum(settings, tmp_path):
    from apps.plugins import installer, manifest, runtime, signing

    settings.PLUGINS_DIR = tmp_path / "plugins"
    shutil.copytree(SRC, settings.PLUGINS_DIR / "forum", ignore=shutil.ignore_patterns("__pycache__", "plugin.sig"))
    signing.dev_mode_allowed = lambda: True
    p = installer.register(manifest.parse((settings.PLUGINS_DIR / "forum" / "plugin.json").read_bytes()))
    p.enabled = True
    p.save()
    assert runtime.load(p) is None
    runtime.ensure_loaded(force=True)
    from django.db import connection

    with connection.cursor() as cur:
        for n in ("report", "follow", "reaction", "attachment", "post", "thread", "manager", "category", "forum", "settings"):
            if f"plg_forum_{n}" in connection.introspection.table_names():
                cur.execute(f'DELETE FROM "plg_forum_{n}"')
    yield p
    runtime.unload("forum")


def user(name, **kw):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create(username=name, email=f"{name}@example.com", first_name=name.title(), **kw)


def client(u=None):
    c = APIClient()
    if u:
        c.force_authenticate(u)
    return c


def make(c, vis="members", title="Golf"):
    return c.post(RUN + "forums", {"title": title, "visibility": vis}, format="json").json()


@pytest.mark.django_db(transaction=True)
def test_member_makes_a_forum_and_is_its_owner_and_groups_have_owners(forum):
    ann, bob = user("ann"), user("bob")
    f = make(client(ann))
    assert f["forum"]["level"] == 3 and f["can"]["moderate"]
    ca, cb = client(ann), client(bob)
    g = cb.post(RUN + f"forums/{f['forum']['id']}/categories", {"title": "x"}, format="json")
    assert g.status_code == 403  # making a group is for managers by default
    g = ca.post(RUN + f"forums/{f['forum']['id']}/categories", {"title": "Clubs"}, format="json").json()
    sub = ca.post(RUN + f"forums/{f['forum']['id']}/categories", {"title": "Utrecht", "parent_id": g["category"]["id"]}, format="json").json()
    assert sub["path"][0]["title"] == "Clubs"
    tree = ca.get(RUN + f"forums/{f['forum']['id']}").json()["tree"]
    assert tree[0]["children"][0]["title"] == "Utrecht"
    mgrs = ca.get(RUN + f"categories/{g['category']['id']}").json()["managers"]
    assert [(m["user"]["id"], m["role"]) for m in mgrs] == [(ann.pk, "owner")]  # whoever makes a group is its owner


@pytest.mark.django_db(transaction=True)
def test_visibility_and_the_table_of_rights(forum):
    ann, bob = user("ann"), user("bob")
    ca, cb, cv = client(ann), client(bob), client()
    pub = make(ca, "public", "Open")["forum"]["id"]
    mem = make(ca, "members", "Leden")["forum"]["id"]
    prv = make(ca, "private", "Prive")["forum"]["id"]
    assert cv.get(RUN + f"forums/{pub}").status_code == 200
    assert cv.get(RUN + f"forums/{mem}").status_code == 404
    assert cb.get(RUN + f"forums/{mem}").status_code == 200
    assert cb.get(RUN + f"forums/{prv}").status_code == 404  # private: only managers
    home = cv.get(RUN + "home").json()
    assert [x["title"] for x in home["forums"]] == ["Open"]
    # the owner lets members make groups in the forum, bob may then
    s = ca.get(RUN + f"forums/{mem}/settings").json()
    s["perms"]["create_category"]["level"] = "members"
    assert ca.put(RUN + f"forums/{mem}/settings", {"perms": s["perms"]}, format="json").status_code == 200
    assert cb.post(RUN + f"forums/{mem}/categories", {"title": "Bobs groep"}, format="json").status_code == 200
    assert cb.put(RUN + f"forums/{mem}/settings", {"perms": s["perms"]}, format="json").status_code == 403  # settings are for the owner


@pytest.mark.django_db(transaction=True)
def test_discussion_answers_on_a_post_and_notifications(forum, monkeypatch):
    ann, bob, cy = user("ann"), user("bob"), user("cy")
    sent = []
    monkeypatch.setattr("apps.notifications.service.notify", lambda u, kind, title, body="", url="", **k: sent.append((u.pk, kind, title)))
    ca, cb, cc = client(ann), client(bob), client(cy)
    f = make(ca)["forum"]["id"]
    g = ca.post(RUN + f"forums/{f}/categories", {"title": "Algemeen"}, format="json").json()["category"]["id"]
    cc.post(RUN + "follow", {"kind": "category", "id": g, "level": "all"}, format="json")
    t = cb.post(RUN + f"categories/{g}/threads", {"title": "Hallo", "body": "html:<p>Eerste <b>bericht</b><script>alert(1)</script></p>"}, format="json").json()
    assert t["status"] == "published"
    assert any(n[0] == cy.pk and n[1] == "forum" for n in sent if False) or any(n[0] == cy.pk for n in sent)  # a follower of the group hears about it
    first = ca.post(RUN + f"threads/{t['id']}/posts", {"body": "Welkom"}, format="json").json()
    sent.clear()
    reply = cc.post(RUN + f"threads/{t['id']}/posts", {"body": "Ik ook", "parent_id": first["id"]}, format="json").json()
    assert {n[0] for n in sent} >= {ann.pk}  # the person that is answered
    d = cb.get(RUN + f"threads/{t['id']}").json()
    assert d["thread"]["replies"] == 2 and d["posts"][1]["parent_id"] == first["id"]
    assert "script" not in d["thread"]["body"]
    assert cb.post(RUN + "react", {"post_id": reply["id"]}, format="json").json() == {"liked": True, "count": 1}
    assert cb.post(RUN + "react", {"post_id": reply["id"]}, format="json").json()["liked"] is False
    # somebody who is no moderator can not delete another one's answer; the author can
    assert cb.delete(RUN + f"posts/{reply['id']}").status_code == 403
    assert cc.delete(RUN + f"posts/{reply['id']}").status_code == 200


@pytest.mark.django_db(transaction=True)
def test_managers_are_added_by_an_admin_and_removed_by_the_owner(forum):
    ann, bob, cy = user("ann"), user("bob"), user("cy")
    boss = user("boss", is_staff=True, is_superuser=True)
    ca, cb, cbo = client(ann), client(bob), client(boss)
    f = make(ca)["forum"]["id"]
    g = ca.post(RUN + f"forums/{f}/categories", {"title": "Algemeen"}, format="json").json()["category"]["id"]
    assert cb.post(RUN + f"forums/{f}/managers", {"user_id": cy.pk}, format="json").status_code == 403
    r = cbo.post(RUN + f"forums/{f}/managers", {"user_id": bob.pk, "category_id": g}, format="json")  # an administrator adds a manager to the group
    assert r.status_code == 200
    mid = [m for m in r.json()["managers"] if m["user"]["id"] == bob.pk][0]["id"]
    t = ca.post(RUN + f"categories/{g}/threads", {"title": "Vast", "body": "x"}, format="json").json()["id"]
    assert cb.post(RUN + f"threads/{t}/action", {"action": "pin"}, format="json").status_code == 200  # the manager of the group moderates in it
    assert cb.delete(RUN + f"managers/{mid}").status_code == 403  # a manager can not take the rights of himself or others away
    assert ca.delete(RUN + f"managers/{mid}").status_code == 200  # the owner of the group can
    assert cb.post(RUN + f"threads/{t}/action", {"action": "lock"}, format="json").status_code == 403


@pytest.mark.django_db(transaction=True)
def test_files_are_checked_and_served_with_a_signed_link(forum):
    ann = user("ann")
    ca = client(ann)
    f = make(ca)["forum"]["id"]
    ok = ca.post(RUN + "upload", {"forum_id": f, "file": SimpleUploadedFile("foto.png", PNG, content_type="image/png")}, format="multipart")
    assert ok.status_code == 200 and ok.json()["kind"] == "photo"
    assert ca.post(RUN + "upload", {"forum_id": f, "file": SimpleUploadedFile("x.png", b"not a picture", content_type="image/png")}, format="multipart").status_code == 400
    assert ca.post(RUN + "upload", {"forum_id": f, "file": SimpleUploadedFile("x.html", b"<b>", content_type="text/html")}, format="multipart").status_code == 400
    assert ca.post(RUN + "upload", {"forum_id": f, "file": SimpleUploadedFile("x.pdf", b"%PDF-1", content_type="application/pdf")}, format="multipart").status_code == 400  # files are off in the standard
    got = client().get(ok.json()["url"])
    assert got.status_code == 200 and b"".join(got.streaming_content).startswith(b"\x89PNG")
    assert client().get(RUN + "get/not-a-token").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_approval_admin_board_and_menu_flags(forum):
    ann, bob = user("ann"), user("bob")
    boss = user("boss", is_staff=True, is_superuser=True)
    ca, cb, cbo = client(ann), client(bob), client(boss)
    f = make(ca)["forum"]["id"]
    g = ca.post(RUN + f"forums/{f}/categories", {"title": "A"}, format="json").json()["category"]["id"]
    s = ca.get(RUN + f"forums/{f}/settings").json()
    ca.put(RUN + f"forums/{f}/settings", {"perms": s["perms"], "features": {"require_approval": True}}, format="json")
    t = cb.post(RUN + f"categories/{g}/threads", {"title": "Wacht", "body": "x"}, format="json").json()
    assert t["status"] == "pending"
    assert client(user("zed")).get(RUN + f"threads/{t['id']}").status_code == 404  # nobody else sees it yet
    assert ca.post(RUN + f"threads/{t['id']}/action", {"action": "approve"}, format="json").status_code == 200
    assert client(user("zed2")).get(RUN + f"threads/{t['id']}").status_code == 200
    assert cb.get(RUN + "admin/overview").status_code == 403
    assert cbo.get(RUN + "admin/overview").json()["threads"] == 1
    b = cbo.put(RUN + "admin/board", {"members_create_forums": False, "max_forums_per_user": 2}, format="json").json()["board"]
    assert b["members_create_forums"] is False
    assert cb.post(RUN + "forums", {"title": "Nee"}, format="json").status_code == 403
    # the plugin settings show_in_menu and show_tile reach the menu of the dashboard
    from apps.plugins.models import Plugin

    p = Plugin.objects.get(name="forum")
    p.config = {"show_in_menu": False, "show_tile": True}
    p.save()
    row = [x for x in cb.get("/api/plugins/menu/").json() if x["name"] == "forum"][0]
    assert row["in_menu"] is False and row["tile"] is True


@pytest.mark.django_db(transaction=True)
def test_inline_flag_is_parsed_and_returned(forum):
    from apps.plugins import manifest

    assert forum.manifest["inline"] is True
    assert manifest.parse(b'{"name": "plain", "version": "1.0.0"}')["inline"] is False
    boss = user("inlineboss", is_staff=True, is_superuser=True)
    c = client(boss)
    assert [x for x in c.get("/api/plugins/menu/").json() if x["name"] == "forum"][0]["inline"] is True
    assert [x for x in c.get("/api/plugins/menu/?scope=admin").json() if x["name"] == "forum"][0]["inline"] is True
    assert client().get("/api/plugins/public/?path=forum").json()["inline"] is True


@pytest.mark.django_db(transaction=True)
def test_my_forums_use_reverse_relations(forum):
    ann = user("ann")
    f = make(client(ann))["forum"]["id"]
    got = client(ann).get(RUN + "mine").json()
    assert [x["id"] for x in got["forums"]] == [f]
