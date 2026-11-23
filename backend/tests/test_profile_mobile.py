# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The mobile number in the profile (next to the phone number)."""
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_mobile_is_saved_checked_and_shown(django_user_model):
    u = django_user_model.objects.create_user("mo", "mo@x.nl", "pw12345678!")
    c = APIClient()
    c.force_authenticate(u)
    r = c.patch("/api/auth/me/", {"mobile": "+31 6 1234 5678"}, format="json")
    assert r.status_code == 200 and r.json()["mobile"] == "+31612345678"
    u.refresh_from_db()
    assert u.mobile == "+31612345678" and u.phone == ""  # the phone number (also the number for SMS codes) is not touched
    assert c.patch("/api/auth/me/", {"mobile": "0612345678"}, format="json").status_code == 400  # with a country code
    assert c.patch("/api/auth/me/", {"mobile": ""}, format="json").json()["mobile"] == ""
    assert c.get("/api/auth/me/").json()["mobile"] == ""


@pytest.mark.django_db
def test_codes_by_sms_go_to_the_mobile_number_and_the_phone_number_is_free(django_user_model, monkeypatch):
    from apps.security import twofa

    sent = []
    monkeypatch.setattr(twofa, "send_sms", lambda to, text, **k: sent.append(to) or True)
    u = django_user_model.objects.create_user("sm", "sm@x.nl", "pw12345678!", phone="+31200000000", mobile="+31611112222")
    u.twofa_method = "sms"
    assert twofa.destination_hint(u).startswith("+31") and twofa.destination_hint(u).endswith("22")
    twofa.deliver(u, "Onderwerp", "mail", "sms tekst")
    assert sent == ["+31611112222"]  # not the phone number
    # the mobile number that is the number for the two-step verification cannot be changed in the profile
    u.otp_active = True
    u.save()
    c = APIClient(); c.force_authenticate(u)
    assert c.patch("/api/auth/me/", {"mobile": "+31699999999"}, format="json").status_code == 400
    assert c.patch("/api/auth/me/", {"phone": "+31201111111"}, format="json").status_code == 200  # the phone number is free


@pytest.mark.django_db
def test_the_phone_number_that_was_the_sms_number_is_copied_to_mobile_by_the_migration(django_user_model):
    import importlib

    from django.apps import apps as real

    mig = importlib.import_module("apps.accounts.migrations.0030_phone_to_mobile")
    a = django_user_model.objects.create_user("a1", "a1@x.nl", "pw12345678!", phone="+31611110000")
    b = django_user_model.objects.create_user("b1", "b1@x.nl", "pw12345678!", phone="+31600000000", mobile="+31699999999")
    mig.copy(real, None)
    a.refresh_from_db(); b.refresh_from_db()
    assert a.mobile == "+31611110000" and b.mobile == "+31699999999"


@pytest.mark.django_db
def test_an_administrator_edits_the_address_and_phone_data_of_a_user(django_user_model):
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    u = django_user_model.objects.create_user("us", "us@x.nl", "pw12345678!")
    c = APIClient(); c.force_authenticate(boss)
    r = c.patch(f"/api/users/{u.pk}/", {"phone": "+31 20 123 4567", "mobile": "+31 6 1234 5678", "address": "Dorpsstraat 1", "postal_code": "1234 ab", "city": "Utrecht", "country": "nl"}, format="json")
    assert r.status_code == 200, r.content
    j = r.json()
    assert j["phone"] == "+31201234567" and j["mobile"] == "+31612345678" and j["address"] == "Dorpsstraat 1" and j["postal_code"] == "1234 AB" and j["country"] == "NL"
    assert c.patch(f"/api/users/{u.pk}/", {"mobile": "0612"}, format="json").status_code == 400
    assert c.patch(f"/api/users/{u.pk}/", {"country": "XX"}, format="json").status_code == 400
