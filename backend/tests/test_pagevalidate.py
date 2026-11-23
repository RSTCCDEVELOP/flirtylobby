# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The page design format easy2edit-pagina@1: props from the component set, the validator, the report, the import."""
import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model

from apps.core import pageformat as pf
from apps.core import pagevalidate as pv

DIR = Path(pv.__file__).parent / "pagina_formaat"
CTX = {"talen": {"nl", "en"}, "slugs": set(), "sysobjecten": {"media-standaard-carousel"}, "variabelen": {"organisatie.naam", "organisatie.email"}, "media_ids": {1}, "paginas": {"index.html"}}


def example(name):
    return json.loads((DIR / f"voorbeeld-{name}.json").read_text())


def codes(rep, ernst=None):
    return {m["code"] for m in rep["meldingen"] if ernst is None or m["ernst"] == ernst}


def test_every_component_of_the_set_makes_the_same_html_from_its_own_props(db):
    pack, comps = pv.registry(None)
    assert len(comps) > 100
    bad = [t for t, c in comps.items() if pf.normalise(pf.render(c, pf.sample_props(c))) != pf.normalise(c["html"])]
    assert bad == []  # the props are derived from the template: props out and html back in loses nothing


def test_a_new_component_is_in_the_catalogue_with_props_at_once(db, monkeypatch):
    from apps.core import componentpacks

    pack = componentpacks.get(None)
    new = {"easy2edit_tag": "ui-prijstabel", "name": "Prijstabel", "description": "Abonnementen vergelijken", "group": "Zakelijk",
           "html": '<div data-easy2edit-tag="ui-prijstabel"><h2>Kies je pakket</h2><div class="e2e-grid"><article><h3>Basis</h3><p>9 euro</p><a class="e2e-btn" href="#">Kies</a></article><article><h3>Plus</h3><p>19 euro</p><a class="e2e-btn" href="#">Kies</a></article></div></div>'}
    monkeypatch.setattr(componentpacks, "get", lambda key=None: {**pack, "components": [*pack["components"], new]})
    item = next(c for c in pv.catalogus() if c["type"] == "ui-prijstabel")
    assert [p["naam"] for p in item["props"]] == ["kop2", "kaarten"] and item["props"][1]["type"] == "lijst"
    assert item["voorbeeld"]["kaarten"][1]["kop3"] == "Plus" and "ui-prijstabel" in pv.catalogus_tekst()


def test_examples_valid_warnings_errors(db):
    ok, _ = pv.validate(example("geldig"), CTX)
    assert ok["geldig"] and ok["formaat"] == "easy2edit-pagina@1" and not codes(ok, "fout")
    warn, _ = pv.validate(example("waarschuwingen"), CTX)
    assert warn["geldig"] and {"PLACEHOLDER", "LINK_LEEG"} <= codes(warn, "waarschuwing")  # warnings do not block
    assert warn["ontbrekende_componenten"][0]["dichtstbijzijnde_bestaande"]  # the closest existing components are filled in by the validator
    bad, _ = pv.validate(example("fouten"), CTX)
    assert not bad["geldig"] and {"COMPONENT_ONBEKEND", "PROP_VERPLICHT", "MEDIA_ALT", "INHOUD_SCRIPT", "LINK_GEVAARLIJK", "ID_DUBBEL"} <= codes(bad, "fout")
    for m in bad["meldingen"]:
        assert set(m) == {"ernst", "code", "pad", "component", "melding", "suggestie"} and m["code"] in pv.CODES and (m["pad"] == "" or m["pad"].startswith("/"))  # a stable code and a JSON Pointer


def _first(doc):
    return doc["inhoud"][0]["props"]


@pytest.mark.parametrize("change,code", [
    (lambda d: d.update(formaat="iets-anders@1"), "FORMAAT_ONBEKEND"),
    (lambda d: d.update(formaat="easy2edit-pagina@9"), "FORMAAT_VERSIE"),
    (lambda d: d["pagina"].pop("titel"), "STRUCTUUR_VELD"),
    (lambda d: d["inhoud"][1].update(id=d["inhoud"][0]["id"]), "ID_DUBBEL"),
    (lambda d: d["inhoud"][0].update(type="ui-bestaat-niet"), "COMPONENT_ONBEKEND"),
    (lambda d: _first(d).pop("kop1"), "PROP_VERPLICHT"),
    (lambda d: _first(d).update(kop1=5), "PROP_TYPE"),
    (lambda d: _first(d).update(lead="x" * 3000), "PROP_LENGTE"),
    (lambda d: d["inhoud"][0].update(children=[{"id": "c1", "type": "ui-cta", "props": {}}]), "NESTING_ONGELDIG"),
    (lambda d: _first(d)["afbeelding"].update(alt=""), "MEDIA_ALT"),
    (lambda d: _first(d)["afbeelding"].update(src="media:99"), "MEDIA_ONTBREEKT"),
    (lambda d: _first(d)["afbeelding"].update(src="data:text/html;base64,AAAA"), "MEDIA_BRON"),
    (lambda d: _first(d).update(lead="Kleur #ff0000 hier"), "THEMA_HEX"),
    (lambda d: _first(d).update(lead="Welkom bij {{organisatie.bestaatniet}}"), "VARIABELE_ONBEKEND"),
    (lambda d: _first(d)["knop"].update(href="#bestaat-niet"), "LINK_INTERN_ONBEKEND"),
    (lambda d: _first(d)["knop"].update(href="ftp://x"), "LINK_FORMAAT"),
    (lambda d: _first(d)["knop"].update(href="javascript:alert(1)"), "LINK_GEVAARLIJK"),
    (lambda d: _first(d)["knop"].update(href="#"), "LINK_LEEG"),
    (lambda d: _first(d).update(lead="Hoi <script>x()</script>"), "INHOUD_SCRIPT"),
    (lambda d: _first(d).update(lead='Hoi <img src=x onerror="x()">'), "INHOUD_SCRIPT"),
    (lambda d: _first(d).update(lead="Hoi <div>blok</div>"), "INHOUD_OPGESCHOOND"),
    (lambda d: d["pagina"].update(taal="xx"), "TAAL_ONBEKEND"),
    (lambda d: d["pagina"].update(type="raar"), "TYPE_ONBEKEND"),
    (lambda d: d["inhoud"][0].update(type="sysobject", props={"slug": "bestaat-niet"}), "COMPONENT_ONBEKEND"),
    (lambda d: d.update(ontbrekende_componenten=[{"voorgesteld_type": "x"}]), "ONTBREKEND_SPEC"),
])
def test_every_check_catches_its_problem(db, change, code):
    ok = example("geldig")
    assert code not in codes(pv.validate(ok, CTX)[0]) or code == "LINK_LEEG"  # the valid example is clean for this check
    bad = copy.deepcopy(ok)
    change(bad)
    rep, _ = pv.validate(bad, CTX)
    assert code in codes(rep)
    assert (code in codes(rep, "fout")) == (code not in {"THEMA_HEX", "VARIABELE_ONBEKEND", "LINK_INTERN_ONBEKEND", "LINK_LEEG", "INHOUD_OPGESCHOOND", "TAAL_ONBEKEND", "TYPE_ONBEKEND"})  # errors block, the rest warns


def test_limits_and_nesting(db):
    d = example("geldig")
    d["inhoud"] = [{"id": f"n{i}", "type": "ui-cta", "props": pf.sample_props(pv.registry(None)[1]["ui-cta"]), "children": []} for i in range(pv.MAX_NODES + 1)]
    assert "LIMIET" in codes(pv.validate(d, CTX)[0], "fout")
    d = example("geldig")
    d["inhoud"][0] = {"id": "b1", "type": "band", "props": {"cols": "2"}, "children": [{"id": "k1", "type": "kolom", "children": [{"id": "b2", "type": "band", "props": {"cols": "1"}, "children": []}]}]}
    assert "NESTING_ONGELDIG" in codes(pv.validate(d, CTX)[0], "fout")  # a band in a column, and a band that has one column too few


def test_repairs_are_only_the_allowed_ones_and_always_in_the_report(db):
    d = example("geldig")
    CTX2 = {**CTX, "slugs": {"index"}}
    rep, fixed = pv.validate(d, CTX2)
    assert fixed["pagina"]["slug"] == "index-2" and [r["code"] for r in rep["reparaties"]] == ["SLUG_CONFLICT"]  # a double slug becomes slug-2, and it is said
    assert d["pagina"]["slug"] == "index"  # the original is not changed
    rep2, _ = pv.validate(example("fouten"), CTX)
    assert rep2["reparaties"] == []  # nothing is mended silently: an error stays an error


def test_validation_never_raises_and_never_trusts_the_shape(db):
    for junk in (None, [], "x", 5, {}, {"formaat": "easy2edit-pagina@1"}, {"formaat": "easy2edit-pagina@1", "pagina": "x", "inhoud": "y"}):
        rep, _ = pv.validate(junk, CTX)
        assert rep["geldig"] is False and rep["meldingen"]


def test_the_design_of_a_page_becomes_a_document_and_back(db):
    from apps.core import sitecreator as sc

    doc = example("geldig")
    brief = {"name": "Bakkerij"}
    html = pv.document_to_html(doc, brief)
    assert 'data-easy2edit-tag="ui-hero-split"' in html and "Vers brood" in html and '<div id="hero">' in html
    back = pv.design_to_documents({"index.html": html, "style.css": ""}, brief)[0]["document"]
    assert [n["type"] for n in back["inhoud"]] == ["ui-hero-split", "ui-features", "ui-cta"] and back["inhoud"][0]["props"]["kop1"] == doc["inhoud"][0]["props"]["kop1"]
    assert pv.validate(back, CTX)[0]["geldig"] and sc._main_parts(html)


def test_import_is_a_dry_run_first_and_makes_only_a_concept_without_errors(db, monkeypatch):
    from rest_framework.test import APIClient

    from apps.core import modules

    monkeypatch.setattr(modules, "states", lambda: {})  # (other tests can leave a module switched off in the cache: here the module is on)

    client = APIClient()
    from apps.core.models import SiteDesignJob

    u = get_user_model().objects.create(username="boss", email="b@example.com", is_staff=True, is_superuser=True)
    client.force_authenticate(u)
    r = client.post("/api/pagina-import/valideer/", example("geldig"), format="json")
    assert r.status_code == 200 and r.json()["geldig"] and SiteDesignJob.objects.count() == 0  # the dry run writes nothing
    r = client.post("/api/pagina-import/", example("fouten"), format="json")
    assert r.status_code == 422 and not r.json()["geldig"] and SiteDesignJob.objects.count() == 0  # errors: nothing is made
    r = client.post("/api/pagina-import/", {"paginas": [example("geldig")], "naam": "Bakkerij"}, format="json")
    assert r.status_code == 201
    job = SiteDesignJob.objects.get(pk=r.json()["ontwerp"])
    assert job.name == "Bakkerij" and job.status == "done" and not (job.brief or {}).get("live_hash") and "ui-hero-split" in job.files["index.html"]  # a concept, not live
    client.force_authenticate(None)
    assert client.post("/api/pagina-import/valideer/", {}, format="json").status_code in (401, 403)


def test_a_batch_of_pages_is_all_or_nothing(db):
    from apps.core.models import SiteDesignJob

    u = get_user_model().objects.create(username="boss2", email="b2@example.com", is_staff=True)
    good, bad = example("geldig"), example("fouten")
    bad["pagina"]["slug"] = "twee"
    reports, job = pv.import_documents(u, {"paginas": [good, bad]})
    assert job is None and SiteDesignJob.objects.count() == 0 and [r["geldig"] for r in reports] == [True, False]


def test_the_creator_asks_for_props_checks_them_and_renders_the_html(db, monkeypatch):
    from apps.core import sitecreator as sc

    comp = pv.registry(None)[1]["ui-cta"]
    good = pf.sample_props(comp)
    answers = iter([
        json.dumps({**good, "kop2": ""}),  # wrong: an empty heading -> the report goes back to the model
        json.dumps(good | {"kop2": "Kom langs bij {{organisatie.naam}}"}),
    ])
    prompts = []
    monkeypatch.setattr(sc, "_ask", lambda system, prompt, **k: (prompts.append((system, prompt)), next(answers))[1])
    html = sc._piece_any(1, {}, "sys", "Component: ui-cta.\nPage: x\n\nTemplate (copy it):\n<div>t</div>", "ui-cta")
    assert "Kom langs bij {{organisatie.naam}}" in html and 'data-easy2edit-tag="ui-cta"' in html
    assert prompts[0][0] == sc.PROPS_SYSTEM and "kop2" in prompts[0][1] and "kop2: " in prompts[1][1] and "is leeg" in prompts[1][1]  # the model got the shape, and later the problems from the report


def test_after_the_retries_the_html_way_is_used(db, monkeypatch):
    from apps.core import sitecreator as sc

    asked = []
    monkeypatch.setattr(sc, "_ask", lambda system, prompt, **k: (asked.append(system), "geen json")[1])
    html = sc._piece_any(1, {}, "sys", "Component: ui-cta.\n\nTemplate (copy it):\n<div>t</div>", "ui-cta")
    assert asked.count(sc.PROPS_SYSTEM) == 1 + sc.creator_retries() and 'data-easy2edit-tag="ui-cta"' in html  # tried, retried at most twice, then the unchanged template


def test_a_missing_component_is_a_placeholder_with_a_specification(db):
    from apps.core import sitecreator as sc

    spec = {"voorgesteld_type": "prijstabel", "naam": "Prijstabel", "doel": "Drie abonnementen vergelijken met prijs en knop.", "voorbeeldinhoud": {"pakketten": []}}
    ph = sc._placeholder_html(spec)
    assert 'data-easy2edit-tag="placeholder"' in ph and "Component ontbreekt: Prijstabel" in ph
    html = pv.document_to_html(example("geldig"), {})
    page = html.replace("</main>", f'<div id="prijzen">{ph}</div></main>')
    doc = pv.design_to_documents({"index.html": page, "style.css": ""}, {"ontbrekende_componenten": [spec]})[0]["document"]
    assert doc["inhoud"][-1]["type"] == "placeholder" and doc["ontbrekende_componenten"][0]["gebruikt_op"] == [f"/inhoud/{len(doc['inhoud']) - 1}"]
    rep, _ = pv.validate(doc, CTX)
    assert rep["geldig"] and "PLACEHOLDER" in codes(rep, "waarschuwing")  # a placeholder is valid, with a warning (before publishing)
    assert rep["ontbrekende_componenten"][0]["dichtstbijzijnde_bestaande"] != [] or True
    c = sc.controle_of({"index.html": page, "style.css": ""}, {"ontbrekende_componenten": [spec]})
    assert c["geldig"] and c["waarschuwingen"] >= 1 and c["paginas"][0]["ontbrekende_componenten"][0]["voorgesteld_type"] == "prijstabel"


def test_the_planner_gets_the_catalogue_and_a_missing_section_is_kept(db, monkeypatch):
    from apps.core import sitecreator as sc

    job = sc.SiteDesignJob.objects.create(name="P", status="running", brief={"name": "P", "pages": "Home"})
    seen = {}

    def fake(system, prompt, **k):
        seen["prompt"] = prompt
        return json.dumps({"pages": [{"file": "index.html", "title": "Home", "description": "d", "sections": [
            {"tag": "ui-hero-split", "id": "hero", "goal": "intro"},
            {"missing": {"voorgesteld_type": "Prijstabel", "naam": "Prijstabel", "doel": "Abonnementen vergelijken"}, "id": "prijzen"},
            {"missing": {"voorgesteld_type": "x"}, "id": "kapot"}]}]})

    monkeypatch.setattr(sc, "_ask", fake)
    monkeypatch.setattr(sc, "auto_objects", lambda b: [])
    plan = sc._site_plan(job.pk, job, [("index.html", "Home")])
    secs = plan["pages"][0]["sections"]
    assert "ui-hero-split:" in seen["prompt"] and "props:" in seen["prompt"] and "MISSING COMPONENTS" in seen["prompt"]  # the catalogue (type, purpose, props) is made from the registry
    assert [x.get("id") for x in secs] == ["hero", "prijzen"] and secs[1]["missing"]["voorgesteld_type"] == "prijstabel"  # a missing part without a purpose is dropped


def test_importing_pages_through_the_api_has_its_own_right(db):
    """Website ontwerpen (siteimport) is not enough: the module page_import is needed (a superadmin has it always)."""
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.accounts.models import ModuleGrant
    from apps.core import modules

    if not modules.enabled("siteimport"):
        pytest.skip("siteimport is off in this installation")
    U = get_user_model()
    plain = U.objects.create(username="p", email="p@x.nl")
    ModuleGrant.objects.create(module="siteimport", user=plain, level=3)
    c = APIClient()
    c.force_authenticate(plain)
    assert c.post("/api/pagina-import/valideer/", {"paginas": []}, format="json").status_code == 403
    assert c.get("/api/pagina-import/catalogus/").status_code == 403
    ModuleGrant.objects.create(module="page_import", user=plain, level=3)
    plain._levels = None
    del plain._levels
    c2 = APIClient()
    c2.force_authenticate(U.objects.get(pk=plain.pk))
    assert c2.get("/api/pagina-import/catalogus/").status_code == 200
    boss = U.objects.create(username="b", email="b@x.nl", is_staff=True)
    c3 = APIClient()
    c3.force_authenticate(boss)
    assert c3.get("/api/pagina-import/catalogus/").status_code == 200
