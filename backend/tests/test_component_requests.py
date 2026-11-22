# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Components on request: the choices for a missing component, the request with duplicate check, the judgement, the building instruction and the designs that wait."""
import pytest
from django.contrib.auth import get_user_model

from apps.core import componentrequests as cr
from apps.core import pagevalidate as pv
from apps.core import sitecreator as sc
from apps.core.models import ComponentRequest, EasySite, SiteDesignJob

SPEC = {"voorgesteld_type": "tijdlijn-pro", "naam": "Tijdlijn Pro", "doel": "Mijlpalen van het bedrijf verticaal tonen met jaartal, titel en tekst.", "voorgestelde_props": [{"naam": "mijlpalen", "type": "lijst", "verplicht": True}],
        "voorbeeldinhoud": {"mijlpalen": [{"jaar": "1987"}]}}


@pytest.fixture
def design(db):
    u = get_user_model().objects.create(username="o", email="o@x.nl", is_staff=True)
    html = pv.document_to_html({"formaat": "easy2edit-pagina@1", "pagina": {"titel": "Home", "slug": "index", "taal": "nl"}, "inhoud": []}, {})
    page = html.replace("</main>", f'<div id="tijd">{sc._placeholder_html(SPEC)}</div><div id="tijd2">{sc._placeholder_html(SPEC)}</div></main>')
    return SiteDesignJob.objects.create(user=u, name="D", status="done", files={"index.html": page, "style.css": ""}, brief={"name": "D", "ontbrekende_componenten": [SPEC]}), u


def test_the_four_choices_and_the_closest_existing_components_come_first(db):
    ch = {c["actie"]: c for c in cr.choices({"voorgesteld_type": "prijstabel", "naam": "Prijstabel", "doel": "Abonnementen vergelijken met prijs"})}
    assert list(ch) == ["vervangen", "weglaten", "laten_staan", "aanvragen"]
    assert "ui-pricing" in ch["vervangen"]["opties"]  # the existing pricing component is offered first
    assert ch["aanvragen"]["variant_van"]  # extending an existing component is mentioned before a new one


def test_a_request_is_stored_and_the_same_request_is_merged(design):
    job, u = design
    r1, merged1 = cr.request_component(u, SPEC, str(job.pk), "a.nl")
    r2, merged2 = cr.request_component(u, {**SPEC, "naam": "Tijdlijn", "voorgesteld_type": "tijdlijn-pro"}, "other-design", "b.nl")
    r3, merged3 = cr.request_component(u, {"voorgesteld_type": "mijlpalen", "naam": "Mijlpalen tijdlijn", "doel": "Mijlpalen van het bedrijf verticaal tonen met jaartal"}, "d3", "c.nl")
    assert not merged1 and merged2 and merged3 and r1.pk == r2.pk == r3.pk  # same type, and nearly the same words: ONE row
    r1.refresh_from_db()
    assert r1.votes == 3 and r1.sites == ["a.nl", "b.nl", "c.nl"] and len(r1.designs) == 3 and r1.status == "nieuw"
    assert ComponentRequest.objects.count() == 1
    with pytest.raises(ValueError):
        cr.request_component(u, {"voorgesteld_type": "x"})  # type, name and purpose are needed


def test_the_judgement_follows_the_flow_and_is_never_put_in_a_site(design):
    job, u = design
    r, _ = cr.request_component(u, SPEC, str(job.pk), "a.nl")
    with pytest.raises(ValueError):
        cr.review(r, "gebouwd")  # not straight to built
    cr.review(r, "beoordeling")
    cr.review(r, "goedgekeurd", "Past bij de set")
    assert "Tijdlijn Pro" in cr.build_instruction(r) and "tests" in cr.build_instruction(r).lower() and "data-easy2edit-tag" in cr.build_instruction(r)
    with pytest.raises(ValueError):
        cr.review(r, "gebouwd", tag="ui-bestaat-niet")  # a built component has to be in the set
    assert "ui-tijdlijn-pro" not in pv.registry(None)[1]  # asking never puts a component in a site


def test_choices_in_a_design(design, monkeypatch):
    job, u = design
    monkeypatch.setattr(cr, "push_remote", lambda r: True)
    job, msg = cr.apply_choice(job, "tijdlijn-pro", "laten_staan")
    assert 'data-missing="tijdlijn-pro"' in job.files["index.html"]  # nothing changes
    job, msg = cr.apply_choice(job, "tijdlijn-pro", "aanvragen", user=u, site="a.nl")
    assert ComponentRequest.objects.count() == 1 and "aangevraagd" in job.brief
    job, msg = cr.apply_choice(job, "tijdlijn-pro", "vervangen", tag="ui-steps-process")  # both placeholders on the page are replaced
    assert 'data-missing' not in job.files["index.html"] and job.files["index.html"].count('data-easy2edit-tag="ui-steps-process"') == 2
    assert not job.brief.get("ontbrekende_componenten") and job.brief["controle"]["geldig"]
    with pytest.raises(ValueError):
        cr.apply_choice(job, "tijdlijn-pro", "weglaten")  # it is not missing any more


def test_leave_it_out_removes_the_placeholder(design):
    job, _u = design
    job, _m = cr.apply_choice(job, "tijdlijn-pro", "weglaten")
    assert "placeholder" not in job.files["index.html"] and "Component ontbreekt" not in job.files["index.html"]


def test_when_the_component_is_built_the_waiting_designs_are_checked_again(design, monkeypatch):
    job, u = design
    r, _ = cr.request_component(u, SPEC, str(job.pk), "a.nl")
    cr.review(r, "beoordeling")
    cr.review(r, "goedgekeurd")
    cr.review(r, "gebouwd", tag="ui-pricing")  # (stands for the new component: it exists in the set)
    job.refresh_from_db()
    assert job.brief["component_klaar"] == {"tijdlijn-pro": "ui-pricing"} and job.brief["controle"]["paginas"]  # the user replaces the placeholder with one click


def test_the_master_merges_requests_of_websites_and_only_for_approved_ones(db):
    site = EasySite.objects.create(instance_id="a" * 32, name="Shop", url="https://www.shop.nl", token_hash="x", status="active")
    out = cr.register_remote(site, {"spec": SPEC, "design": "d1"})
    other = EasySite.objects.create(instance_id="b" * 32, name="Blog", url="https://blog.nl", token_hash="y", status="active")
    out2 = cr.register_remote(other, {"spec": SPEC})
    assert not out["merged"] and out2["merged"] and out["request_id"] == out2["request_id"]
    assert ComponentRequest.objects.get().sites == ["www.shop.nl", "blog.nl"]
    pending = EasySite.objects.create(instance_id="c" * 32, name="New", url="https://new.nl", token_hash="z", status="pending")
    with pytest.raises(ValueError):
        cr.register_remote(pending, {"spec": SPEC})


def test_the_api_for_the_choices_and_the_review_is_for_the_right_people(design, monkeypatch):
    from rest_framework.test import APIClient

    from apps.core import modules

    monkeypatch.setattr(modules, "states", lambda: {})
    monkeypatch.setattr(cr, "push_remote", lambda r: True)
    job, u = design
    c = APIClient()
    c.force_authenticate(u)
    r = c.post(f"/api/sitecreator/{job.pk}/missing/", {"type": "tijdlijn-pro", "actie": "aanvragen"}, format="json")
    assert r.status_code == 200 and ComponentRequest.objects.count() == 1
    assert c.post(f"/api/sitecreator/{job.pk}/missing/", {"type": "tijdlijn-pro", "actie": "raar"}, format="json").status_code == 400
    plain = get_user_model().objects.create(username="p", email="p@x.nl")
    c.force_authenticate(plain)
    assert c.get("/api/component-requests/").status_code in (401, 403)  # judging is for the easy2edit side (superadmin+)
