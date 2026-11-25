# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""easy2edit admin setup: the settings of the admin and the dashboards; the module is always on, also in every standard installation."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core import adminsetup, modules, presets


def _client(staff):
    u = get_user_model().objects.create(username="s" if staff else "p", email="x@example.com", is_staff=staff)
    c = APIClient()
    c.force_authenticate(u)
    return c


def test_the_module_is_core_and_always_on_in_every_installation():
    assert modules.BY_KEY["admin_setup"]["core"] and "admin_setup" in modules.ALWAYS_ON and "admin_setup" in presets.ALWAYS_ON
    assert modules.enabled("admin_setup")


def test_validation_accepts_good_values_and_refuses_bad_ones():
    ok, err = adminsetup.validate({"view": "list", "page_size": "25", "sidebar": "open", "menu_search": False, "hidden_tiles": ["/dashboard/admin/tags"], "blocks": {"ai": False}})
    assert not err and ok["view"] == "list" and ok["blocks"]["ai"] is False and ok["blocks"]["about"] is True
    for bad in ({"view": "x"}, {"page_size": "7"}, {"sidebar": "x"}, {"hidden_tiles": ["https://x.nl"]}, {"hidden_tiles": ["/dashboard/admin/admin-setup"]}, {"blocks": {"zzz": True}}, {"nope": 1}):
        assert adminsetup.validate(bad)[1], bad


@pytest.mark.django_db
def test_an_administrator_saves_and_resets_and_a_person_only_reads():
    admin, person = _client(True), _client(False)
    assert person.get("/api/admin-setup/").json()["settings"]["view"] == "tiles"
    assert person.put("/api/admin-setup/", {"view": "list"}, format="json").status_code == 403
    r = admin.put("/api/admin-setup/", {"view": "list", "blocks": {"about": False}}, format="json")
    assert r.status_code == 200 and r.json()["settings"]["view"] == "list" and r.json()["settings"]["blocks"] == {"ai": True, "presets": True, "backup": True, "about": False}
    assert person.get("/api/admin-setup/").json()["settings"]["view"] == "list"  # everybody gets the website's starting value
    assert admin.put("/api/admin-setup/", {"view": "x"}, format="json").status_code == 400
    assert admin.delete("/api/admin-setup/").json()["settings"]["view"] == "tiles"


@pytest.mark.django_db
def test_not_logged_in_gets_nothing():
    assert APIClient().get("/api/admin-setup/").status_code in (401, 403)


# ── tab Licentie: the company and the person linked to the licence, changes also go to the master ──
@pytest.fixture
def licensed(db, monkeypatch):
    from apps.core import entity, siteowners, system
    from apps.core.models import License

    system.save({"contact_email": "owner@example.com", "company_name": "Acme", "frontend_url": "https://acme.example.com"})
    License.objects.update_or_create(pk=1, defaults={"number": "L-1", "client": "Acme"})
    system.license_changed()
    owner = get_user_model().objects.create(username="owner@example.com", email="owner@example.com", first_name="Olga", last_name="Owner")
    e = entity.own()
    e.name = "Acme"
    e.save()
    sent = []
    monkeypatch.setattr(siteowners, "push", lambda force=False, fresh=False: sent.append(force) or {"ok": True, "skipped": "", "error": ""})
    return owner, e, sent


def test_the_licence_tab_shows_licence_company_and_person(licensed):
    from apps.core import licence_link

    o = licence_link.overview()
    assert o["licence"]["number"] == "L-1" and o["company"]["name"] == "Acme" and o["owner"]["email"] == "owner@example.com"
    assert [p["email"] for p in o["persons"]] == ["owner@example.com"] and o["persons"][0]["owner"]


def test_a_change_is_saved_everywhere_and_sent_to_the_master(licensed):
    from apps.core import licence_link, system
    from apps.core.models import License

    owner, e, sent = licensed
    r = _client(True).put("/api/admin-setup/licence/", {"company": {"name": "Acme BV", "city": "Utrecht", "email": "info@acme.nl"}, "owner": {"first_name": "Ola", "mobile": "+31612345678"}}, format="json")
    assert r.status_code == 200 and r.json()["sync"]["ok"] and sent == [True]
    e.refresh_from_db(); owner.refresh_from_db()
    assert e.name == "Acme BV" and e.city == "Utrecht" and owner.first_name == "Ola" and owner.mobile == "+31612345678"
    assert system.get()["company_name"] == "Acme BV" and system.get()["city"] == "Utrecht" and License.objects.get(pk=1).client == "Acme BV"
    assert licence_link.overview()["company"]["name"] == "Acme BV"


def test_wrong_data_is_refused_and_a_person_may_not_change(licensed):
    admin = _client(True)
    assert admin.put("/api/admin-setup/licence/", {"company": {"name": ""}}, format="json").status_code == 400
    assert admin.put("/api/admin-setup/licence/", {"owner": {"email": "no"}}, format="json").status_code == 400
    assert admin.put("/api/admin-setup/licence/", {"company": {"email": "x"}}, format="json").status_code == 400
    p = _client(False)
    assert p.get("/api/admin-setup/licence/").status_code == 403
    assert p.put("/api/admin-setup/licence/", {"company": {"name": "X"}}, format="json").status_code == 403
    assert admin.put("/api/admin-setup/licence/", {"resend": True}, format="json").json()["sync"]["ok"]


def test_changing_the_company_in_its_own_screen_also_goes_to_the_master(licensed, monkeypatch):
    from apps.core import siteowners

    calls = []
    monkeypatch.setattr(siteowners, "push_async", lambda fresh=False, force=False: calls.append(force))
    from apps.core import entity

    body = {**entity.get(), "name": "Acme Nieuw"}
    r = _client(True).put("/api/entity/", body, format="json")
    assert r.status_code == 200 and calls == [True]


def test_the_look_of_the_admin_has_choices_that_are_checked():
    ok, err = adminsetup.validate({"width": "site", "density": "roomy", "tile_size": "large", "font": "large", "sidebar_width": "wide", "reduce_motion": True, "frame": "login"})
    assert not err and ok == {"width": "site", "density": "roomy", "tile_size": "large", "font": "large", "sidebar_width": "wide", "reduce_motion": True, "frame": "login"}
    for bad in ({"frame": "x"}, {"width": "x"}, {"density": "x"}, {"tile_size": "x"}, {"font": "x"}, {"sidebar_width": "x"}):
        assert adminsetup.validate(bad)[1], bad
    assert adminsetup.DEFAULTS["width"] == "full" and adminsetup.DEFAULTS["density"] == "normal"  # nothing changes until the setup says so


def test_page_back_button_is_off_unless_chosen():
    from apps.pages import layout

    assert "back" not in layout.clean({"rows": []})
    assert "back" not in layout.clean({"rows": [], "back": {"on": False, "pos": "right"}})
    out = layout.clean({"rows": [], "back": {"on": True, "pos": "middle", "place": "float", "size": "xl"}})
    assert out["back"] == {"on": True, "pos": "left", "place": "float", "size": "md"}
    assert layout.clean({"rows": [], "back": {"on": True, "pos": "right", "size": "lg"}})["back"] == {"on": True, "pos": "right", "place": "page", "size": "lg"}


def test_page_header_footer_flags():
    from apps.pages import layout

    out = layout.clean({"rows": []})
    assert "header_off" not in out and "footer_off" not in out
    out = layout.clean({"rows": [], "header_off": True, "footer_off": True})
    assert out["header_off"] is True and out["footer_off"] is True
