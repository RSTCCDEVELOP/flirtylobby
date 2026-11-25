# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Adds the extra hero components to the standard component set (more than split / centre / dark): a hero with a full-screen photo behind the text, a centred one, a text card on a photo,
a collage, a typographic (newspaper) opening, a wide panorama and an image-left variant. Writes the next version of resource/components/easy2edit-ui-kit-<version>.zip.

  venv/bin/python tools/make_kit_heroes.py     (from backend/; run it after make_kit_extra.py and before make_kit_variants.py)

A picture is a role="img" element (a picture place: the slot of the page format); the photo is put in it as an <img> that fills the whole hero. Only the tokens of the kit (--e2e-*) are used."""
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "resource" / "components"
KEY = "easy2edit-ui-kit"
MARK = "/* ===== HERO'S: FOTO, KAART, COLLAGE, TYPOGRAFIE */"


def C(tag, name, desc, body):
    return {"easy2edit_tag": tag, "name": name, "description": desc, "group": "Content-blokken", "category": "Hero", "html": f'<div data-easy2edit-tag="{tag}">\n{body.strip()}\n</div>'}


BTNS = '<div class="e2e-row"><a href="#" class="e2e-btn e2e-btn--lg">Primaire actie</a><a href="#" class="e2e-btn e2e-btn--outline e2e-btn--lg">Meer weten</a></div>'
BTNS_LIGHT = '<div class="e2e-row"><a href="#" class="e2e-btn e2e-btn--lg">Primaire actie</a><a href="#" class="e2e-btn e2e-btn--light e2e-btn--lg">Meer weten</a></div>'

HEROES = [
    C("ui-hero-image", "Hero met foto", "Een grote foto over de volle breedte met de tekst erop (links), op een donkere laag. Een heel ander effect dan tekst naast een plaatje.", f"""
<section class="e2e-hero e2e-hero--image">
  <div class="e2e-herobg" role="img" aria-label="Achtergrondfoto"></div>
  <div class="e2e-hero__shade"></div>
  <div class="e2e-container e2e-hero__body">
    <span class="e2e-eyebrow">Welkom</span>
    <h1>Een krachtige kop die <span>blijft hangen</span></h1>
    <p class="e2e-lead">Een korte, heldere zin die uitlegt wat je doet en voor wie.</p>
    {BTNS_LIGHT}
  </div>
</section>"""),
    C("ui-hero-image-center", "Hero met foto, gecentreerd", "Schermvullende foto met de tekst in het midden, hoog en rustig. Voor een groot, sfeervol begin.", f"""
<section class="e2e-hero e2e-hero--image e2e-hero--tall e2e-hero--center">
  <div class="e2e-herobg" role="img" aria-label="Achtergrondfoto"></div>
  <div class="e2e-hero__shade"></div>
  <div class="e2e-container e2e-hero__body">
    <span class="e2e-badge">Nieuw</span>
    <h1>Een sfeervolle kop in het midden</h1>
    <p class="e2e-lead">Een korte zin die de beloofde sfeer en de belangrijkste reden vertelt.</p>
    {BTNS_LIGHT}
  </div>
</section>"""),
    C("ui-hero-card", "Hero met tekstkaart op foto", "Een foto over de volle breedte met een vlakke kaart met de tekst erop, als een tijdschriftomslag.", f"""
<section class="e2e-hero e2e-hero--card">
  <div class="e2e-herobg" role="img" aria-label="Achtergrondfoto"></div>
  <div class="e2e-container e2e-hero__body">
    <div class="e2e-hero__panel">
      <span class="e2e-eyebrow">Uitgelicht</span>
      <h1>Een kop op een kaart, met de foto eromheen</h1>
      <p class="e2e-lead">De kaart houdt de tekst leesbaar, wat de foto er ook achter doet.</p>
      {BTNS}
    </div>
  </div>
</section>"""),
    C("ui-hero-collage", "Hero met fotocollage", "Tekst links en een collage van drie foto's rechts: één grote en twee kleine.", f"""
<section class="e2e-hero e2e-hero--collage">
  <div class="e2e-container e2e-hero__inner">
    <div>
      <span class="e2e-eyebrow">Sfeer en beeld</span>
      <h1>Laat zien <span>wat je doet</span> met meer dan één foto</h1>
      <p class="e2e-lead">Drie beelden vertellen sneller wat je biedt dan een alinea.</p>
      {BTNS}
    </div>
    <div class="e2e-hero__mosaic">
      <div class="e2e-mosaic__a" role="img" aria-label="Grote foto"></div>
      <div class="e2e-mosaic__b" role="img" aria-label="Foto rechtsboven"></div>
      <div class="e2e-mosaic__c" role="img" aria-label="Foto rechtsonder"></div>
    </div>
  </div>
</section>"""),
    C("ui-hero-type", "Hero typografisch (krant)", "Alleen typografie: een grote kop met lijnen en een intro in twee kolommen, zoals de voorpagina van een krant of tijdschrift.", f"""
<section class="e2e-hero e2e-hero--type">
  <div class="e2e-container">
    <div class="e2e-hero__masthead"><span class="e2e-eyebrow">Editie van vandaag</span><span class="e2e-hero__rule"></span><span class="e2e-eyebrow">Sinds 1923</span></div>
    <h1>Een grote kop die de hele breedte pakt</h1>
    <div class="e2e-hero__cols">
      <p class="e2e-lead">Een eerste alinea die de lezer meeneemt: wat gebeurt er, waarom is het belangrijk en wat kun je er nu mee.</p>
      <p>Een tweede alinea met meer achtergrond. Houd het kort en concreet, zodat de pagina erna het verhaal kan vertellen.</p>
    </div>
    {BTNS}
  </div>
</section>"""),
    C("ui-hero-wide", "Hero met brede foto", "De kop gecentreerd bovenaan en daaronder een brede panoramafoto die het beeld bepaalt.", f"""
<section class="e2e-hero e2e-hero--wide e2e-hero--center">
  <div class="e2e-container">
    <span class="e2e-eyebrow">Ontdek</span>
    <h1>Eerst de kop, dan een foto die alles zegt</h1>
    <p class="e2e-lead">Een rustige opening met veel ruimte, gevolgd door een breed beeld.</p>
    {BTNS}
    <div class="e2e-hero__panorama" role="img" aria-label="Brede foto"></div>
  </div>
</section>"""),
    C("ui-hero-split-reverse", "Hero gesplitst, beeld links", "Een grote foto tegen de linkerrand en de tekst rechts. De spiegel van de gesplitste hero.", f"""
<section class="e2e-hero e2e-hero--reverse">
  <div class="e2e-hero__side" role="img" aria-label="Foto links"></div>
  <div class="e2e-container e2e-hero__inner">
    <div class="e2e-hero__text">
      <span class="e2e-eyebrow">Over ons</span>
      <h1>Een kop naast een foto die de hele hoogte vult</h1>
      <p class="e2e-lead">De foto loopt door tot de rand van het scherm en geeft de pagina diepte.</p>
      {BTNS}
    </div>
  </div>
</section>"""),
]

CSS = MARK + r"""
.e2e-hero--image,.e2e-hero--card{position:relative;overflow:hidden;min-height:clamp(26rem,72vh,46rem);display:flex;align-items:center;background:var(--e2e-accent);color:#fff;padding-block:clamp(3rem,8vw,6rem)}
.e2e-hero--tall{min-height:clamp(30rem,88vh,60rem)}
.e2e-herobg{position:absolute;inset:0;z-index:0;background:linear-gradient(145deg,var(--e2e-primary),color-mix(in srgb,var(--e2e-primary) 40%,var(--e2e-accent)) 60%,var(--e2e-accent))}
.e2e-herobg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.e2e-hero__shade{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(0,0,0,.68),rgba(0,0,0,.35) 55%,rgba(0,0,0,.12))}
.e2e-hero--center .e2e-hero__shade{background:rgba(0,0,0,.5)}
.e2e-hero--image .e2e-hero__body,.e2e-hero--card .e2e-hero__body{position:relative;z-index:2}
.e2e-hero--image h1,.e2e-hero--image .e2e-lead,.e2e-hero--image .e2e-eyebrow{color:#fff}
.e2e-hero--image h1{font-size:clamp(2.4rem,6vw,4.6rem);line-height:1.05;max-width:18ch}
.e2e-hero--image.e2e-hero--center h1{margin-inline:auto;max-width:20ch}
.e2e-hero--image h1 span{color:color-mix(in srgb,var(--e2e-primary) 55%,#fff)}
.e2e-hero--image .e2e-lead{color:rgba(255,255,255,.88);max-width:40rem}
.e2e-hero--image.e2e-hero--center .e2e-lead{margin-inline:auto}
.e2e-hero--card{background:var(--e2e-bg)}
.e2e-hero__panel{max-width:34rem;background:var(--e2e-bg);color:var(--e2e-text);padding:clamp(1.5rem,4vw,2.6rem);border-radius:var(--e2e-radius-lg);box-shadow:var(--e2e-shadow)}
.e2e-hero__panel h1{color:var(--e2e-text);font-size:clamp(1.9rem,4vw,3rem);line-height:1.1}
.e2e-hero__panel .e2e-lead{color:var(--e2e-muted)}
.e2e-hero--collage .e2e-hero__inner{align-items:center}
.e2e-hero__mosaic{display:grid;gap:.8rem;grid-template-columns:1.35fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:5/4}
.e2e-hero__mosaic>div{position:relative;overflow:hidden;border-radius:var(--e2e-radius-lg);background:linear-gradient(145deg,var(--e2e-primary),var(--e2e-accent));box-shadow:var(--e2e-shadow)}
.e2e-hero__mosaic .e2e-mosaic__a{grid-row:1/3}
.e2e-hero__mosaic .e2e-mosaic__b{background:linear-gradient(145deg,var(--e2e-secondary),var(--e2e-primary))}
.e2e-hero__mosaic .e2e-mosaic__c{background:linear-gradient(145deg,var(--e2e-accent),var(--e2e-secondary))}
.e2e-hero__mosaic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.e2e-hero--type{background:var(--e2e-bg);padding-block:clamp(2rem,5vw,4rem)}
.e2e-hero--type h1{font-size:clamp(2.8rem,9vw,7rem);line-height:.98;letter-spacing:-.03em;margin:.6rem 0 1.4rem;border-top:3px solid var(--e2e-text);border-bottom:1px solid var(--e2e-text);padding-block:1rem}
.e2e-hero__masthead{display:flex;align-items:center;gap:1rem}
.e2e-hero__rule{flex:1;height:1px;background:var(--e2e-border-strong)}
.e2e-hero__cols{columns:2 20rem;column-gap:2.5rem;margin-bottom:1.6rem}
.e2e-hero__cols p{margin:0 0 1rem;break-inside:avoid}
.e2e-hero--wide{padding-bottom:0;overflow:hidden}
.e2e-hero__panorama{position:relative;margin-top:clamp(1.6rem,4vw,3rem);aspect-ratio:21/9;border-radius:var(--e2e-radius-lg) var(--e2e-radius-lg) 0 0;overflow:hidden;background:linear-gradient(145deg,var(--e2e-primary),color-mix(in srgb,var(--e2e-primary) 40%,var(--e2e-accent)) 60%,var(--e2e-accent))}
.e2e-hero__panorama img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.e2e-hero--reverse{position:relative;padding-block:0;min-height:clamp(26rem,70vh,42rem);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.e2e-hero--reverse .e2e-hero__side{position:relative;overflow:hidden;background:linear-gradient(145deg,var(--e2e-primary),var(--e2e-accent));min-height:18rem}
.e2e-hero--reverse .e2e-hero__side img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.e2e-hero--reverse .e2e-hero__inner{display:flex;align-items:center;max-width:none;margin:0;padding-block:clamp(2rem,6vw,5rem);padding-inline:clamp(1.5rem,5vw,4rem)}
@media (max-width:760px){.e2e-hero--reverse{grid-template-columns:1fr}.e2e-hero__mosaic{aspect-ratio:auto;grid-template-rows:12rem 8rem}.e2e-hero__shade{background:rgba(0,0,0,.55)}}
"""


def main():
    zips = sorted(LIB.glob(f"{KEY}-*.zip"))
    if not zips:
        sys.exit("Geen easy2edit-ui-kit zip in resource/components.")
    src = zips[-1]
    z = zipfile.ZipFile(src)
    man = json.loads(z.read("components.json"))
    css, js = z.read("components.css").decode(), z.read("components.js").decode()
    css = css.split(MARK)[0].rstrip() + "\n" + CSS
    tags = {c["easy2edit_tag"] for c in HEROES}
    had = any(c["easy2edit_tag"] in tags for c in man["components"])
    keep = [c for c in man["components"] if c["easy2edit_tag"] not in tags]
    first = next((i for i, c in enumerate(keep) if c.get("category") == "Hero"), len(keep))  # the new heroes stand with the other heroes
    last = max((i for i, c in enumerate(keep) if c.get("category") == "Hero"), default=first - 1)
    comps = keep[:last + 1] + HEROES + keep[last + 1:]
    major, minor, patch = (int(x) for x in str(man["version"]).split("."))
    man["version"] = f"{major}.{minor}.{patch + (0 if had and False else 1)}"
    man["components"] = comps
    out = LIB / f"{KEY}-{man['version']}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as w:
        w.writestr("components.json", json.dumps(man, indent=2, ensure_ascii=False))
        w.writestr("components.css", css)
        w.writestr("components.js", js)
    for old in LIB.glob(f"{KEY}-*.zip"):
        if old != out:
            old.unlink()
    print(out, len(comps), "components")


if __name__ == "__main__":
    main()
