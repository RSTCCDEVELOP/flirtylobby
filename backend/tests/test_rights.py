# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The rights system: view, edit and delete for users and groups, on modules, pages and records of plugins."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts import rights
from apps.accounts.models import AccessTarget, ModuleGrant, Role, UserGroup
from apps.core import modules
from apps.pages.models import Page, PageLayout
from apps.plugins.models import Plugin

U = get_user_model()


@pytest.fixture(autouse=True)
def _modules_on(monkeypatch):
    monkeypatch.setattr(modules, "states", lambda: {})


def user(name, **kw):
    return U.objects.create(username=name, email=f"{name}@x.nl", **kw)


def api(u=None):
    c = APIClient()
    if u:
        c.force_authenticate(u)
    return c


# ── the rules ──

def test_a_list_restricts_only_its_own_right_and_higher_rights_include_the_lower_ones(db):
    a, b, c = user("a"), user("b"), user("c")
    rules = rights.clean({"edit": {"users": [a.id]}, "delete": {"users": [b.id]}})
    assert not rights.restricted(rules, "view")  # a list for editing does not restrict viewing
    assert rights.allowed(rules, c, "view")
    assert rights.restricted(rules, "edit") and rights.restricted(rules, "delete")
    assert rights.allowed(rules, a, "edit") and not rights.allowed(rules, a, "delete")
    assert rights.allowed(rules, b, "edit") and rights.allowed(rules, b, "delete")  # who may delete may also edit
    assert not rights.allowed(rules, c, "edit") and not rights.allowed(rules, c, "delete")
    assert rights.allowed(rules, user("boss", is_staff=True), "delete")  # an administrator always
    assert rights.allowed(rules, c, "edit", owner_id=c.id)  # the owner always
    assert not rights.allowed(rules, None, "edit")


def test_groups_count_and_a_list_in_the_view_right_includes_editors(db):
    g = UserGroup.objects.create(name="Redactie", slug="redactie")
    m, other = user("m"), user("o")
    m.user_groups.add(g)
    rules = rights.clean({"view": {"groups": [g.id]}})
    assert rights.allowed(rules, m, "view") and not rights.allowed(rules, other, "view")
    rules = rights.clean({"view": {"users": [other.id]}, "edit": {"groups": [g.id]}})
    assert rights.allowed(rules, m, "view")  # the editors of the page may view it as well


def test_clean_drops_unknown_people_doubles_and_garbage(db):
    a = user("a")
    assert rights.clean({"view": {"users": [a.id, a.id, 9999, "x"], "groups": []}, "bogus": {"users": [a.id]}}) == {"view": {"users": [a.id], "groups": []}}
    assert rights.clean("nonsense") == {} and rights.clean(None) == {}


# ── modules ──

def test_module_rights_are_stored_as_grants_and_roles_are_left_alone(db):
    a, g = user("a"), UserGroup.objects.create(name="G", slug="g")
    role = Role.objects.create(name="R", slug="r")
    ModuleGrant.objects.create(module="media", role=role, level=2)
    out = rights.set_module_entries("media", [{"type": "user", "id": a.id, "view": True, "edit": True, "delete": False}, {"type": "group", "id": g.id, "view": True}, {"type": "user", "id": 9999, "view": True}, {"type": "group", "id": g.id + 50, "view": True}])
    assert {(e["type"], e["id"]): (e["view"], e["edit"], e["delete"]) for e in out} == {("user", a.id): (True, True, False), ("group", g.id): (True, False, False)}
    assert ModuleGrant.objects.get(module="media", user=a).level == 2 and ModuleGrant.objects.get(module="media", group=g).level == 1
    assert ModuleGrant.objects.filter(module="media", role=role, level=2).exists()
    rights.set_module_entries("media", [{"type": "user", "id": a.id, "delete": True}])  # delete includes the others
    assert ModuleGrant.objects.get(module="media", user=a).level == 3 and not ModuleGrant.objects.filter(module="media", group=g).exists()
    rights.set_module_entries("media", [{"type": "user", "id": a.id}])  # no right at all: gone
    assert not ModuleGrant.objects.filter(module="media", user=a).exists()


def test_the_rights_of_a_module_follow_into_what_the_user_may_do(db):
    from apps.accounts.access import level

    a = user("a")
    rights.set_module_entries("media", [{"type": "user", "id": a.id, "view": True, "edit": True}])
    assert level(a, "media") == 2


# ── pages ──

@pytest.fixture
def page(db):
    return Page.objects.create(key="info", kind="content", title={"nl": "Info"}, scope="public")


def test_the_old_list_of_a_page_is_the_view_list_and_stays_when_edit_lists_are_added(page, db):
    a = user("a")
    page.access = {"users": [a.id], "groups": []}
    assert rights.of_page(page) == {"view": {"users": [a.id], "groups": []}}
    b = user("b")
    page.access = rights.to_page_access({**rights.of_page(page), "edit": {"users": [b.id]}})
    assert page.access == {"users": [a.id], "groups": [], "edit": {"users": [b.id], "groups": []}}
    from apps.pages import service

    assert service.can_see(a, page)
    assert service.can_see(b, page)  # b may view it as an editor of the page
    assert not service.can_see(user("c"), page)


def test_only_the_listed_editors_may_edit_a_page_and_managers_are_never_kept_out(page, db):
    editor, other, manager = user("e"), user("o"), user("m")
    for u in (editor, other):
        ModuleGrant.objects.create(module="pages", user=u, level=2)
        ModuleGrant.objects.create(module="edit_mode", user=u, level=2)
    ModuleGrant.objects.create(module="pages", user=manager, level=3)
    page.access = rights.to_page_access({"edit": {"users": [editor.id]}})
    page.save()
    assert api(other).patch(f"/api/pages/{page.pk}/", {"in_menu": False}, format="json").status_code == 403
    assert api(editor).patch(f"/api/pages/{page.pk}/", {"in_menu": False}, format="json").status_code == 200
    assert api(manager).patch(f"/api/pages/{page.pk}/", {"in_menu": True}, format="json").status_code == 200
    assert api(other).put("/api/pages/layout/info/", {"rows": [], "bg": {}}, format="json").status_code == 403  # the layout (edit mode) as well
    assert api(editor).put("/api/pages/layout/info/", {"rows": [], "bg": {}}, format="json").status_code == 200
    # a page without a list: everybody with the right of the module
    free = Page.objects.create(key="vrij", kind="content", title={"nl": "Vrij"}, scope="public")
    assert api(other).patch(f"/api/pages/{free.pk}/", {"in_menu": False}, format="json").status_code == 200


def test_delete_needs_the_delete_right_and_the_rights_of_a_page_can_only_be_changed_by_a_manager(page, db):
    editor, mgr = user("e"), user("m")
    ModuleGrant.objects.create(module="pages", user=editor, level=2)
    ModuleGrant.objects.create(module="pages", user=mgr, level=3)
    r = api(editor).patch(f"/api/pages/{page.pk}/", {"rights": [{"type": "user", "id": editor.id, "view": True, "edit": True}]}, format="json")
    assert r.status_code == 403  # an editor can not give himself rights
    r = api(mgr).patch(f"/api/pages/{page.pk}/", {"rights": [{"type": "user", "id": editor.id, "view": True, "edit": True}]}, format="json")
    assert r.status_code == 200 and r.json()["rights"][0]["edit"] is True
    page.refresh_from_db()
    assert page.access["edit"]["users"] == [editor.id] and page.access["users"] == [editor.id]
    page.access = rights.to_page_access({"delete": {"users": [mgr.id + 100]}})  # a list for deleting with nobody real in it: cleaned away
    assert page.access == {}


def test_a_page_can_get_its_rights_when_it_is_made(db):
    mgr, g = user("m"), None
    ModuleGrant.objects.create(module="pages", user=mgr, level=3)
    g = UserGroup.objects.create(name="Redactie", slug="redactie")
    r = api(mgr).post("/api/pages/", {"kind": "content", "title": {"nl": "Nieuw"}, "rights": [{"type": "group", "id": g.id, "view": True, "edit": True, "delete": False}]}, format="json")
    assert r.status_code == 201
    p = Page.objects.get(key=r.json()["key"])
    assert p.access == {"users": [], "groups": [g.id], "edit": {"users": [], "groups": [g.id]}}


# ── records of plugins ──

def test_a_record_with_rights_is_hidden_from_others_and_the_owner_and_admins_keep_access(db):
    owner, friend, stranger, boss = user("o"), user("f"), user("s"), user("b", is_staff=True)
    rights.protect("documents", "document", 7, owner=owner, rules={"view": {"users": [friend.id]}, "edit": {"users": [friend.id]}})
    assert rights.can(owner, "documents", "document", 7, "delete") and rights.can(boss, "documents", "document", 7, "delete")
    assert rights.can(friend, "documents", "document", 7, "edit") and rights.can(friend, "documents", "document", 7, "delete")  # no list for deleting: no restriction for deleting
    assert not rights.can(stranger, "documents", "document", 7, "view")
    assert rights.can(stranger, "documents", "document", 8, "delete")  # a record without rights: the plugin decides
    assert rights.hidden_pks(stranger, "documents", "document") == ["7"] and rights.hidden_pks(friend, "documents", "document") == [] and rights.hidden_pks(boss, "documents", "document") == []
    rights.forget("documents", "document", 7)
    assert rights.can(stranger, "documents", "document", 7, "view") and not AccessTarget.objects.exists()
    rights.protect("documents", "document", 9, owner=None, rules={})  # nothing to store
    assert not AccessTarget.objects.exists()


def test_a_queryset_can_be_filtered_with_the_facade(db):
    from apps.plugins import facade

    a, b = user("a"), user("b")
    rights.protect("documents", "document", 1, owner=a, rules={"view": {"users": [a.id]}})
    qs = U.objects.filter(pk__in=[a.id, b.id])  # (any model: here a user stands for a record)
    rights.protect("documents", "document", a.id, owner=a, rules={"view": {"users": [a.id]}})
    assert list(facade.rights.exclude_hidden(qs, b, "documents", "document").values_list("pk", flat=True)) == [b.id]
    assert set(facade.rights.exclude_hidden(qs, a, "documents", "document").values_list("pk", flat=True)) == {a.id, b.id}
    assert facade.rights.can(b, "documents", "document", 1, "view") is False


@pytest.fixture
def docs_plugin(db):
    pl, _ = Plugin.objects.update_or_create(name="documents", defaults={"title": "Documenten", "enabled": True, "rights_members": False, "manifest": {"rights": {"models": ["document"]}}})
    return pl


def test_non_admins_set_rights_of_their_own_records_only_when_the_plugin_allows_it(docs_plugin):
    owner, other, friend = user("o"), user("x"), user("f")
    rights.protect("documents", "document", 3, owner=owner, rules={"view": {"users": [owner.id]}})
    url = "/api/rights/record/documents/document/3/"
    assert api(owner).get(url).status_code == 403  # the plugin does not allow it yet
    docs_plugin.rights_members = True
    docs_plugin.save()
    r = api(owner).put(url, {"entries": [{"type": "user", "id": owner.id, "view": True, "edit": True}, {"type": "user", "id": friend.id, "view": True}]}, format="json")
    assert r.status_code == 200 and {e["id"] for e in r.json()["entries"]} == {owner.id, friend.id} and r.json()["can_manage"] is True
    assert api(other).put(url, {"entries": []}, format="json").status_code == 403  # somebody else's record
    assert rights.can(friend, "documents", "document", 3, "view") and not rights.can(friend, "documents", "document", 3, "edit")
    assert api(user("boss", is_staff=True)).delete(url).json()["entries"] == []  # an administrator takes the restrictions away


def test_the_api_for_modules_pages_and_plugins_is_for_administrators(docs_plugin, page):
    plain, boss, a = user("p"), user("b", is_staff=True), user("a")
    assert api(plain).get("/api/rights/module/media/").status_code == 403 and api().get("/api/rights/module/media/").status_code in (401, 403)
    r = api(boss).put("/api/rights/module/media/", {"entries": [{"type": "user", "id": a.id, "view": True, "edit": True}]}, format="json")
    assert r.status_code == 200 and r.json()["entries"][0]["edit"] is True
    assert api(boss).get("/api/rights/module/nonexistent/").status_code == 404 and api(boss).get("/api/rights/module/rights/").status_code == 404
    mgr = user("m")
    ModuleGrant.objects.create(module="pages", user=mgr, level=3)
    r = api(mgr).put("/api/rights/page/info/", {"entries": [{"type": "user", "id": a.id, "view": True, "delete": True}]}, format="json")
    assert r.status_code == 200
    page.refresh_from_db()
    assert page.access["delete"]["users"] == [a.id]
    assert api(plain).get("/api/rights/page/info/").status_code == 403 and api(mgr).get("/api/rights/people/").status_code == 200 and api(plain).get("/api/rights/people/").status_code == 403
    assert api(plain).put("/api/rights/plugin/documents/", {"rights_members": True}, format="json").status_code == 403
    r = api(boss).put("/api/rights/plugin/documents/", {"rights_members": True}, format="json")
    assert r.json()["rights_members"] is True and r.json()["models"] == ["document"]
    ov = api(boss).get("/api/rights/overview/").json()
    assert any(m["key"] == "media" and m["entries"] == 1 for m in ov["modules"]) and next(x for x in ov["plugins"] if x["name"] == "documents")["rights_members"] is True
    assert not any(m["key"] == "rights" for m in ov["modules"])


def test_the_manifest_lists_the_models_with_rights():
    from apps.plugins import manifest

    m = manifest.parse('{"name": "demo-plugin", "version": "1.0.0", "rights": {"models": ["product", "Bad Name", "doc"]}}')
    assert m["rights"] == {"models": ["product", "doc"]}
    assert manifest.parse('{"name": "demo-plugin", "version": "1.0.0"}')["rights"] == {}


def test_the_layout_tells_whether_this_user_may_edit_the_page(page, db):
    editor, other = user("e"), user("o")
    page.access = rights.to_page_access({"edit": {"users": [editor.id]}})
    page.save()
    PageLayout.objects.create(key="info", data={"rows": [], "bg": {}})
    assert api(editor).get("/api/pages/layout/info/").json()["can_edit"] is True
    assert api(other).get("/api/pages/layout/info/").json()["can_edit"] is False
    assert api(user("boss", is_staff=True)).get("/api/pages/layout/info/").json()["can_edit"] is True


def test_the_rights_module_is_standard_and_always_on(db):
    m = next(x for x in modules.MODULES if x["key"] == "rights")
    assert m["core"] is True and m["acl"] is False
