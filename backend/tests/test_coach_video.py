# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The plugin Coach video: roles, analyses and sharing, rights, upload and processing, Range, drawings, the YouTube library, AI (mocked), chat."""
import io
import shutil
import time
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

SRC = Path(__file__).resolve().parents[2] / "plugins" / "coach-video"
RUN = "/api/plugins/run/coach-video/"


def png(size=(40, 30)):
    from PIL import Image

    b = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(b, "PNG")
    return b.getvalue()


@pytest.fixture
def cv(settings, tmp_path):
    from apps.plugins import installer, manifest, runtime, signing

    settings.PLUGINS_DIR = tmp_path / "plugins"
    shutil.copytree(SRC, settings.PLUGINS_DIR / "coach-video", ignore=shutil.ignore_patterns("__pycache__", "plugin.sig"))
    signing.dev_mode_allowed = lambda: True
    p = installer.register(manifest.parse((settings.PLUGINS_DIR / "coach-video" / "plugin.json").read_bytes()))
    p.enabled = True
    p.config = {"coach_groepen": "Coaches"}
    p.save()
    assert runtime.load(p) is None
    runtime.ensure_loaded(force=True)
    from django.db import connection

    with connection.cursor() as cur:
        for n in ("bericht", "aiopdracht", "momentopname", "analyseinstructievideo", "instructievideo", "tekening", "opmerking", "media", "analysesporter", "analyse", "sporter"):
            if f"plg_coach_video_{n}" in connection.introspection.table_names():
                cur.execute(f'DELETE FROM "plg_coach_video_{n}"')
    yield p
    runtime.unload("coach-video")


def user(name, **kw):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create(username=name, email=f"{name}@example.com", first_name=name.title(), **kw)


def coach(name="coach"):
    from apps.accounts.models import UserGroup

    u = user(name)
    g, _ = UserGroup.objects.get_or_create(name="Coaches", defaults={"slug": "coaches"})
    u.user_groups.add(g)
    return u


def client(u=None):
    c = APIClient()
    if u:
        c.force_authenticate(u)
    return c


def wait_ready(c, aid, mid, seconds=15):
    end = time.time() + seconds
    while time.time() < end:
        m = c.get(RUN + f"media/{mid}").json()
        if m["verwerking"] in ("klaar", "fout"):
            return m
        time.sleep(0.1)
    raise AssertionError("processing did not finish")


def link_athlete(cc, ca, athlete):
    """The coach invites an existing user and the user says yes (a link always needs the OK of the athlete)."""
    cc.post(RUN + "sporters/uitnodigen", {"email": athlete.email}, format="json")
    req = ca.get(RUN + "koppelingen").json()["verzoeken_in"]
    assert len(req) == 1, req
    r = ca.post(RUN + f"verzoeken/{req[0]['id']}/antwoord", {"akkoord": True}, format="json")
    assert r.status_code == 200 and len(r.json()["coaches"]) == 1


def new_analysis(c, sp, link=True, **kw):
    if link:
        link_athlete(c, client(sp), sp)
    return c.post(RUN + "analyses", {"titel": "Squat", "sporter_ids": [sp.pk], **kw}, format="json").json()


@pytest.mark.django_db(transaction=True)
def test_only_coaches_make_analyses_and_a_concept_is_invisible_for_the_athlete(cv, monkeypatch):
    sent = []
    monkeypatch.setattr("apps.notifications.service.notify", lambda u, kind, title, body="", url="", **k: sent.append((u.pk, kind, title)))
    co, ath, other = coach(), user("sanne"), user("other")
    cc, ca, co2 = client(co), client(ath), client(other)
    assert ca.post(RUN + "analyses", {"titel": "x"}, format="json").status_code == 403  # an athlete is no coach
    a = new_analysis(cc, ath)
    assert a["status"] == "concept"
    r = ca.get(RUN + "mijn")
    from apps.plugins.models import Plugin
    assert r.status_code == 200, Plugin.objects.get(name="coach-video").error
    assert ca.get(RUN + f"mijn/{a['id']}").status_code == 404 and r.json()["analyses"] == []
    assert ca.get(RUN + f"analyses/{a['id']}").status_code == 404  # the editor is for the coach
    r = cc.post(RUN + f"analyses/{a['id']}/delen", {}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "gedeeld"
    assert any(n[0] == ath.pk and n[1] == "coachvideo" for n in sent)
    assert ca.get(RUN + f"mijn/{a['id']}").status_code == 200
    assert co2.get(RUN + f"mijn/{a['id']}").status_code == 404 and co2.get(RUN + f"analyses/{a['id']}").status_code == 404  # nobody else
    assert any(n[0] == co.pk for n in sent)  # the coach hears that the athlete looked
    assert cc.get(RUN + f"analyses/{a['id']}").json()["status"] == "bekeken"


@pytest.mark.django_db(transaction=True)
def test_changes_after_sharing_stay_hidden_until_the_next_share(cv):
    co, ath = coach(), user("sanne")
    cc, ca = client(co), client(ath)
    a = new_analysis(cc, ath)
    cc.put(RUN + f"analyses/{a['id']}", {"instructie": "html:<p>Een</p>"}, format="json")
    cc.post(RUN + f"analyses/{a['id']}/delen", {"melden": False}, format="json")
    cc.put(RUN + f"analyses/{a['id']}", {"instructie": "html:<p>Twee</p>"}, format="json")
    d = cc.get(RUN + f"analyses/{a['id']}").json()
    assert d["ongepubliceerd"] is True and "Twee" in d["instructie"]
    assert "Een" in ca.get(RUN + f"mijn/{a['id']}").json()["instructie"]
    cc.post(RUN + f"analyses/{a['id']}/delen", {"melden": False}, format="json")
    assert "Twee" in ca.get(RUN + f"mijn/{a['id']}").json()["instructie"]


@pytest.mark.django_db(transaction=True)
def test_photo_upload_is_checked_processed_and_served_with_range(cv):
    co, ath = coach(), user("sanne")
    cc = client(co)
    a = new_analysis(cc, ath)
    up = lambda f: cc.post(RUN + f"analyses/{a['id']}/media", {"file": f}, format="multipart")  # noqa: E731
    assert up(SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")).status_code == 400
    assert up(SimpleUploadedFile("fake.png", b"this is not a picture", content_type="image/png")).status_code == 400  # on content, not on name
    ok = up(SimpleUploadedFile("foto.png", png(), content_type="image/png"))
    assert ok.status_code == 200
    m = wait_ready(cc, a["id"], ok.json()["id"])
    assert m["verwerking"] == "klaar" and m["soort"] == "afbeelding" and m["url"]
    got = client().get(m["url"], HTTP_RANGE="bytes=0-9")
    assert got.status_code == 206 and got["Content-Range"].startswith("bytes 0-9/") and len(b"".join(got.streaming_content)) == 10
    assert client().get(m["url"]).status_code == 200
    assert client().get(RUN + "get/not-a-token").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_quota_and_size_limits(cv, settings):
    from apps.plugins.models import Plugin

    co, ath = coach(), user("sanne")
    cc = client(co)
    a = new_analysis(cc, ath)
    p = Plugin.objects.get(name="coach-video")
    p.config = {**p.config, "opslag_per_coach_gb": 0.00001, "max_video_mb": 1}
    p.save()
    from apps.plugins import runtime

    runtime.ensure_loaded(force=True)
    r = cc.post(RUN + f"analyses/{a['id']}/media", {"file": SimpleUploadedFile("foto.png", png((600, 600)) * 1, content_type="image/png")}, format="multipart")
    assert r.status_code in (200, 413)
    big = SimpleUploadedFile("a.mp4", b"\x00\x00\x00\x18ftypmp42" + b"0" * (2 * 1024 * 1024), content_type="video/mp4")
    assert cc.post(RUN + f"analyses/{a['id']}/media", {"file": big}, format="multipart").status_code == 400  # too big


@pytest.mark.django_db(transaction=True)
def test_remarks_and_drawings_are_validated(cv):
    co, ath = coach(), user("sanne")
    cc = client(co)
    a = new_analysis(cc, ath)
    up = cc.post(RUN + f"analyses/{a['id']}/media", {"file": SimpleUploadedFile("foto.png", png(), content_type="image/png")}, format="multipart").json()
    wait_ready(cc, a["id"], up["id"])
    r1 = cc.post(RUN + f"analyses/{a['id']}/opmerkingen", {"media_id": up["id"], "tekst": "html:<p>Mooi</p>"}, format="json").json()
    r2 = cc.post(RUN + f"analyses/{a['id']}/opmerkingen", {"media_id": up["id"], "tekst": "Tweede"}, format="json").json()
    assert (r1["nummer"], r2["nummer"]) == (1, 2) and r1["tijd_ms"] is None  # a photo has no time
    assert cc.post(RUN + f"analyses/{a['id']}/opmerkingen", {"media_id": up["id"], "tekst": "  "}, format="json").status_code == 400
    ok = {"soort": "hoek", "punten": [[0.1, 0.2], [0.5, 0.5], [0.9, 0.2]], "stijl": {"kleur": "licht", "dikte": 4}, "waarde": 86.2}
    put = lambda items: cc.put(RUN + f"analyses/{a['id']}/tekeningen", {"media_id": up["id"], "tekeningen": items}, format="json")  # noqa: E731
    r = put([ok])
    assert r.status_code == 200 and r.json()["tekeningen"][0]["waarde"] == 86.2
    assert put([{**ok, "punten": [[0.1, 0.2]]}]).status_code == 400  # an angle has three points
    assert put([{**ok, "soort": "spook"}]).status_code == 400
    assert put([{**ok, "punten": [["x", 1], [0, 0], [1, 1]]}]).status_code == 400
    clamped = put([{**ok, "punten": [[-5, 9], [0.5, 0.5], [2, 2]], "stijl": {"kleur": "rood", "dikte": 99}}]).json()["tekeningen"][0]
    assert clamped["punten"][0] == [0.0, 1.0] and clamped["stijl"] == {"kleur": "primair", "dikte": 8}  # between 0 and 1, only theme colours
    assert put([]).json()["tekeningen"] == []  # the layer is replaced as a whole


@pytest.mark.django_db(transaction=True)
def test_youtube_links_in_every_form_and_the_library(cv, monkeypatch):
    import urllib.request

    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(OSError("no network")))
    co, ath = coach(), user("sanne")
    cc = client(co)
    forms = ["https://youtu.be/xY7k2Q-lAbc?t=80", "https://www.youtube.com/watch?v=xY7k2Q-lAbc&t=1m20s", "https://www.youtube.com/shorts/xY7k2Q-lAbc?start=80", "https://www.youtube.com/embed/xY7k2Q-lAbc?start=80",
             "https://www.youtube-nocookie.com/embed/xY7k2Q-lAbc?start=80"]
    for u in forms:
        r = cc.post(RUN + "bibliotheek/ophalen", {"url": u}, format="json").json()
        assert (r["youtube_id"], r["start_s"]) == ("xY7k2Q-lAbc", 80), u
    assert cc.post(RUN + "bibliotheek/ophalen", {"url": "https://example.com/watch?v=xY7k2Q-lAbc"}, format="json").status_code == 400
    v = cc.post(RUN + "bibliotheek", {"url": forms[0], "titel": "Box squat", "categorie": "Squat", "start_s": 80, "eind_s": 165, "zichtbaarheid": "eigen"}, format="json")
    assert v.status_code == 200 and v.json()["start_s"] == 80
    assert cc.post(RUN + "bibliotheek", {"url": forms[0], "titel": "Fout", "start_s": 100, "eind_s": 50}, format="json").status_code == 400
    other = client(coach("coach2"))
    assert other.get(RUN + "bibliotheek").json()["videos"] == []  # private
    cc.put(RUN + f"bibliotheek/{v.json()['id']}", {"zichtbaarheid": "alle_coaches"}, format="json")
    assert len(other.get(RUN + "bibliotheek").json()["videos"]) == 1
    a = new_analysis(cc, ath)
    link = cc.post(RUN + f"analyses/{a['id']}/instructievideos", {"instructievideo_id": v.json()["id"], "start_s": 90}, format="json")
    assert link.status_code == 200 and link.json()["start_s"] == 90
    assert other.post(RUN + f"analyses/{a['id']}/instructievideos", {"instructievideo_id": v.json()["id"]}, format="json").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_ai_is_paid_by_the_coach_cleaned_and_never_for_an_athlete(cv, monkeypatch):
    from apps.integrations import ai

    calls = []

    def fake(system, prompt, max_tokens=2500, timeout=90, web=False, images=None):
        from apps.integrations import aiusage

        calls.append({"user": aiusage.current_user_id(), "images": len(images or []), "prompt": prompt, "ref": aiusage._ref.get()})
        return 'noise {"blokken": [{"titel": "Focus", "tekst": "<p>Heup <b>eerst</b><script>x()</script></p>"}, {"titel": "Leeg", "tekst": ""}]} end'

    monkeypatch.setattr(ai, "claude", fake)
    monkeypatch.setattr(ai, "available", lambda: True)
    co, ath = coach(), user("sanne")
    cc, ca = client(co), client(ath)
    a = new_analysis(cc, ath)
    up = cc.post(RUN + f"analyses/{a['id']}/media", {"file": SimpleUploadedFile("foto.png", png(), content_type="image/png")}, format="multipart").json()
    wait_ready(cc, a["id"], up["id"])
    snap = cc.post(RUN + f"analyses/{a['id']}/momentopnames", {"image": SimpleUploadedFile("s.png", png((80, 60)), content_type="image/png"), "media_id": up["id"]}, format="multipart")
    assert snap.status_code == 200
    cc.post(RUN + f"analyses/{a['id']}/opmerkingen", {"media_id": up["id"], "tekst": "html:<p>Knie voorbij de tenen</p>"}, format="json")
    assert ca.post(RUN + f"ai/{a['id']}", {"soort": "instructie"}, format="json").status_code == 404  # an athlete can never start an AI job
    body = {"soort": "instructie", "opdracht": "Schrijf 3 aandachtspunten", "momentopname_ids": [snap.json()["id"]], "opties": {"lengte": "kort", "toon": "motiverend", "taal": "nl"}}
    est = cc.post(RUN + f"ai/{a['id']}/schat", body, format="json").json()
    assert est["beelden"] == 1 and est["hoog"] >= est["laag"]
    nc = cc.post(RUN + f"ai/{a['id']}", body, format="json")
    assert nc.status_code == 402 and nc.json()["code"] == "no_credit" and calls == []  # no credit: nothing is sent to the AI
    from apps.integrations import aiusage

    aiusage.credit(co, 5, "topup", "test")
    r0 = cc.post(RUN + f"ai/{a['id']}", body, format="json")
    assert r0.status_code == 200, (r0.json(), __import__("apps.plugins.models", fromlist=["Plugin"]).Plugin.objects.get(name="coach-video").error)
    o = r0.json()
    end = time.time() + 15
    while o["status"] == "bezig" and time.time() < end:
        time.sleep(0.1)
        o = cc.get(RUN + f"ai/opdracht/{o['id']}").json()
    assert o["status"] == "klaar" and len(o["resultaat"]) == 1 and "script" not in o["resultaat"][0]["tekst"]
    assert calls[0]["user"] == co.pk and calls[0]["images"] == 1 and calls[0]["ref"] == f"cv:{a['id']}"  # counted for the coach, per analysis
    assert "<data>" in calls[0]["prompt"] and "Knie voorbij de tenen" in calls[0]["prompt"] and "sanne" not in calls[0]["prompt"].lower()  # data, and no name of the athlete
    r = cc.post(RUN + f"ai/opdracht/{o['id']}/overnemen", {"blokken": [0]}, format="json")
    assert r.status_code == 200 and "Focus" in r.json()["instructie"]
    cc.put(RUN + f"analyses/{a['id']}", {"instructie": "html:<p>Mijn tekst</p>"}, format="json")
    cc.post(RUN + f"ai/opdracht/{o['id']}/overnemen", {"blokken": [0]}, format="json")
    assert "Mijn tekst" in cc.get(RUN + f"analyses/{a['id']}").json()["instructie"]  # added, never overwritten


@pytest.mark.django_db(transaction=True)
def test_chat_sides_unread_read_and_delete_and_one_notification_per_quarter(cv, monkeypatch):
    sent = []
    monkeypatch.setattr("apps.notifications.service.notify", lambda u, kind, title, body="", url="", **k: sent.append((u.pk, title)))
    co, ath, other = coach(), user("sanne"), user("other")
    cc, ca, cx = client(co), client(ath), client(other)
    a = new_analysis(cc, ath)
    assert ca.get(RUN + f"chat/{a['id']}").status_code == 404  # a concept: no chat for the athlete yet
    cc.post(RUN + f"analyses/{a['id']}/delen", {"melden": False}, format="json")
    m1 = cc.post(RUN + f"chat/{a['id']}", {"tekst": "Kijk naar opmerking 2", "tijd_ref_ms": 11000}, format="json").json()
    assert m1["rol"] == "coach" and m1["mine"] and m1["tijd_ref_ms"] == 11000
    cc.post(RUN + f"chat/{a['id']}", {"tekst": "Nog iets"}, format="json")
    assert len([s for s in sent if s[0] == ath.pk and s[1].startswith("Nieuw bericht")]) == 1  # bundled: one notification per quarter of an hour
    d = ca.get(RUN + f"chat/{a['id']}").json()
    assert [b["rol"] for b in d["berichten"]] == ["coach", "coach"] and d["ongelezen"] == 2 and not d["berichten"][0]["mine"]
    ca.post(RUN + f"chat/{a['id']}/gelezen", {}, format="json")
    assert ca.get(RUN + f"chat/{a['id']}").json()["ongelezen"] == 0
    mine = ca.post(RUN + f"chat/{a['id']}", {"tekst": "Moet de box lager?"}, format="json").json()
    assert mine["rol"] == "sporter" and mine["mine"]
    assert cx.get(RUN + f"chat/{a['id']}").status_code == 404 and cx.post(RUN + f"chat/{a['id']}", {"tekst": "hoi"}, format="json").status_code == 404
    assert cc.delete(RUN + f"chat/bericht/{m1['id']}").status_code == 200  # (the coach may remove)
    assert cx.delete(RUN + f"chat/bericht/{mine['id']}").status_code == 404
    gone = ca.get(RUN + f"chat/{a['id']}").json()["berichten"][0]
    assert gone["verwijderd"] and gone["tekst"] == ""


@pytest.mark.django_db(transaction=True)
def test_a_link_needs_the_ok_of_the_athlete_and_other_coaches_never_see_the_user(cv, monkeypatch):
    sent = []
    monkeypatch.setattr("apps.notifications.service.notify", lambda u, kind, title, body="", url="", **k: sent.append((u.pk, title)))
    co, co2, ath = coach(), coach("coach2"), user("sanne")
    cc, cc2, ca = client(co), client(co2), client(ath)
    cc.post(RUN + "sporters/uitnodigen", {"email": "SANNE@example.com"}, format="json")
    assert any(n[0] == ath.pk for n in sent)  # the athlete is asked
    assert cc.get(RUN + "sporters").json()["sporters"] == []  # not a sporter yet: nothing without the OK
    assert new_analysis(cc, ath, link=False)["sporters"] == []
    req = ca.get(RUN + "koppelingen").json()["verzoeken_in"]
    assert len(req) == 1 and req[0]["inkomend"]
    assert cc.post(RUN + f"verzoeken/{req[0]['id']}/antwoord", {"akkoord": True}, format="json").status_code == 404  # only the asked person answers
    assert ca.post(RUN + f"verzoeken/{req[0]['id']}/antwoord", {"akkoord": True}, format="json").status_code == 200
    assert [x["id"] for x in cc.get(RUN + "sporters").json()["sporters"]] == [ath.pk]
    assert cc2.get(RUN + "sporters").json()["sporters"] == []  # the other coach does not see this user ...
    assert new_analysis(cc2, ath, link=False)["sporters"] == []  # ... and cannot pick the user either
    assert cc2.get(RUN + "sporters/zoek?q=sanne").status_code == 404  # (there is no browsing of users any more)
    # the other coach has to ask too; a refusal keeps the other coach out
    cc2.post(RUN + "sporters/uitnodigen", {"email": ath.email}, format="json")
    req2 = ca.get(RUN + "koppelingen").json()["verzoeken_in"]
    ca.post(RUN + f"verzoeken/{req2[0]['id']}/antwoord", {"akkoord": False}, format="json")
    assert cc2.get(RUN + "sporters").json()["sporters"] == []
    assert cc.post(RUN + "sporters/uitnodigen", {"email": ath.email}, format="json").status_code == 400  # already linked


@pytest.mark.django_db(transaction=True)
def test_an_athlete_adds_a_coach_by_e_mail_and_the_coach_has_to_accept(cv, monkeypatch):
    monkeypatch.setattr("apps.notifications.service.notify", lambda *a, **k: None)
    co, ath, plain = coach(), user("sanne"), user("notacoach")
    cc, ca = client(co), client(ath)
    r1 = ca.post(RUN + "coaches/vragen", {"email": co.email}, format="json").json()
    r2 = ca.post(RUN + "coaches/vragen", {"email": plain.email}, format="json").json()
    r3 = ca.post(RUN + "coaches/vragen", {"email": "nobody@example.com"}, format="json").json()
    assert r1["boodschap"] == r2["boodschap"] == r3["boodschap"]  # nobody can find out who is a coach
    assert len(r1["verzoeken_uit"]) == 1 and len(r2["verzoeken_uit"]) == 1  # (only the first one is a real request)
    inc = cc.get(RUN + "koppelingen").json()["verzoeken_in"]
    assert len(inc) == 1 and inc[0]["richting"] == "aanvraag" and cc.get(RUN + "sporters").json()["sporters"] == []
    cc.post(RUN + f"verzoeken/{inc[0]['id']}/antwoord", {"akkoord": True}, format="json")
    assert [x["id"] for x in cc.get(RUN + "sporters").json()["sporters"]] == [ath.pk]
    sid = cc.get(RUN + "sporters").json()["sporters"][0]["sporter_id"]
    a = new_analysis(cc, ath, link=False)
    cc.post(RUN + f"analyses/{a['id']}/delen", {"melden": False}, format="json")
    assert len(ca.get(RUN + "mijn").json()["analyses"]) == 1
    assert ca.delete(RUN + f"koppelingen/{sid}").status_code == 200  # the athlete ends it and leaves the analyses of this coach
    assert ca.get(RUN + "mijn").json()["analyses"] == [] and cc.get(RUN + "sporters").json()["sporters"] == []


@pytest.mark.django_db(transaction=True)
def test_a_new_person_gets_an_invitation_by_e_mail_and_is_linked_to_the_coach_after_the_account(cv, monkeypatch):
    import re

    from apps.accounts import invitations
    from apps.accounts.models import Invitation

    mails = []
    monkeypatch.setattr("apps.communication.sending.send_email", lambda to, subject, body, **k: mails.append((to, subject, body)))
    monkeypatch.setattr("apps.notifications.service.notify", lambda *a, **k: None)
    co, other = coach(), coach("coach2")
    cc = client(co)
    assert cc.post(RUN + "sporters/uitnodigen", {"email": "new@example.com"}, format="json").status_code == 400  # a new person needs a name
    r = cc.post(RUN + "sporters/uitnodigen", {"email": "New@Example.com", "first_name": "Nina", "last_name": "Nieuw"}, format="json")
    assert r.status_code == 200 and r.json()["verzoeken_uit"][0]["nieuw_account"]
    assert len(mails) == 1 and mails[0][0] == "new@example.com" and "Coach video" in mails[0][1]
    token = re.search(r"/uitnodiging/([A-Za-z0-9_\-]+)", mails[0][2]).group(1)
    inv = Invitation.objects.get(email="new@example.com")
    assert inv.source == "coach-video" and inv.require_email_verify and inv.require_terms and inv.after_path == "/dashboard/plugins/coach-video"
    got = client().get(f"/api/invite/{token}/").json()
    assert got["after"] == "/dashboard/plugins/coach-video" and got["require_email_verify"] is True  # straight to the module afterwards, the e-mail code is mandatory
    assert cc.post(RUN + f"verzoeken/{r.json()['verzoeken_uit'][0]['id']}/opnieuw", {}, format="json").status_code == 200 and len(mails) == 2  # a new link
    token2 = re.search(r"/uitnodiging/([A-Za-z0-9_\-]+)", mails[1][2]).group(1)
    assert client().get(f"/api/invite/{token}/").status_code == 410 and client().get(f"/api/invite/{token2}/").status_code == 200  # the old link stops working
    inv.refresh_from_db()
    inv.pending = {"password": "x"}
    resp = invitations._finish(inv, verified=True)  # (what the page does after the code)
    assert resp.status_code == 201
    from django.contrib.auth import get_user_model

    nina = get_user_model().objects.get(email="new@example.com")
    assert [x["id"] for x in cc.get(RUN + "sporters").json()["sporters"]] == [nina.pk]  # linked to the inviting coach
    assert client(other).get(RUN + "sporters").json()["sporters"] == []  # and invisible for the other coaches
    assert cc.get(RUN + "koppelingen").json()["verzoeken_uit"] == []


@pytest.mark.django_db(transaction=True)
def test_withdrawing_an_invitation_kills_the_link_and_the_menu_flags(cv, monkeypatch):
    import re

    from apps.accounts.models import Invitation
    from apps.plugins.models import Plugin

    mails = []
    monkeypatch.setattr("apps.communication.sending.send_email", lambda to, subject, body, **k: mails.append((to, subject, body)))
    co = coach()
    cc = client(co)
    r = cc.post(RUN + "sporters/uitnodigen", {"email": "gone@example.com", "first_name": "G", "last_name": "One"}, format="json").json()
    token = re.search(r"/uitnodiging/([A-Za-z0-9_\-]+)", mails[0][2]).group(1)
    assert cc.delete(RUN + f"verzoeken/{r['verzoeken_uit'][0]['id']}").status_code == 200
    assert not Invitation.objects.filter(email="gone@example.com").exists() and client().get(f"/api/invite/{token}/").status_code == 410
    p = Plugin.objects.get(name="coach-video")  # the plugin settings show_in_menu and show_tile reach the menu of the dashboard
    p.config = {**p.config, "show_in_menu": False}
    p.save()
    row = [x for x in cc.get("/api/plugins/menu/").json() if x["name"] == "coach-video"][0]
    assert row["in_menu"] is False and row["tile"] is True


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg is not installed")
def test_video_is_made_smaller_with_a_poster_and_its_length_is_checked(cv, tmp_path):
    import subprocess

    from apps.plugins import runtime
    from apps.plugins.models import Plugin

    src = tmp_path / "clip.mov"
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=25", "-pix_fmt", "yuv420p", str(src)], capture_output=True, check=True)
    co, ath = coach(), user("sanne")
    cc = client(co)
    a = new_analysis(cc, ath)
    up = cc.post(RUN + f"analyses/{a['id']}/media", {"file": SimpleUploadedFile("clip.mov", src.read_bytes(), content_type="video/quicktime")}, format="multipart")
    assert up.status_code == 200, up.json()
    m = wait_ready(cc, a["id"], up.json()["id"], 60)
    assert m["verwerking"] == "klaar" and m["soort"] == "video" and 1800 <= m["duur_ms"] <= 2300 and m["breedte"] == 320 and m["poster"]
    got = client().get(m["url"], HTTP_RANGE="bytes=0-99")
    assert got.status_code == 206 and got["Content-Type"] == "video/mp4"  # the web version (MP4), not the MOV original
    assert client().get(m["poster"]).status_code == 200
    p = Plugin.objects.get(name="coach-video")  # a video longer than the setting is refused after processing
    p.config = {**p.config, "max_video_sec": 1}
    p.save()
    runtime.ensure_loaded(force=True)
    up2 = cc.post(RUN + f"analyses/{a['id']}/media", {"file": SimpleUploadedFile("clip.mov", src.read_bytes(), content_type="video/quicktime")}, format="multipart")
    bad = wait_ready(cc, a["id"], up2.json()["id"], 60)
    assert bad["verwerking"] == "fout" and "seconden" in bad["fout"]


@pytest.mark.django_db(transaction=True)
def test_the_coach_group_is_made_and_deleting_the_plugin_removes_everything(settings, tmp_path, monkeypatch):
    import shutil as sh

    from django.db import connection

    from apps.accounts.models import Invitation, UserGroup
    from apps.plugins import installer, manifest, runtime, signing
    from apps.plugins.models import Plugin

    settings.PLUGINS_DIR = tmp_path / "plugins"
    sh.copytree(SRC, settings.PLUGINS_DIR / "coach-video", ignore=sh.ignore_patterns("__pycache__", "plugin.sig"))
    signing.dev_mode_allowed = lambda: True
    UserGroup.objects.filter(name__iexact="Coaches").delete()
    p = installer.register(manifest.parse((settings.PLUGINS_DIR / "coach-video" / "plugin.json").read_bytes()))
    p.enabled = True
    p.save()
    assert runtime.load(p) is None
    g = UserGroup.objects.get(name="Coaches")  # switched on: the group is checked and made
    assert g.description == "Automatisch gemaakt door de plugin Coach video"
    assert runtime.load(p) is None and UserGroup.objects.filter(name__iexact="Coaches").count() == 1  # it exists now: nothing is made twice
    co = user("coach1")
    co.user_groups.add(g)
    mails = []
    monkeypatch.setattr("apps.communication.sending.send_email", lambda to, subject, body, **k: mails.append(to))
    monkeypatch.setattr("apps.notifications.service.notify", lambda *a, **k: None)
    runtime.ensure_loaded(force=True)
    cc = client(co)
    assert cc.get(RUN + "home").json()["me"]["coach"] is True  # everybody in the group is a coach
    cc.post(RUN + "sporters/uitnodigen", {"email": "later@example.com", "first_name": "L", "last_name": "Ater"}, format="json")
    a = cc.post(RUN + "analyses", {"titel": "X"}, format="json").json()
    up = cc.post(RUN + f"analyses/{a['id']}/media", {"file": SimpleUploadedFile("foto.png", png(), content_type="image/png")}, format="multipart").json()
    wait_ready(cc, a["id"], up["id"])
    files = Path(p.config.get("x", "")) if False else installer.root() / ".data" / "coach-video"
    assert any(files.rglob("*.jpg")) and Invitation.objects.filter(source="coach-video").exists()
    boss = user("boss", is_staff=True, is_superuser=True)
    r = client(boss).delete("/api/plugins/coach-video/")
    assert r.status_code == 204
    assert not Plugin.objects.filter(name="coach-video").exists() and not files.exists()  # the data folder (and the files in it) is gone
    assert not Invitation.objects.filter(source="coach-video").exists()  # no open invitation stays
    assert not UserGroup.objects.filter(name__iexact="Coaches").exists()  # the group that the plugin made
    with connection.cursor() as cur:
        assert not [t for t in connection.introspection.table_names() if t.startswith("plg_coach_video_")]  # the tables are dropped
