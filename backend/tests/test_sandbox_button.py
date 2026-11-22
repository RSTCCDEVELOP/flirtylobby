# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The SANDBOX label in the header is a button for the people who may switch the sandbox: it stays (also when the sandbox is off) until the setting "Sandbox-knop tonen" is switched off."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core import modules
from apps.sandbox import service


@pytest.fixture(autouse=True)
def _modules_on(monkeypatch):
    monkeypatch.setattr(modules, "states", lambda: {})


def test_the_button_is_for_those_who_may_switch_and_stays_when_the_sandbox_is_off(db):
    boss = get_user_model().objects.create(username="boss", email="b@x.nl", is_staff=True, is_superuser=True)
    plain = get_user_model().objects.create(username="p", email="p@x.nl")
    c = APIClient()
    assert c.get("/api/sandbox/status/").json()["button"] is False  # a visitor never sees it
    c.force_authenticate(plain)
    assert c.get("/api/sandbox/status/").json()["can_toggle"] is False
    c.force_authenticate(boss)
    st = c.get("/api/sandbox/status/").json()
    assert st["enabled"] is False and st["button"] is True and st["can_toggle"] is True  # off, and the button stays (LIVE)
    assert c.put("/api/sandbox/settings/", {"enabled": True}, format="json").status_code == 200  # the button switches it on ...
    assert c.get("/api/sandbox/status/").json()["enabled"] is True and service.active()
    assert c.put("/api/sandbox/settings/", {"enabled": False}, format="json").status_code == 200  # ... and off again (live)
    st = c.get("/api/sandbox/status/").json()
    assert st["enabled"] is False and st["button"] is True and not service.active()
    c.put("/api/sandbox/settings/", {"button": False}, format="json")  # switched off in the settings: the button goes
    assert c.get("/api/sandbox/status/").json()["button"] is False
