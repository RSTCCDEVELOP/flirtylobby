# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The standard reseller (Standaard en globale instellingen): checked, noted in the licence, and the reseller of a new website on the easy2edit server."""
import pytest

from apps.core import global_settings as g
from apps.core import resellers
from apps.core.models import License, Reseller


def test_standard_values_and_checks():
    d = g.DEFAULTS
    assert d["reseller_company"] == "Studio2 Communications BV" and d["reseller_postal_code"] == "3542 DH"
    vals, err = g.clean({"reseller_email": "geen-adres", "reseller_website": "www.studio2.nl", "reseller_phone": "abc", "reseller_city": "  Den   Haag "})
    assert set(err) == {"reseller_email", "reseller_phone"}
    assert vals["reseller_website"] == "https://www.studio2.nl" and vals["reseller_city"] == "Den Haag"  # capitals kept, spaces tidied


@pytest.mark.django_db
def test_licence_notes_the_standard_reseller_once():
    g.save({"reseller_email": "robert@studio2.nl"})
    assert g.apply_reseller_to_licence() is True
    lic = License.objects.get(pk=1)
    assert lic.reseller_name == "Studio2 Communications BV" and lic.reseller_email == "robert@studio2.nl" and lic.reseller_url == "https://www.studio2.nl"
    lic.reseller_name = "Anders"
    lic.save()
    assert g.apply_reseller_to_licence() is False and License.objects.get(pk=1).reseller_name == "Anders"  # a reseller that is there stays


@pytest.mark.django_db
def test_default_reseller_record_is_made_once_with_its_contact_person():
    g.save({"reseller_email": "robert@studio2.nl"})
    r = resellers.default_reseller()
    assert r and r.name == "Studio2 Communications BV" and r.address["city"] == "Utrecht"
    assert r.contacts[0]["first_name"] == "Ronald" and r.contacts[0]["last_name"] == "Stolk" and r.contacts[0]["email"] == "robert@studio2.nl"
    assert resellers.default_reseller().pk == r.pk and Reseller.objects.count() == 1


@pytest.mark.django_db
def test_the_wizard_uses_the_standard_reseller():
    from apps.core import pricing

    g.save({"reseller_email": "robert@studio2.nl"})
    r = pricing.reseller_of({})
    assert r["company"] == "Studio2 Communications BV" and r["email"] == "robert@studio2.nl" and r["first_name"] == "Ronald"


@pytest.mark.django_db
def test_a_new_website_on_the_server_gets_the_standard_reseller(client):
    import json

    from apps.core import sitemanager
    from apps.core.models import EasySite

    sitemanager.set_server(True)
    r = client.post("/api/easy2edit/sites/register/", json.dumps({"instance_id": "a1b2c3d4e5f60718293a4b5c6d7e8f90", "name": "Nieuw"}), content_type="application/json", REMOTE_ADDR="203.0.113.9")
    assert r.status_code == 201
    site = EasySite.objects.get(instance_id="a1b2c3d4e5f60718293a4b5c6d7e8f90")
    assert site.reseller and site.reseller.name == "Studio2 Communications BV"


def test_phone_numbers_always_have_a_country_code():
    _, err = g.clean({"reseller_phone": "085 201 77 85", "reseller_mobile": "0653327702"})
    assert set(err) == {"reseller_phone", "reseller_mobile"} and "landnummer" in err["reseller_phone"]
    vals, err = g.clean({"reseller_phone": "+31 85 201 77 85", "reseller_mobile": "+31653327702"})
    assert not err and vals["reseller_phone"] == "+31 85 201 77 85"
    assert g.clean({"reseller_mobile": "+31"})[0]["reseller_mobile"] == ""  # only a code = empty
    assert g.DEFAULTS["reseller_phone"].startswith("+")
    assert resellers._phone("0612345678")[1] and not resellers._phone("+31 612345678")[1]  # the contact persons of a reseller too


def test_the_phone_numbers_of_the_basic_data_have_a_country_code_too():
    from apps.core import system

    _, err = system.clean({"phone": "0612345678", "mobile": "+31 6 12345678"})
    assert set(err) == {"phone"}
    assert not system.clean({"phone": "+31 85 201 77 85"})[1]


def test_one_phone_rule_for_every_form():
    from apps.core import phone

    assert phone.check("+31 6 12345678") == ("+31 6 12345678", "")
    assert phone.check("06 12345678")[1] == phone.MESSAGE and phone.check("+31 12")[1] == phone.INVALID
    assert phone.check("+31") == ("", "") and phone.check("") == ("", "")


@pytest.mark.django_db
def test_entity_and_wizard_need_a_country_code(django_user_model):
    from rest_framework.test import APIClient

    from apps.core import entity

    with pytest.raises(ValueError):
        entity.clean({"name": "Bedrijf", "phone": "0612345678"}) if hasattr(entity, "clean") else (_ for _ in ()).throw(ValueError())
    u = django_user_model.objects.create_user("wz", "wz@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    r = c.post("/api/system/wizard/", {"config": True, "customer": {"company": "A", "mobile": "0612345678"}, "answers": {}}, format="json")
    assert r.status_code == 400 and "landnummer" in r.json()["detail"]
