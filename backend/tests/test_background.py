# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from apps.core import background


def test_the_controller_runs_due_jobs_together_and_sleeps_until_the_next(monkeypatch):
    monkeypatch.setattr(background, "TASKS", {})
    calls = []
    background.register("a", lambda: calls.append("a"), every=60, first=0)
    background.register("b", lambda: calls.append("b"), every=300, first=0)
    background.register("off", lambda: calls.append("off"), every=60, first=0, enabled=lambda: False)
    background.register("later", lambda: calls.append("later"), every=60, first=1000)
    t0 = background.TASKS["a"]["next"]
    assert sorted(background.run_due(t0 + 1)) == ["a", "b"] and sorted(calls) == ["a", "b"]  # in one round; the switched-off and the later job did not run
    assert background.run_due(t0 + 30) == []  # nothing due: nothing happens
    assert 20 < background.seconds_until_next(t0 + 30) <= 31  # asleep until "a" is due again
    assert background.run_due(t0 + 70) == ["a"]


def test_a_failing_job_does_not_stop_the_others(monkeypatch):
    monkeypatch.setattr(background, "TASKS", {})
    ok = []
    background.register("bad", lambda: 1 / 0, every=60, first=0)
    background.register("good", lambda: ok.append(1), every=60, first=0)
    assert background.run_due(background.TASKS["bad"]["next"] + 1) == ["good"] and ok == [1]
