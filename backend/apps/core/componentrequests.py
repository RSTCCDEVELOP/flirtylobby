# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Components on request: what happens with a component that a design needs and the component set does not have (the placeholder of the creator, see pagevalidate.py).

For every missing component the user chooses: replace it by an existing component, leave it out, leave the placeholder, or ask for the component. A request is stored with a status
(nieuw, beoordeling, goedgekeurd, afgewezen, gebouwd); the same request from other designs or websites is merged into ONE row; "extend an existing component with a variant" is preferred above
a new component. A request is NEVER put in a site directly: it is judged first and then built in the code by the easy2edit developers, with the fixed building instruction (`build_instruction`).
When the component is built, the designs that wait for it are checked again and the user replaces the placeholder with one click."""
import logging
import re

from django.db import transaction

from . import pageformat as pf
from . import pagevalidate as pv
from .models import ComponentRequest

logger = logging.getLogger(__name__)
OPEN = ("nieuw", "beoordeling", "goedgekeurd")
FLOW = {"nieuw": ("beoordeling", "afgewezen"), "beoordeling": ("goedgekeurd", "afgewezen"), "goedgekeurd": ("gebouwd", "afgewezen", "beoordeling"), "afgewezen": ("beoordeling",), "gebouwd": ()}
ACTIONS = ("vervangen", "weglaten", "laten_staan", "aanvragen")


def _words(t):
    return {w for w in re.findall(r"[a-z0-9]{3,}", str(t or "").lower())}


def similar(a, b):
    """How much two requests are the same (0 to 1): the same type is the same; otherwise the words of name and purpose."""
    if a.get("voorgesteld_type") and a.get("voorgesteld_type", "").lower() == b.get("voorgesteld_type", "").lower():
        return 1.0
    wa, wb = _words(f"{a.get('naam')} {a.get('doel')}"), _words(f"{b.get('naam')} {b.get('doel')}")
    return len(wa & wb) / max(1, min(len(wa), len(wb)))


def clean_spec(spec):
    """The specification of a missing component, checked and limited: voorgesteld_type, naam, doel (required), voorbeeldinhoud, voorgestelde_props, gebruikt_op, visuele_referentie."""
    if not isinstance(spec, dict):
        raise ValueError("De beschrijving van het component ontbreekt.")
    out = {"voorgesteld_type": re.sub(r"[^a-z0-9-]", "", str(spec.get("voorgesteld_type") or "").lower())[:60], "naam": str(spec.get("naam") or "").strip()[:80], "doel": str(spec.get("doel") or "").strip()[:600]}
    if not (out["voorgesteld_type"] and out["naam"] and out["doel"]):
        raise ValueError("Een verzoek heeft een type, een naam en een doel nodig.")
    props = [{"naam": str(p.get("naam") or "")[:40], "type": str(p.get("type") or "")[:20], "verplicht": bool(p.get("verplicht"))} for p in (spec.get("voorgestelde_props") or []) if isinstance(p, dict) and p.get("naam")][:30]
    out.update({"voorgestelde_props": props, "gebruikt_op": [str(x)[:80] for x in (spec.get("gebruikt_op") or [])][:20], "visuele_referentie": str(spec.get("visuele_referentie") or "")[:4000]})
    ex = spec.get("voorbeeldinhoud")
    out["voorbeeldinhoud"] = ex if isinstance(ex, dict) and len(str(ex)) < 8000 else {}
    return out


def choices(spec):
    """The choices for one missing component: [{actie, label, uitleg, opties?}]. The closest existing components are offered first; asking is the last choice."""
    _pack, comps = pv.registry(None)
    near = pv.nearest(comps, f"{spec.get('voorgesteld_type')} {spec.get('naam')} {spec.get('doel')}")
    return [{"actie": "vervangen", "label": "Vervangen door een bestaand component", "uitleg": "Het ontwerp gebruikt een component dat er al is.", "opties": near},
            {"actie": "weglaten", "label": "Weglaten", "uitleg": "Dit onderdeel komt niet in de pagina."},
            {"actie": "laten_staan", "label": "Placeholder laten staan", "uitleg": "Het ontwerp blijft een concept met een waarschuwing; vul het later aan."},
            {"actie": "aanvragen", "label": "Component aanvragen", "uitleg": "Het verzoek wordt beoordeeld en door de ontwikkelaars gebouwd. Een bestaand component uitbreiden gaat voor een nieuw component.",
             "variant_van": near[0] if near else ""}]


def find_open(spec):
    """The request that is the same as this one (still open or built): the same type, or nearly the same words."""
    best, score = None, 0.0
    for r in ComponentRequest.objects.exclude(status="afgewezen"):
        sc = similar(spec, {"voorgesteld_type": r.voorgesteld_type, "naam": r.naam, "doel": r.doel})
        if sc > score:
            best, score = r, sc
    return best if score >= 0.7 else None


def request_component(user, spec, design="", site=""):
    """Ask for a component. A request that is the same as an open one is merged into it (one more vote, this design and website added). -> (request, merged)."""
    spec = clean_spec(spec)
    _pack, comps = pv.registry(None)
    with transaction.atomic():
        r = find_open(spec)
        if r:
            r.votes += 1
            if design and not any(d.get("design") == design for d in r.designs):
                r.designs = [*r.designs, {"design": design, "site": site}]
            if site and site not in r.sites:
                r.sites = [*r.sites, site]
            r.save()
            return r, True
        near = pv.nearest(comps, f"{spec['voorgesteld_type']} {spec['naam']} {spec['doel']}")
        r = ComponentRequest.objects.create(voorgesteld_type=spec["voorgesteld_type"], naam=spec["naam"], doel=spec["doel"], spec={**spec, "dichtstbijzijnde_bestaande": near}, requested_by=user if getattr(user, "pk", None) else None,
                                            extends=near[0] if near and _extension_fits(spec, comps.get(near[0])) else "", designs=[{"design": design, "site": site}] if design else [], sites=[site] if site else [])
        return r, False


def _extension_fits(spec, comp):
    """A variant of an existing component is the better answer when the existing one already does most of what is asked (enough shared words)."""
    if not comp:
        return False
    have = _words(f"{comp.get('easy2edit_tag')} {comp.get('name')} {comp.get('description')}")
    want = _words(f"{spec.get('voorgesteld_type')} {spec.get('naam')} {spec.get('doel')}")
    return len(have & want) >= 3


def review(req, status, note="", tag=""):
    """The judgement: nieuw > beoordeling > goedgekeurd / afgewezen > gebouwd. Raises ValueError for a step that is not allowed."""
    if status not in FLOW.get(req.status, ()):
        raise ValueError(f"Van '{req.status}' kan het verzoek niet naar '{status}'.")
    if status == "gebouwd":
        tag = str(tag or "").strip()
        if not re.fullmatch(r"ui-[a-z0-9-]{2,50}", tag) or tag not in pv.registry(None)[1]:
            raise ValueError("Geef het type van het gebouwde component; het moet in de component set staan.")
        req.built_tag = tag
    req.status = status
    if note:
        req.note = str(note)[:2000]
    req.save()
    if status == "gebouwd":
        recheck_waiting(req)
    return req


def build_instruction(req):
    """The fixed instruction to build the component in the code (for the developers, and for Claude Code): where it goes, how it is made, what is tested."""
    sp = req.spec or {}
    props = "\n".join(f"  - {p['naam']} ({p['type']}{', verplicht' if p.get('verplicht') else ''})" for p in sp.get("voorgestelde_props") or []) or "  (not given: derive them from the example content)"
    near = ", ".join(sp.get("dichtstbijzijnde_bestaande") or []) or "-"
    way = (f"EXTEND the existing component {req.extends} with a variant (a modifier class, e.g. {req.extends}--{req.voorgesteld_type}); do NOT make a new component unless that is not possible." if req.extends
           else "Make a NEW component in the component set.")
    return f"""Build the component "{req.naam}" ({req.voorgesteld_type}) for the easy2edit component set.

PURPOSE: {req.doel}
{way}
Closest existing components (look at them first and reuse their classes and markup): {near}
Wishes for the props (they come out of the html of the template: every text, link, picture and repeated group is a prop):
{props}
Example content from the design: {sp.get('voorbeeldinhoud') or '-'}

HOW:
1. The component is one piece of html in the component set (source: backend/tools/make_easy2edit_component_set.py, output resource/components/*.zip): a root <div data-easy2edit-tag="ui-...">, only e2e-* classes of the set, colours and sizes through the theme variables, no <script>, no inline colours, mobile first.
2. Fill the template with realistic example texts; repeated items (cards, plans, steps) are real repeated elements of the same kind, so the props schema gets a list. Give it a name, a one-sentence description, a group and a category.
3. Raise the version of the set; build the zip with the tool; the standard sets (and the templates that use it) are rebuilt.
4. Tests: the component is in the catalogue (pagevalidate.catalogus) with props; props out and html back in gives the same html (tests/test_pagevalidate.py); a design that uses it validates without errors.
5. Document it in md/modules/ (English, copyright RSTCC) and add it to the list of components.
6. When it is built: mark this request as built with the type of the component; the designs that wait for it are checked again."""


# ── the designs that wait ──
def _waiting(type_):
    from .models import SiteDesignJob

    out = []
    for j in SiteDesignJob.objects.all():
        if any(isinstance(m, dict) and m.get("voorgesteld_type") == type_ for m in (j.brief or {}).get("ontbrekende_componenten") or []):
            out.append(j)
    return out


def recheck_waiting(req):
    """The component is built: the designs that wait for it are checked again and marked, so the user can replace the placeholder with one click. -> the number of designs."""
    from . import sitecreator as sc
    from .models import SiteDesignJob

    n = 0
    for j in _waiting(req.voorgesteld_type):
        b = dict(j.brief or {})
        ready = dict(b.get("component_klaar") or {})
        ready[req.voorgesteld_type] = req.built_tag
        b["component_klaar"] = ready
        b["controle"] = sc.controle_of(j.files or {}, b)
        SiteDesignJob.objects.filter(pk=j.pk).update(brief=b)
        n += 1
    return n


# ── what the user chooses in a design ──
def _placeholders_re(type_):
    return re.compile(r'<div data-easy2edit-tag="placeholder" data-missing="%s">.*?</div>' % re.escape(type_), re.S)


def _drop_missing(brief, type_):
    b = dict(brief or {})
    b["ontbrekende_componenten"] = [m for m in b.get("ontbrekende_componenten") or [] if not (isinstance(m, dict) and m.get("voorgesteld_type") == type_)]
    b["component_klaar"] = {k: v for k, v in (b.get("component_klaar") or {}).items() if k != type_}
    return b


def apply_choice(job, type_, actie, tag="", user=None, site=""):
    """The choice for ONE missing component of a design. -> (design, message). vervangen: the placeholder becomes the component (filled with its example texts, the user adapts them in the editor);
    weglaten: the placeholder goes; laten_staan: nothing changes; aanvragen: a request is made (or merged)."""
    from . import sitecreator as sc
    from .models import SiteDesignJob

    if actie not in ACTIONS:
        raise ValueError("Onbekende keuze.")
    b = dict(job.brief or {})
    spec = next((m for m in b.get("ontbrekende_componenten") or [] if isinstance(m, dict) and m.get("voorgesteld_type") == type_), None)
    if not spec:
        raise ValueError("Dit component ontbreekt niet (meer) in het ontwerp.")
    files = dict(job.files or {})
    if actie == "laten_staan":
        return job, "De placeholder blijft staan."
    if actie == "aanvragen":
        r, merged = request_component(user, spec, str(job.pk), site)
        if not merged:
            import threading

            threading.Thread(target=push_remote, args=(r,), daemon=True, name="component-request-push").start()  # (the master site hears about it; never in the way)
        b["aangevraagd"] = {**(b.get("aangevraagd") or {}), type_: str(r.uid)}
        SiteDesignJob.objects.filter(pk=job.pk).update(brief=b)
        job.refresh_from_db()
        return job, ("Dit is al aangevraagd: jouw ontwerp is erbij gezet." if merged else "Het verzoek is gedaan. Je ziet hier wanneer het component klaar is.")
    if actie == "vervangen":
        comp = pv.registry(None)[1].get(tag)
        if not comp:
            raise ValueError("Kies een component uit de component set.")
        html = pf.render(comp, pf.sample_props(comp))
    else:
        html = ""
    changed = 0
    for n in [n for n in files if n.endswith(".html")]:
        new, k = _placeholders_re(type_).subn(lambda m: html, files[n])
        if k:
            files[n], changed = new, changed + k
    if not changed:
        raise ValueError("De placeholder staat niet in de pagina's.")
    b = _drop_missing(b, type_)
    files, left = sc.repair_design(files, b)
    b["controle"] = sc.controle_of(files, b)
    SiteDesignJob.objects.filter(pk=job.pk).update(files=files, brief=b)
    job.refresh_from_db()
    return job, ("Het onderdeel is weggelaten." if actie == "weglaten" else f"De placeholder is vervangen door {tag}; pas de teksten aan in de editor.")


# ── on the easy2edit server (the master): requests of other websites ──
def register_remote(site, data):
    """A website sends its request to the master site: merged with an open one or made. -> {request_id, merged}. Only an approved website."""
    if not site or site.status != "active":
        raise ValueError("Deze website is nog niet goedgekeurd op de easy2edit server.")
    domain = site.url.split("//")[-1].split("/")[0].lower()
    r, merged = request_component(None, data.get("spec") if isinstance(data, dict) else {}, str((data or {}).get("design") or "")[:60], domain)
    return {"request_id": str(r.uid), "merged": merged, "status": r.status}


def push_remote(req):
    """A website that is not the master also tells the master about its request. Never raises; the local request stays the one that counts for the user. -> True when sent."""
    try:
        from . import global_settings, sitemanager

        if sitemanager.server_enabled():
            return False
        key = sitemanager._state().get("token") or ""
        api = (global_settings.get().get("api_url") or "").rstrip("/")
        if not key or not api:
            return False
        r = sitemanager._post(f"{api}/api/easy2edit/sites/component-request/", {"spec": req.spec, "design": (req.designs or [{}])[0].get("design", "")}, key)
        ComponentRequest.objects.filter(pk=req.pk).update(remote_id=str(r.get("request_id") or "")[:40])
        return True
    except Exception as ex:  # noqa: BLE001
        logger.warning("component request not sent to the master site: %s", ex)
        return False


def public(r, detail=False):
    out = {"id": r.pk, "uid": str(r.uid), "status": r.status, "status_label": dict(ComponentRequest.STATUS)[r.status], "type": r.voorgesteld_type, "naam": r.naam, "doel": r.doel, "votes": r.votes, "extends": r.extends,
           "sites": r.sites, "designs": len(r.designs or []), "note": r.note, "built_tag": r.built_tag, "remote_id": r.remote_id, "created": r.created.isoformat(), "volgende": list(FLOW.get(r.status, ()))}
    if detail:
        out.update({"spec": r.spec, "instructie": build_instruction(r)})
    return out
