# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The cache choice (standard database), the system cache (settings + public answers, cleared by a change) and the energy advice for it."""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.core import syscache, system
from config import cacheconf


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def test_standard_cache_is_the_database_and_is_checked():
    assert cacheconf.configured("/nonexistent", {})["backend"] == "database"
    assert cacheconf.valid({"backend": "redis", "redis_url": "nonsense"})[1]  # a wrong address is refused; none = the local Redis
    assert cacheconf.valid({"backend": "redis", "redis_url": "redis://h:6379/1"})[1] == ""
    assert cacheconf.valid({"backend": "x"})[1]
    assert cacheconf.configured("/nonexistent", {"CACHE_BACKEND": "memory"})["source"] == "env"


@pytest.mark.django_db
def test_settings_are_kept_and_cleared_by_a_save():
    assert system.get()["system_cache"] is True and system.get()["system_cache_seconds"] == "300"
    assert cache.get(system.SETTINGS_CACHE_KEY) is not None
    system.save({"site_name": "Eerste"})
    assert system.get()["site_name"] == "Eerste"  # not the old copy
    system.save({"site_name": "Tweede"})
    assert system.get()["site_name"] == "Tweede"


@pytest.mark.django_db
def test_switched_off_nothing_is_kept():
    system.save({"system_cache": False})
    system.get()
    assert cache.get(system.SETTINGS_CACHE_KEY) is None


@pytest.mark.django_db
def test_public_answer_is_kept_and_a_change_by_a_person_clears_it(django_user_model):
    c = APIClient()
    assert c.get("/api/modules/")["X-System-Cache"] == "miss"
    assert c.get("/api/modules/")["X-System-Cache"] == "hit"
    u = django_user_model.objects.create_user("ca", "a@x.nl", "pw12345678!", is_staff=True)
    admin = APIClient()
    admin.force_authenticate(u)
    assert admin.post("/api/system/cache/", {}, format="json").status_code == 200  # a change: new generation
    assert c.get("/api/modules/")["X-System-Cache"] == "miss"


@pytest.mark.django_db
def test_admin_can_read_and_set_the_cache(django_user_model):
    u = django_user_model.objects.create_user("cs", "s@x.nl", "pw12345678!", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    r = c.get("/api/system/cache/").json()
    assert r["backend"] in ("database", "memory") and r["works"] and r["system_cache"] is True
    assert c.put("/api/system/cache/", {"backend": "redis", "redis_url": "nonsense"}, format="json").status_code == 400  # (no address at all: the local Redis)
    assert c.put("/api/system/cache/", {"system_cache_seconds": "120"}, format="json").json()["system_cache_seconds"] == "120"


@pytest.mark.django_db
def test_energy_advice_can_switch_the_system_cache_on_and_back():
    from apps.energy import advice

    system.save({"system_cache": False})
    item = next(i for i in advice.analyse()["items"] if i["key"] == "system_cache")
    assert item["status"] == "todo"
    advice.apply({"system_cache": True})
    assert system.get()["system_cache"] is True and system.get()["system_cache_seconds"] == "300"
    advice.revert("system_cache")
    assert system.get()["system_cache"] is False


@pytest.mark.django_db
def test_admin_with_manage_rights_may_switch_the_cache_but_not_choose_its_kind():
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.accounts.models import ModuleGrant

    u = get_user_model().objects.create_user(username="adm", email="adm@x.nl", password="x")
    c = APIClient()
    c.force_authenticate(u)
    assert c.get("/api/system/cache/").status_code == 403
    ModuleGrant.objects.create(user=u, module="system", level=3)
    u = get_user_model().objects.get(pk=u.pk)  # (the levels are kept on the user object for one request)
    c = APIClient()
    c.force_authenticate(u)
    assert c.get("/api/system/cache/").status_code == 200
    assert c.put("/api/system/cache/", {"system_cache_seconds": "300"}, format="json").status_code == 200
    assert c.post("/api/system/cache/", {}, format="json").status_code == 200
    assert c.put("/api/system/cache/", {"backend": "memory"}, format="json").status_code == 403


def test_redis_without_an_address_uses_the_local_redis():
    from config import cacheconf

    conf, err = cacheconf.valid({"backend": "redis", "redis_url": ""})
    assert err == "" and conf == {"backend": "redis", "redis_url": "redis://localhost:6379/1"}
    assert cacheconf.valid({"backend": "redis", "redis_url": "nonsense"})[1]


@pytest.mark.django_db
def test_restart_is_for_a_superadmin_and_uses_the_right_way(monkeypatch):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.core import restart

    plain = APIClient()
    plain.force_authenticate(get_user_model().objects.create_user(username="x", email="x@x.nl", password="x"))
    assert plain.post("/api/system/restart/", {}, format="json").status_code == 403
    su = APIClient()
    su.force_authenticate(get_user_model().objects.create_user(username="s", email="s@x.nl", password="x", is_staff=True))
    started = []
    monkeypatch.setattr(restart, "mode", lambda: "gunicorn")
    monkeypatch.setattr(restart, "_do", lambda how: started.append(how))
    assert su.get("/api/system/restart/").json() == {"mode": "gunicorn"}
    assert su.post("/api/system/restart/", {}, format="json").json()["ok"] is True
    monkeypatch.setattr(restart, "mode", lambda: "manual")
    assert su.post("/api/system/restart/", {}, format="json").status_code == 400


def test_a_redis_that_does_not_answer_falls_back_to_the_database(tmp_path, monkeypatch):
    from config import cacheconf

    cacheconf.write_file(tmp_path, {"backend": "redis", "redis_url": "redis://localhost:6399/1"})
    monkeypatch.setattr(cacheconf, "redis_reachable", lambda url=cacheconf.AUTO_REDIS: False)
    conf = cacheconf.configured(tmp_path, {})
    assert conf["backend"] == "database" and conf["source"] == "fallback" and conf["fallback_from"] == "redis://localhost:6399/1"
    assert cacheconf._configured(tmp_path, {})["backend"] == "redis"  # the saved choice stays
    monkeypatch.setattr(cacheconf, "redis_reachable", lambda url=cacheconf.AUTO_REDIS: True)
    assert cacheconf.configured(tmp_path, {})["backend"] == "redis"
