# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The log (Logboek): lines by rank, who may read, remove and set the retention, and what is written."""
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.auditlog import service
from apps.auditlog.models import LogEntry


@pytest.fixture
def people(django_user_model):
    admin_role, _ = Role.objects.get_or_create(slug="admin", defaults={"name": "Admin"})
    plain = django_user_model.objects.create_user("pl", "pl@x.nl", "pw12345678!")
    admin = django_user_model.objects.create_user("ad", "ad@x.nl", "pw12345678!")
    admin.roles.add(admin_role)
    sup = django_user_model.objects.create_user("su", "su@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    plus = django_user_model.objects.create_user("pp", "pp@x.nl", "pw12345678!", is_staff=True, is_superuser=True)
    plus.is_superadmin_plus = True
    plus.save()
    return plain, admin, sup, plus


def _c(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


@pytest.mark.django_db
def test_ranks_and_who_reads_which_lines(people):
    plain, admin, sup, plus = people
    assert [service.rank_of(u) for u in people] == [0, 1, 2, 3]
    for u, ev in ((plain, "auth.login"), (admin, "auth.login"), (sup, "system.reset"), (plus, "module.changed")):
        service.log(ev, u, detail=f"door {u.email}")
    mails = lambda u: {r["email"] for r in _c(u).get("/api/log/").json()["results"]}  # noqa: E731
    assert mails(admin) == {"pl@x.nl", "ad@x.nl"}  # an admin never reads the lines of a superadmin
    assert mails(sup) == {"pl@x.nl", "ad@x.nl", "su@x.nl"}
    assert mails(plus) == {"pl@x.nl", "ad@x.nl", "su@x.nl", "pp@x.nl"}
    assert _c(plain).get("/api/log/").status_code == 403  # an ordinary user has no log


@pytest.mark.django_db
def test_only_a_superadmin_empties_the_log_and_sets_the_retention(people):
    plain, admin, sup, plus = people
    service.log("auth.login", admin)
    assert _c(admin).delete("/api/log/").status_code == 403
    assert _c(admin).put("/api/log/settings/", {"retention_days": 30}, format="json").status_code == 403
    assert _c(admin).get("/api/log/settings/").json()["can_edit"] is False
    assert LogEntry.objects.count() == 1
    assert _c(sup).put("/api/log/settings/", {"retention_days": 90}, format="json").json()["retention_days"] == 90
    assert _c(sup).put("/api/log/settings/", {"retention_days": 13}, format="json").status_code == 400
    r = _c(sup).delete("/api/log/")
    assert r.status_code == 200 and r.json()["removed"] >= 1
    assert set(LogEntry.objects.values_list("event", flat=True)) == {"system.log_cleared"}  # one line says that it was done


@pytest.mark.django_db
def test_old_lines_are_removed_after_the_retention_and_unlimited_keeps_everything(people):
    _p, admin, sup, _pp = people
    old = LogEntry.objects.create(event="auth.login", level=1, actor_email="old@x.nl")
    LogEntry.objects.filter(pk=old.pk).update(created_at=timezone.now() - timezone.timedelta(days=400))
    service.save_settings(0)  # unlimited
    assert service.purge() == 0 and LogEntry.objects.filter(pk=old.pk).exists()
    service.save_settings(365)  # (setting it purges at once)
    assert not LogEntry.objects.filter(pk=old.pk).exists()


@pytest.mark.django_db
def test_logins_logouts_failed_logins_and_password_changes_are_written(people):
    plain, admin, sup, plus = people
    c = APIClient()
    assert c.post("/api/auth/login/", {"email": "su@x.nl", "password": "pw12345678!"}, format="json").status_code == 200
    assert c.post("/api/auth/login/", {"email": "su@x.nl", "password": "fout"}, format="json").status_code == 400
    kinds = list(LogEntry.objects.order_by("id").values_list("event", "level"))
    assert ("auth.login", 2) in kinds and ("auth.login_failed", 2) in kinds  # (the failed attempt on a superadmin is a superadmin line)
    token = c.post("/api/auth/login/", {"email": "pl@x.nl", "password": "pw12345678!"}, format="json").json()["token"]
    c2 = APIClient()
    c2.credentials(HTTP_AUTHORIZATION=f"Token {token}")
    c2.post("/api/auth/logout/")
    assert LogEntry.objects.filter(event="auth.logout", actor_email="pl@x.nl").exists()


@pytest.mark.django_db
def test_the_log_is_a_standard_module_that_is_always_on():
    from apps.core import modules

    assert "log" in modules.ALWAYS_ON and modules.enabled("log")


@pytest.mark.django_db
def test_a_reset_asks_whether_the_log_is_emptied(people, monkeypatch):
    from apps.core import reset

    _p, _a, sup, _pp = people
    monkeypatch.setattr(reset, "perform", lambda *a, **k: {})
    monkeypatch.setattr("apps.accounts.devlogin.check", lambda *a, **k: True)
    service.log("auth.login", sup)
    c = _c(sup)
    c.post("/api/system/reset/", {"confirm": "RESET", "password": "x"}, format="json")
    assert LogEntry.objects.filter(event="auth.login").exists()  # kept
    last = LogEntry.objects.filter(event="system.reset").first()
    assert last and last.detail == "logboek bewaard" and last.actor_email == "su@x.nl"
    c.post("/api/system/reset/", {"confirm": "RESET", "password": "x", "clear_logs": True}, format="json")
    assert not LogEntry.objects.filter(event="auth.login").exists()  # emptied
    assert LogEntry.objects.filter(event="system.reset", detail="logboek geleegd").count() == 1


@pytest.mark.django_db
def test_errors_of_the_server_become_lines_for_superadmins_once_a_minute(people):
    import logging

    from django.core.cache import cache

    cache.clear()
    plain, admin, sup, plus = people
    lg = logging.getLogger("apps.test_area")
    h = __import__("apps.auditlog.handler", fromlist=["DbErrorHandler"]).DbErrorHandler()
    lg.addHandler(h)
    lg.propagate = False
    try:
        lg.warning("only a warning")  # (a warning goes to the file, not to the log of the website)
        lg.error("De betaling is mislukt voor %s", "order 12")
        lg.error("De betaling is mislukt voor %s", "order 12")  # the same message: once a minute
        try:
            raise ValueError("kapot")
        except ValueError:
            lg.exception("Andere storing")
    finally:
        lg.removeHandler(h)
    rows = list(LogEntry.objects.filter(event="system.error").order_by("id"))
    assert len(rows) == 2 and rows[0].level == 2 and rows[0].target == "apps.test_area" and "order 12" in rows[0].detail and "ValueError: kapot" in rows[1].detail
    seen = lambda u: [r["event"] for r in _c(u).get("/api/log/").json()["results"]]  # noqa: E731
    assert "system.error" not in seen(admin)  # a malfunction is for superadmins
    assert seen(sup).count("system.error") == 2
    assert "Storingen" in _c(sup).get("/api/log/").json()["categories"]
