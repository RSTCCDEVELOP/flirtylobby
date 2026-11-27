# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Roles, groups with rights and demo users are a setting of a standard installation (tab Gebruikers en rechten) and are made when the installation is set up."""
import pytest

from apps.accounts import setups
from apps.accounts.models import Role, User, UserGroup
from apps.core import presets


@pytest.mark.django_db
def test_the_default_is_to_make_them_and_the_editor_shows_what_the_set_up_holds():
    key = "webshop"
    assert presets.access_of(key) == {"auto": True, "steps": presets.ACCESS_DEFAULT}
    o = presets.edit_options(key)
    assert o["access"]["auto"] is True and o["access"]["summary"]["groups"] and o["access"]["summary"]["people"] > 0
    assert {"name", "roles", "modules", "people"} <= set(o["access"]["summary"]["groups"][0])


@pytest.mark.django_db
def test_the_choices_are_saved_and_only_what_differs_from_the_default_is_kept():
    key = "webshop"
    presets.save_edits(key, {"access": {"auto": False, "steps": {"people": False, "roles": True}}})
    ac = presets.access_of(key)
    assert ac["auto"] is False and ac["steps"]["people"] is False and ac["steps"]["roles"] is True
    assert presets.edits(key)["access"] == {"auto_off": True, "steps": {"people": False}}  # only what differs from the default is stored
    presets.save_edits(key, {"access": {"auto": True}})
    assert presets.access_of(key) == {"auto": True, "steps": presets.ACCESS_DEFAULT}
    presets.reset_edits(key)


@pytest.mark.django_db
def test_setting_up_the_installation_makes_what_is_switched_on_and_leaves_the_rest(monkeypatch):
    key = "webshop"
    made = []
    real = setups.apply
    monkeypatch.setattr(setups, "apply", lambda k, steps=None: (made.append((k, dict(steps or {}))), real(k, steps))[1])
    presets.save_edits(key, {"access": {"auto": True, "steps": {"people": False}}})  # (on is the default: only the step is changed)
    try:
        out = presets.apply(key)
    finally:
        presets.reset_edits(key)
    assert made and made[0][0] == key and made[0][1]["people"] is False
    assert out["access"]["made"]["groups"] == len(setups.GROUPS[key]) and out["access"]["made"]["people"] == 0  # groups yes, demo users no
    assert UserGroup.objects.filter(slug__startswith=f"{key}-").exists() and not User.objects.filter(username__startswith=setups._user_of(key, "")).exists()
    assert Role.objects.filter(slug__in=[r for g in setups.GROUPS[key] for r in g["roles"]]).exists()


@pytest.mark.django_db
def test_nothing_is_made_when_the_installation_switched_it_off(monkeypatch):
    called = []
    monkeypatch.setattr(setups, "apply", lambda *a, **k: called.append(a))
    presets.save_edits("webshop", {"access": {"auto": False}})
    try:
        out = presets.apply("webshop")
    finally:
        presets.reset_edits("webshop")
    assert not called and out["access"] is None


@pytest.mark.django_db
def test_the_question_before_the_installation_decides_for_that_run(monkeypatch):
    called = []
    monkeypatch.setattr(setups, "apply", lambda k, steps=None: called.append(k) or {"made": {}, "skipped": [], "switched_on": []})
    presets.save_edits("standaard-website", {"access": {"auto": False}})
    try:
        presets.apply("standaard-website", access=True)  # switched off in the installation, but asked for now
    finally:
        presets.reset_edits("standaard-website")
    assert called == ["standaard-website"]
    presets.apply("standaard-website", access=False)  # on by default, but not now
    assert called == ["standaard-website"]


@pytest.mark.django_db
def test_the_list_says_which_installations_have_a_set_of_roles_and_groups():
    rows = {r["key"]: r["access"] for r in presets.listing()}
    assert rows["standaard-website"]["available"] and rows["standaard-website"]["groups"] >= 3 and rows["standaard-website"]["auto"] is True
    assert all(rows[k]["available"] for k in setups.GROUPS if k in rows)
