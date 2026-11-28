# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The plugin MCP connection: clients with a secret (shown once), access tokens, verification and the JSON-RPC endpoint; off by default."""
import shutil
from pathlib import Path

import pytest
from rest_framework.test import APIClient

SRC = Path(__file__).resolve().parents[2] / "plugins" / "mcp"
RUN = "/api/plugins/run/mcp/"


@pytest.fixture
def mcp(transactional_db, settings, tmp_path, media):
    from apps.plugins import installer, manifest, runtime, signing

    settings.PLUGINS_DIR = tmp_path / "plugins"
    shutil.copytree(SRC, settings.PLUGINS_DIR / "mcp", ignore=shutil.ignore_patterns("__pycache__", "plugin.sig"))
    signing.dev_mode_allowed = lambda: True
    p = installer.register(manifest.parse((settings.PLUGINS_DIR / "mcp" / "plugin.json").read_bytes()))
    assert p.enabled is False  # off by default
    p.enabled = True
    p.save()
    assert runtime.load(p) is None
    runtime.ensure_loaded(force=True)
    from django.db import connection

    with connection.cursor() as cur:
        if "plg_mcp_client" in connection.introspection.table_names():
            cur.execute('DELETE FROM "plg_mcp_client"')
    from django.core.cache import cache

    cache.clear()
    yield p
    runtime.unload("mcp")


@pytest.fixture
def admin(transactional_db):
    from django.contrib.auth import get_user_model

    u = get_user_model().objects.create(username="boss", email="b@example.com", is_staff=True, is_superuser=True)
    c = APIClient()
    c.force_authenticate(u)
    return c


def rpc(secret, method, params=None):
    return APIClient().post(RUN + "rpc", {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}, format="json", HTTP_AUTHORIZATION=f"Bearer {secret}")


def make(admin, **kw):
    r = admin.post(RUN + "admin/clients", {"name": "Claude", **kw}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_the_secret_is_shown_once_and_only_a_hash_is_kept(mcp, admin):
    c = make(admin)
    assert c["secret"].startswith(c["client_id"] + ".")
    listed = admin.get(RUN + "admin/clients").json()
    assert "secret" not in listed["clients"][0] and listed["endpoint"].endswith("/api/plugins/run/mcp/rpc")


def test_only_an_administrator_manages(mcp, transactional_db):
    from django.contrib.auth import get_user_model

    c = APIClient()
    c.force_authenticate(get_user_model().objects.create(username="p", email="p@example.com"))
    assert c.post(RUN + "admin/clients", {"name": "x"}, format="json").status_code == 403
    assert APIClient().get(RUN + "admin/clients").status_code == 401


def test_verify_tells_valid_revoked_and_unknown(mcp, admin):
    c = make(admin)
    ver = lambda s: admin.post(RUN + "admin/verify", {"secret": s}, format="json").json()  # noqa: E731
    assert ver(c["secret"])["valid"] is True
    assert ver(c["secret"] + "x")["state"] == "unknown"
    admin.patch(RUN + f"admin/clients/{c['id']}", {"revoked": True}, format="json")
    assert ver(c["secret"])["state"] == "revoked"


def test_the_endpoint_needs_a_key_and_speaks_mcp(mcp, admin):
    s = make(admin)["secret"]
    assert APIClient().post(RUN + "rpc", {}, format="json").status_code == 401
    assert rpc("mcp_bad.x", "ping").status_code == 401
    assert rpc(s, "initialize").json()["result"]["protocolVersion"] == "2025-03-26"
    assert "list_pages" in [t["name"] for t in rpc(s, "tools/list").json()["result"]["tools"]]
    assert rpc(s, "tools/call", {"name": "site_info"}).json()["result"]["isError"] is False
    assert rpc(s, "nope").json()["error"]["code"] == -32601
    assert admin.get(RUN + "admin/clients").json()["clients"][0]["uses"] == 4


def test_access_token_and_a_renewed_secret_kills_old_tokens(mcp, admin):
    c = make(admin)
    t = APIClient().post(RUN + "token", {"client_id": c["client_id"], "client_secret": c["secret"]}, format="json").json()
    assert t["token_type"] == "Bearer" and rpc(t["access_token"], "ping").status_code == 200
    new = admin.post(RUN + f"admin/clients/{c['id']}/renew").json()["secret"]
    assert rpc(t["access_token"], "ping").status_code == 401 and rpc(c["secret"], "ping").status_code == 401 and rpc(new, "ping").status_code == 200


def test_expiry_ip_limit_scope_and_fail_brake(mcp, admin):
    s = make(admin, expires="2000-01-01")["secret"]
    assert rpc(s, "ping").status_code == 401
    c = make(admin, allowed_ips=["10.9.9.9"])
    assert rpc(c["secret"], "ping").status_code == 403
    d = make(admin)
    from django.db import connection

    with connection.cursor() as cur:
        cur.execute('UPDATE "plg_mcp_client" SET scopes = %s WHERE client_id = %s', ["[]", d["client_id"]])
    assert rpc(d["secret"], "tools/list").json()["result"]["tools"] == []
    assert rpc(d["secret"], "tools/call", {"name": "site_info"}).json()["error"]["code"] == -32001
    for _ in range(25):
        rpc("mcp_x.y", "ping")
    assert rpc("mcp_x.y", "ping").status_code == 429


def test_resolve_gives_addresses_and_only_real_ip_addresses_are_saved(mcp, admin):
    r = admin.post(RUN + "admin/resolve", {"hosts": ["203.0.113.5", "localhost"]}, format="json").json()
    assert "203.0.113.5" in r["ips"] and r["failed"] == []
    assert admin.post(RUN + "admin/resolve", {"hosts": []}, format="json").json()["ips"]  # empty: the own address
    assert admin.post(RUN + "admin/resolve", {"hosts": ["nietbestaand.invalid"]}, format="json").json()["failed"] == ["nietbestaand.invalid"]
    assert admin.post(RUN + "admin/clients", {"name": "x", "allowed_ips": ["mcp.studio2.nl"]}, format="json").status_code == 400
    assert make(admin, allowed_ips=["203.0.113.5"])["allowed_ips"] == ["203.0.113.5"]


def call(secret, name, args=None):
    return rpc(secret, "tools/call", {"name": name, "arguments": args or {}}).json()


def set_rights(admin, c, scopes):
    r = admin.patch(RUN + f"admin/clients/{c['id']}", {"scopes": scopes}, format="json")
    assert r.status_code == 200, r.content
    return r.json()


def test_rights_are_per_part_and_write_brings_read(mcp, admin):
    c = make(admin)
    assert c["scopes"] == ["pages:read", "site:read"]  # a new connection only reads the site and its pages
    assert set_rights(admin, c, ["pages:write"])["scopes"] == ["pages:read", "pages:write"]
    every_read = sorted(f"{k}:read" for k in admin.get(RUN + "admin/clients").json()["resources"])
    assert set_rights(admin, c, ["read"])["scopes"] == every_read  # the old right "read" = every read right
    assert set_rights(admin, c, ["nonsense:write", "users:write"])["scopes"] == []  # users has nothing to write yet
    assert "resources" in admin.get(RUN + "admin/clients").json()


def test_a_tool_needs_its_own_right_and_write_tools_write(mcp, admin):
    from apps.core.models import Tag
    from apps.pages.models import Page

    c = make(admin)
    s = c["secret"]
    names = lambda: [t["name"] for t in rpc(s, "tools/list").json()["result"]["tools"]]  # noqa: E731
    assert "create_tag" not in names() and "update_page" not in names()
    assert call(s, "create_tag", {"name": "x"})["error"]["code"] == -32001
    set_rights(admin, c, ["tags:write", "pages:write", "users:read", "entity:read", "media:read"])
    assert {"create_tag", "list_tags", "update_page", "list_users", "get_company", "list_media"} <= set(names())
    assert call(s, "create_tag", {"name": "Via MCP", "color": "#112233"})["result"]["isError"] is False
    assert Tag.objects.filter(name="Via MCP").exists()
    assert call(s, "create_tag", {"name": "Via MCP"})["result"]["isError"] is True  # a double name is refused
    Page.objects.create(key="mcp-test", kind="content", title={"nl": "Oud"}, scope="public", enabled=True)
    assert call(s, "update_page", {"key": "mcp-test", "title": {"nl": "Nieuw"}, "in_menu": True})["result"]["isError"] is False
    p = Page.objects.get(key="mcp-test")
    assert p.title["nl"] == "Nieuw" and p.in_menu is True
    assert call(s, "update_page", {"key": "mcp-test", "title": "text"})["result"]["isError"] is True
    assert call(s, "update_page", {"key": "mcp-test", "enabled": "yes"})["result"]["isError"] is True
    assert call(s, "update_page", {"key": "mcp-test"})["result"]["isError"] is True
    assert "email" not in str(call(s, "list_users")["result"]["content"][0]["text"]).lower().replace("e-mail", "")


def test_modules_and_plugins_can_be_read_and_switched_with_a_write_right(mcp, admin):
    from apps.auditlog.models import LogEntry
    from apps.core import modules
    from apps.plugins.models import Plugin

    c = make(admin)
    s = c["secret"]
    assert call(s, "set_module", {"key": "help", "enabled": False})["error"]["code"] == -32001  # no right yet
    set_rights(admin, c, ["modules:write", "plugins:write"])
    assert {"list_modules", "set_module", "list_plugins", "set_plugin"} <= {t["name"] for t in rpc(s, "tools/list").json()["result"]["tools"]}
    mods = __import__("json").loads(call(s, "list_modules")["result"]["content"][0]["text"])
    assert any(m["key"] == "help" for m in mods)
    assert call(s, "set_module", {"key": "help", "enabled": False})["result"]["isError"] is False
    assert modules.enabled("help") is False
    call(s, "set_module", {"key": "help", "enabled": True})
    assert modules.enabled("help") is True
    assert call(s, "set_module", {"key": "users", "enabled": False})["result"]["isError"] is True  # a core module
    assert call(s, "set_module", {"key": "nope", "enabled": False})["result"]["isError"] is True
    assert call(s, "set_module", {"key": "help", "enabled": "no"})["result"]["isError"] is True
    names = {p["name"] for p in __import__("json").loads(call(s, "list_plugins")["result"]["content"][0]["text"])}
    assert "mcp" in names
    assert call(s, "set_plugin", {"name": "mcp", "enabled": False})["result"]["isError"] is True  # not itself
    assert Plugin.objects.get(name="mcp").enabled is True
    assert call(s, "set_plugin", {"name": "nope", "enabled": True})["result"]["isError"] is True
    assert LogEntry.objects.filter(event="mcp.write", detail__contains="set_module").exists()  # a change is in the log


def test_access_per_plugin_only_for_plugins_that_are_on(mcp, admin):
    import json

    from apps.plugins.models import Plugin

    Plugin.objects.create(name="demo-plugin", title="Demo", version="1.0.0", enabled=True, manifest={"name": "demo-plugin", "section": "website", "provides": ["x"]})
    Plugin.objects.create(name="off-plugin", title="Off", version="1.0.0", enabled=False, manifest={"name": "off-plugin"})
    listed = admin.get(RUN + "admin/clients").json()["plugins"]
    assert [p["name"] for p in listed] == ["demo-plugin"]  # only the plugins that are on, not this plugin itself
    c = make(admin)
    s = c["secret"]
    assert "get_plugin" not in [t["name"] for t in rpc(s, "tools/list").json()["result"]["tools"]]
    assert call(s, "get_plugin", {"name": "demo-plugin"})["error"]["code"] == -32001
    assert set_rights(admin, c, ["plugin:demo-plugin", "plugin:off-plugin", "plugin:BAD NAME"])["scopes"] == ["plugin:demo-plugin", "plugin:off-plugin"]
    assert "get_plugin" in [t["name"] for t in rpc(s, "tools/list").json()["result"]["tools"]]
    got = json.loads(call(s, "get_plugin", {"name": "demo-plugin"})["result"]["content"][0]["text"])
    assert got["title"] == "Demo" and got["section"] == "website"
    assert call(s, "get_plugin", {"name": "off-plugin"})["result"]["isError"] is True  # not on
    assert call(s, "get_plugin", {"name": "mcp"})["error"]["code"] == -32001  # no access to that one


def test_the_connections_are_in_a_backup_and_come_back_but_are_never_in_a_template(mcp, admin, tmp_path, monkeypatch):
    import json
    import zipfile

    from apps.core import templatepacks as tp
    from apps.plugins import backup as pb
    from apps.plugins.models import Plugin

    c = make(admin)
    # the backup of the plugins has the rows of the table of the plugin (the keys are only hashes)
    out = pb._export({})
    item = next(i for i in out["plugins"] if i["name"] == "mcp")
    rows = json.loads(item["data"]["Client"])
    assert [r["fields"]["client_id"] for r in rows] == [c["client_id"]] and c["secret"] not in item["data"]["Client"]
    # restoring it: the table is emptied and the connection is back, and the key still works
    p = Plugin.objects.get(name="mcp")
    from django.db import connection

    with connection.cursor() as cur:
        cur.execute('DELETE FROM "plg_mcp_client"')
    assert rpc(c["secret"], "ping").status_code == 401
    pb._data_apply(p, item["data"], "clean")
    assert rpc(c["secret"], "ping").status_code == 200
    # a template never holds the plugin: not its entry, its zip, its settings, nor its data
    monkeypatch.setattr(tp, "library_dir", lambda: tmp_path / "lib")
    monkeypatch.setattr(tp, "site_dir", lambda: tmp_path / "site")
    tp.build_from_site("no-mcp", "No MCP")
    f = next((tmp_path / "lib").glob("no-mcp-1.0.0.zip"))
    with zipfile.ZipFile(f) as z:
        blob = b"".join(z.read(n) for n in z.namelist() if n.endswith(".json"))
        system = json.loads(z.read("system.json"))
    assert b"mcp_" not in blob and c["client_id"].encode() not in blob
    assert "mcp" not in [i.get("name") for i in system["sections"]["plugins"]["data"]["plugins"]]
    assert "mcp" not in tp.all_templates()["no-mcp"][1]["requires"]["plugins"]
    # and an older template or backup that still has it does not bring it in
    bundle = {"sections": {"plugins": {"data": {"plugins": [{"name": "mcp"}, {"name": "faq"}]}}}}
    assert [i["name"] for i in tp.strip_private_plugins(bundle)["sections"]["plugins"]["data"]["plugins"]] == ["faq"]


def test_a_connection_file_can_be_saved_as_a_connection_when_it_does_not_exist(mcp, admin):
    cid = "mcp_0123456789abcdef"
    secret = cid + ".AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
    r = admin.post(RUN + "admin/clients/import", {"client_id": cid, "secret": secret, "name": "Uit bestand", "scopes": ["pages:write"]}, format="json")
    assert r.status_code == 201 and r.json()["scopes"] == ["pages:read", "pages:write"] and "secret" not in r.json()
    assert rpc(secret, "ping").status_code == 200  # the key of the file works
    assert admin.post(RUN + "admin/clients/import", {"client_id": cid, "secret": secret}, format="json").status_code == 409  # it exists now
    for bad_one in ({"client_id": "mcp_x", "secret": "mcp_x.y"}, {"client_id": cid.replace("0", "1"), "secret": secret}, {"client_id": "mcp_1111111111111111", "secret": "mcp_1111111111111111.kort"}):
        assert admin.post(RUN + "admin/clients/import", bad_one, format="json").status_code == 400
    from django.contrib.auth import get_user_model

    p = APIClient()
    p.force_authenticate(get_user_model().objects.create(username="pp", email="pp@example.com"))
    assert p.post(RUN + "admin/clients/import", {"client_id": "mcp_2222222222222222", "secret": "mcp_2222222222222222." + "a" * 30}, format="json").status_code == 403


def test_the_ip_check_uses_the_chosen_source_and_the_error_names_the_address(mcp, admin):
    from apps.plugins import runtime
    from apps.plugins.models import Plugin

    c = make(admin, allowed_ips=["10.9.9.9"])
    s = c["secret"]
    call_from = lambda **meta: APIClient().post(RUN + "rpc", {"jsonrpc": "2.0", "id": 1, "method": "ping"}, format="json", HTTP_AUTHORIZATION=f"Bearer {s}", **meta)  # noqa: E731
    r = call_from(HTTP_X_FORWARDED_FOR="10.9.9.9, 172.18.0.5")
    assert r.status_code == 403  # the default does not read X-Forwarded-For
    assert "This address may not connect:" in r.json()["error"]["message"]
    for source, header, ok in (("x-forwarded-for-eerste", "10.9.9.9, 172.18.0.5", True), ("x-forwarded-for-laatste", "1.2.3.4, 10.9.9.9", True), ("x-forwarded-for-laatste", "10.9.9.9, 172.18.0.5", False)):
        p = Plugin.objects.get(name="mcp")
        p.config = {"ip_source": source}
        p.save()
        runtime.ensure_loaded(force=True)
        assert (call_from(HTTP_X_FORWARDED_FOR=header).status_code == 200) is ok, (source, header)
    p = Plugin.objects.get(name="mcp")
    p.config = {"ip_source": "x-real-ip"}
    p.save()
    runtime.ensure_loaded(force=True)
    assert call_from(HTTP_X_REAL_IP="10.9.9.9").status_code == 200
    assert admin.post(RUN + "admin/resolve", {"hosts": []}, format="json").json()["ips"]  # the own address as the server sees it
