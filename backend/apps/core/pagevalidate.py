# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The validator of a page design (format "easy2edit-pagina@1", see pageformat.py): ONE source of truth. The creator, the import and the screens all use it (through the API).

`validate(doc, ctx)` -> (report, repaired document). The report is always:
    {"geldig": bool, "formaat": "easy2edit-pagina@1", "meldingen": [{ernst, code, pad, component, melding, suggestie}], "reparaties": [...], "ontbrekende_componenten": [...]}
ernst: "fout" blocks the import, "waarschuwing" does not, "info" is for information. Paths are JSON Pointers into the document. Only deterministic, lossless repairs are made, and every
one is in "reparaties" (nothing is changed silently); when in doubt there is a message and no repair. The messages are in Dutch (the source language of the system).

Also: `catalogus()` (the component catalogue, made from the registry), `design_to_documents()` (the html pages of a design as documents) and `document_to_html()`."""
import json
import re
import nh3

from . import componentpacks, pageformat as pf

SUPPORTED = 1  # the version of the format that this code reads: easy2edit-pagina@1
MAX_NODES = 400
MAX_BYTES = 600_000
MAX_DEPTH = 3  # inhoud > band > kolom > component
PAGE_TYPES = ("home", "standaard", "over-ons", "contact", "diensten", "blog", "faq", "product", "overig")
LAYOUT_TYPES = ("band", "kolom", "sysobject", "placeholder")
COLS = {"1": 1, "2": 2, "3": 3, "4": 4, "2-1": 2, "1-2": 2, "3-1": 2, "1-3": 2}
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
URL_RE = re.compile(r"^https?://[^\s/$.?#][^\s]{0,490}$", re.I)
VAR_RE = re.compile(r"\{\{\s*([a-z_]+\.[a-z_]+)\s*\}\}")
HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b")
DANGER = re.compile(r"<\s*script|<\s*iframe|\son[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text/html", re.I)
SYSTEM_PATHS = ("/registreren", "/login", "/dashboard", "/privacy", "/cookies", "/producten", "/winkelwagen", "/faq", "/contact", "/")
INLINE_TAGS = {"b", "i", "em", "strong", "br", "span", "small", "mark", "code", "u", "sup", "sub", "a"}

CODES = {  # code: what it means (the list of error codes of the documentation)
    "FORMAAT_ONBEKEND": "Het document heeft niet het formaat easy2edit-pagina.",
    "FORMAAT_VERSIE": "De versie van het formaat wordt niet ondersteund.",
    "STRUCTUUR_VELD": "Een verplicht veld ontbreekt of heeft het verkeerde type.",
    "ID_DUBBEL": "Een id komt twee keer voor in het ontwerp.",
    "COMPONENT_ONBEKEND": "Het component staat niet in de component set.",
    "WIDGET_NIET_ACTIEF": "Het widget is niet geïnstalleerd of staat uit op deze website.",
    "COMPONENT_VERSIE": "Het ontwerp is gemaakt voor een andere versie van het component.",
    "PROP_VERPLICHT": "Een verplichte prop ontbreekt.",
    "PROP_TYPE": "Een prop heeft het verkeerde type.",
    "PROP_LENGTE": "Een tekst is te lang of een lijst heeft te veel items.",
    "PROP_ONBEKEND": "Een prop bestaat niet voor dit component (wordt genegeerd).",
    "NESTING_ONGELDIG": "Dit onderdeel mag niet op deze plek staan.",
    "NESTING_DIEPTE": "Het ontwerp is dieper genest dan toegestaan.",
    "MEDIA_ALT": "Een afbeelding heeft geen alt-tekst.",
    "MEDIA_ONTBREEKT": "De verwijzing naar de afbeelding bestaat niet.",
    "MEDIA_BRON": "De bron van de afbeelding is niet toegestaan of ongeldig.",
    "MEDIA_OPHALEN": "Een afbeelding van een https-adres kon niet worden opgehaald bij het importeren.",
    "MEDIA_DUBBEL": "Dezelfde afbeelding wordt meer dan één keer gebruikt.",
    "THEMA_HEX": "Een vaste kleur in een tekst: gebruik de kleuren van het thema.",
    "VARIABELE_ONBEKEND": "Een variabele bestaat niet.",
    "LINK_INTERN_ONBEKEND": "Een interne link verwijst naar een pagina of plek die er niet is.",
    "LINK_FORMAAT": "Een link heeft een ongeldig formaat.",
    "LINK_GEVAARLIJK": "Een link is niet veilig (javascript: of data:).",
    "LINK_LEEG": "Een link verwijst nergens naartoe.",
    "INHOUD_SCRIPT": "De tekst bevat een script of een event handler.",
    "INHOUD_OPGESCHOOND": "De tekst bevatte html die niet is toegestaan en is opgeschoond.",
    "SLUG_CONFLICT": "Er is al een pagina met deze slug.",
    "TAAL_ONBEKEND": "De taal is niet ingeschakeld op deze website.",
    "TYPE_ONBEKEND": "Het paginatype is niet toegestaan.",
    "LIMIET": "Het ontwerp is te groot.",
    "PLACEHOLDER": "Op deze plek ontbreekt een component (een placeholder).",
    "ONTBREKEND_SPEC": "De beschrijving van een ontbrekend component is niet compleet.",
    "REPARATIE": "Dit is automatisch hersteld.",
}


# ── the registry ──
def registry(set_key=None):
    pack = componentpacks.get(set_key or None)
    return pack, {c["easy2edit_tag"]: c for c in pack["components"]}


def catalogus(set_key=None):
    """The component catalogue, made from the registry (never written by hand): per component the type, the version of the set, the purpose, the props schema, the nesting and an example."""
    pack, comps = registry(set_key)
    out = []
    for tag, c in comps.items():
        out.append({"type": tag, "versie": pack["version"], "naam": c.get("name") or tag, "doel": c.get("description") or "", "groep": c.get("group") or "", "props": pf.schema_json(c),
                    "nesting": "blad: een component heeft geen children; het staat in 'inhoud' of in een 'kolom' van een 'band'", "voorbeeld": pf.sample_props(c)})
    return out


def catalogus_tekst(set_key=None, only=None):
    """The catalogue as compact text for the model: type - purpose - the names of the props (with the example texts left out)."""
    lines = []
    for c in catalogus(set_key):
        if only and c["type"] not in only:
            continue
        def names(ps):
            return ", ".join(p["naam"] + (("[" + names(p["items"]) + "]") if p["type"] == "lijst" else {"link": "{label,href}", "afbeelding": "{src,alt}"}.get(p["type"], "")) for p in ps)
        lines.append(f"- {c['type']}: {c['doel'][:110]} | props: {names(c['props'])}")
    return "\n".join(lines)


# ── the context of the site ──
def site_context(extra=None):
    """What the validator needs to know about this website: the languages, the slugs of the pages, the system objects, the variables and the media. Extra values override (for tests)."""
    ctx = {"talen": set(), "slugs": set(), "sysobjecten": set(), "variabelen": set(), "media_ids": None, "paginas": set()}
    try:
        from .models import Language

        ctx["talen"] = {l.code for l in Language.objects.filter(enabled=True)}
    except Exception:  # noqa: BLE001
        pass
    try:
        from apps.pages.models import Page

        ctx["slugs"] = {p.key for p in Page.objects.all()}
    except Exception:  # noqa: BLE001
        pass
    try:
        from apps.sysobjects.models import SystemObject

        ctx["sysobjecten"] = set(SystemObject.objects.filter(enabled=True).values_list("slug", flat=True))
    except Exception:  # noqa: BLE001
        pass
    try:
        from . import entity

        ctx["variabelen"] = set(entity.VARIABLES)
    except Exception:  # noqa: BLE001
        pass
    return {**ctx, **(extra or {})}


# ── the validation ──
class _Run:
    def __init__(self, ctx, comps, pack):
        self.ctx, self.comps, self.pack = ctx, comps, pack
        self.msgs, self.repairs, self.ids, self.nodes, self.srcs, self.anchors, self.hrefs = [], [], {}, 0, {}, set(), []

    def add(self, ernst, code, pad, melding, component="", suggestie=""):
        self.msgs.append({"ernst": ernst, "code": code, "pad": pad, "component": component, "melding": melding, "suggestie": suggestie})

    def repair(self, code, pad, tekst):
        self.repairs.append({"code": code, "pad": pad, "melding": tekst})


def _text_ok(run, value, pad, comp):
    """A text prop: no script, only the inline tags (anything else is cleaned and said), no fixed colours, known variables."""
    if DANGER.search(value):
        run.add("fout", "INHOUD_SCRIPT", pad, "De tekst bevat een script, een event handler of een gevaarlijke link.", comp, "Verwijder de code uit de tekst.")
        return value
    cleaned = nh3.clean(value, tags=INLINE_TAGS, attributes={"a": {"href"}}, link_rel=None)
    if pf.normalise(cleaned) != pf.normalise(value):
        run.add("waarschuwing", "INHOUD_OPGESCHOOND", pad, "De tekst bevatte html die niet is toegestaan; die is verwijderd.", comp)
        value = cleaned
    if HEX_RE.search(value):
        run.add("waarschuwing", "THEMA_HEX", pad, "Een vaste kleur in de tekst.", comp, "Gebruik de kleuren van het thema.")
    for var in VAR_RE.findall(value):
        known = run.ctx["variabelen"] | {"user." + k for k in ("naam", "voornaam", "achternaam", "email", "functie", "bedrijf")}
        if known and var not in known:
            run.add("waarschuwing", "VARIABELE_ONBEKEND", pad, f"De variabele {{{{{var}}}}} bestaat niet.", comp, "Gebruik een bestaande variabele, bijvoorbeeld {{organisatie.naam}}.")
    return value


def _check_href(run, href, pad, comp):
    h = str(href or "").strip()
    if not h or h == "#":
        run.add("waarschuwing", "LINK_LEEG", pad, "Een link verwijst nergens naartoe.", comp, "Geef de link een adres, een pagina of #anker.")
        return
    if re.match(r"^\s*(javascript|vbscript|data)\s*:", h, re.I):
        run.add("fout", "LINK_GEVAARLIJK", pad, "Een link met javascript: of data: is niet toegestaan.", comp)
        return
    if h.startswith(("mailto:", "tel:")):
        return
    if h.startswith("#"):
        run.hrefs.append((h[1:], pad, comp))
        return
    if re.match(r"^[a-z][a-z0-9+.-]*://", h, re.I):
        if not URL_RE.match(h):
            run.add("fout", "LINK_FORMAAT", pad, "Het adres van de link is niet geldig.", comp)
        return
    base = h.split("#")[0].split("?")[0]
    if base.startswith("/"):
        if SYSTEM_PATHS and not any(base == p or base.startswith(p + "/") for p in SYSTEM_PATHS) and run.ctx["slugs"] and base.strip("/") not in run.ctx["slugs"] and base.strip("/") not in run.ctx["paginas"]:
            run.add("waarschuwing", "LINK_INTERN_ONBEKEND", pad, f"De pagina {base} bestaat niet op deze website.", comp)
        return
    if base.endswith(".html"):
        if run.ctx["paginas"] and base not in run.ctx["paginas"]:
            run.add("waarschuwing", "LINK_INTERN_ONBEKEND", pad, f"De pagina {base} zit niet in dit ontwerp.", comp)
        return
    run.add("fout", "LINK_FORMAAT", pad, "Het adres van de link heeft een onbekend formaat.", comp)


def _check_img(run, v, pad, comp):
    src, alt = str(v.get("src") or "").strip(), str(v.get("alt") or "").strip()
    if not alt:
        run.add("fout", "MEDIA_ALT", pad + "/alt", "De afbeelding heeft geen alt-tekst.", comp, "Beschrijf in 4 tot 10 woorden wat er te zien is.")
    if not src:
        run.add("fout", "MEDIA_ONTBREEKT", pad + "/src", "De afbeelding heeft geen bron.", comp)
        return
    if re.match(r"^\s*(data|javascript)\s*:", src, re.I):
        run.add("fout", "MEDIA_BRON", pad + "/src", "Een data:- of javascript:-bron is niet toegestaan.", comp)
        return
    if src.startswith("media:"):
        mid = src[6:]
        ids = run.ctx["media_ids"]
        if not mid.isdigit() or (ids is not None and int(mid) not in ids):
            run.add("fout", "MEDIA_ONTBREEKT", pad + "/src", f"Het media-item {mid} bestaat niet.", comp)
    elif src.startswith("img/") or re.match(r"^[\w.-]+\.(jpe?g|png|webp|svg|gif)$", src, re.I):
        pass
    elif src.lower().startswith("http://") and URL_RE.match(src):
        run.add("fout", "MEDIA_BRON", pad + "/src", "Alleen https-adressen worden opgehaald.", comp, "Gebruik het https-adres van de afbeelding.")
    elif URL_RE.match(src):
        pass  # a source to import (https): the import fetches it
    else:
        run.add("fout", "MEDIA_BRON", pad + "/src", "De bron van de afbeelding is onbekend.", comp, "Gebruik img/<bestand>, media:<id> of een https-adres.")
    key = src.split("/")[-1].lower()
    if key and not key.startswith("logo"):
        run.srcs.setdefault(key, []).append(pad)


def _check_props(run, comp, slots, props, pad, tag):
    if not isinstance(props, dict):
        run.add("fout", "PROP_TYPE", pad, "De props zijn geen object.", tag)
        return
    names = {s.name for s in slots}
    for k in props:
        if k not in names:
            run.add("waarschuwing", "PROP_ONBEKEND", f"{pad}/{k}", f"De prop '{k}' bestaat niet voor {tag}; hij wordt genegeerd.", tag, "Bekende props: " + ", ".join(sorted(names)))
    for s in slots:
        p = f"{pad}/{s.name}"
        if s.name not in props:
            run.add("fout", "PROP_VERPLICHT", p, f"Verplichte prop '{s.name}' ontbreekt.", tag, "Voeg hem toe, of gebruik {{organisatie.naam}} voor bedrijfsgegevens.")
            continue
        v = props[s.name]
        if s.kind == "text":
            if not isinstance(v, str):
                run.add("fout", "PROP_TYPE", p, f"'{s.name}' moet een tekst zijn.", tag)
            elif not v.strip():
                run.add("fout", "PROP_VERPLICHT", p, f"'{s.name}' is leeg.", tag)
            elif len(v) > pf.MAX_TEXT:
                run.add("fout", "PROP_LENGTE", p, f"'{s.name}' is langer dan {pf.MAX_TEXT} tekens.", tag)
            else:
                props[s.name] = _text_ok(run, v, p, tag)
        elif s.kind == "link":
            if not isinstance(v, dict):
                run.add("fout", "PROP_TYPE", p, f"'{s.name}' moet {{label, href}} zijn.", tag)
                continue
            if s.sample != "href":
                if not isinstance(v.get("label"), str) or not v["label"].strip():
                    run.add("fout", "PROP_VERPLICHT", p + "/label", f"'{s.name}' heeft geen label.", tag)
                else:
                    v["label"] = _text_ok(run, v["label"], p + "/label", tag)
            _check_href(run, v.get("href"), p + "/href", tag)
            if s.aria and "aria" not in v:
                v["aria"] = ""
                run.repair("PROP_DEFAULT", p + "/aria", "Het aria-label ontbrak en is leeg aangevuld.")
        elif s.kind == "afbeelding":
            if not isinstance(v, dict):
                run.add("fout", "PROP_TYPE", p, f"'{s.name}' moet {{src, alt}} zijn.", tag)
            else:
                _check_img(run, v, p, tag)
        elif s.kind == "lijst":
            if not isinstance(v, list):
                run.add("fout", "PROP_TYPE", p, f"'{s.name}' moet een lijst zijn.", tag)
            elif not v:
                run.add("fout", "PROP_VERPLICHT", p, f"'{s.name}' heeft geen items.", tag)
            else:
                if len(v) > pf.MAX_ITEMS:
                    run.add("fout", "PROP_LENGTE", p, f"'{s.name}' heeft meer dan {pf.MAX_ITEMS} items.", tag)
                for n, it in enumerate(v[:pf.MAX_ITEMS]):
                    _check_props(run, comp, s.item[n % len(s.item)], it, f"{p}/{n}", tag)


def _node(run, node, pad, depth, parent):
    if not isinstance(node, dict):
        run.add("fout", "STRUCTUUR_VELD", pad, "Een knoop moet een object zijn.")
        return
    run.nodes += 1
    nid, typ = node.get("id"), node.get("type")
    if not isinstance(nid, str) or not ID_RE.match(nid):
        run.add("fout", "STRUCTUUR_VELD", pad + "/id", "Elke knoop heeft een id (letters, cijfers, - en _).", str(typ or ""))
    elif nid in run.ids:
        run.add("fout", "ID_DUBBEL", pad + "/id", f"Het id '{nid}' komt twee keer voor (ook op {run.ids[nid]}).", str(typ or ""))
    else:
        run.ids[nid] = pad
    if node.get("anker"):
        run.anchors.add(str(node["anker"]))
    if depth > MAX_DEPTH:
        run.add("fout", "NESTING_DIEPTE", pad, f"Dieper dan {MAX_DEPTH} niveaus.", str(typ or ""))
        return
    children = node.get("children") or []
    if not isinstance(typ, str) or not typ:
        run.add("fout", "STRUCTUUR_VELD", pad + "/type", "Een knoop heeft een type.")
        return
    if typ == "band":
        if parent not in ("inhoud",):
            run.add("fout", "NESTING_ONGELDIG", pad, "Een band staat alleen direct in de inhoud.", typ)
        pr = node.get("props") or {}
        cols = str(pr.get("cols") or len(children) or 1)
        if cols not in COLS or COLS[cols] != len(children) or not children:
            run.add("fout", "NESTING_ONGELDIG", pad + "/children", f"Een band met kolommen '{cols}' heeft {COLS.get(cols, '?')} kolommen nodig (nu {len(children)}).", typ)
        for i, c in enumerate(children):
            if not isinstance(c, dict) or c.get("type") != "kolom":
                run.add("fout", "NESTING_ONGELDIG", f"{pad}/children/{i}", "In een band staan alleen kolommen.", typ)
            else:
                _node(run, c, f"{pad}/children/{i}", depth + 1, "band")
        return
    if typ == "kolom":
        if parent != "band":
            run.add("fout", "NESTING_ONGELDIG", pad, "Een kolom staat alleen in een band.", typ)
        for i, c in enumerate(children):
            if isinstance(c, dict) and c.get("type") in ("band", "kolom"):
                run.add("fout", "NESTING_ONGELDIG", f"{pad}/children/{i}", "In een kolom staan componenten, geen banden.", typ)
            else:
                _node(run, c, f"{pad}/children/{i}", depth + 1, "kolom")
        return
    if children:
        run.add("fout", "NESTING_ONGELDIG", pad + "/children", f"{typ} is een los component en heeft geen children.", typ)
    if typ == "sysobject":
        slug = (node.get("props") or {}).get("slug")
        if slug and str(slug).startswith("widget-") and run.ctx["sysobjecten"] and slug not in run.ctx["sysobjecten"]:  # a widget that is not active: no error, the rest of the design goes on
            run.add("waarschuwing", "WIDGET_NIET_ACTIEF", pad + "/props/slug", f"Het widget '{slug}' is niet geïnstalleerd of staat uit; het blijft leeg tot je het activeert.", typ, "Installeer het widget bij Admin → Website → Widgets.")
        elif not slug or (run.ctx["sysobjecten"] and slug not in run.ctx["sysobjecten"]):
            run.add("fout", "COMPONENT_ONBEKEND", pad + "/props/slug", f"Het systeemobject '{slug}' bestaat niet of staat uit.", typ)
        return
    if typ == "placeholder":
        run.add("waarschuwing", "PLACEHOLDER", pad, "Op deze plek ontbreekt een component; het ontwerp is niet af.", typ, "Kies een bestaand component of vraag het component aan.")
        return
    comp = run.comps.get(typ)
    if not comp:
        near = nearest(run.comps, typ)
        run.add("fout", "COMPONENT_ONBEKEND", pad + "/type", f"Het component '{typ}' staat niet in de component set.", typ, ("Bedoel je " + ", ".join(near) + "? ") + "Of zet het in ontbrekende_componenten.")
        return
    if node.get("versie") and str(node["versie"]) != str(run.pack["version"]):
        run.add("waarschuwing", "COMPONENT_VERSIE", pad + "/versie", f"Gemaakt voor versie {node['versie']}; de set is {run.pack['version']}.", typ)
    _check_props(run, comp, pf.schema_of(comp)["slots"], node.setdefault("props", {}), pad + "/props", typ)


SYNONYMS = {"prijs": ("pricing", "plan"), "prijzen": ("pricing", "plan"), "tarief": ("pricing",), "abonnement": ("pricing", "plan"), "tijdlijn": ("timeline",), "mijlpaal": ("timeline",), "vragen": ("faq",), "kalender": ("calendar",),
            "agenda": ("agenda", "calendar"), "galerij": ("gallery",), "foto": ("gallery", "photo"), "beoordeling": ("testimonials", "reviews"), "review": ("testimonials",), "stappen": ("steps", "process"), "cijfers": ("stats",),
            "statistiek": ("stats",), "formulier": ("form",), "knop": ("button",), "kaart": ("cards", "card"), "team": ("team",), "tabel": ("table",), "logo": ("logos",), "nieuwsbrief": ("newsletter",), "contact": ("contact",)}


def _tokens(text):
    """The words of a text, with the English words for common Dutch ones (the set is English in its types, Dutch in its texts)."""
    words = set(re.findall(r"[a-z0-9]{3,}", str(text).lower()))
    for w in list(words):
        for key, syn in SYNONYMS.items():
            if key in w:
                words |= set(syn)
    return words


def nearest(comps, name, n=3):
    """The components that are closest to a name or a wish (by the words of the type, the name and the purpose)."""
    want = _tokens(name)
    scored = []
    for tag, c in comps.items():
        have = _tokens(f"{tag} {c.get('name', '')} {c.get('description', '')}")
        scored.append((len(want & have), tag))
    return [t for sc, t in sorted(scored, reverse=True)[:n] if sc > 0]


def validate(doc, ctx=None, set_key=None):
    """Validates a document. -> (report, repaired copy of the document). Never raises: a document that is not even an object gives an error report."""
    doc = json.loads(json.dumps(doc)) if isinstance(doc, (dict, list)) else doc
    pack, comps = registry(set_key)
    run = _Run(ctx if ctx is not None else site_context(), comps, pack)
    report = lambda: {"geldig": not any(m["ernst"] == "fout" for m in run.msgs), "formaat": pf.FORMAT, "meldingen": run.msgs, "reparaties": run.repairs, "ontbrekende_componenten": miss}  # noqa: E731
    miss = []
    if not isinstance(doc, dict):
        run.add("fout", "FORMAAT_ONBEKEND", "", "Het ontwerp is geen JSON-object.")
        return report(), doc
    if len(json.dumps(doc)) > MAX_BYTES:
        run.add("fout", "LIMIET", "", f"Het ontwerp is groter dan {MAX_BYTES // 1000} kB.")
        return report(), doc
    m = re.match(r"^easy2edit-pagina@(\d+)$", str(doc.get("formaat") or ""))
    if not m:
        run.add("fout", "FORMAAT_ONBEKEND", "/formaat", "Het formaat moet 'easy2edit-pagina@1' zijn.")
        return report(), doc
    if int(m.group(1)) > SUPPORTED:
        run.add("fout", "FORMAAT_VERSIE", "/formaat", f"Versie {m.group(1)} wordt niet ondersteund (alleen {SUPPORTED}).")
        return report(), doc
    pg = doc.get("pagina")
    if not isinstance(pg, dict):
        run.add("fout", "STRUCTUUR_VELD", "/pagina", "De pagina (titel, slug, taal) ontbreekt.")
        pg = {}
    for k in ("titel", "slug", "taal"):
        if not isinstance(pg.get(k), str) or not pg.get(k).strip():
            run.add("fout", "STRUCTUUR_VELD", f"/pagina/{k}", f"'{k}' ontbreekt.")
    slug = str(pg.get("slug") or "")
    if slug and not SLUG_RE.match(slug):
        run.add("fout", "STRUCTUUR_VELD", "/pagina/slug", "De slug bestaat uit kleine letters, cijfers en -.")
    elif slug and slug in run.ctx["slugs"]:
        n = 2
        while f"{slug}-{n}" in run.ctx["slugs"]:
            n += 1
        pg["slug"] = f"{slug}-{n}"
        run.add("waarschuwing", "SLUG_CONFLICT", "/pagina/slug", f"Er is al een pagina '{slug}'.", suggestie=f"Hernoemd naar {slug}-{n}.")
        run.repair("SLUG_CONFLICT", "/pagina/slug", f"De slug '{slug}' bestond al en is '{slug}-{n}' geworden.")
    if pg.get("taal") and run.ctx["talen"] and pg["taal"] not in run.ctx["talen"]:
        run.add("waarschuwing", "TAAL_ONBEKEND", "/pagina/taal", f"De taal '{pg['taal']}' is niet ingeschakeld op deze website.")
    if pg.get("type") and pg["type"] not in PAGE_TYPES:
        run.add("waarschuwing", "TYPE_ONBEKEND", "/pagina/type", f"Het paginatype '{pg['type']}' is onbekend ({', '.join(PAGE_TYPES)}).")
    inhoud = doc.get("inhoud")
    if not isinstance(inhoud, list) or not inhoud:
        run.add("fout", "STRUCTUUR_VELD", "/inhoud", "De inhoud is een lijst met minstens één onderdeel.")
        inhoud = []
    for key in ("header", "footer"):
        if doc.get(key):
            _node(run, doc[key], f"/{key}", 1, key)
    for i, n in enumerate(inhoud):
        _node(run, n, f"/inhoud/{i}", 1, "inhoud")
    if run.nodes > MAX_NODES:
        run.add("fout", "LIMIET", "/inhoud", f"Meer dan {MAX_NODES} onderdelen.")
    for target, pad, comp in run.hrefs:
        if target and target not in run.anchors and target not in run.ids:
            run.add("waarschuwing", "LINK_INTERN_ONBEKEND", pad, f"Er is geen onderdeel met het anker #{target}.", comp)
    for src, pads in run.srcs.items():
        if len(pads) > 1:
            run.add("waarschuwing", "MEDIA_DUBBEL", pads[1], f"Dezelfde afbeelding ({src}) staat {len(pads)} keer in het ontwerp.", suggestie="Gebruik per plek een andere foto.")
    # the missing components: complete, and the closest existing ones
    for i, spec in enumerate(doc.get("ontbrekende_componenten") or []):
        pad = f"/ontbrekende_componenten/{i}"
        if not isinstance(spec, dict) or not all(str(spec.get(k) or "").strip() for k in ("voorgesteld_type", "naam", "doel")):
            run.add("fout", "ONTBREKEND_SPEC", pad, "Een ontbrekend component heeft voorgesteld_type, naam en doel nodig.")
            continue
        spec["dichtstbijzijnde_bestaande"] = nearest(comps, f"{spec['voorgesteld_type']} {spec['naam']} {spec['doel']}")
        miss.append(spec)
    return report(), doc


# ── a design (html pages) <-> documents ──
def _section_nodes(html, comps, counter):
    """The nodes in the html of one section of a page."""
    root = pf.parse(html)
    out = []

    def comp_node(el):
        tag = el.get("data-easy2edit-tag")
        if tag == "placeholder":
            counter[0] += 1
            return {"id": f"n{counter[0]}", "type": "placeholder", "props": {"voorgesteld_type": el.get("data-missing")}, "children": []}
        if tag and tag in comps:
            counter[0] += 1
            return {"id": f"n{counter[0]}", "type": tag, "versie": "", "props": pf.extract(comps[tag], pf.serialize(el)), "children": []}
        if tag:
            counter[0] += 1
            return {"id": f"n{counter[0]}", "type": tag, "versie": "", "props": {}, "children": []}
        so = el.get("data-sysobject")
        if so:
            counter[0] += 1
            return {"id": f"n{counter[0]}", "type": "sysobject", "props": {"slug": so}, "children": []}
        return None

    def walk(el):
        n = comp_node(el)
        if n:
            return [n]
        found = []
        for k in el.kids:
            if isinstance(k, pf.El):
                found.extend(walk(k))
        return found

    for k in root.kids:
        if isinstance(k, pf.El):
            if k.tag == "section" and "band" in k.get("class").split():
                inner = next((x for x in pf._walk(k) if "cols" in x.get("class").split()), None)
                cols = [c for c in (inner.kids if inner else []) if isinstance(c, pf.El) and "col" in c.get("class").split()]
                cls = (inner.get("class") if inner else "").split()
                ratio = next((c[5:] for c in cls if c.startswith("cols-")), str(len(cols) or 1))
                counter[0] += 1
                band = {"id": f"n{counter[0]}", "type": "band", "props": {"cols": ratio, "bg": "soft" if "band--soft" in k.get("class").split() else "none", "valign": "center" if "cols--center" in cls else "top",
                                                                         "screen": "band--screen" in k.get("class").split()}, "children": []}
                for c in cols:
                    counter[0] += 1
                    band["children"].append({"id": f"n{counter[0]}", "type": "kolom", "children": walk(c)})
                out.append(band)
            else:
                out.extend(walk(k))
    return out


def design_to_documents(files, brief, set_key=None):
    """The html pages of a design as documents of the format: [{file, document}]. Parts that are not components of the set stay as nodes without props (the validator reports them)."""
    from . import sitecreator as sc

    pack, comps = registry(set_key)
    docs = []
    pages = sc.pages_of(brief or {})
    titles = {f: t for f, t in pages}
    for name in sorted((n for n in files if n.endswith(".html")), key=lambda n: (n != "index.html", n)):
        mp = sc._main_parts(files[name])
        if not mp:
            continue
        before, secs, after = mp
        counter = [0]
        inhoud = []
        for sid, h in secs:
            nodes = _section_nodes(h, comps, counter)
            for k, n in enumerate(nodes):
                if k == 0 and sid:
                    n["anker"] = sid
            inhoud.extend(nodes)

        def one(part):
            m = re.search(rf"<{part}>\s*(.*?)\s*</{part}>", files[name], re.S)
            ns = _section_nodes(m.group(1), comps, counter) if m else []
            return ns[0] if ns else None

        title = titles.get(name) or (re.search(r"<title>(.*?)</title>", files[name], re.S) or [None, name])[1]
        lang = re.search(r'<html[^>]*lang="([a-z-]+)"', files[name])
        doc = {"formaat": pf.FORMAT, "set": {"sleutel": pack["key"], "versie": pack["version"]},
               "pagina": {"titel": str(title)[:120], "slug": "index" if name == "index.html" else name[:-5], "taal": lang.group(1) if lang else "nl", "type": "home" if name == "index.html" else "standaard",
                          "seo": {"titel": str(title)[:80], "omschrijving": ((re.search(r'<meta name="description" content="([^"]*)"', files[name]) or [None, ""])[1])[:160], "og_afbeelding": ""}},
               "header": one("header"), "inhoud": inhoud, "footer": one("footer"), "ontbrekende_componenten": _missing_of(brief, inhoud)}
        for n in [doc["header"], doc["footer"], *inhoud]:
            _stamp(n, pack["version"])
        docs.append({"file": name, "document": doc})
    return docs


def _missing_of(brief, inhoud):
    """The specifications of the missing components that this page uses (from the brief of the design), with where they are used."""
    specs = {m.get("voorgesteld_type"): m for m in (brief or {}).get("ontbrekende_componenten") or [] if isinstance(m, dict)}
    out = {}
    for i, n in enumerate(inhoud):
        if n.get("type") == "placeholder":
            t = (n.get("props") or {}).get("voorgesteld_type")
            spec = dict(out.get(t) or specs.get(t) or {"voorgesteld_type": t, "naam": str(t), "doel": "(niet beschreven)"})
            spec["gebruikt_op"] = [*(spec.get("gebruikt_op") or []), f"/inhoud/{i}"]
            out[t] = spec
    return list(out.values())


def _stamp(node, version):
    if isinstance(node, dict):
        if node.get("type") not in LAYOUT_TYPES and "versie" in node:
            node["versie"] = version
        for c in node.get("children") or []:
            _stamp(c, version)


def node_html(node, comps):
    """The html of one node (a component filled with its props, a band with columns, a system object or the placeholder)."""
    from . import sitecreator as sc

    t = node.get("type")
    if t == "band":
        pr = node.get("props") or {}
        cells = [("\n".join(node_html(x, comps) for x in (c.get("children") or []))) for c in node.get("children") or []]
        return sc._band_html({"bg": pr.get("bg"), "cols": pr.get("cols"), "valign": pr.get("valign"), "screen": bool(pr.get("screen"))}, cells)
    if t == "sysobject":
        return f'<div data-sysobject="{(node.get("props") or {}).get("slug", "")}"></div>'
    if t == "placeholder":
        spec = (node.get("props") or {}).get("voorgesteld_type", "")
        return f'<div data-easy2edit-tag="placeholder" data-missing="{spec}"><p>Component ontbreekt: {spec}</p></div>'
    c = comps.get(t)
    return pf.render(c, node.get("props") or {}) if c else ""


def document_to_html(doc, brief=None, set_key=None):
    """A document as the html of its page (the same markup as the creator makes), for the preview and the import."""
    from . import sitecreator as sc

    pack, comps = registry(set_key)
    pg = doc.get("pagina") or {}
    seo = pg.get("seo") or {}
    secs = [(n.get("anker") or "", node_html(n, comps)) for n in doc.get("inhoud") or []]
    header = node_html(doc["header"], comps) if doc.get("header") else ""
    footer = node_html(doc["footer"], comps) if doc.get("footer") else ""
    b = {**(brief or {}), "name": (brief or {}).get("name") or "", "lang": {"nl": "Dutch", "en": "English", "de": "German", "fr": "French", "es": "Spanish"}.get(pg.get("taal"), "Dutch")}
    return sc._page_html(b, {"title": pg.get("titel") or "", "description": seo.get("omschrijving") or ""}, header, secs, footer)


def validate_design(files, brief, ctx=None):
    """All pages of a design validated: {valid, pages: [{file, rapport}]}. The documents are made from the html of the pages."""
    docs = design_to_documents(files, brief)
    ctx = ctx if ctx is not None else site_context()
    ctx = {**ctx, "paginas": {d["file"] for d in docs}}
    out = []
    for d in docs:
        rep, _doc = validate(d["document"], {**ctx, "slugs": set()})  # (a design that is not imported yet can not conflict with the pages of the site)
        out.append({"file": d["file"], "rapport": rep})
    return {"geldig": all(p["rapport"]["geldig"] for p in out), "paginas": out}


# ── the import: only a document without errors becomes a design (a concept) ──
def documents_of(body):
    """The documents in a request: {"paginas": [doc, ...]} or one document (or {"document": doc}). -> list."""
    if isinstance(body, dict) and isinstance(body.get("paginas"), list):
        return body["paginas"]
    if isinstance(body, dict) and isinstance(body.get("document"), dict):
        return [body["document"]]
    return [body] if isinstance(body, dict) else []


def validate_many(docs, ctx=None):
    """Every document validated; the pages of the batch know each other (links between them). -> (reports, repaired documents)."""
    ctx = ctx if ctx is not None else site_context()
    files = {f"{(d.get('pagina') or {}).get('slug') or 'index'}.html" for d in docs if isinstance(d, dict)}
    reports, fixed = [], []
    for d in docs:
        rep, doc = validate(d, {**ctx, "paginas": files | set(ctx.get("paginas") or ())})
        reports.append(rep)
        fixed.append(doc)
    return reports, fixed


class _FetchFailed(Exception):
    """One or more pictures could not be fetched: [(document index, pointer, message)]."""

    def __init__(self, problems):
        super().__init__("pictures")
        self.problems = problems


def _pictures(value, pad, out):
    """Every picture value ({src, alt}) in a node, with the JSON Pointer of its src."""
    if isinstance(value, dict):
        if "src" in value and "alt" in value:
            out.append((pad, value))
            return
        for k, v in value.items():
            _pictures(v, f"{pad}/{k}", out)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _pictures(v, f"{pad}/{i}", out)


def _doc_pictures(doc):
    out = []

    def node(n, pad):
        if not isinstance(n, dict):
            return
        _pictures(n.get("props"), pad + "/props", out)
        for i, c in enumerate(n.get("children") or []):
            node(c, f"{pad}/children/{i}")

    for key in ("header", "footer"):
        node(doc.get(key), f"/{key}")
    for i, n in enumerate(doc.get("inhoud") or []):
        node(n, f"/inhoud/{i}")
    return out


def fetch_pictures(docs, user, saved, fetch=None):
    """Fetches the pictures that are given as an https address, puts them in the media library and points the document at them (img/<file>, the file is a photo of the design).
    -> (documents, photos of the design). `saved` gets every MediaItem that was made (the caller removes them when the import fails). Raises _FetchFailed when a picture can not be fetched.
    The same address is fetched once. All problems are collected, so the person sees them at once."""
    from . import imagefetch
    from . import sitecreator as sc
    from django.core.files.storage import default_storage

    fetch = fetch or imagefetch.fetch
    docs = json.loads(json.dumps(docs))
    done, photos, problems, total = {}, [], [], 0
    for di, d in enumerate(docs):
        for pad, v in _doc_pictures(d):
            src = str(v.get("src") or "").strip()
            if not src.lower().startswith("https://"):
                continue
            if src not in done:
                if len(done) >= sc.MAX_PHOTOS:
                    problems.append((di, pad + "/src", f"Er kunnen niet meer dan {sc.MAX_PHOTOS} afbeeldingen van een adres mee."))
                    continue
                try:
                    data, ext = fetch(src)
                    total += len(data)
                    if total > imagefetch.MAX_TOTAL:
                        raise imagefetch.FetchError("Samen zijn de afbeeldingen te groot (meer dan 40 MB).")
                    base = re.sub(r"\.[a-z0-9]{2,5}$", "", src.split("?")[0].rstrip("/").split("/")[-1], flags=re.I) or "afbeelding"
                    item = imagefetch.save(data, ext, base, user)
                    saved.append(item)
                except imagefetch.FetchError as e:
                    problems.append((di, pad + "/src", str(e)))
                    done[src] = None
                    continue
                file = f"import-{len(done) + 1}.{ext}"
                done[src] = file
                photos.append({"id": item.id, "file": file, "name": item.name[:120], "url": default_storage.url(item.key), "note": str(v.get("alt") or "")[:200]})
            if done.get(src):
                v["src"] = "img/" + done[src]
            elif src in done:
                problems.append((di, pad + "/src", "Deze afbeelding kon niet worden opgehaald."))
    if problems:
        raise _FetchFailed(problems)
    return docs, photos



def _remove_saved(items):
    """The files of pictures that were saved for an import that did not succeed (storage is not part of the database transaction, which removes the items itself)."""
    from django.core.files.storage import default_storage

    for it in items:
        try:
            default_storage.delete(it.key)
        except Exception:  # noqa: BLE001
            pass


def import_documents(user, body, name=""):
    """Validates AGAIN (a validation of the client is never trusted) and, only when there is no error, makes ONE design (a concept) from the documents, all or nothing.
    -> (reports, job or None). The design is a concept: it is checked in the creator and made into pages with 'Alles aanmaken'."""
    from django.db import transaction

    from . import sitecreator as sc
    from .models import SiteDesignJob

    docs = documents_of(body)
    if not docs or len(docs) > 10:
        return [{"geldig": False, "formaat": pf.FORMAT, "meldingen": [{"ernst": "fout", "code": "STRUCTUUR_VELD", "pad": "", "component": "", "melding": "Geef 1 tot 10 pagina's.", "suggestie": ""}], "reparaties": [], "ontbrekende_componenten": []}], None
    reports, fixed = validate_many(docs)
    if not all(r["geldig"] for r in reports):
        return reports, None
    pages = ", ".join(str((d.get("pagina") or {}).get("titel") or "")[:60] for d in fixed)
    first = fixed[0]
    brief = {"name": str(name or (first.get("pagina") or {}).get("titel") or "Ontwerp")[:120], "kind": "company", "lang": "Dutch", "mode": "new", "step": 6, "font": "sans", "pages": pages, "sectioned": True, "imported_document": True}
    saved = []
    try:
        with transaction.atomic():
            fixed, photos = fetch_pictures(fixed, user, saved)
            if photos:
                brief["photos"] = photos
            files = {}
            for i, d in enumerate(fixed):
                fn = "index.html" if i == 0 else f"{(d.get('pagina') or {}).get('slug') or 'pagina'}.html"
                files[fn] = document_to_html(d, brief)
            files = sc.themed({**files, "style.css": "/* the theme is written by the system */\n"}, sc.clean_brief({}, brief))
            job = SiteDesignJob.objects.create(user=user, name=brief["name"], status="done", progress=100, brief=brief, files=files,
                                               messages=[{"role": "ai", "text": f"Het ontwerp is geïmporteerd ({len(fixed)} pagina's) en gecontroleerd. Het staat als concept klaar."}])
    except _FetchFailed as e:
        _remove_saved(saved)
        for di, pad, text in e.problems:
            reports[di]["meldingen"].append({"ernst": "fout", "code": "MEDIA_OPHALEN", "pad": pad, "component": "", "melding": text, "suggestie": "Controleer het adres, of upload de afbeelding en gebruik media:<id>."})
            reports[di]["geldig"] = False
        return reports, None
    except Exception:
        _remove_saved(saved)
        raise
    return reports, job
