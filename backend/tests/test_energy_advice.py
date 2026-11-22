# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The cache advice of the energy module: five minutes, and Redis when it runs on this machine."""
import pytest


@pytest.mark.django_db
def test_cache_advice_asks_for_five_minutes_and_for_redis_when_it_runs(monkeypatch):
    from apps.core import system
    from apps.energy import advice
    from config import cacheconf

    system.save({"system_cache": True, "system_cache_seconds": "60"})
    monkeypatch.setattr(cacheconf, "redis_reachable", lambda url=cacheconf.AUTO_REDIS: True)
    items = {i["key"]: i for i in advice.analyse()["items"]}
    assert items["system_cache"]["status"] == "todo"  # 60 s is shorter than the advice
    assert items["cache_backend"]["status"] == "todo" and items["cache_backend"]["applicable"]
    monkeypatch.setattr(cacheconf, "redis_reachable", lambda url=cacheconf.AUTO_REDIS: False)
    items = {i["key"]: i for i in advice.analyse()["items"]}
    assert items["cache_backend"]["status"] == "info" and not items["cache_backend"]["applicable"]
