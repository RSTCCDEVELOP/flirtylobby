# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Superadmin+: the standard accounts, the modules that only a superadmin+ sees and manages, and the protection of a superadmin+."""
import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

from apps.accounts import access, superplus
from apps.core import modules
from apps.core.models import ModuleState

U = get_user_model()


def mk(email, **kw):
    return U.objects.create(username=email, email=email, **kw)


def auth(u):
    return {"HTTP_AUTHORIZATION": f"Token {Token.objects.get_or_create(user=u)[0].key}"}


@pytest.mark.django_db
def test_standard_superadmin_plus_accounts():
    a, b = mk("ronald@rstcc.net"), mk("Admin@Easy2edit.com")
    other = mk("x@example.com", is_staff=True, is_superuser=True)
    assert set(superplus.ensure()) == {a.email, b.email}
    for u in (a, b):
        u.refresh_from_db()
        assert u.is_staff and u.is_superuser and u.is_superplus
    other.refresh_from_db()
    assert not other.is_superplus and superplus.ensure() == []  # nobody else becomes a superadmin+; a second run changes nothing


@pytest.mark.django_db
def test_owner_only_module_is_for_superadmin_plus_only():
    plain = mk("p@example.com", is_staff=True, is_superuser=True)
    plus = mk("q@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    assert access.level(plain, "seo") == 3
    ModuleState.objects.update_or_create(key="seo", defaults={"owner_only": True})
    modules.invalidate()
    plain, plus = U.objects.get(pk=plain.pk), U.objects.get(pk=plus.pk)  # (levels are cached per request on the user object)
    assert access.level(plain, "seo") == 0 and access.level(plus, "seo") == 3
    assert "seo" not in access.levels(plain) and "pages" in access.levels(plain)  # only the marked module is gone


@pytest.mark.django_db
def test_marking_a_module_needs_a_superadmin_plus(client):
    plain = mk("p@example.com", is_staff=True, is_superuser=True)
    plus = mk("q@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    body = json.dumps({"owner_only": True})
    assert client.patch("/api/modules/help/", body, content_type="application/json", **auth(plain)).status_code == 403
    r = client.patch("/api/modules/help/", body, content_type="application/json", **auth(plus))
    assert r.status_code == 200 and next(m for m in r.json() if m["key"] == "help")["owner_only"] is True
    off = json.dumps({"enabled": False})
    assert client.patch("/api/modules/help/", off, content_type="application/json", **auth(plain)).status_code == 403  # a normal superadmin cannot switch it either
    assert ModuleState.objects.get(key="help").enabled is True  # (marking did not switch the module on or off)


@pytest.mark.django_db
def test_a_superadmin_plus_is_protected(client):
    plain = mk("p@example.com", is_staff=True, is_superuser=True)
    plus = mk("q@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    target = mk("t@example.com")
    ct = "application/json"
    assert client.patch(f"/api/users/{plus.pk}/", json.dumps({"first_name": "x"}), content_type=ct, **auth(plain)).status_code == 400  # not changed by a normal superadmin
    assert client.patch(f"/api/users/{target.pk}/", json.dumps({"is_superadmin_plus": True}), content_type=ct, **auth(plain)).status_code == 400  # not made by one either
    assert client.post(f"/api/users/{plus.pk}/block/", **auth(plain)).status_code == 403
    assert client.delete(f"/api/users/{plus.pk}/", **auth(plain)).status_code == 403
    r = client.patch(f"/api/users/{target.pk}/", json.dumps({"is_superadmin_plus": True}), content_type=ct, **auth(plus))
    assert r.status_code == 200
    target.refresh_from_db()
    assert target.is_superplus and target.is_staff  # a superadmin+ is a superadmin too


@pytest.mark.django_db
def test_price_list_is_for_superadmin_plus_only(client):
    plain = mk("p@example.com", is_staff=True, is_superuser=True)
    plus = mk("q@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    for path in ("/api/system/pricing/", "/api/system/pricing/ai/?last=1"):
        assert client.get(path, **auth(plain)).status_code == 403
        assert client.get(path, **auth(plus)).status_code == 200
    assert client.post("/api/system/pricing/", json.dumps({"base_price": 1}), content_type="application/json", **auth(plain)).status_code == 403


@pytest.mark.django_db
def test_the_licence_of_the_server_side_is_for_superadmin_plus_only(client):
    plain = mk("p@example.com", is_staff=True, is_superuser=True)
    plus = mk("q@example.com", is_staff=True, is_superuser=True, is_superadmin_plus=True)
    for path in ("/api/system/license/", "/api/system/license/prices/", "/api/system/license/stripe/"):
        assert client.get(path, **auth(plain)).status_code == 403
        assert client.get(path, **auth(plus)).status_code == 200
    assert client.post("/api/system/license/invoice-paid/", "{}", content_type="application/json", **auth(plain)).status_code == 403
    assert client.get("/api/system/license/usage/", **auth(plain)).status_code != 403  # what a customer's administrator pays and sees stays open
