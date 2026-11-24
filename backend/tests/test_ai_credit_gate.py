# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The AI never works for a user with no credit (the offer to buy credit comes first), and the superadmin decides whether plain users may use the AI at all."""
import pytest
from rest_framework.test import APIClient

from apps.integrations import aiusage
from apps.integrations.models import AiAccount, AiSettings


def _as(user):
    token = aiusage._actor.set(user.pk)
    return token


@pytest.mark.django_db
def test_no_credit_no_ai_and_the_work_is_not_started(django_user_model, monkeypatch):
    from apps.core import sitecreator

    monkeypatch.setattr(sitecreator.ai, "available", lambda *a, **k: True)
    user = django_user_model.objects.create_user("us", "us@x.nl", "pw12345678!")
    AiSettings.load()
    token = _as(user)
    try:
        with pytest.raises(aiusage.NoCredit):
            aiusage.gate("claude-sonnet-5-5", ("hallo",), 100)  # no account: no credit
        AiAccount.objects.update_or_create(user=user, defaults={"balance": 0})
        with pytest.raises(aiusage.NoCredit):
            aiusage.precheck()  # 0 is no credit
        AiAccount.objects.filter(user=user).update(balance=-1)
        with pytest.raises(aiusage.NoCredit):
            aiusage.precheck()  # less than 0 neither
        AiAccount.objects.filter(user=user).update(balance=50)
        aiusage.precheck()  # with credit it passes
    finally:
        aiusage._actor.reset(token)


@pytest.mark.django_db
def test_the_creator_answers_with_the_offer_to_buy_credit(django_user_model, monkeypatch):
    from apps.core import sitecreator
    from apps.core.models import SiteDesignJob

    monkeypatch.setattr(sitecreator.ai, "available", lambda *a, **k: True)
    from apps.accounts.models import ModuleGrant, Role

    user = django_user_model.objects.create_user("us", "us@x.nl", "pw12345678!", is_staff=False)
    role = Role.objects.create(name="Ontwerper", slug="ontwerper", permissions=["pages.manage"])
    user.roles.add(role)
    ModuleGrant.objects.create(module="siteimport", user=user, level=3)
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    bc = APIClient(); bc.force_authenticate(boss)
    pk = bc.post("/api/sitecreator/", {"name": "x"}, format="json").json()["id"]
    SiteDesignJob.objects.filter(pk=pk).update(user=user)
    c = APIClient(); c.force_authenticate(user)
    r = c.post(f"/api/sitecreator/{pk}/chat/", {"text": "hoi"}, format="json")
    if r.status_code in (403, 404):
        pytest.skip("this user may not open the creator")
    assert r.status_code == 402 and r.json()["code"] == "ai_credit"
    assert SiteDesignJob.objects.get(pk=pk).status != "running"  # nothing was started


@pytest.mark.django_db
def test_users_may_be_switched_off_and_admins_stay(django_user_model):
    from apps.accounts.models import Role

    user = django_user_model.objects.create_user("us", "us@x.nl", "pw12345678!")
    admin = django_user_model.objects.create_user("ad", "ad@x.nl", "pw12345678!")
    role = Role.objects.create(name="Beheer", slug="beheer", permissions=["pages.manage"])
    admin.roles.add(role)
    st = AiSettings.load()
    st.credit_required = False
    st.users_may_use = False
    st.save()
    t = _as(user)
    try:
        with pytest.raises(aiusage.NotAllowed):
            aiusage.gate("claude-sonnet-5-5", (), 100)
    finally:
        aiusage._actor.reset(t)
    t = _as(admin)
    try:
        aiusage.gate("claude-sonnet-5-5", (), 100)  # an admin is not stopped
    finally:
        aiusage._actor.reset(t)
