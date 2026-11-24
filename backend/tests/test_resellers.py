# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core import resellers, sitemanager
from apps.core.models import EasySite, Reseller


@pytest.fixture
def plus(db):
    u = get_user_model().objects.create_user("plus", "plus@x.nl", "pw12345678!", is_staff=True, is_superadmin_plus=True)
    c = APIClient()
    c.force_authenticate(u)
    sitemanager.set_server(True)  # this installation is the easy2edit server
    return c


FORM = {"name": "Studio Test", "email": "info@studiotest.nl", "phone": "+31 301234567", "website": "www.studiotest.nl", "info": "html:<p>Hallo <script>x()</script><b>wereld</b></p>", "rst_share": "30",
        "address": {"city": "Utrecht", "country": "Nederland"}, "contacts": [{"role": "sales", "first_name": "Sam", "last_name": "Sales", "email": "sales@studiotest.nl"}, {"role": "sales", "first_name": "Els", "last_name": "Smit", "email": "els@studiotest.nl"}, {"role": "financial", "first_name": "Fien", "last_name": "Fin", "email": "fin@studiotest.nl", "same_address": False, "address": {"city": "Breda"}}, {"role": "support", "first_name": "Sup", "last_name": "Port", "email": "help@studiotest.nl"}]}


@pytest.mark.django_db
def test_reseller_crud_and_validation(plus):
    r = plus.post("/api/system/resellers/", FORM, format="json")
    assert r.status_code == 201
    d = r.json()
    assert len(d["contacts"]) == 4 and d["contacts"][1]["name"] == "Els Smit"  # more persons of one kind
    assert d["contacts"][0]["full_address"]["city"] == "Utrecht" and d["contacts"][2]["full_address"]["city"] == "Breda"  # the main address unless an own one
    old = plus.post("/api/system/resellers/", {"name": "Oud", "contacts": {"sales": {"name": "Piet Pols", "email": "p@oud.nl"}, "support": {}}}, format="json").json()
    assert [p["role"] for p in old["contacts"]] == ["sales"] and old["contacts"][0]["name"] == "Piet Pols" and old["contacts"][0]["last_name"] == "Pols"  # the older form still works
    assert d["email"] == "info@studiotest.nl" and d["phone"] == "+31 301234567"
    assert plus.post("/api/system/resellers/", {"name": "X", "email": "nope"}, format="json").status_code == 400
    assert d["website"] == "https://www.studiotest.nl" and "<script" not in d["info"] and d["share"] == "30.00"  # cleaned, the own share
    assert plus.post("/api/system/resellers/", {"name": ""}, format="json").status_code == 400
    bad = plus.post("/api/system/resellers/", {"name": "X", "contacts": [{"role": "sales", "email": "nope"}], "rst_share": "150"}, format="json")
    assert bad.status_code == 400 and "contact_0" in bad.json()["errors"] and "rst_share" in bad.json()["errors"]
    put = plus.put(f"/api/system/resellers/{d['id']}/", {"rst_share": ""}, format="json").json()
    assert put["rst_share"] is None and put["share"] == put["default_share"]  # empty = the default of the price list
    assert plus.get("/api/system/resellers/").json()["resellers"][-1]["name"] == "Studio Test"
    assert plus.delete(f"/api/system/resellers/{d['id']}/").status_code == 204


@pytest.mark.django_db
def test_only_superplus(db):
    u = get_user_model().objects.create_user("adm", "a@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    assert c.get("/api/system/resellers/").status_code == 403


@pytest.mark.django_db
def test_login_with_mail(plus, monkeypatch):
    sent = []
    from apps.communication import sending

    monkeypatch.setattr(sending, "send_email", lambda to, subject, body, **k: sent.append((to, body)))
    rid = plus.post("/api/system/resellers/", FORM, format="json").json()["id"]
    r = plus.post(f"/api/system/resellers/{rid}/logins/", {"email": "Piet@Studiotest.nl", "name": "Piet Pols", "send": True}, format="json")
    assert r.status_code == 201 and len(r.json()["password"]) == 20 and r.json()["sent"]
    assert sent and sent[0][0] == "piet@studiotest.nl" and r.json()["password"] in sent[0][1]  # the mail has the password
    assert plus.post(f"/api/system/resellers/{rid}/logins/", {"email": "piet@studiotest.nl"}, format="json").status_code == 400  # twice
    lid = r.json()["login"]["id"]
    assert plus.patch(f"/api/system/resellers/{rid}/logins/{lid}/", {"new_password": "Nieuw-wachtwoord-1", "send": False}, format="json").json()["password"] == "Nieuw-wachtwoord-1"
    assert len(sent) == 1  # no second mail
    assert plus.post(f"/api/system/resellers/{rid}/logins/", {"email": "x@studiotest.nl", "access": "king"}, format="json").status_code == 400
    assert plus.patch(f"/api/system/resellers/{rid}/logins/{lid}/", {"access": "superadmin"}, format="json").json()["login"]["access"] == "superadmin"
    assert plus.delete(f"/api/system/resellers/{rid}/logins/{lid}/").status_code == 204


@pytest.mark.django_db
def test_public_list_search(plus):
    plus.post("/api/system/resellers/", FORM, format="json")
    plus.post("/api/system/resellers/", {"name": "Verborgen", "active": False}, format="json")
    c = APIClient()
    if not sitemanager.server_enabled():
        sitemanager.set_server(True)
    names = [x["name"] for x in c.get("/api/easy2edit/resellers/").json()["resellers"]]
    assert names == ["Studio Test"]  # inactive ones are not shown
    assert c.get("/api/easy2edit/resellers/").json()["resellers"][0]["phone"] == "+31 301234567"  # the general phone and e-mail are public
    assert c.get("/api/easy2edit/resellers/?q=utrecht").json()["resellers"][0]["sales"]["email"] == "sales@studiotest.nl"
    assert c.get("/api/easy2edit/resellers/?q=zzz").json()["resellers"] == []
    assert "fin@studiotest.nl" not in str(c.get("/api/easy2edit/resellers/").json())  # financial contact is not public


@pytest.mark.django_db
def test_accounts_for_website_and_apply(plus):
    from apps.accounts.models import Role

    Role.objects.get_or_create(slug="admin", defaults={"name": "Admin"})
    sitemanager.set_server(True)
    rid = plus.post("/api/system/resellers/", FORM, format="json").json()["id"]
    plus.post(f"/api/system/resellers/{rid}/logins/", {"email": "piet@studiotest.nl", "name": "Piet Pols", "password": "Wachtwoord-123"}, format="json")
    site, key, _ = sitemanager.register({"instance_id": "a" * 24, "name": "Klant", "url": "https://klant.nl"}, "")
    site.status = "active"
    site.save()
    plus.put(f"/api/system/resellers/{rid}/sites/", {"site_ids": [site.pk]}, format="json")
    c = APIClient()
    assert c.get("/api/easy2edit/reseller/accounts/").status_code == 403  # without key
    data = c.get("/api/easy2edit/reseller/accounts/", HTTP_X_EASY2EDIT_KEY=key).json()
    assert data["reseller"]["name"] == "Studio Test" and data["accounts"][0]["email"] == "piet@studiotest.nl"
    assert data["accounts"][0]["password_hash"].startswith("pbkdf2_")
    resellers.apply_accounts(data)  # this website makes the user (on the server itself it was made at once: the login may log in on the easy2edit site)
    u = get_user_model().objects.get(username="piet@studiotest.nl")
    assert u.check_password("Wachtwoord-123") and u.function == "Reseller" and u.roles.filter(slug="admin").exists()
    data["accounts"][0]["access"] = "superadmin"  # the rights change: a superadmin has no Admin role but is staff
    resellers.apply_accounts(data)
    u.refresh_from_db()
    assert u.is_staff and not u.roles.filter(slug="admin").exists()
    data["accounts"][0]["access"] = "user"
    resellers.apply_accounts(data)
    u.refresh_from_db()
    assert not u.is_staff and not u.roles.exists()  # a user: no extra rights
    resellers.apply_accounts({"accounts": [], "reseller": None})  # no logins any more: the user goes
    assert not get_user_model().objects.filter(username="piet@studiotest.nl").exists()
    assert EasySite.objects.get(pk=site.pk).reseller_id == rid


@pytest.mark.django_db
def test_not_on_other_installations(plus):
    sitemanager.set_server(False)
    assert plus.get("/api/system/resellers/").status_code == 403  # not the easy2edit server: no reseller management


@pytest.mark.django_db
def test_login_details_otp_sites_and_host(plus):
    from apps.accounts.models import Role

    Role.objects.get_or_create(slug="admin", defaults={"name": "Admin"})
    rid = plus.post("/api/system/resellers/", FORM, format="json").json()["id"]
    s1, k1, _ = sitemanager.register({"instance_id": "b" * 24, "name": "Een", "url": "https://een.nl"}, "")
    s2, k2, _ = sitemanager.register({"instance_id": "c" * 24, "name": "Twee", "url": "https://twee.nl"}, "")
    for s in (s1, s2):
        s.status = "active"
        s.save()
    plus.put(f"/api/system/resellers/{rid}/sites/", {"site_ids": [s1.pk, s2.pk]}, format="json")
    r = plus.post(f"/api/system/resellers/{rid}/logins/", {"email": "a@studiotest.nl", "name": "Anna Smit", "function": "Sales", "mobile": "+31612345678", "password": "Wachtwoord-123"}, format="json").json()["login"]
    assert r["otp"] == "email" and r["all_sites"] and r["host"] and r["access"] == "admin"  # by default: the code check, every website of the reseller, also this site
    assert plus.post(f"/api/system/resellers/{rid}/logins/", {"email": "b@studiotest.nl", "otp": "sms"}, format="json").status_code == 400  # SMS needs a mobile number
    c = APIClient()
    for k in (k1, k2):
        assert [a["email"] for a in c.get("/api/easy2edit/reseller/accounts/", HTTP_X_EASY2EDIT_KEY=k).json()["accounts"]] == ["a@studiotest.nl"]
    plus.patch(f"/api/system/resellers/{rid}/logins/{r['id']}/", {"all_sites": False, "site_ids": [s1.pk]}, format="json")
    assert len(c.get("/api/easy2edit/reseller/accounts/", HTTP_X_EASY2EDIT_KEY=k1).json()["accounts"]) == 1
    assert c.get("/api/easy2edit/reseller/accounts/", HTTP_X_EASY2EDIT_KEY=k2).json()["accounts"] == []  # only the chosen website
    data = c.get("/api/easy2edit/reseller/accounts/", HTTP_X_EASY2EDIT_KEY=k1).json()
    resellers.apply_accounts(data)
    u = get_user_model().objects.get(username="a@studiotest.nl")  # (made here on the easy2edit server by sync_host first: now with the rights of the website)
    assert u.otp_active and u.twofa_method == "email" and u.mobile == "+31612345678" and u.role == "Sales"
    plus.patch(f"/api/system/resellers/{rid}/logins/{r['id']}/", {"host": False}, format="json")
    assert not get_user_model().objects.filter(username="a@studiotest.nl").exists()  # not allowed on this site: gone here
    plus.patch(f"/api/system/resellers/{rid}/logins/{r['id']}/", {"host": True}, format="json")
    h = get_user_model().objects.get(username="a@studiotest.nl")
    assert not h.is_staff and not h.roles.exists()  # on the easy2edit site itself: no extra rights


@pytest.mark.django_db
def test_persons_need_first_and_last_name_and_a_valid_phone(plus):
    def post(contacts, **kw):
        return plus.post("/api/system/resellers/", {"name": "P", "contacts": contacts, **kw}, format="json")

    r = post([{"role": "sales", "first_name": "Sam", "email": "s@x.nl"}])
    assert r.status_code == 400 and "contact_name_0" in r.json()["errors"]  # no last name
    assert post([{"role": "sales", "first_name": "Sam", "last_name": "Sales", "mobile": "+31 12"}]).status_code == 400  # not a phone number
    ok = post([{"role": "sales", "first_name": "Sam", "last_name": "Sales", "phone": "+31", "mobile": "+31 612345678"}], phone="+31")
    assert ok.status_code == 201 and ok.json()["contacts"][0]["name"] == "Sam Sales" and ok.json()["contacts"][0]["phone"] == "" and ok.json()["phone"] == ""  # a country code alone is empty
    assert post([{"role": "other"}]).status_code == 201  # an empty person is kept empty
    lg = plus.post(f"/api/system/resellers/{ok.json()['id']}/logins/", {"email": "a@x.nl", "name": "Anna"}, format="json")
    assert lg.status_code == 400  # a login too: first and last name


@pytest.mark.django_db
def test_switch_also_make_a_login(plus, monkeypatch):
    from apps.core import resellers

    sent = []
    monkeypatch.setattr(resellers, "mail_password", lambda x, pw, url="": sent.append((x.email, pw)))
    p = {"role": "sales", "first_name": "Sam", "last_name": "Sales", "function": "CTO", "email": "sam@studiotest.nl", "mobile": "+31 612345678", "make_login": True}
    bad = plus.post("/api/system/resellers/", {"name": "L", "contacts": [{**p, "email": ""}]}, format="json")
    assert bad.status_code == 400 and "contact_0" in bad.json()["errors"]  # a login needs an e-mail address
    r = plus.post("/api/system/resellers/", {"name": "L", "contacts": [p]}, format="json")
    d = r.json()
    assert r.status_code == 201 and d["new_logins"][0]["email"] == "sam@studiotest.nl" and sent and sent[0][0] == "sam@studiotest.nl"
    assert d["logins"][0]["name"] == "Sam Sales" and d["logins"][0]["access"] == "admin" and d["logins"][0]["all_sites"]
    assert d["contacts"][0]["has_login"] and not d["contacts"][0]["make_login"]  # the switch goes off, the person has a login
    again = plus.put(f"/api/system/resellers/{d['id']}/", {"contacts": [{**p}]}, format="json").json()
    assert len(again["logins"]) == 1 and "new_logins" not in again  # never twice


@pytest.mark.django_db
def test_media_replace_block_takes_a_video_but_a_slot_only_a_picture(plus):
    from apps.core.models import ContentBlock
    from apps.medialib.models import MediaItem

    vid = MediaItem.objects.create(key="v/film.mp4", name="film.mp4", kind="video")
    img = MediaItem.objects.create(key="v/foto.jpg", name="foto.jpg", kind="image")
    ok = plus.post("/api/media/replace/", {"target": "block:layout.home.abc", "media_id": vid.id}, format="json")
    assert ok.status_code == 200 and ContentBlock.objects.get(key="layout.home.abc", lang="*").text == f"media:{vid.id}"
    assert plus.post("/api/media/replace/", {"target": "asset:logo", "media_id": vid.id}, format="json").status_code == 400  # a logo is never a video
    assert plus.post("/api/media/replace/", {"target": "block:layout.home.abc", "media_id": img.id}, format="json").status_code == 200
    assert plus.post("/api/media/replace/", {"target": "block:layout.home.abc", "media_id": None}, format="json").status_code == 200
    assert not ContentBlock.objects.filter(key="layout.home.abc").exists()  # cleared


def test_position_of_a_part_keeps_valign():
    from apps.pages import layout

    st = layout._item_style({"align": "center", "valign": "bottom"})
    assert st.get("align") == "center" and st.get("valign") == "bottom"
    assert "valign" not in layout._item_style({"valign": "sideways"})  # only top, middle or bottom


@pytest.mark.django_db
def test_layout_keeps_size_and_position_of_text_heading_and_widget():
    from apps.pages import layout

    cell = {"id": "cell0001", "halign": "left", "valign": "top", "items": [
        {"id": "item0001", "type": "text", "ref": "", "style": {"w": "50%", "align": "center", "talign": "justify"}},
        {"id": "item0002", "type": "heading", "ref": "", "style": {"w": "320px", "valign": "bottom"}},
        {"id": "item0003", "type": "widget", "widget": "quote", "data": {"text": "Hoi"}, "style": {"w": "50%", "align": "right"}}]}
    out = layout.clean({"rows": [{"id": "row00001", "cols": 1, "cells": [cell]}]})
    items = out["rows"][0]["cells"][0]["items"]
    assert items[0]["style"] == {"w": "50%", "align": "center", "talign": "justify"}  # the text inside the box has its own alignment
    assert items[1]["style"] == {"w": "320px", "valign": "bottom"}
    assert items[2]["style"] == {"w": "50%", "align": "right"}  # a ready-made part (a quote) keeps its size and position too


@pytest.mark.django_db
def test_creator_rules_tell_the_ai_about_the_editor_positions():
    from apps.core import sitecreator

    text = sitecreator.rules({})
    for word in ("EDITOR POSITIONS", "max-width", "justify", "align-self", "placeholder"):
        assert word in text


def test_quote_keeps_marks_and_colours():
    from apps.pages import layout

    cell = {"id": "cell0001", "halign": "left", "valign": "top", "items": [
        {"id": "item0001", "type": "widget", "widget": "quote", "data": {"text": "Hoi", "author": "Jan", "marks": False}, "style": {"color": "#112233", "qcolor": "#aa0000"}},
        {"id": "item0002", "type": "widget", "widget": "quote", "data": {"text": "Hallo"}}]}
    items = layout.clean({"rows": [{"id": "row00001", "cols": 1, "cells": [cell]}]})["rows"][0]["cells"][0]["items"]
    assert items[0]["data"]["marks"] is False and items[0]["style"]["qcolor"] == "#aa0000" and items[0]["style"]["color"] == "#112233"
    assert items[1]["data"]["marks"] is True  # the two big quotation marks are on by default
