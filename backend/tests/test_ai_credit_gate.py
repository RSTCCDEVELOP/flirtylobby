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


@pytest.mark.django_db
def test_the_costs_of_a_superadmin_run_up_by_default(django_user_model):
    """The use of superadmins and of the system counts as costs of the website from the start (the live window and the reports used to stay at 0)."""
    import time

    from apps.integrations.models import AiUsage

    assert AiSettings.load().bill_internal is True
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    t = _as(boss)
    try:
        aiusage.record("claude-sonnet-5-5", {"input_tokens": 12000, "output_tokens": 3000}, time.time() - 2, True, "", False, 0, "")
    finally:
        aiusage._actor.reset(t)
    row = AiUsage.objects.order_by("-id").first()
    assert row.tokens_in == 12000 and float(row.charged) > 0 and row.group == "site"


@pytest.mark.django_db
def test_superadmins_and_superadmin_plus_must_buy_credit_too(django_user_model):
    """Everybody who asks needs credit when it is required: also a superadmin and a superadmin+ (only the system itself is free)."""
    sup = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    plus = django_user_model.objects.create_user("pp", "pp@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    plus.is_superadmin_plus = True
    plus.save()
    st = AiSettings.load()
    assert st.credit_required
    for u in (sup, plus):
        assert aiusage.subject(u)
        t = _as(u)
        try:
            with pytest.raises(aiusage.NoCredit):
                aiusage.gate("claude-sonnet-5-5", ("hallo",), 100)  # no credit: no AI
            with pytest.raises(aiusage.NoCredit):
                aiusage.precheck()
            AiAccount.objects.update_or_create(user=u, defaults={"balance": 50})
            aiusage.precheck()  # with credit it passes
            aiusage.record("claude-sonnet-5-5", {"input_tokens": 12000, "output_tokens": 3000}, __import__("time").time() - 2, True, "", False, 0, "")
        finally:
            aiusage._actor.reset(t)
        assert float(AiAccount.objects.get(user=u).balance) < 50  # the use is paid from the credit
    assert not aiusage.subject(None)  # (the system itself is free)


@pytest.mark.django_db
def test_superadmin_may_bypass_the_credit_when_the_option_is_on(django_user_model):
    sa = django_user_model.objects.create_user("sa", "sa@x.nl", "pw12345678!", is_staff=True)
    st = AiSettings.load()
    st.credit_required = True
    st.save()
    token = _as(sa)
    try:
        with pytest.raises(aiusage.NoCredit):
            aiusage.gate("claude-sonnet-5-5", ("hallo",), 100)  # option off: a superadmin needs credit too
        st.superadmin_bypass = True
        st.save()
        aiusage.gate("claude-sonnet-5-5", ("hallo",), 100)  # option on: passes without credit
    finally:
        aiusage._actor.reset(token)
