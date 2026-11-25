# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The creator does not make the same design every time: more heroes in the component set and a design direction per website."""
import random

import pytest

from apps.core import componentpacks, pageformat as pf, sitecreator as sc

NEW_HEROES = ["ui-hero-image", "ui-hero-image-center", "ui-hero-card", "ui-hero-collage", "ui-hero-type", "ui-hero-wide", "ui-hero-split-reverse"]


@pytest.mark.django_db
def test_the_standard_set_has_the_new_heroes_with_picture_places():
    comps = {c["easy2edit_tag"]: c for c in componentpacks.get("easy2edit-ui-kit")["components"]}
    for tag in NEW_HEROES:
        assert tag in comps, tag
        assert comps[tag]["category"] == "Hero"
    for tag in ("ui-hero-image", "ui-hero-card", "ui-hero-wide", "ui-hero-split-reverse", "ui-hero-collage"):
        kinds = [str(getattr(sl, "kind", sl.get("kind") if isinstance(sl, dict) else sl)) for sl in pf.schema_of(comps[tag])["slots"]]
        assert any("afbeelding" in k for k in kinds), (tag, kinds)


@pytest.mark.django_db
def test_every_direction_only_names_heroes_of_the_set():
    tags = {c["easy2edit_tag"] for c in componentpacks.get("easy2edit-ui-kit")["components"]}
    for key, d in sc.DIRECTIONS.items():
        assert d["heroes"] and all(h in tags for h in d["heroes"]), key


def test_a_direction_is_chosen_by_the_customer_or_varies_with_the_kind():
    assert sc.pick_direction({"hero_style": "editorial"}) == "editorial"
    seen = {sc.pick_direction({"kind": "blog"}, random.Random(i)) for i in range(60)}
    assert len(seen) >= 2 and seen <= set(sc.DIRECTIONS)
    assert "editorial" in seen
    assert sc.hero_key("Donker en krachtig") == "bold" and sc.hero_key("Laat de ontwerper kiezen") == "auto" and sc.hero_key("onzin") == ""


@pytest.mark.django_db
def test_the_questionnaire_always_asks_for_the_look_of_the_opening():
    qs = sc._with_installation([{"id": "name", "q": "Naam?", "type": "text"}], {"kind": "company"}, [])
    q = next(x for x in qs if x["id"] == sc.HERO_QID)
    assert q["options"] == list(sc.HERO_OPTIONS.values()) and q["default"] == sc.HERO_OPTIONS["auto"]


@pytest.mark.django_db
def test_the_brief_carries_the_direction_to_every_prompt():
    b = sc.clean_brief({"hero_style": "photo"}, {"name": "X"})
    assert b["hero_style"] == "photo" and sc.clean_brief({"hero_style": "nope"}, {})["hero_style"] == ""
    assert "DESIGN DIRECTION" in sc._brief_text(b) and "ui-hero-image" in sc._brief_text(b)


def _pdf(text):
    """A one page pdf with a line of text (made by hand, so the test needs no extra library)."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offs)
    return out + f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()


@pytest.mark.django_db
def test_a_pdf_in_the_chat_goes_to_the_designer_and_the_questions_come_from_it(django_user_model, monkeypatch):
    from django.core.files.uploadedfile import SimpleUploadedFile

    from apps.core.models import SiteDesignJob

    u = django_user_model.objects.create_user("up", "up@x.nl", "pw12345678!", is_staff=True)
    job = SiteDesignJob.objects.create(user=u, name="Nieuw ontwerp", status="done", brief={"name": "Nieuw ontwerp"})
    up = sc.add_upload(job, SimpleUploadedFile("plan.pdf", _pdf("Bakkerij De Gouden Korst in Zwolle verkoopt brood en taart"), content_type="application/pdf"))
    assert up[0]["name"] == "plan.pdf" and up[0]["pages"] == 1
    job.refresh_from_db()
    assert "Gouden Korst" in sc.uploads_text(job.brief) and "Gouden Korst" in sc._brief_text(job.brief)
    assert "text" not in sc.public(job)["brief"]["uploads"][0]  # the text itself does not go to the screen
    with pytest.raises(ValueError):
        sc.add_upload(job, SimpleUploadedFile("x.docx", b"x"))  # only pdf (pictures go with the message)
    monkeypatch.setattr(sc.ai, "available", lambda *a, **k: True)
    monkeypatch.setattr(sc, "_spawn", lambda *a, **k: None)
    sc.chat(job, "Maak een vragenlijst", None, "en")
    job.refresh_from_db()
    assert job.brief["prefill"] is True and job.brief["ui_lang"] == "en"  # no question about assumptions first: the questionnaire is made from the material
    assert not any(m.get("ask") == "prefill" for m in job.messages)
    assert sc.remove_upload(job, up[0]["id"]) == []


@pytest.mark.django_db
def test_the_pictures_in_a_pdf_go_to_the_designer_too(django_user_model, monkeypatch):
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    from apps.core.models import SiteDesignJob

    buf = io.BytesIO()
    Image.effect_noise((600, 400), 80).convert("RGB").save(buf, "PDF")  # a scan: a PDF that is only a picture, no text
    u = django_user_model.objects.create_user("up2", "up2@x.nl", "pw12345678!", is_staff=True)
    job = SiteDesignJob.objects.create(user=u, name="Nieuw ontwerp", status="done", brief={"name": "Nieuw ontwerp"})
    up = sc.add_upload(job, SimpleUploadedFile("scan.pdf", buf.getvalue(), content_type="application/pdf"))
    assert up[0]["images"] == 1  # accepted although it has no text: the picture is what the designer reads
    job.refresh_from_db()
    assert len(sc.upload_shots(job.brief)) == 1
    seen = {}
    monkeypatch.setattr(sc.ai, "available", lambda *a, **k: True)
    monkeypatch.setattr(sc, "_spawn", lambda fn, *a, **k: seen.update(args=a))
    sc.chat(job, "Maak een vragenlijst", None, "nl")
    assert len(seen["args"][3]) == 1 and seen["args"][3][0][0] == "image/jpeg"  # (pk, text, has, shots)
    sc.remove_upload(job, up[0]["id"])
    job.refresh_from_db()
    assert not job.brief["uploads"]
