# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The plugin Mailform: forms with drag and drop fields, test mode (the mail is shown, nothing is sent), real sending through a chosen mail link, spam brakes, and system objects."""
import shutil
import time
from pathlib import Path

import pytest
from rest_framework.test import APIClient

SRC = Path(__file__).resolve().parents[2] / "plugins" / "mailform"
RUN = "/api/plugins/run/mailform/"


@pytest.fixture
def mailform(settings, tmp_path, media):
    from apps.plugins import installer, manifest, runtime, signing

    settings.PLUGINS_DIR = tmp_path / "plugins"
    shutil.copytree(SRC, settings.PLUGINS_DIR / "mailform", ignore=shutil.ignore_patterns("__pycache__", "plugin.sig"))
    signing.dev_mode_allowed = lambda: True
    p = installer.register(manifest.parse((settings.PLUGINS_DIR / "mailform" / "plugin.json").read_bytes()))
    p.enabled = True
    p.save()
    assert runtime.load(p) is None
    runtime.ensure_loaded(force=True)
    from django.db import connection

    with connection.cursor() as cur:
        for name in ("message", "form"):
            if f"plg_mailform_{name}" in connection.introspection.table_names():
                cur.execute(f'DELETE FROM "plg_mailform_{name}"')
    yield p
    runtime.unload("mailform")


@pytest.fixture
def admin(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create(username="boss", email="b@example.com", is_staff=True, is_superuser=True)


def client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user)
    return c


def sub(c, slug, values, **extra):
    return c.post(RUN + f"forms/{slug}/submit", {"values": values, "t": int((time.time() - 10) * 1000), **extra}, format="json")


@pytest.mark.django_db(transaction=True)
def test_new_form_has_default_fields_and_admin_only(mailform, admin):
    assert client().get(RUN + "admin/forms").status_code in (401, 403)
    f = client(admin).post(RUN + "admin/forms", {"name": "Contact"}, format="json").json()
    assert [x["name"] for x in f["fields"]] == ["name", "email", "message"] and f["test_mode"] is True and f["slug"] == "contact"
    assert client(admin).get(RUN + "admin/forms").json()["default_link"] == "postmark-easy2edit"


@pytest.mark.django_db(transaction=True)
def test_fields_not_sent_and_test_mode_shows_mail(mailform, admin):
    c = client(admin)
    f = c.post(RUN + "admin/forms", {"name": "Contact"}, format="json").json()
    fields = f["fields"] + [{"id": "x", "type": "text", "name": "secret", "label": "Intern", "send": False}]
    fields[2]["send"] = True
    c.patch(RUN + f"admin/forms/{f['id']}", {"fields": fields, "recipients": "a@example.com", "reply_field": "email"}, format="json")
    pub = client().get(RUN + "forms/contact").json()
    assert "recipients" not in pub and all("send" not in x for x in pub["fields"])
    r = sub(client(), "contact", {"name": "Piet", "email": "p@example.com", "message": "Hoi", "secret": "geheim"}).json()
    assert r["test"] is True and "Naam: Piet" in r["mail"]["text"] and "geheim" not in r["mail"]["text"] and r["mail"]["reply_to"] == "p@example.com"
    assert client(admin).get(RUN + "admin/messages").json()["messages"][0]["test"] is True


@pytest.mark.django_db(transaction=True)
def test_validation_and_spam_brakes(mailform, admin):
    c = client(admin)
    f = c.post(RUN + "admin/forms", {"name": "Contact"}, format="json").json()
    assert sub(client(), "contact", {"name": "", "email": "x", "message": "m"}).status_code == 400
    assert sub(client(), "contact", {"name": "P", "email": "geen-mail", "message": "m"}).status_code == 400
    assert client().post(RUN + "forms/contact/submit", {"values": {"name": "P", "email": "p@example.com", "message": "m"}, "t": int(time.time() * 1000)}, format="json").status_code == 429  # too fast
    assert sub(client(), "contact", {"name": "P", "email": "p@example.com", "message": "m"}, website="bot").json()["ok"] is True  # honeypot: silently dropped
    assert client(admin).get(RUN + "admin/messages").json()["messages"] == []


@pytest.mark.django_db(transaction=True)
def test_live_sends_through_chosen_link(mailform, admin, monkeypatch):
    from apps.communication import sending

    sent = []
    monkeypatch.setattr(sending, "send_email", lambda to, subject, body, **k: sent.append((to, subject, body, k)) or "ok")
    c = client(admin)
    f = c.post(RUN + "admin/forms", {"name": "Contact"}, format="json").json()
    assert sub(client(), "contact", {"name": "P", "email": "p@example.com", "message": "m"}).json()["test"] is True and not sent
    c.patch(RUN + f"admin/forms/{f['id']}", {"test_mode": False, "recipients": ""}, format="json")
    assert sub(client(), "contact", {"name": "P", "email": "p@example.com", "message": "m"}).status_code == 503  # no recipient
    c.patch(RUN + f"admin/forms/{f['id']}", {"recipients": "a@example.com", "integration": "mijn-smtp", "reply_field": "email"}, format="json")
    assert sub(client(), "contact", {"name": "P", "email": "p@example.com", "message": "m"}).json() == {"ok": True, "message": "Bedankt! Je bericht is verstuurd."}
    to, subject, body, k = sent[0]
    assert to == "a@example.com" and k["integration"] == "mijn-smtp" and k["reply_to"] == "p@example.com" and "Bericht: m" in body
    t = c.post(RUN + f"admin/forms/{f['id']}/test", {"send": True, "to": "me@example.com"}, format="json").json()
    assert t["sent_to"] == "me@example.com" and sent[1][1].startswith("[TEST]")


@pytest.mark.django_db(transaction=True)
def test_every_active_form_is_a_system_object(mailform, admin):
    from apps.sysobjects.models import SystemObject

    c = client(admin)
    f = c.post(RUN + "admin/forms", {"name": "Offerte aanvraag"}, format="json").json()
    assert SystemObject.objects.filter(kind="plugin_part", ref_key="mailform-offerte-aanvraag").exists()
    c.patch(RUN + f"admin/forms/{f['id']}", {"active": False}, format="json")
    assert client().get(RUN + "forms/offerte-aanvraag").status_code == 404
    assert not SystemObject.objects.filter(kind="plugin_part", ref_key="mailform-offerte-aanvraag").exists()


@pytest.mark.django_db
def test_send_email_can_choose_the_mail_link():
    from apps.communication import sending
    from apps.integrations.models import Integration

    a = Integration(name="Postmark easy2edit", slug="postmark-easy2edit", provider="postmark", enabled=True)
    a.config = {"server_token": "x", "from_email": "a@example.com"}
    a.save()
    b = Integration(name="Eigen SMTP", slug="eigen-smtp", provider="smtp", enabled=True)
    b.config = {"host": "localhost"}
    b.save()
    assert sending.email_integration("eigen-smtp").slug == "eigen-smtp"
    assert sending.email_integration("bestaat-niet").provider in ("postmark", "smtp")  # unknown link: the usual one
    assert sending.email_integration("postmark-easy2edit").slug == "postmark-easy2edit"


@pytest.mark.django_db(transaction=True)
def test_captcha_and_email_code_are_separate_switches(mailform, admin):
    import re

    c = client(admin)
    f = c.post(RUN + "admin/forms", {"name": "Contact"}, format="json").json()
    ok = {"name": "P", "email": "p@example.com", "message": "m"}
    assert client().get(RUN + "forms/contact/captcha").status_code == 404 and client().post(RUN + "forms/contact/code", {"email": "p@example.com"}, format="json").status_code == 404
    # characters only
    c.patch(RUN + f"admin/forms/{f['id']}", {"captcha": True}, format="json")
    assert client().get(RUN + "forms/contact").json()["captcha"] is True
    assert sub(client(), "contact", ok).status_code == 422
    cap = client().get(RUN + "forms/contact/captcha").json()
    answer = "".join(re.findall(r">([A-Z0-9])</text>", cap["svg"]))
    assert len(answer) == 5
    assert sub(client(), "contact", ok, captcha_token=cap["token"], captcha="XXXXX").status_code == 422
    assert sub(client(), "contact", ok, captcha_token=cap["token"], captcha=answer.lower()).status_code == 422  # the picture was used up
    cap = client().get(RUN + "forms/contact/captcha").json()
    answer = "".join(re.findall(r">([A-Z0-9])</text>", cap["svg"]))
    assert sub(client(), "contact", ok, captcha_token=cap["token"], captcha=answer.lower()).json()["ok"] is True
    # e-mail code only (test mode shows the code on screen)
    c.patch(RUN + f"admin/forms/{f['id']}", {"captcha": False, "verify_email": True}, format="json")
    assert sub(client(), "contact", ok).status_code == 422
    assert client().post(RUN + "forms/contact/code", {"email": "geen"}, format="json").status_code == 400
    r = client().post(RUN + "forms/contact/code", {"email": "p@example.com"}, format="json").json()
    assert sub(client(), "contact", ok, code_token=r["token"], code="000000x").status_code == 422
    assert sub(client(), "contact", ok, code_token=r["token"], code=r["test_code"]).json()["ok"] is True
    other = dict(ok, email="q@example.com")
    assert sub(client(), "contact", other, code_token=r["token"], code=r["test_code"]).status_code == 422  # the code belongs to that address


@pytest.mark.django_db(transaction=True)
def test_email_code_is_mailed_when_live(mailform, admin, monkeypatch):
    from apps.communication import sending

    sent = []
    monkeypatch.setattr(sending, "send_email", lambda to, subject, body, **k: sent.append((to, body)) or "ok")
    c = client(admin)
    f = c.post(RUN + "admin/forms", {"name": "Contact"}, format="json").json()
    c.patch(RUN + f"admin/forms/{f['id']}", {"verify_email": True, "test_mode": False, "recipients": "a@example.com"}, format="json")
    r = client().post(RUN + "forms/contact/code", {"email": "p@example.com"}, format="json").json()
    assert "test_code" not in r and sent[0][0] == "p@example.com"
    code = __import__("re").search(r"\d{6}", sent[0][1]).group(0)
    ok = {"name": "P", "email": "p@example.com", "message": "m"}
    assert sub(client(), "contact", ok, code_token=r["token"], code=code).json()["ok"] is True and sent[1][0] == "a@example.com"
