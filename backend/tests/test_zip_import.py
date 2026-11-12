# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The ZIP import of both routes (AI creator "ZIP-bestand inlezen" and the tab "ZIP-bestand") with the test ZIP of zipfactory.py."""
import io
import re
import zipfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core import importrules as R
from apps.core import ziprules
from tests import zipfactory as F


def _bundle():
    return ziprules.read_zip(zipfile.ZipFile(io.BytesIO(F.build())))


def _refs(files):
    """Every local picture reference in the html and css of the bundle."""
    out = set()
    for n, d in files.items():
        if n.endswith((".html", ".css")):
            t = d.decode() if isinstance(d, bytes) else d
            out |= set(re.findall(r"""(?:src|content)=["'](img/[^"'?#\s]+)""", t)) | set(re.findall(r"url\(\s*[\"']?(img/[^)\"']+)", t))
            for s in re.findall(r'srcset="([^"]+)"', t):
                out |= {p.split()[0] for p in s.split(",") if p.strip().startswith("img/")}
    return out


def test_rules_are_the_prompt_numbers():
    assert (R.MAX_PAGES, R.MAX_IMAGES, R.MAX_IMAGE_BYTES, R.NAME_MAX) == (12, 40, 5 * 2**20, 40)


def test_bundle_pages_images_and_names():
    b = _bundle()
    assert sorted(n for n in b.files if n.endswith(".html")) == ["about.html", "contact.html", "index.html"]  # en/index.html skipped
    assert any("en/index.html" in n and "overgeslagen" in n for n in b.notes)
    pics = [n for n in b.files if n.startswith("img/")]
    assert len(pics) == R.MAX_IMAGES  # 41 + 6 used pictures: the used ones first, the rest cut with a note
    assert sum("maximaal 40 afbeeldingen" in n for n in b.notes) == 7
    for n in pics:
        assert re.match(r"^img/[a-z0-9][a-z0-9_-]{0,39}\.(jpg|png|webp|svg)$", n), n
    assert all(len(n) <= len("img/") + 40 + 5 for n in pics)  # the 50-character name is renamed, not silently cut in only one place


def test_no_dead_references_and_used_pictures_kept():
    b = _bundle()
    refs = _refs(b.files)
    assert refs and refs <= set(b.files), refs - set(b.files)
    assert {"img/hero.jpg", "img/band.webp", "img/logo.svg", "img/team-foto.jpg", "img/social-kaart.png"} <= refs  # also og:image, css variable and url("")
    assert any(re.match(r"img/x{40}\.png", r) for r in refs)  # the long name, also in srcset


def test_svg_is_sanitized():
    svg = _bundle().files["img/logo.svg"].decode()
    assert "<script" not in svg and "onload" not in svg and "<circle" in svg


def test_zip_with_common_top_folder():
    b = ziprules.read_zip(zipfile.ZipFile(io.BytesIO(F.build(top="mijnsite/"))))
    assert "index.html" in b.files and "en" in b.translations


def test_translation_validation(languages):
    b = ziprules.validate_for_site(_bundle())
    assert list(b.translations) == ["en"]
    wrong = _bundle()
    wrong.translations["en"] = {**wrong.translations["en"], "bron": "de"}
    assert ziprules.validate_for_site(wrong).translations == {} and any("hoofdtaal" in n for n in wrong.notes)
    nl_only = _bundle()
    nl_only.translations["fr"] = {**nl_only.translations["en"], "doel": "fr"}
    assert "fr" not in ziprules.validate_for_site(nl_only).translations
    dirty = _bundle()
    dirty.translations["en"]["paginas"]["about.html"][2]["en"] = 'We bake <script>alert(1)</script><em>since</em> 1990 <img src=x onerror=alert(1)>'
    t = ziprules.validate_for_site(dirty).translations["en"]["paginas"]["about.html"][2]["en"]
    assert "<script" not in t and "onerror" not in t and "<em>since</em>" in t


def test_lookup_normalizes():
    from siteimport_lib import translations as TR

    lk = TR.Lookup(F.TRANSLATION and {"en": F.TRANSLATION})
    assert lk.get("en", "Elke ochtend vers uit de oven.") == "Fresh from the oven every morning."  # whitespace collapsed
    assert lk.get("en", "html:<h1>Vers brood & meer</h1>".replace("html:", "").replace("<h1>", "").replace("</h1>", "")) == "Fresh bread &amp; more"  # entities decoded
    assert lk.get("en", "Een tekst die niet vertaald is.") is None


@pytest.mark.django_db
def test_route_ai_creator(media, languages, user):
    from apps.core import sitecreator

    job = sitecreator.new_job(user, {"name": "Zon"}) if hasattr(sitecreator, "new_job") else None
    if job is None:
        from apps.core.models import SiteDesignJob

        job = SiteDesignJob.objects.create(user=user, status="draft", name="Zon", brief={"name": "Zon", "photos": []})
    job, notes = sitecreator.read_zip(job, SimpleUploadedFile("site.zip", F.build()), user)
    htmls = [n for n in job.files if n.endswith(".html")]
    assert sorted(htmls) == ["about.html", "contact.html", "index.html"]
    photos = {p["file"] for p in job.brief["photos"]}
    assert len(photos) <= R.MAX_IMAGES
    raster = {r for r in _refs(job.files) if not r.endswith(".svg")}
    assert {r.split("/")[1] for r in raster} <= photos | {"x" * 40 + ".png"}, raster - {"img/" + p for p in photos}  # no dead references
    assert "img/logo.svg" in job.files and "<script" not in job.files["img/logo.svg"]
    assert list(job.translations) == ["en"]
    assert any("heet voortaan" in n for n in notes)


@pytest.mark.django_db
def test_route_zip_tab(media, languages, user, plugin_tables):
    from siteimport_lib import importer

    imp = importer.import_zip(SimpleUploadedFile("site.zip", F.build()), "Zon", user)
    pr = imp.proposal
    paths = {"/index.html"} | {p["path"] for p in pr["pages"]}
    assert len(pr["pages"]) + 1 == 3 and paths == {"/index.html", "/about.html", "/contact.html"}  # contact.html is linked only in the footer
    assert any(p["path"] == "/contact.html" for p in pr["pages"])
    files = {a["file"] for a in pr["assets"]}
    assert any(f.endswith("hero.jpg") for f in files) and any(f.endswith("band.webp") for f in files)  # backgrounds through --hero-photo and url("")
    assert any(f.endswith(".svg") for f in files)
    assert list(pr["translations"]) == ["en"]
    assert any("en/index.html" in n for n in imp.notes)


@pytest.mark.django_db
def test_english_texts_come_from_the_file(media, languages, user, plugin_tables, monkeypatch):
    """The translation of what is in vertalingen-en.json is NOT asked from the AI; only the rest is."""
    from siteimport_lib import importer
    from siteimport_lib import translations as TR

    asked = []
    monkeypatch.setattr(importer, "_translate_chunk", lambda name, chunk: asked.append(dict(chunk)) or {k: "AI:" + v for k, v in chunk.items()})
    lookup = TR.Lookup({"en": F.TRANSLATION})
    stats = {}
    out = importer._translate_all(0, {"a": "<p>Altijd vers.</p>", "b": "<p>Een tekst die niet vertaald is.</p>", "c": "Onze broden"}, [{"code": "en", "name": "English"}], 0, 10, lookup=lookup, stats=stats, ai=True)
    assert out["en"]["a"] == "<p>Always fresh.</p>" and out["en"]["c"] == "Our breads"
    assert out["en"]["b"].startswith("<p>AI:") or "AI:" in out["en"]["b"]
    assert stats["from_file"] == 2 and stats["ai"] == 1
    sent = " ".join(v for chunk in asked for v in chunk.values())
    assert "Altijd vers" not in sent and "Onze broden" not in sent
