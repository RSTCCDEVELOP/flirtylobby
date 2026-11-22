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
    assert cacheconf.valid({"backend": "redis", "redis_url": ""})[1]  # redis needs an address
    assert cacheconf.valid({"backend": "redis", "redis_url": "redis://h:6379/1"})[1] == ""
    assert cacheconf.valid({"backend": "x"})[1]
    assert cacheconf.configured("/nonexistent", {"CACHE_BACKEND": "memory"})["source"] == "env"


@pytest.mark.django_db
def test_settings_are_kept_and_cleared_by_a_save():
    assert system.get()["system_cache"] is True and system.get()["system_cache_seconds"] == "60"
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
    assert c.put("/api/system/cache/", {"backend": "redis", "redis_url": ""}, format="json").status_code == 400
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
