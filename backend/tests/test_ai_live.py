# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The floating AI window of the back office: live list of AI calls with costs; only for superadmins and admins with the right; admins never see purchase prices."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.integrations.models import AiUsage

URL = "/api/admin/ai/live/"


def client(u=None):
    c = APIClient()
    if u:
        c.force_authenticate(u)
    return c


@pytest.mark.django_db
def test_live_calls_for_superadmin_only_with_prices(db):
    U = get_user_model()
    sup = U.objects.create(username="s", email="s@example.com", is_staff=True, is_superuser=True)
    plain = U.objects.create(username="p", email="p@example.com")
    a = AiUsage.objects.create(group="user", source="Website ontwerpen", model="claude-sonnet-5-5", tokens_in=1000, tokens_out=500, cost="0.0105", charged="0.02")
    b = AiUsage.objects.create(group="super", source="Systeem", model="claude-sonnet-5-5", tokens_in=10, tokens_out=5, cost="0.0001", charged="0")
    assert client().get(URL).status_code in (401, 403) and client(plain).get(URL).status_code == 403
    d = client(sup).get(URL).json()
    assert d["super"] is True and d["top"] == b.id and [r["id"] for r in d["rows"]] == [b.id, a.id] and "cost" not in d["rows"][1] and d["rows"][1]["charged"] == 0.02 and d["currency"] == "EUR"
    assert client(sup).get(URL + f"?after={a.id}").json()["rows"][0]["id"] == b.id and len(client(sup).get(URL + f"?after={b.id}").json()["rows"]) == 0


@pytest.mark.django_db
def test_admin_with_right_sees_no_purchase_price(db):
    from unittest import mock

    U = get_user_model()
    adm = U.objects.create(username="a", email="a@example.com")
    AiUsage.objects.create(group="user", source="Website ontwerpen", model="m", cost="0.5", charged="0.7")
    AiUsage.objects.create(group="super", source="Systeem", model="m", cost="0.5", charged="0.7")
    with mock.patch.object(U, "permission_keys", lambda self: {"ai.manage"}, create=True):
        d = client(adm).get(URL).json()
    assert d["super"] is False and len(d["rows"]) == 1 and "cost" not in d["rows"][0] and d["rows"][0]["charged"] == 0.7
    assert d["today"] == {"calls": 1, "charged": 0.7} and d["month"]["charged"] == 0.7 and "cost" not in d["today"]  # the totals of an admin count only what he may see


@pytest.mark.django_db
def test_icon_position_is_remembered_per_user_on_the_server(db):
    U = get_user_model()
    a, b = U.objects.create(username="a", email="a@example.com"), U.objects.create(username="b", email="b@example.com")
    assert client(a).put("/api/dashboard/prefs/", {"set": {"aiLivePos": "tl"}}, format="json").json()["prefs"]["aiLivePos"] == "tl"
    assert client(a).get("/api/dashboard/prefs/").json()["prefs"]["aiLivePos"] == "tl"
    assert "aiLivePos" not in client(b).get("/api/dashboard/prefs/").json()["prefs"]


@pytest.mark.django_db
def test_summary_gives_the_big_numbers_without_purchase_price(db):
    U = get_user_model()
    sup = U.objects.create(username="s", email="s@example.com", is_staff=True)
    AiUsage.objects.create(group="user", source="Website ontwerpen", model="m", cost="0.5", charged="0.7")
    AiUsage.objects.create(group="super", source="Systeem", model="m", cost="0.5", charged="0.3", ok=False)
    d = client(sup).get("/api/admin/ai/summary/").json()
    assert d["today"]["calls"] == 2 and d["today"]["charged"] == 1.0 and d["today"]["errors"] == 1 and d["all"]["calls"] == 2 and d["yesterday"]["calls"] == 0
    assert d["month"]["charged"] == 1.0 and d["expected_month"] >= 1.0 and d["currency"] == "EUR" and "cost" not in d["today"]


@pytest.mark.django_db
def test_the_site_group_gets_the_name_of_the_last_installation(db):
    from apps.core import system
    from apps.integrations import aiusage

    system.save({"site_name": "Oude naam"})
    aiusage.forget_names()
    assert aiusage.group_names()["site"] == "Oude naam"
    system.set_installation_name("Webwinkel")  # an installation was done: the name follows at once
    assert aiusage.group_names()["site"] == "Webwinkel"
    assert system.site_name() == "Oude naam"


@pytest.mark.django_db
def test_a_busy_call_shows_its_costs_growing_and_disappears_when_done(db):
    from apps.integrations import aiusage

    U = get_user_model()
    sup = U.objects.create(username="s2", email="s2@example.com", is_staff=True)
    aiusage.RUNNING.clear()
    rid = aiusage.begin("claude-sonnet-5-5", "system", "x" * 4000, False)
    first = client(sup).get(URL).json()["running"]
    assert len(first) == 1 and first[0]["tokens_in"] >= 1000 and "cost" not in first[0]
    aiusage.progress(rid, tokens_in=20000)
    aiusage.progress(rid, written_chars=40000)  # 10.000 tokens written so far
    later = client(sup).get(URL).json()["running"][0]
    assert later["tokens_in"] == 20000 and later["tokens_out"] == 10000 and later["charged"] >= first[0]["charged"]
    aiusage.end(rid)
    assert client(sup).get(URL).json()["running"] == []
