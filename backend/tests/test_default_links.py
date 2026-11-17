# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""API links that go with every installation (marked by a superadmin): written to the file, made and switched on at an installation, left alone at a normal start."""
import json

import pytest

from apps.integrations import default_links
from apps.integrations.models import Integration


def make(slug="unsplash", provider="unsplash", key="K", enabled=True, flag=True):
    o = Integration(name=slug.capitalize(), slug=slug, provider=provider, enabled=enabled, in_installation=flag)
    o.config = {"api_key": key}
    o.save()
    return o


@pytest.fixture
def links(tmp_path, monkeypatch):
    f = tmp_path / "default_links.json"
    monkeypatch.setattr(default_links, "PATH", f)
    return f


@pytest.mark.django_db
def test_capture_writes_only_the_marked_links(links):
    make()
    make("stripe", "stripe", "SECRET", flag=False)
    assert default_links.capture() == ["unsplash"]
    rows = json.loads(links.read_text())["links"]
    assert [r["slug"] for r in rows] == ["unsplash"] and rows[0]["config"] == {"api_key": "K"}


@pytest.mark.django_db
def test_installation_makes_the_link_and_switches_it_on(links):
    make()
    default_links.capture()
    Integration.objects.all().delete()
    res = default_links.apply(force=True)
    o = Integration.objects.get(slug="unsplash")
    assert res[0]["ok"] and o.enabled and o.in_installation and o.config["api_key"] == "K"


@pytest.mark.django_db
def test_force_keeps_an_own_key_but_a_normal_start_changes_nothing(links):
    make()
    default_links.capture()
    o = Integration.objects.get(slug="unsplash")
    o.config, o.enabled = {"api_key": "OWN"}, False
    o.save()
    default_links.apply()  # a normal start: the site keeps what it has (also when switched off)
    o.refresh_from_db()
    assert not o.enabled and o.config["api_key"] == "OWN"
    default_links.apply(force=True)  # installation / reset / button: switched on, the own key stays
    o.refresh_from_db()
    assert o.enabled and o.config["api_key"] == "OWN"
    Integration.objects.all().delete()
    default_links.apply()  # a normal start makes a link that is missing
    assert Integration.objects.filter(slug="unsplash", enabled=True).exists()


@pytest.mark.django_db
def test_only_a_superadmin_can_mark_a_link(client):
    from django.contrib.auth import get_user_model

    from apps.integrations.serializers import IntegrationSerializer

    U = get_user_model()
    admin = U.objects.create(username="adm", email="adm@example.com", is_staff=False)

    class Req:
        user = admin

    s = IntegrationSerializer(data={"name": "X", "slug": "x", "provider": "unsplash", "in_installation": True, "config": {"api_key": "a"}}, context={"request": Req()})
    assert s.is_valid(), s.errors
    assert s.validated_data["in_installation"] is False
    Req.user = U.objects.create(username="sup", email="sup@example.com", is_staff=True, is_superuser=True)
    s = IntegrationSerializer(data={"name": "X", "slug": "x", "provider": "unsplash", "in_installation": True, "config": {"api_key": "a"}}, context={"request": Req()})
    assert s.is_valid() and s.validated_data["in_installation"] is True
