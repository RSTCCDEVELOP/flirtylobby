# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""How long someone may stay logged in without doing anything: the setting (standard 5 minutes, ask first), the activity of the screen and the check on the server."""
import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from apps.core import system
from apps.security import authentication as auth


@pytest.fixture
def login(db):
    cache.clear()
    u = get_user_model().objects.create(username="u", email="u@x.nl")
    t = Token.objects.create(user=u)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Token {t.key}")
    return u, t, c


def test_standard_is_five_minutes_and_ask_first(db):
    assert system.idle() == {"minutes": 5, "action": "ask", "ask_seconds": 60}


def test_the_setting_is_checked_and_limited(db):
    out, errors = system.clean({"idle_minutes": "99999", "idle_action": "raar"})
    assert out["idle_minutes"] == "1440" and out["idle_action"] == "ask" and not errors  # at most a day; an unknown action is "ask"
    assert system.clean({"idle_minutes": "0", "idle_action": "logout"})[0] == {"idle_minutes": "0", "idle_action": "logout"}  # 0 = never logged out
    system.save({"idle_minutes": "20", "idle_action": "logout"})
    assert system.idle()["minutes"] == 20 and system.idle()["action"] == "logout"


def test_the_screen_gets_the_setting_with_the_profile(login):
    _u, _t, c = login
    system.save({"idle_minutes": "10"})
    assert c.get("/api/auth/me/").json()["idle"]["minutes"] == 10


def test_idle_too_long_is_logged_out_on_the_server_but_the_screen_keeps_it_alive(login, monkeypatch):
    u, t, c = login
    system.save({"idle_minutes": "5", "idle_action": "ask"})
    assert c.get("/api/auth/me/").status_code == 200  # the first request starts the clock
    cache.set(auth.idle_key(t.key), cache.get(auth.idle_key(t.key)) - 5 * 60 - 60)  # 6 minutes ago: inside the question of the screen (60 s) and the grace
    assert c.get("/api/auth/me/").status_code == 200
    assert c.post("/api/auth/activity/").status_code == 200  # "Ingelogd blijven" / the person is active: the clock starts again
    cache.set(auth.idle_key(t.key), cache.get(auth.idle_key(t.key)) - 5 * 60 - auth.IDLE_GRACE - 5)  # too long ago
    r = c.get("/api/auth/me/")
    assert r.status_code == 401 and not Token.objects.filter(pk=t.pk).exists()  # logged out, the login is gone


def test_polling_does_not_keep_a_login_alive_and_never_means_never(login):
    u, t, c = login
    system.save({"idle_minutes": "1"})
    c.get("/api/auth/me/")
    first = cache.get(auth.idle_key(t.key))
    c.get("/api/auth/me/")
    c.get("/api/auth/me/")
    assert cache.get(auth.idle_key(t.key)) == first  # only the activity of the screen moves the moment, not the requests of the pages
    system.save({"idle_minutes": "0"})
    cache.set(auth.idle_key(t.key), first - 10**6)
    assert c.get("/api/auth/me/").status_code == 200  # 0 = never logged out for being idle


def test_a_longer_time_before_the_next_question_is_kept_per_login(login):
    import time

    u, t, c = login
    system.save({"idle_minutes": "5", "idle_action": "ask"})
    ago = lambda m: cache.set(auth.idle_key(t.key), time.time() - m * 60)  # noqa: E731
    ago(20)
    assert auth.is_idle(t) is True
    ago(5.5)  # the question is open (inside the grace): he chooses 30 minutes
    assert c.post("/api/auth/activity/", {"extend": 30}, format="json").status_code == 200
    ago(20)
    assert auth.is_idle(t) is False  # 30 minutes now
    ago(40)
    assert auth.is_idle(t) is True
    ago(5.5)
    c.post("/api/auth/activity/", {"extend": 7}, format="json")  # not a choice: back to the setting of the website
    ago(20)
    assert auth.is_idle(t) is True
