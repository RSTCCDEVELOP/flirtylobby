# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Notes on users and companies: text and files, internal or visible for the user, private files."""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.core.models import Entity, Note, NoteFile


def _png():
    from PIL import Image

    b = io.BytesIO()
    Image.new("RGB", (4, 4), (200, 30, 30)).save(b, "PNG")
    return b.getvalue()


@pytest.fixture
def people(django_user_model, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    boss = django_user_model.objects.create_user("bo", "bo@x.nl", "pw12345678!", is_staff=True)
    sanne = django_user_model.objects.create_user("sa", "sa@x.nl", "pw12345678!")
    other = django_user_model.objects.create_user("ot", "ot@x.nl", "pw12345678!")
    ent = Entity.objects.create(kind="bedrijf", is_own=False, name="Shop BV")
    ent.users.add(sanne)
    c, s, o = APIClient(), APIClient(), APIClient()
    c.force_authenticate(boss); s.force_authenticate(sanne); o.force_authenticate(other)
    return boss, sanne, ent, c, s, o


@pytest.mark.django_db
def test_notes_are_made_by_administrators_only_and_are_internal_by_default(people):
    boss, sanne, ent, c, s, o = people
    r = c.post("/api/notes/", {"kind": "user", "id": sanne.pk, "title": "Gesprek", "body": "html:<p>Hoi <script>x</script><b>wereld</b></p>"}, format="json")
    assert r.status_code == 201 and r.json()["visible"] is False and "<script" not in r.json()["body"] and "<b>wereld</b>" in r.json()["body"]
    assert s.post("/api/notes/", {"kind": "user", "id": sanne.pk, "title": "x"}, format="json").status_code == 403  # the user cannot make notes on himself
    assert s.get(f"/api/notes/?kind=user&id={sanne.pk}").status_code == 403
    assert c.get("/api/notes/?kind=user&id=99999").status_code == 404
    assert c.post("/api/notes/", {"kind": "vreemd", "id": 1}, format="json").status_code == 403
    assert [n["title"] for n in c.get(f"/api/notes/?kind=user&id={sanne.pk}").json()["notes"]] == ["Gesprek"]


@pytest.mark.django_db
def test_only_visible_notes_reach_the_user_and_the_people_of_the_company(people):
    boss, sanne, ent, c, s, o = people
    intern = c.post("/api/notes/", {"kind": "user", "id": sanne.pk, "title": "Intern"}, format="json").json()
    zicht = c.post("/api/notes/", {"kind": "user", "id": sanne.pk, "title": "Voor jou", "visible": True}, format="json").json()
    bedr = c.post("/api/notes/", {"kind": "entity", "id": ent.pk, "title": "Voor het bedrijf", "visible": True}, format="json").json()
    c.post("/api/notes/", {"kind": "entity", "id": ent.pk, "title": "Intern bedrijf"}, format="json")
    mine = s.get("/api/notes/mine/").json()["notes"]
    assert sorted(n["title"] for n in mine) == ["Voor het bedrijf", "Voor jou"] and "by" not in mine[0]
    assert [n["about"] for n in mine if n["title"] == "Voor het bedrijf"] == ["Shop BV"]
    assert o.get("/api/notes/mine/").json()["notes"] == []  # nobody else
    # a note is made visible or internal again
    assert c.patch(f"/api/notes/{zicht['id']}/", {"visible": False}, format="json").json()["visible"] is False
    assert [n["title"] for n in s.get("/api/notes/mine/").json()["notes"]] == ["Voor het bedrijf"]
    assert c.patch(f"/api/notes/{intern['id']}/", {"title": "Intern 2", "visible": True}, format="json").json()["title"] == "Intern 2"


@pytest.mark.django_db
def test_files_are_private_checked_and_given_out_only_to_the_right_people(people):
    boss, sanne, ent, c, s, o = people
    n = c.post("/api/notes/", {"kind": "user", "id": sanne.pk, "title": "Met bestanden", "visible": True}, format="json").json()
    r = c.post(f"/api/notes/{n['id']}/files/", {"files": [SimpleUploadedFile("foto.png", _png(), "image/png"), SimpleUploadedFile("offerte.pdf", b"%PDF-1.4 x", "application/pdf"),
                                                          SimpleUploadedFile("film.mp4", b"\x00\x00\x00\x18ftypmp42", "video/mp4"), SimpleUploadedFile("kwaad.exe", b"MZ", "application/octet-stream"),
                                                          SimpleUploadedFile("kapot.png", b"geen plaatje", "image/png")]}, format="multipart")
    assert r.status_code == 201
    kinds = {f["name"]: f["kind"] for f in r.json()["files"]}
    assert kinds == {"foto.png": "image", "offerte.pdf": "document", "film.mp4": "video"} and len(r.json()["errors"]) == 2  # the .exe and the broken picture are refused
    fid = {f["name"]: f["id"] for f in r.json()["files"]}
    img = s.get(f"/api/notes/files/{fid['foto.png']}/")  # the user reads his visible note
    assert img.status_code == 200 and img["Content-Type"] == "image/png" and "inline" in img["Content-Disposition"] and img["X-Content-Type-Options"] == "nosniff"
    assert "attachment" in s.get(f"/api/notes/files/{fid['offerte.pdf']}/")["Content-Disposition"]
    assert o.get(f"/api/notes/files/{fid['foto.png']}/").status_code == 404  # another user
    assert APIClient().get(f"/api/notes/files/{fid['foto.png']}/").status_code in (401, 403)
    c.patch(f"/api/notes/{n['id']}/", {"visible": False}, format="json")
    assert s.get(f"/api/notes/files/{fid['foto.png']}/").status_code == 404  # internal again: the file is closed too
    assert c.get(f"/api/notes/files/{fid['foto.png']}/").status_code == 200
    assert s.delete(f"/api/notes/files/{fid['foto.png']}/").status_code == 403 and c.delete(f"/api/notes/files/{fid['foto.png']}/").json() == {"ok": True}
    assert NoteFile.objects.filter(note_id=n["id"]).count() == 2


@pytest.mark.django_db
def test_notes_go_with_the_user_or_company_and_a_note_can_be_deleted(people, django_user_model):
    boss, sanne, ent, c, s, o = people
    n = c.post("/api/notes/", {"kind": "entity", "id": ent.pk, "title": "x"}, format="json").json()
    c.post(f"/api/notes/{n['id']}/files/", {"files": [SimpleUploadedFile("a.txt", b"hoi", "text/plain")]}, format="multipart")
    assert c.delete(f"/api/notes/{n['id']}/").json() == {"ok": True} and Note.objects.count() == 0 and NoteFile.objects.count() == 0
    c.post("/api/notes/", {"kind": "user", "id": sanne.pk, "title": "y"}, format="json")
    sanne.delete()
    assert Note.objects.count() == 0
