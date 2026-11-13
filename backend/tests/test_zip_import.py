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


HERO_CSS = """:root{--dark-band:#0b1220}
.hero-bg{background-color:var(--dark-band);background-size:cover;background-image:linear-gradient(90deg,color-mix(in srgb,var(--dark-band) 90%,transparent) 0%,color-mix(in srgb,var(--dark-band) 72%,transparent) 100%),var(--hero-photo)}
@media (max-width:760px){.hero-bg{background-image:linear-gradient(color-mix(in srgb,var(--dark-band) 86%,transparent),color-mix(in srgb,var(--dark-band) 86%,transparent)),var(--hero-photo)}}
.hero-home{--hero-photo:url(img/home.jpg)}
.hero-faq{--hero-photo:url(img/faq.jpg)}
.plain{background:#fff}"""


def test_hero_background_through_a_variable_on_another_class():
    """The picture of a hero: several layers (a gradient made of colour variables, then var(--hero-photo)), the variable defined on another class, a different picture per page."""
    from siteimport_lib.importer import mark_backgrounds

    from apps.core.webtoolkit import find, parse_html

    for cls, want in (("hero-home", "img/home.jpg"), ("hero-faq", "img/faq.jpg")):
        root = parse_html(f'<main><section id="hero" class="band-dark hero-bg {cls}"><h1>Hallo</h1></section><section class="plain"><p>x</p></section></main>')
        mark_backgrounds(root, HERO_CSS)
        secs = find(root, "section")
        assert secs[0].attrs.get("data-e2e-bg") == want
        assert not secs[1].attrs.get("data-e2e-bg")  # a plain colour is not a picture


def test_ai_gets_the_background_picture_of_a_section():
    from siteimport_lib.importer import _compact, mark_backgrounds

    from apps.core.webtoolkit import find, parse_html

    root = parse_html('<main><section id="hero" class="hero-bg hero-home"><h1>Hallo</h1></section></main>')
    mark_backgrounds(root, HERO_CSS.replace("img/home.jpg", "__MEDIA__/img/home.jpg"))
    assert 'data-bg="IMG:0"' in _compact(find(root, "main")[0], {"img/home.jpg": 0})


def test_pages_that_are_not_ticked_are_not_made():
    from apps.core import sitecreator

    b = {"pages": "Home, Over ons, Contact, FAQ", "pages_off": ["Contact", "Home"]}  # (the start page cannot be left out)
    assert [t for _f, t in sitecreator.pages_of(b)] == ["Home", "Over ons", "FAQ"]
    assert [f for f, _t in sitecreator.pages_of(b)][0] == "index.html"
    assert sitecreator.clean_brief({"pages_off": ["Contact", "", 5]}, {"pages": "Home"})["pages_off"] == ["Contact", "5"]


def test_screenshots_in_the_zip_are_kept_as_reference():
    import zipfile

    from apps.core import importrules as R2

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("index.html", "<html><body><main><h1>Hoi</h1></main></body></html>")
        z.writestr("style.css", "body{}")
        z.writestr("screenshots/index.png", F._img("PNG"))  # too small: the importer wants a real screenshot
        big = io.BytesIO()
        from PIL import Image

        Image.new("RGB", (1440, 2000), (240, 240, 240)).save(big, "PNG")
        z.writestr("screenshots/over-ons.png", big.getvalue())
        z.writestr("screenshots/over-ons-mobile.png", big.getvalue())  # not needed
        z.writestr("screenshots/diep/x.png", big.getvalue())  # only the folder itself is read
    b = ziprules.read_zip(zipfile.ZipFile(io.BytesIO(buf.getvalue())))
    assert list(b.screenshots) == ["over-ons"] and len(b.screenshots["over-ons"]) > 100
    assert any("te smal" in n for n in b.notes) and R2.SCREENSHOT_FOLDER == "screenshots"
    assert not any(n.startswith("screenshots/") for n in b.files)  # (they are not pictures of the website)


def test_css_facts_of_a_hero_and_a_card():
    """The real values: variables, color-mix, the gradient over a picture, a shorthand that overrides a longhand, descendant selectors, desktop @media."""
    from siteimport_lib import cssfacts as C

    from apps.core.webtoolkit import find, parse_html

    css = """:root{--dark:#0b1220;--text:#222222;--card:#ffffff}
    section{background-color:#eeeeee;color:var(--text);padding:4rem 0}
    .band-dark{background:var(--dark);color:#f5e6d8}
    .hero-bg{background-image:linear-gradient(90deg,color-mix(in srgb,var(--dark) 90%,transparent),color-mix(in srgb,var(--dark) 70%,transparent)),var(--hero-photo);padding:6rem 0}
    .hero-home{--hero-photo:url(img/home.jpg)}
    @media (max-width:760px){.hero-bg{padding:2rem 0}}
    .card{background:var(--card);border-radius:14px;padding:1.5rem}
    .band-dark .card{background:color-mix(in srgb,#ffffff 8%,var(--dark))}
    h1{font-size:3.4rem;color:inherit}"""
    rules = C.parse_rules(css)
    root = parse_html('<main><section id="hero" class="band-dark hero-bg hero-home"><h1>Hoi</h1><div class="card"><p>x</p></div></section><section id="b"><div class="card">y</div></section></main>')
    hero, plain = find(root, "section")
    f = C.section_facts(hero, rules)
    s = f["section"]
    assert s["bg"] == "#0b1220" and s["image"] == "img/home.jpg" and s["overlay"] == "#0b1220" and 0.78 <= s["overlay_opacity"] <= 0.82  # (the shorthand wins over the colour of `section`)
    assert s["pad_top_px"] == 96 and s["color"] == "#f5e6d8"  # (the mobile rule is not used)
    assert f["elements"]["h1"]["color"] == "#f5e6d8" and f["elements"]["h1"]["font-size"] == "3.4rem"
    assert f["elements"]["div.card"]["bg"] == C.fmt_color(C._mix("in srgb, #ffffff 8%, #0b1220"))  # a card on a dark band
    assert C.section_facts(plain, rules)["elements"]["div.card"]["bg"] == "#ffffff"  # the same class on a light band


def test_css_facts_of_every_page_of_a_real_design():
    from pathlib import Path

    from siteimport_lib import cssfacts as C

    from apps.core.webtoolkit import find, parse_html

    d = Path.home() / "Desktop" / "easy2edit-demo"
    if not (d / "style.css").is_file():
        pytest.skip("the example design is not on this machine")
    rules = C.parse_rules((d / "style.css").read_text())
    for f in d.glob("*.html"):
        for sec in find(parse_html(f.read_text()), "section"):
            facts = C.section_facts(sec, rules)
            assert facts["section"].get("color")  # every section has a text colour and the facts stay small
            assert len(str(facts)) < 14000


def test_a_section_the_ai_cannot_build_is_taken_over_exactly():
    """The last resort for a section: its own html and the css that applies to it as one code block (not a plain text block)."""
    from siteimport_lib import cssfacts as C
    from siteimport_lib.importer import _exact_rows

    from apps.core.webtoolkit import find, parse_html

    css = ":root{--c:#0b1220}.band{background:var(--c);color:#fff;padding:4rem 0}.pc{border:1px solid #fff;border-radius:14px}.other{color:red}"
    root = parse_html('<main><section id="showcase" class="band"><div class="pc"><img src="__MEDIA__/themes/x/img/a.jpg" alt="A"><h3>Titel</h3><script>alert(1)</script></div></section></main>')
    sec = find(root, "section")[0]
    p = {"secs": [sec], "imgs": {"themes/x/img/a.jpg": 3}, "rules": C.parse_rules(css)}
    rows = _exact_rows(p, 0)
    item = rows[0]["cells"][0]["items"][0]
    assert item["type"] == "code" and 'class="band"' in item["html"] and 'src="IMG:3"' in item["html"] and "<script" not in item["html"] and "Titel" in item["html"]
    assert ".band{" in item["css"] and ".pc{" in item["css"] and ":root{--c:#0b1220}" in item["css"] and ".other" not in item["css"]  # only what applies to this section
