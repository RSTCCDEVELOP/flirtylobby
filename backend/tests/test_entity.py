# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The module Entiteit: the organisation behind the website, local in the site."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core import entity, modules, presets, sitecreator


@pytest.fixture
def admin(db):
    u = get_user_model().objects.create_user("boss", "boss@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_module_is_core_and_every_installation_says_company():
    m = modules.BY_KEY["entities"]
    assert m["core"] is True
    assert all(p["entity_kind"] == "bedrijf" for p in presets.PRESETS)  # default: company; the superadmin changes it later


@pytest.mark.django_db
def test_default_title_is_company_and_follows_the_installation(admin):
    d = admin.get("/api/entity/").json()
    assert d["kind"] == "bedrijf" and d["title"] == "Bedrijf" and d["filled"] is False
    assert [k["key"] for k in d["kinds"]] == ["organisatie", "bedrijf", "vereniging", "club", "vrij"]
    key = "sportclub"
    data = presets._data()
    data["active_preset"] = key
    presets._save_data(data)
    opts = admin.put(f"/api/system/presets/{key}/edit/", {"entity": {"kind": "club"}}, format="json").json()
    assert opts["entity"]["kind"] == "club" and opts["entity"]["default"] == "bedrijf"
    assert admin.get("/api/entity/").json()["title"] == "Club"
    opts = admin.put(f"/api/system/presets/{key}/edit/", {"entity": {"kind": "vrij", "name": "Stichting"}}, format="json").json()
    assert admin.get("/api/entity/").json()["title"] == "Stichting"
    assert admin.put(f"/api/system/presets/{key}/edit/", {"entity": {"kind": "vrij", "name": ""}}, format="json").status_code == 400
    assert admin.put(f"/api/system/presets/{key}/edit/", {"entity": {"kind": "gek"}}, format="json").status_code == 400
    admin.put(f"/api/system/presets/{key}/edit/", {"entity": {"kind": "bedrijf"}}, format="json")  # back to the default: nothing is kept
    assert "entity" not in presets.edits(key) and admin.get("/api/entity/").json()["title"] == "Bedrijf"


@pytest.mark.django_db
def test_save_validates_and_cleans(admin):
    r = admin.put("/api/entity/", {"name": "Studio Test BV", "email": "info@studiotest.nl", "phone": "+31 30 1234567", "website": "https://studiotest.nl", "street": "Kerkstraat", "house_number": "1", "postal_code": "3511 AB", "city": "Utrecht", "country": "Nederland",
                                   "description": "html:<p>Hallo <script>x()</script><b>wereld</b></p>", "registration_no": "12345678"}, format="json")
    assert r.status_code == 200
    d = r.json()
    assert d["filled"] is True and "<script" not in d["data"]["description"] and "<b>wereld</b>" in d["data"]["description"]
    assert admin.put("/api/entity/", {"name": "X", "email": "nope"}, format="json").status_code == 400
    assert admin.put("/api/entity/", {"name": "X", "website": "javascript:alert(1)"}, format="json").status_code == 400
    assert admin.put("/api/entity/", {"name": "X", "phone": "abc"}, format="json").status_code == 400
    assert APIClient().put("/api/entity/", {"name": "X"}, format="json").status_code in (401, 403)  # only people with the right may change it
    assert APIClient().get("/api/entity/public/").json()["data"]["name"] == "Studio Test BV"  # the website reads it without a login


@pytest.mark.django_db
def test_text_variables_are_filled(admin):
    admin.put("/api/entity/", {"name": "Studio Test BV", "city": "Utrecht", "street": "Kerkstraat", "house_number": "1", "postal_code": "3511 AB", "description": "html:<p>Over <b>ons</b></p>"}, format="json")
    assert entity.fill("Welkom bij {{organisatie.naam}} in {{ organisatie.plaats }}.") == "Welkom bij Studio Test BV in Utrecht."
    assert entity.fill("{{organisatie.adres}}") == "Kerkstraat 1, 3511 AB Utrecht"
    assert entity.fill("{{organisatie.soort}}") == "Bedrijf" and entity.fill("x {{organisatie.onbekend}} y") == "x  y"
    assert entity.fill("{{organisatie.omschrijving}}") == "Over ons"  # the description without html
    v = admin.get("/api/entity/public/").json()["variables"]
    assert v["naam"] == "Studio Test BV" and v["telefoon"] == ""


@pytest.mark.django_db
def test_creator_and_catalog_know_the_organisation(admin):
    assert sitecreator.catalog()["organisation"]["filled"] is False and "ABOUT THE ORGANISATION" not in sitecreator.rules()
    admin.put("/api/entity/", {"name": "Studio Test BV", "city": "Utrecht", "email": "info@studiotest.nl"}, format="json")
    cat = sitecreator.catalog()["organisation"]
    assert cat["filled"] is True and "Studio Test BV" in cat["text"] and cat["label"] == "Bedrijf"
    rules = sitecreator.rules()
    assert "ABOUT THE ORGANISATION" in rules and "Studio Test BV" in rules and "{{organisatie.naam}}" in rules


@pytest.mark.django_db
def test_other_entities_with_users_and_groups(admin):
    from apps.accounts.models import UserGroup

    User = get_user_model()
    ann = User.objects.create_user("ann", "ann@x.nl", "pw12345678!")
    bob = User.objects.create_user("bob", "bob@x.nl", "pw12345678!")
    team = UserGroup.objects.create(name="Team", slug="team")
    admin.put("/api/entity/", {"name": "Eigen BV"}, format="json")
    r = admin.post("/api/entities/", {"name": "Klant BV", "kind": "vereniging", "city": "Utrecht", "user_ids": [ann.id, bob.id], "group_ids": [team.id]}, format="json")
    assert r.status_code == 201
    d = r.json()
    assert d["kind_label"] == "Vereniging" and d["user_count"] == 2 and d["group_count"] == 1 and [u["email"] for u in d["users"]] == ["ann@x.nl", "bob@x.nl"] and d["groups"][0]["name"] == "Team"
    lst = admin.get("/api/entities/").json()
    assert [x["name"] for x in lst][0] == "Eigen BV" and lst[0]["is_own"] is True and len(lst) == 2  # the entity of the website first
    assert [x["name"] for x in admin.get("/api/entities/?q=utrecht").json()] == ["Klant BV"]
    # change the links; leaving user_ids out keeps them
    admin.put(f"/api/entities/{d['id']}/", {"name": "Klant BV", "user_ids": [ann.id]}, format="json")
    assert admin.get(f"/api/entities/{d['id']}/").json()["user_count"] == 1 and admin.get(f"/api/entities/{d['id']}/").json()["group_count"] == 1
    admin.put(f"/api/entities/{d['id']}/", {"city": "Breda"}, format="json")
    assert admin.get(f"/api/entities/{d['id']}/").json()["user_count"] == 1
    # users and groups show their entities (read only)
    assert admin.get("/api/users/").json()
    row = next(u for u in admin.get("/api/users/").json() if u["email"] == "ann@x.nl")
    assert row["entities"] == [{"id": d["id"], "name": "Klant BV", "color": ""}] and row["role_list"] == []
    assert admin.get("/api/user-groups/").json()[0]["entities"][0]["name"] == "Klant BV"
    # validation, and the own entity cannot be removed
    assert admin.post("/api/entities/", {"name": ""}, format="json").status_code == 400
    assert admin.post("/api/entities/", {"name": "X", "kind": "gek"}, format="json").status_code == 400
    assert admin.post("/api/entities/", {"name": "X", "kind": "vrij"}, format="json").status_code == 400
    assert admin.post("/api/entities/", {"name": "X", "kind": "vrij", "kind_name": "Stichting"}, format="json").json()["kind_label"] == "Stichting"
    own = lst[0]["id"]
    assert admin.delete(f"/api/entities/{own}/").status_code == 400
    assert admin.delete(f"/api/entities/{d['id']}/").status_code == 204 and User.objects.filter(pk=ann.pk).exists()  # the people stay
    assert APIClient().get("/api/entities/").status_code in (401, 403)


@pytest.mark.django_db
def test_delegated_manager_never_sees_superadmins(db):
    User = get_user_model()
    boss = User.objects.create_user("boss2", "boss2@x.nl", "pw12345678!", is_staff=True)
    from apps.core.models import Entity

    e = Entity.objects.create(name="Klant BV")
    e.users.add(boss)
    me = User.objects.create_user("mgr", "mgr@x.nl", "pw12345678!")
    d = entity.serialize(e, True, me)
    assert d["users"] == [] and d["user_count"] == 1
    entity.save_other(e, {"name": "Klant BV", "user_ids": [boss.id]}, me)
    assert e.users.count() == 1  # the link to the superadmin stays


@pytest.mark.django_db
def test_setup_tab_users_and_entity_on_the_dashboard(admin):
    key = "sportclub"
    data = presets._data()
    data["active_preset"] = key
    presets._save_data(data)
    assert APIClient().get("/api/modules/").json()["setup_users"] is True  # default: both on
    o = admin.get(f"/api/system/presets/{key}/edit/").json()
    assert o["setup"] == {"users": True, "entity": True}
    o = admin.put(f"/api/system/presets/{key}/edit/", {"setup": {"users": False, "entity": True}}, format="json").json()
    assert o["setup"] == {"users": False, "entity": True}
    m = APIClient().get("/api/modules/").json()
    assert m["setup_users"] is False and m["setup_entity"] is True
    admin.put(f"/api/system/presets/{key}/edit/", {"setup": {"users": True, "entity": False}, "entity": {"kind": "vrij", "name": "Stichting"}}, format="json")
    m = APIClient().get("/api/modules/").json()
    assert m["setup_users"] is True and m["setup_entity"] is False and admin.get("/api/entity/").json()["title"] == "Stichting"
    admin.put(f"/api/system/presets/{key}/edit/", {"setup": {"users": True, "entity": True}}, format="json")
    assert "setup" not in presets.edits(key)  # the default is not stored


@pytest.mark.django_db
def test_link_entities_from_the_user_and_the_group(admin):
    from apps.accounts.models import UserGroup
    from apps.core.models import Entity

    e1, e2 = Entity.objects.create(name="Klant A"), Entity.objects.create(name="Klant B")
    r = admin.post("/api/users/", {"email": "new@x.nl", "password": "Pw12345678!xx", "entity_ids": [e1.id]}, format="json")
    assert r.status_code == 201 and [x["name"] for x in r.json()["entities"]] == ["Klant A"]
    uid = r.json()["id"]
    r = admin.patch(f"/api/users/{uid}/", {"entity_ids": [e1.id, e2.id]}, format="json")
    assert sorted(x["name"] for x in r.json()["entities"]) == ["Klant A", "Klant B"]
    assert len(admin.patch(f"/api/users/{uid}/", {"function": "x"}, format="json").json()["entities"]) == 2  # not sent: unchanged
    g = admin.post("/api/user-groups/", {"name": "Team Z", "entity_ids": [e2.id]}, format="json")
    assert g.status_code == 201 and g.json()["entities"][0]["name"] == "Klant B"
    admin.patch(f"/api/user-groups/{g.json()['id']}/", {"entity_ids": []}, format="json")
    assert UserGroup.objects.get(pk=g.json()["id"]).entities.count() == 0


@pytest.mark.django_db
def test_basic_data_makes_the_entity_and_the_contact_user(admin):
    from apps.core import system
    from apps.core.models import License

    User = get_user_model()
    data = {"company_name": "Testbedrijf BV", "contact_first_name": "Test", "contact_last_name": "Gebruiker", "contact_email": "test@testbedrijf.nl", "mobile": "+31 612345678", "phone": "+31 301234567",
            "street": "Teststraat", "house_number": "12", "postal_code": "1234 AB", "city": "Utrecht", "country": "Nederland", "kvk": "12345678", "vat_id": "NL123456789B01", "frontend_url": "https://testbedrijf.nl"}
    r = system.save(data)  # no licence yet: the entity is made, the contact person waits for the licence
    assert not User.objects.filter(email="test@testbedrijf.nl").exists()
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "Testbedrijf BV"})
    system.license_changed()
    from apps.accounts.models import UserGroup

    assert entity.ensure_from_licence()["user"] == "created"
    e = admin.get("/api/entity/").json()["data"]
    assert e["name"] == "Testbedrijf BV" and e["city"] == "Utrecht" and e["registration_no"] == "12345678" and e["website"] == "https://testbedrijf.nl" and e["email"] == "test@testbedrijf.nl"
    u = User.objects.get(email="test@testbedrijf.nl")
    assert u.first_name == "Test" and u.last_name == "Gebruiker" and u.has_usable_password() and not u.is_staff  # a password, no superadmin
    assert u.roles.filter(slug="admin").exists() and UserGroup.objects.get(slug="admins").members.filter(pk=u.pk).exists()  # admin rights, in the group Admins
    assert [x["email"] for x in admin.get(f"/api/entities/{entity.own().id}/").json()["users"]] == ["test@testbedrijf.nl"]
    # a second save never overwrites what is there, and makes no second user
    admin.put("/api/entity/", {"name": "Eigen naam"}, format="json")
    system.save({**data, "company_name": "Andere naam", "contact_email": "ander@x.nl"})
    assert admin.get("/api/entity/").json()["data"]["name"] == "Eigen naam" and not User.objects.filter(email="ander@x.nl").exists()


@pytest.mark.django_db
def test_basic_data_links_an_existing_account(admin):
    from apps.core import system
    from apps.core.models import License

    User = get_user_model()
    me = User.objects.create_user("jan", "jan@bedrijf.nl", "pw12345678!")
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "Bedrijf"})
    system.license_changed()
    system.save({"company_name": "Bedrijf", "contact_first_name": "Jan", "contact_last_name": "Jansen", "contact_email": "JAN@bedrijf.nl"})
    assert User.objects.filter(email__iexact="jan@bedrijf.nl").count() == 1 and entity.own().users.filter(pk=me.pk).exists()


@pytest.mark.django_db
def test_reset_can_keep_the_licence_the_entities_and_the_users(admin):
    from apps.core import reset
    from apps.core.models import Entity, License

    User = get_user_model()
    ann = User.objects.create_user("ann", "ann@x.nl", "pw12345678!")
    e = Entity.objects.create(name="Klant BV")
    e.users.add(ann)
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "Klant"})
    reset.perform(keep_identity=True)
    assert User.objects.filter(pk=ann.pk).exists() and Entity.objects.filter(pk=e.pk).exists() and e.users.filter(pk=ann.pk).exists()
    assert License.objects.get(pk=1).number == "123-456"
    reset.perform()  # without the switch everything goes, as before
    assert not User.objects.filter(pk=ann.pk).exists() and not Entity.objects.exists() and License.objects.get(pk=1).number == ""


@pytest.mark.django_db
def test_onboarding_replay_removes_nothing_and_makes_what_is_missing(admin):
    from apps.core import reset, system
    from apps.core.models import Entity, License, SystemSettings

    User = get_user_model()
    ann = User.objects.create_user("ann", "ann@x.nl", "pw12345678!")
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "Klant"})
    system.save({"company_name": "Testbedrijf BV", "contact_first_name": "Test", "contact_last_name": "Gebruiker", "contact_email": "test@testbedrijf.nl"})
    row = SystemSettings.objects.get(pk=1)
    row.data = {**row.data, "welcome_asked": True, "sandbox_asked": True, "manual_asked": True}
    row.save()
    before = (User.objects.count(), Entity.objects.count())
    # wrong word: REPLAY is asked, not RESET
    assert admin.post("/api/system/reset/", {"mode": "replay", "confirm": "RESET", "password": "pw12345678!"}, format="json").status_code == 400
    me = get_user_model().objects.get(username="boss")
    me.set_password("pw12345678!")
    me.save()
    r = admin.post("/api/system/reset/", {"mode": "replay", "confirm": "REPLAY", "password": "pw12345678!"}, format="json")
    assert r.status_code == 200 and r.json()["replay"]["entity"] is False  # the entity was made already: only a check
    assert (User.objects.count(), Entity.objects.count()) == before and User.objects.filter(pk=ann.pk).exists() and License.objects.get(pk=1).number == "123-456"
    d = SystemSettings.objects.get(pk=1).data
    assert not any(d.get(k) for k in ("welcome_asked", "sandbox_asked", "manual_asked")) and bool(d["onboarding_replay"])
    assert admin.get("/api/system/setup/").json()["needed"] is True and admin.get("/api/system/setup/").json()["replay"] is True  # the form opens, with nothing missing
    # a missing entity and contact user are made
    Entity.objects.all().delete()
    User.objects.filter(email="test@testbedrijf.nl").delete()
    out = reset.replay_onboarding()
    assert out["entity"] is True and out["user"] == "created" and entity.filled()
    # saving the set-up form ends it
    cur = admin.get("/api/system/setup/").json()["settings"]
    r = admin.put("/api/system/setup/", {**cur, "frontend_url": "https://testbedrijf.nl", "street": "Teststraat", "house_number": "1", "postal_code": "1234 AB", "city": "Utrecht", "country": "Nederland", "site_name": "Test", "mobile": "+31 612345678"}, format="json")
    assert r.status_code == 200 and r.json()["needed"] is False and reset.replay_pending()  # the form is done, the onboarding goes on (installation, then the design wizard)
    assert admin.post("/api/system/onboarding/done/", {}, format="json").status_code == 200 and not reset.replay_pending()  # the last step: it does not come back


@pytest.mark.django_db
def test_onboarding_replay_makes_a_superadmin_when_there_is_none(monkeypatch):
    from apps.core import reset

    monkeypatch.setenv("ADMIN_EMAIL", "admin@easy2edit.test")
    monkeypatch.setenv("ADMIN_PASSWORD", "Standard-pw-12345!")

    User = get_user_model()
    assert not User.objects.filter(is_staff=True).exists()
    out = reset.replay_onboarding()
    assert out["admin_made"] and User.objects.filter(is_staff=True).exists()


@pytest.mark.django_db
def test_onboarding_replay_shows_licence_terms_and_installation_again(admin):
    from apps.core import presets, reset, terms
    from apps.core.models import TermsSignature

    User = get_user_model()
    me = User.objects.get(username="boss")
    key = "sportclub"
    data = presets._data()
    data["active_preset"] = key
    presets._save_data(data)
    v = terms.current()
    TermsSignature.objects.create(user=me, version=v.version, role="superadmin", name="Boss", email=me.email)
    assert terms.signed(me, v.version) is True
    assert admin.get("/api/system/presets/setup/").json() == {"needed": False}  # normally nothing is asked: an installation is set
    reset.replay_onboarding()
    assert terms.signed(me, v.version) is False  # the terms come again; the earlier signature stays
    assert TermsSignature.objects.filter(user=me).count() == 1
    r = admin.get("/api/system/presets/setup/").json()
    assert r["needed"] is True and r["replay"] is True and r["active"] == key and r["presets"][0]["key"] == key  # the installation in use is shown, chosen
    TermsSignature.objects.create(user=me, version=v.version, role="superadmin", name="Boss", email=me.email)
    assert terms.signed(me, v.version) is True  # signed again during the onboarding
    from apps.core import system

    assert system.public()["onboarding_replay"] is True
    reset.clear_replay()
    assert system.public()["onboarding_replay"] is False and admin.get("/api/system/presets/setup/").json() == {"needed": False}


@pytest.mark.django_db
def test_the_licence_makes_the_entity_and_the_contact_user_linked(admin):
    from apps.core import entity as ent, system
    from apps.core.models import Entity, License

    User = get_user_model()
    # an older licence (made before the entity existed): looking at the entity makes it from the licence
    system.save({"contact_first_name": "Test", "contact_last_name": "Gebruiker", "contact_email": "test@testbedrijf.nl", "mobile": "+31 612345678", "site_name": "Testsite"})
    assert not ent.filled()
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "Testbedrijf BV", "main_url": "https://testbedrijf.nl"})
    system.license_changed()
    d = admin.get("/api/entity/").json()
    assert d["filled"] is True and d["data"]["name"] == "Testbedrijf BV" and d["data"]["website"] == "https://testbedrijf.nl"
    u = User.objects.get(email="test@testbedrijf.nl")
    assert u.first_name == "Test" and ent.own().users.filter(pk=u.pk).exists()  # the user is linked to the company
    assert Entity.objects.count() == 1
    admin.get("/api/entity/")
    assert Entity.objects.count() == 1 and User.objects.filter(email="test@testbedrijf.nl").count() == 1  # nothing is made twice


@pytest.mark.django_db
def test_no_licence_no_entity_from_the_licence(admin):
    from apps.core import entity as ent

    assert ent.ensure_from_licence() == {"entity": False, "user": ""}


@pytest.mark.django_db
def test_contact_person_is_made_a_user_also_when_the_entity_was_there_already(admin):
    from apps.core import entity as ent, system
    from apps.core.models import License, SystemSettings

    User = get_user_model()
    admin.put("/api/entity/", {"name": "Handmatig BV"}, format="json")  # the entity was made by hand, the contact person is no user yet
    system.save({"contact_first_name": "Piet", "contact_last_name": "Pols", "contact_email": "piet@handmatig.nl", "mobile": "+31 612345678"})
    assert not User.objects.filter(email="piet@handmatig.nl").exists()  # (no licence yet: he is made when the licence is there)
    row = SystemSettings.objects.get(pk=1)
    row.data = {k: v for k, v in row.data.items() if k != ent.CONTACT_KEY}
    row.save()
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "Handmatig BV"})
    system.license_changed()
    admin.get("/api/entities/")  # looking at the entities completes it
    u = User.objects.get(email="piet@handmatig.nl")
    assert u.first_name == "Piet" and u.has_usable_password() and ent.own().users.filter(pk=u.pk).exists()
    ent.own().users.remove(u)
    admin.get("/api/entities/")
    assert not ent.own().users.filter(pk=u.pk).exists()  # made once: unlinked by hand stays unlinked


@pytest.mark.django_db
def test_onboarding_replay_shows_the_ai_credit_explanation_again(admin):
    from apps.core import reset
    from apps.integrations.models import AiAccount

    me = get_user_model().objects.get(username="boss")
    acc, _ = AiAccount.objects.get_or_create(user=me, defaults={"welcomed": True})
    AiAccount.objects.filter(pk=acc.pk).update(welcomed=True)
    reset.replay_onboarding()
    acc.refresh_from_db()
    assert acc.welcomed is False  # only the "shown" flag: no credit or history is touched


@pytest.mark.django_db
def test_onboarding_makes_the_group_everyone_with_all_users(admin):
    from apps.accounts.models import UserGroup
    from apps.core import everyone, reset

    User = get_user_model()
    ann = User.objects.create_user("ann", "ann@x.nl", "pw12345678!")
    assert not UserGroup.objects.filter(slug="everyone").exists()
    reset.replay_onboarding()
    g = UserGroup.objects.get(slug="everyone")
    assert g.name == "Everyone" and set(g.members.values_list("pk", flat=True)) == set(User.objects.values_list("pk", flat=True)) and ann in g.members.all()
    bob = User.objects.create_user("bob", "bob@x.nl", "pw12345678!")  # a new user goes in by itself
    assert bob in g.members.all()
    assert everyone.ensure() == {"created": False, "added": 0}  # nothing twice
    assert UserGroup.objects.filter(slug="everyone").count() == 1
    g.delete()  # removed by hand: new users are not put anywhere, the next onboarding makes it again
    User.objects.create_user("cy", "cy@x.nl", "pw12345678!")
    assert everyone.ensure()["created"] is True and UserGroup.objects.get(slug="everyone").members.count() == User.objects.count()


@pytest.mark.django_db
def test_onboarding_status_remembers_where_it_is(admin, monkeypatch):
    from apps.core import onboarding, presets, reset
    from apps.core.models import License, SystemSettings, TermsSignature
    from apps.core import system, terms

    User = get_user_model()
    me = User.objects.get(username="boss")
    plain = APIClient()
    plain.force_authenticate(User.objects.create_user("ann", "ann@x.nl", "pw12345678!"))
    assert plain.get("/api/system/onboarding/").json()["complete"] is True  # only a superadmin has an onboarding
    s = admin.get("/api/system/onboarding/").json()
    assert s["complete"] is False and s["next"] == "welcome" and [x["key"] for x in s["steps"]][:3] == ["welcome", "licence", "terms"]
    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**row.data, "welcome_asked": True}
    row.save()
    assert admin.get("/api/system/onboarding/").json()["next"] == "licence"  # where it was left
    system.save({"site_name": "T", "company_name": "T BV", "frontend_url": "https://t.nl", "street": "S", "house_number": "1", "postal_code": "1234 AB", "city": "U", "country": "NL", "contact_first_name": "A", "contact_last_name": "B", "contact_email": "a@t.nl", "mobile": "+31 612345678"})
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "T BV"})
    system.license_changed()
    assert admin.get("/api/system/onboarding/").json()["next"] == "terms"
    TermsSignature.objects.create(user=me, version=terms.current().version, role="superadmin", name="Boss", email=me.email)
    assert admin.get("/api/system/onboarding/").json()["next"] == "manual"
    row.refresh_from_db()
    row.data = {**row.data, "manual_asked": True}
    row.save()
    assert admin.get("/api/system/onboarding/").json()["next"] == "install"
    d = presets._data()
    d["active_preset"] = "sportclub"
    presets._save_data(d)
    s = admin.get("/api/system/onboarding/").json()
    assert s["complete"] is False and s["next"] == "trees"  # the (optional) step "bomen planten" comes before the design wizard
    assert admin.post("/api/ecologi/onboarding/", {"choice": "no"}, format="json").status_code == 200
    s = admin.get("/api/system/onboarding/").json()
    assert s["complete"] is False and s["next"] == "design"  # a new installation: everything is done except the last step, the design wizard
    reset.replay_onboarding()  # started again: nothing is done until it is done again
    s = admin.get("/api/system/onboarding/").json()
    assert s["complete"] is False and s["next"] == "welcome"
    assert admin.post("/api/system/onboarding/done/", {}, format="json").status_code == 200
    assert admin.get("/api/system/onboarding/").json()["complete"] is True and not reset.replay_pending()


@pytest.mark.django_db
def test_the_licence_makes_the_contact_person_an_admin_with_the_wizard_password(admin, monkeypatch):
    from apps.accounts.models import UserGroup
    from apps.core import entity as ent, system
    from apps.core.models import License

    User = get_user_model()
    sent = []
    monkeypatch.setattr("apps.communication.sending.send_email", lambda to, subject, body, **kw: sent.append((to, body)))
    pw = admin.get("/api/system/setup/password/").json()["password"]
    assert len(pw) >= 12 and admin.get("/api/system/setup/password/").json()["password"] != pw  # refresh gives another one
    system.save({"company_name": "Wizard BV", "contact_first_name": "Wil", "contact_last_name": "Zard", "contact_email": "wil@wizard.nl", "mobile": "+31 612345678"})
    License.objects.update_or_create(pk=1, defaults={"number": "123-456", "client": "Wizard BV"})
    system.license_changed()
    ent.set_pending_password(pw)  # what the wizard sends with the form
    assert ent.ensure_from_licence()["user"] == "created"
    u = User.objects.get(email="wil@wizard.nl")
    assert u.check_password(pw) and u.roles.filter(slug="admin").exists() and UserGroup.objects.get(slug="admins").members.filter(pk=u.pk).exists()
    assert ent.own().users.filter(pk=u.pk).exists()  # linked to the company
    assert sent and sent[0][0] == "wil@wizard.nl" and pw in sent[0][1]  # the password is mailed
    assert UserGroup.objects.get(slug="admins").roles.filter(slug="admin").exists()


@pytest.mark.django_db
def test_terms_are_signed_by_the_consent_in_the_wizard(admin):
    from apps.core import setup_consent, terms

    me = get_user_model().objects.get(username="boss")
    assert terms.signed(me, terms.current().version) is False
    r = admin.post("/api/system/setup/consent/verify/", {"code": "@"}, format="json")
    assert r.status_code == 200 and setup_consent.ok(me) and terms.signed(me, terms.current().version) is True  # the same acceptance is the signature


@pytest.mark.django_db
def test_a_new_entity_gets_the_existing_contact_account_linked(admin):
    from apps.core import entity as ent, system
    from apps.core.models import Entity, SystemSettings

    User = get_user_model()
    u = User.objects.create_user("test", "test@testbedrijf.nl", "pw12345678!")
    system.save({"company_name": "Testbedrijf BV", "contact_first_name": "Test", "contact_last_name": "Gebruiker", "contact_email": "test@testbedrijf.nl"})  # no licence yet
    assert ent.own().users.filter(pk=u.pk).exists()  # the account is there: linked at once, also before the licence
    row = SystemSettings.objects.get(pk=1)
    row.data = {**row.data, ent.CONTACT_KEY: True}  # an old flag (from the entity of an earlier run)
    row.save()
    Entity.objects.all().delete()  # the entity is gone (a reset), the account stays
    system.save({"company_name": "Testbedrijf BV", "contact_email": "test@testbedrijf.nl"})
    assert ent.own().users.filter(pk=u.pk).exists()  # the new entity gets him linked again


@pytest.mark.django_db
def test_an_older_installation_counts_as_complete(admin):
    from apps.core.models import SystemSettings

    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**row.data, "welcome_asked": True}  # it answered the first question long ago
    row.save()
    assert admin.get("/api/system/onboarding/").json()["complete"] is True


@pytest.mark.django_db
def test_a_new_installation_is_marked_started_when_the_colour_question_is_asked(admin):
    from apps.core.models import SystemSettings

    admin.get("/api/system/sandbox-first/")  # the first screen of a new installation asks the colour question
    d = SystemSettings.objects.get(pk=1).data
    assert d.get("onboarding_started") is True and not d.get("welcome_asked")
    admin.post("/api/system/sandbox-first/", {"welcome": True}, format="json")
    s = admin.get("/api/system/onboarding/").json()
    assert s["complete"] is False  # answering the colour question first never makes the onboarding "old"


@pytest.mark.django_db
def test_onboarding_has_no_step_for_installing_the_api_links(admin):
    """The API links that must be on come from the environment / the easy2edit server (always on); nothing is installed with a password in the onboarding any more."""
    s = admin.get("/api/system/onboarding/").json()
    keys = [x["key"] for x in s["steps"]]
    assert "links" not in keys and keys.index("ai") < keys.index("design")


@pytest.mark.django_db
def test_the_company_of_the_licence_is_in_the_group_everyone(admin):
    from apps.accounts.models import UserGroup
    from apps.core import entity as ent, everyone, reset
    from apps.core.models import Entity

    ent.own()  # an entity that was there before the group
    reset.replay_onboarding()  # makes the group Everyone
    g = UserGroup.objects.get(slug="everyone")
    assert Entity.objects.get(is_own=True).groups.filter(pk=g.pk).exists()
    Entity.objects.all().delete()
    assert ent.own().groups.filter(pk=g.pk).exists()  # an entity made after the group goes in by itself
    other = Entity.objects.create(name="Klant")
    assert not other.groups.filter(pk=g.pk).exists()  # only the company of the licence, not every other entity


@pytest.mark.django_db
def test_tags_with_colours_and_scopes(admin):
    from apps.core import tags
    from apps.core.models import Entity

    User = get_user_model()
    ann = User.objects.create_user("ann", "ann@x.nl", "pw12345678!")
    e = Entity.objects.create(name="Klant BV")
    r = admin.post("/api/tags/", {"name": "VIP", "color": "#ff8800"}, format="json")
    assert r.status_code == 201 and r.json()["scope"] == "global" and r.json()["color"] == "#ff8800"
    vip = r.json()["id"]
    assert admin.post("/api/tags/", {"name": "vip"}, format="json").status_code == 400  # one name once
    assert admin.post("/api/tags/", {"name": "X", "color": "rood"}, format="json").status_code == 400
    assert admin.post("/api/tags/", {"name": "Y", "scope": "module"}, format="json").status_code == 400  # a module is needed
    assert admin.post("/api/tags/", {"name": "Y", "scope": "module", "modules": ["bestaat-niet"]}, format="json").status_code == 400
    usr = admin.post("/api/tags/", {"name": "Intern", "color": "#112233", "scope": "module", "modules": ["users"]}, format="json").json()["id"]
    plg = admin.post("/api/tags/", {"name": "Shop", "scope": "plugin", "plugins": ["webshop", "orders"]}, format="json").json()["id"]
    # global: on everything; module users: only users and groups; plugin: only what belongs to those plugins
    assert admin.put("/api/tags/links/", {"kind": "user", "ref": ann.id, "tag_ids": [vip, usr]}, format="json").status_code == 200
    assert admin.put("/api/tags/links/", {"kind": "entity", "ref": e.id, "tag_ids": [vip]}, format="json").status_code == 200
    assert admin.put("/api/tags/links/", {"kind": "entity", "ref": e.id, "tag_ids": [vip, usr]}, format="json").status_code == 400  # Intern is for the module users only
    assert admin.put("/api/tags/links/", {"kind": "plugin", "ref": "webshop", "tag_ids": [plg, vip]}, format="json").status_code == 200
    assert admin.put("/api/tags/links/", {"kind": "plugin:orders:order", "ref": "12", "tag_ids": [plg]}, format="json").status_code == 200
    assert admin.put("/api/tags/links/", {"kind": "plugin", "ref": "agenda", "tag_ids": [plg]}, format="json").status_code == 400  # not one of its plugins
    assert admin.put("/api/tags/links/", {"kind": "module", "ref": "users", "tag_ids": [usr]}, format="json").status_code == 200
    assert admin.put("/api/tags/links/", {"kind": "kapot", "ref": "1", "tag_ids": [vip]}, format="json").status_code == 400
    g = admin.get(f"/api/tags/links/?kind=user&ref={ann.id}").json()
    assert sorted(g["tag_ids"]) == sorted([vip, usr]) and {t["name"] for t in g["available"]} == {"VIP", "Intern"}  # what may be put on a user
    assert {t["name"] for t in admin.get(f"/api/tags/links/?kind=entity&ref={e.id}").json()["available"]} == {"VIP"}
    m = admin.get("/api/tags/map/?kind=user").json()
    assert m["links"][str(ann.id)] and len(m["tags"]) == 3
    # a narrower scope drops the links that no longer fit; deleting a tag leaves the things
    admin.put(f"/api/tags/{vip}/", {"name": "VIP", "scope": "module", "modules": ["entities"]}, format="json")
    assert vip not in admin.get(f"/api/tags/links/?kind=user&ref={ann.id}").json()["tag_ids"] and vip in admin.get(f"/api/tags/links/?kind=entity&ref={e.id}").json()["tag_ids"]
    assert admin.delete(f"/api/tags/{usr}/").status_code == 204 and User.objects.filter(pk=ann.pk).exists()
    assert APIClient().get("/api/tags/").status_code in (401, 403)
    assert [t["count"] for t in admin.get("/api/tags/").json() if t["name"] == "VIP"] == [1]


@pytest.mark.django_db
def test_colour_of_users_and_entities(admin):
    from apps.core.models import Entity

    User = get_user_model()
    ann = User.objects.create_user("ann", "ann@x.nl", "pw12345678!")
    r = admin.patch(f"/api/users/{ann.id}/", {"color": "#22aa66"}, format="json")
    assert r.status_code == 200 and r.json()["color"] == "#22aa66"
    assert admin.patch(f"/api/users/{ann.id}/", {"color": "groen"}, format="json").status_code == 400
    e = admin.post("/api/entities/", {"name": "Klant BV", "color": "#AA0000"}, format="json").json()
    assert e["color"] == "#aa0000" and admin.get("/api/entities/").json()[-1]["color"] == "#aa0000"
    assert admin.put("/api/entities/%d/" % e["id"], {"color": ""}, format="json").json()["color"] == ""
    admin.put("/api/entity/", {"name": "Eigen BV", "color": "#0000ff"}, format="json")
    assert admin.get("/api/entity/").json()["data"]["color"] == "#0000ff"
    assert Entity.objects.filter(is_own=True, color="#0000ff").exists()


@pytest.mark.django_db
def test_every_administrator_may_make_and_use_tags():
    from apps.accounts.models import Role

    User = get_user_model()
    adm = User.objects.create_user("adm", "adm@x.nl", "pw12345678!")
    adm.roles.add(Role.objects.get(slug="admin"))  # an administrator (not a superadmin)
    plain = User.objects.create_user("plain", "plain@x.nl", "pw12345678!")
    plus = User.objects.create_user("plus", "plus@x.nl", "pw12345678!", is_staff=True, is_superadmin_plus=True)
    for who in (adm, plus):
        c = APIClient()
        c.force_authenticate(who)
        r = c.post("/api/tags/", {"name": f"Van {who.username}", "color": "#123456"}, format="json")
        assert r.status_code == 201
        assert c.put("/api/tags/links/", {"kind": "user", "ref": plain.id, "tag_ids": [r.json()["id"]]}, format="json").status_code == 200  # also from the screen of a user
        assert c.get("/api/tags/").status_code == 200
    c = APIClient()
    c.force_authenticate(plain)  # a user who does not administer: no
    assert c.post("/api/tags/", {"name": "Nee"}, format="json").status_code == 403 and c.get("/api/tags/").status_code == 403


def test_variables_are_system_objects_for_the_page_editor(admin):
    from apps.sysobjects import service
    from apps.sysobjects.models import SystemObject

    service.sync()
    slugs = set(SystemObject.objects.filter(kind="variable").values_list("slug", flat=True))
    assert "var-organisatie-naam" in slugs and "var-user-email" in slugs
    assert SystemObject.objects.filter(kind="variable").count() == len(entity.VARIABLES)


@pytest.mark.django_db
def test_creator_knows_user_variables_and_leaves_variable_objects_out(admin):
    admin.put("/api/entity/", {"name": "Studio Test BV"}, format="json")
    assert "{{user.naam}}" in sitecreator.rules()
    assert not [o for o in sitecreator.catalog()["objects"] if o["kind"] == "variable"]  # a variable is text, not a section to place


@pytest.mark.django_db
def test_reset_does_not_ask_for_a_system_update_check(admin):
    from apps.core import reset, sysupdate

    reset.perform()
    assert sysupdate.status(None)["needed"] is False


@pytest.mark.django_db
def test_ai_credit_can_be_bought_in_the_sandbox_without_the_payments_plugin(admin, monkeypatch):
    from apps.integrations import ai_views
    from apps.integrations.models import AiAccount

    monkeypatch.setattr(ai_views, "_sandbox_pays", lambda: True)
    monkeypatch.setattr("apps.integrations.aiusage.pay_link", lambda user=None: None)
    r = admin.post("/api/ai/me/topup/", {"amount": 5}, format="json")
    assert r.status_code == 200 and r.json()["via"] == "sandbox" and "paid=1" in r.json()["url"]
    assert float(AiAccount.objects.get().balance) == 5.0


@pytest.mark.django_db
def test_ai_credit_says_who_pays_the_person_or_a_company(admin, monkeypatch):
    from apps.core.models import Entity
    from apps.integrations import ai_views
    from apps.integrations.models import AiLedger, AiTopup

    monkeypatch.setattr(ai_views, "_sandbox_pays", lambda: True)
    monkeypatch.setattr("apps.integrations.aiusage.pay_link", lambda user=None: None)
    from django.contrib.auth import get_user_model

    u = get_user_model().objects.filter(is_staff=True).first()
    e = Entity.objects.create(name="Shop BV", kind="bedrijf")
    other = Entity.objects.create(name="Andere BV", kind="bedrijf")
    e.users.add(u)
    me = admin.get("/api/ai/me/").json()
    assert me["companies"] == [{"id": e.pk, "name": "Shop BV", "city": ""}] and me["payer"]["mode"] == "private"
    assert admin.post("/api/ai/me/topup/", {"amount": 5, "payer": "company", "entity": other.pk}, format="json").status_code == 400  # not his company
    assert admin.post("/api/ai/me/topup/", {"amount": 5, "payer": "company", "entity": e.pk}, format="json").status_code == 200
    t = AiTopup.objects.get()
    assert t.payer_entity == e.pk and t.payer_name == "Shop BV"
    assert "betaald door Shop BV" in AiLedger.objects.get(kind="topup").note  # the credit is the person's; the note says who paid
    assert admin.post("/api/ai/me/topup/", {"amount": 5, "payer": "private"}, format="json").status_code == 200
    assert AiTopup.objects.order_by("-id").first().payer_entity is None


def test_locations_are_cleaned_and_saved(db):
    from apps.core import entity
    from apps.core.models import Entity

    e = entity.save_other(Entity(), {"name": "Shop BV", "locations": [
        {"name": "Amsterdam", "street": "Damrak", "house_number": "1", "city": "Amsterdam"}, {"name": "", "street": ""}, {"name": "Magazijn", "email": "mag@shop.nl"}]})
    e.refresh_from_db()
    assert [x["name"] for x in e.locations] == ["Amsterdam", "Magazijn"] and e.locations[0]["city"] == "Amsterdam"
    assert entity.serialize(e, True)["data"]["locations"][1]["email"] == "mag@shop.nl"
    with pytest.raises(ValueError):
        entity.save_other(e, {"locations": [{"street": "Zonder naam 1"}]})
    with pytest.raises(ValueError):
        entity.save_other(e, {"locations": [{"name": "X", "email": "geen-mail"}]})
    entity.save_other(e, {"name": "Shop BV"})  # no locations sent: they stay
    e.refresh_from_db()
    assert len(e.locations) == 2


# ── payment details: encrypted in the database ──
IBAN = "NL91 ABNA 0417 1643 00"


def _pay_entity(db):
    from apps.core.models import Entity

    return Entity.objects.create(kind="bedrijf", name="Shop BV")


def test_payment_details_are_encrypted_and_masked(db):
    from apps.core import entity_payments as ep

    e = _pay_entity(db)
    items = ep.save(e, [{"kind": "bank", "label": "Hoofdrekening", "holder": "Shop BV", "iban": "nl91abna0417164300", "bic": "ABNANL2A"},
                        {"kind": "paypal", "label": "PayPal", "email": "pay@shop.nl"}])
    e.refresh_from_db()
    raw = e.payments_enc
    assert raw and "NL91" not in raw and "Shop BV" not in raw and "pay@shop.nl" not in raw  # nothing readable in the database
    assert items[0]["iban"] == IBAN and items[0]["default"] and not items[1]["default"]
    m = ep.masked(ep.unseal(e))
    assert m[0]["iban"] == "NL91 •••• •••• 00" and m[0]["holder"] == "Shop BV" and m[1]["email"] == "p•••@shop.nl"


def test_masked_value_keeps_the_stored_one_and_bad_values_are_refused(db):
    import pytest

    from apps.core import entity_payments as ep

    e = _pay_entity(db)
    first = ep.save(e, [{"kind": "bank", "label": "A", "holder": "X", "iban": IBAN}])[0]
    ep.save(e, [{**ep.masked([first])[0], "label": "A2"}])  # the screen sends the masked text back
    got = ep.unseal(e)[0]
    assert got["iban"] == IBAN and got["label"] == "A2" and got["id"] == first["id"]
    for bad in ({"kind": "bank", "label": "B", "holder": "X", "iban": "NL91ABNA0417164301"}, {"kind": "bank", "label": "B", "holder": "", "iban": IBAN},
                {"kind": "paypal", "label": "P", "email": "x"}, {"kind": "card", "label": "C"}, {"kind": "other", "label": "", "value": "x"}):
        with pytest.raises(ValueError):
            ep.save(e, [bad])
    with pytest.raises(ValueError):
        ep.save(e, [{"kind": "other", "label": str(i), "value": "v"} for i in range(ep.MAX_ITEMS + 1)])


def test_blob_of_another_company_or_other_key_is_not_readable(db, settings):
    import pytest

    from apps.core import entity_payments as ep
    from apps.core.models import Entity

    a, b = _pay_entity(db), Entity.objects.create(kind="bedrijf", name="Other")
    ep.save(a, [{"kind": "other", "label": "Tikkie", "value": "0612345678"}])
    b.payments_enc = a.payments_enc
    with pytest.raises(ep.Locked):
        ep.unseal(b)
    settings.PAYMENT_ENCRYPTION_KEY = "another key"
    with pytest.raises(ep.Locked):
        ep.unseal(a)


def test_payment_api_needs_edit_rights(db):
    from rest_framework.test import APIClient

    client = APIClient()
    from django.contrib.auth import get_user_model

    from apps.core.models import Entity

    e = Entity.objects.create(kind="bedrijf", name="Shop BV")
    plain = get_user_model().objects.create_user(username="p@x.nl", email="p@x.nl", password="pw")
    client.force_authenticate(plain)
    assert client.get(f"/api/entities/{e.pk}/payments/").status_code in (401, 403)
    boss = get_user_model().objects.create_user(username="b@x.nl", email="b@x.nl", password="pw", is_staff=True, is_superuser=True)
    client.force_authenticate(boss)
    r = client.put(f"/api/entities/{e.pk}/payments/", {"items": [{"kind": "bank", "label": "A", "holder": "X", "iban": IBAN}]}, format="json")
    assert r.status_code == 200 and "0417" not in str(r.json())
    assert "0417" in str(client.post(f"/api/entities/{e.pk}/payments/reveal/").json())


# ── payment details of a user and the switch company / private ──
def test_user_payments_switch_and_encryption(db):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.accounts import payment_views
    from apps.core import entity_payments as ep
    from apps.core.models import Entity

    U = get_user_model()
    boss = U.objects.create_user(username="b@x.nl", email="b@x.nl", password="pw", is_staff=True, is_superuser=True)
    u = U.objects.create_user(username="u@x.nl", email="u@x.nl", password="pw")
    c = APIClient()
    c.force_authenticate(boss)
    url = f"/api/users/{u.pk}/payments/"
    r = c.put(url, {"pays_via_company": True}, format="json")
    assert r.status_code == 400  # no company yet
    e = Entity.objects.create(kind="bedrijf", name="Shop BV")
    e.users.add(u)
    r = c.put(url, {"pays_via_company": True, "items": [{"kind": "bank", "label": "Privé", "holder": "U", "iban": IBAN}]}, format="json")
    assert r.status_code == 200 and r.json()["pays_via_company"] and r.json()["billing_entity"] == e.pk  # one company: chosen by itself
    assert "0417" not in str(r.json())
    u.refresh_from_db()
    assert IBAN.replace(" ", "")[:4] not in u.payments_enc and "U" != u.payments_enc
    assert payment_views.billing_party(u) == {"mode": "company", "entity": e}
    assert c.put(url, {"pays_via_company": False}, format="json").json()["pays_via_company"] is False
    u.refresh_from_db()
    assert payment_views.billing_party(u) == {"mode": "private"}
    assert ep.unseal(u)[0]["iban"] == IBAN  # still there
    e.payments_enc = u.payments_enc  # a blob of a person never opens as a company's blob
    with __import__("pytest").raises(ep.Locked):
        ep.unseal(e)
    other = U.objects.create_user(username="m@x.nl", email="m@x.nl", password="pw")
    c.force_authenticate(other)
    assert c.get(url).status_code in (401, 403)


@pytest.mark.django_db
def test_stripe_invoice_for_the_company_that_pays(monkeypatch):
    from apps.core import license_stripe

    seen = {}
    monkeypatch.setattr(license_stripe, "call", lambda m, path, data=None, l=None, key=None: (seen.update(data or {}) or {"url": "u", "id": "s"}))
    monkeypatch.setattr(license_stripe, "config", lambda l=None: {})
    u = type("U", (), {"email": "a@x.nl", "pk": 1})()
    license_stripe.ai_checkout(u, 5, "EUR", "ai_x", key="k", payer="Shop BV", payer_vat="NL123B01")
    inv = seen["invoice_creation"]
    assert inv["enabled"] and inv["invoice_data"]["custom_fields"][0] == {"name": "Op naam van", "value": "Shop BV"} and "NL123B01" in inv["invoice_data"]["footer"]
    seen.clear()
    license_stripe.ai_checkout(u, 5, "EUR", "ai_y", key="k")
    assert "invoice_creation" not in seen  # a person who pays himself: as before
