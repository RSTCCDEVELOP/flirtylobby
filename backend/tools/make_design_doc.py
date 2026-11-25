# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Makes the PDF "Ontwerpmogelijkheden met easy2edit: de bouwstenen" (Dutch): how a page is built, the options of a block, the building blocks of the page editor, every component of the UI-kit
with a real picture of it, the widgets and the media objects.

  venv/bin/python tools/make_design_doc.py [output.pdf]     (from backend/; needs Google Chrome or Chromium for the PDF)

The pictures are the components themselves, drawn with the css of the standard set (the newest easy2edit-ui-kit zip)."""
import html
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "resource" / "components"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "md" / "ontwerpmogelijkheden-bouwstenen.pdf"
e = html.escape

LAYERS = [("Pagina", "Een pagina is een lijst met rijen (blokken) van boven naar beneden. Bovenaan komt desgewenst de banner (hero) met de titel."),
          ("Rij (blok)", "Een volle rij van de pagina met een eigen achtergrond, hoogte, ruimte en effect. Een rij kan een hero zijn."),
          ("Kolommen", "In een rij staan 1 tot 4 kolommen naast elkaar, met verhoudingen als 1, 2, 3, 4, 2-1, 1-2, 3-1 en 1-3. Op een telefoon komen ze onder elkaar."),
          ("Items", "In een kolom staan items: tekst, kop, afbeelding, knop, lijn, ruimte, widget of een object van het systeem."),
          ("Onderdelen van de UI-kit", "Complete bouwstenen (hero, kaarten, prijzen, FAQ, kalender ...) die de kleuren, lettertypen en hoeken van het thema volgen. Elk is één item in een kolom of een rij van zichzelf."),
          ("Widgets en objecten", "Kleine levende onderdelen (aftelklok, openingstijden ...), media-objecten (carrousel, mozaïek ...) en onderdelen van modules (agenda, producten, documenten).")]

ROW_OPTIONS = [
    ("Breedte", "Standaard de kolom van de pagina; een rij kan paginabreed of over het hele scherm lopen (met de inhoud binnen de paginabreedte)."),
    ("Hoogte", "Naar inhoud, vaste hoogte in pixels, een percentage van het scherm of het hele scherm. Zo maak je een hero van schermhoogte."),
    ("Achtergrond", "Een kleur, een foto of een video uit de mediabibliotheek, met een donkere of lichte laag erover (0 tot 90 procent)."),
    ("Parallax", "De achtergrondfoto of -video beweegt trager dan de pagina."),
    ("Uitlijning", "De inhoud bovenaan, in het midden of onderaan; links, midden of rechts; de rij zelf links, midden of rechts als hij smaller is dan de pagina."),
    ("Ruimte", "Vijf standaardmaten (geen, klein, normaal, groot, extra groot) of een eigen ruimte in pixels per zijde; de ruimte tot het blok erboven."),
    ("Stijl van het blok", "Eigen kleur van de achtergrond, tekst en randen, doorzichtigheid, afgeronde hoeken en een eigen lettertype, of terug naar het thema."),
    ("Verschijnen", "Het blok komt in beeld met: vervagen, omhoog, omlaag, inzoomen, van links, van rechts, onscherp, omklappen, draaien of springen; met eigen snelheid, wachttijd en versnelling."),
    ("Bij de muis", "Optillen, groter, kleiner, gloed, kantelen of dimmen."),
    ("Blijft bewegen", "Zweven, pulseren of zwaaien."),
    ("Naam en anker", "Een naam voor in het menu en een anker om naar het blok te linken (pagina#anker)."),
]

ITEMS = [("Kop", "Een titel of tussenkop in het lettertype van het thema, met kleur en uitlijning."),
         ("Tekst", "Een alinea met opmaak, lijsten, koppen en links (de kleine editor); in alle talen van de website."),
         ("Afbeelding", "Een foto uit de mediabibliotheek, met opmaak: hoeken, schaduw, rand, formaat, uitsnede en een link."),
         ("Knop", "Naar een pagina of een link, in elke taal een eigen tekst; vol, omlijnd of als tekstlink; met pictogram, kleur en formaat."),
         ("Lijn en ruimte", "Een scheidingslijn of een lege ruimte van een gekozen hoogte."),
         ("Widget: contact", "Contactgegevens van het bedrijf, vanuit de entiteit ingevuld."),
         ("Widget: sociale media", "Links naar de sociale kanalen."),
         ("Widget: kaart", "Een kaart met het adres, met zoom, hoogte en soort kaart (kaart, satelliet, terrein)."),
         ("Widget: video", "Een YouTube- of Vimeo-video, zonder tracking."),
         ("Widget: citaat", "Een quote met naam."),
         ("Widget: cijfers", "Grote getallen met een omschrijving."),
         ("Widget: logo", "Het logo van de website."),
         ("Widget: openingstijden", "De tijden per dag."),
         ("Widget: code", "Een onderdeel van de UI-kit (zie verder) of eigen html met css, zonder scripts."),
         ("Object van het systeem", "Een mediastijl, een widget uit de bibliotheek of een onderdeel van een module.")]

DIRECTIONS = [("Foto-gedreven", "Grote foto over de volle breedte met tekst erop, grote foto's verder op de pagina."),
              ("Redactioneel", "Krantenvoorpagina of tijdschrift: typografische kop, tekstkaart op een foto, kolommen."),
              ("Beeldrijk", "Een collage of brede panoramafoto, galerijen en mediaobjecten."),
              ("Klassiek", "Tekst naast een foto, rustige volle banden, kaarten en reviews."),
              ("Donker en krachtig", "Een donkere hero, grote koppen, hoog contrast.")]

CSS = r"""
@page { size: 1240px 1754px; margin: 60px 50px 70px; }  /* A4 in proportion, but wide enough (1240 px) for the responsive css of the components to show their desktop layout; it prints on A4 scaled down */
* { box-sizing: border-box; }
body { margin: 0; font: 20px/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2937; }
h1 { font-size: 60px; margin: 0 0 16px; letter-spacing: -.02em; line-height: 1.05; } h2 { font-size: 34px; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 3px solid #1d8fd1; break-after: avoid; }
h3 { font-size: 26px; margin: 34px 0 10px; color: #1d6fa0; break-after: avoid; } p { margin: 0 0 14px; }
.cover { min-height: 1500px; display: flex; flex-direction: column; justify-content: center; } .cover small { color: #6b7280; font-size: 18px; }
.lead { font-size: 26px; color: #374151; }
.pb { break-before: page; }
table.t { width: 100%; border-collapse: collapse; margin: 8px 0 20px; } table.t td { padding: 9px 13px; border-bottom: 1px solid #e5e7eb; vertical-align: top; } table.t td:first-child { width: 190px; font-weight: 700; background: #f3f8fc; }
.chips { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 20px; } .chip { padding: 5px 15px; border-radius: 99px; background: #eaf4fb; border: 1px solid #c5e0f2; font-size: 18px; }
.layers { display: grid; gap: 10px; margin: 14px 0; } .layer { padding: 14px 18px; border-radius: 10px; border-left: 6px solid #1d8fd1; background: #f3f8fc; } .layer b { display: block; }
.toc { columns: 2; column-gap: 40px; } .toc div { break-inside: avoid; display: flex; justify-content: space-between; border-bottom: 1px dotted #cbd5e1; padding: 5px 0; }
.card { break-inside: avoid; margin: 0 0 30px; } .card h4 { margin: 0 0 5px; font-size: 22px; } .card h4 span { font-weight: 400; color: #6b7280; font-size: 16px; margin-left: 12px; font-family: Menlo, monospace; } .card p { color: #4b5563; font-size: 18px; margin: 0 0 8px; }
.pv { position: relative; contain: paint; width: 1180px; zoom: .96; max-height: 900px; overflow: hidden; border: 1px solid #d1d5db; border-radius: 8px; background: var(--e2e-bg, #fff); }
.pvf { display: block; width: 1180px; height: 300px; border: 1px solid #d1d5db; border-radius: 8px; zoom: .96; background: #fff; }
.pvw { width: 100%; overflow: hidden; }
.dir { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } .dir div { padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; } .dir b { display: block; color: #1d6fa0; }
footer.f { color: #6b7280; font-size: 17px; margin-top: 40px; }
"""


def main():
    zips = sorted(LIB.glob("easy2edit-ui-kit-*.zip"))
    if not zips:
        sys.exit("Geen easy2edit-ui-kit zip in resource/components.")
    z = zipfile.ZipFile(zips[-1])
    man = json.loads(z.read("components.json"))
    kit_css, kit_js = z.read("components.css").decode(), z.read("components.js").decode()
    comps = man["components"]
    groups = OrderedDict()
    for c in comps:
        groups.setdefault(c["group"], []).append(c)
    widgets = []
    for p in sorted((ROOT / "source" / "widgets").glob("*/widget.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
            widgets.append(d)
        except ValueError:
            pass
    media = ["Beeldcarrousel", "Diavoorstelling", "Coverflow", "Fotoboek", "Bladerboek", "Fotomuur", "Fotostapel", "Mozaïek", "Galerij met filmstrip", "Videocarrousel", "Videoraster", "Videolijst met speler"]

    out = [f"<h1>Ontwerpmogelijkheden met easy2edit</h1><p class='lead'>Deel 1: de bouwstenen</p>"]
    cover = ("<div class='cover'><h1>Ontwerpmogelijkheden<br>met easy2edit</h1><p class='lead'>Deel 1: de bouwstenen</p>"
             f"<p>Alles waarmee een website in easy2edit kan worden opgebouwd: de lagen van een pagina, de opties van een blok, de bouwstenen van de pagina-editor, de {len(comps)} onderdelen van de UI-kit met een echte afbeelding, "
             f"de {len(widgets)} widgets en de mediaobjecten.</p><p><small>Versie van de UI-kit: {e(str(man['version']))} · gemaakt met tools/make_design_doc.py · RST Coaching &amp; Consultancy B.V.</small></p></div>")
    out = [cover]
    out.append("<div class='pb'></div><h2>1. Hoe een pagina is opgebouwd</h2><p>Van groot naar klein. De AI-creator en de pagina-editor gebruiken precies dezelfde lagen, dus alles wat de creator maakt kun je daarna zelf bewerken.</p><div class='layers'>"
               + "".join(f"<div class='layer'><b>{e(a)}</b>{e(b)}</div>" for a, b in LAYERS) + "</div>")
    out.append("<h2>2. De opties van een rij (blok)</h2><p>Dit is wat een ontwerp per rij kan variëren. Een grote foto met tekst erop, een schermhoge opening, een tinten-ritme: het zijn allemaal combinaties hiervan.</p><table class='t'>"
               + "".join(f"<tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in ROW_OPTIONS) + "</table>")
    out.append("<h2>3. De bouwstenen van de pagina-editor</h2><table class='t'>" + "".join(f"<tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in ITEMS) + "</table>")
    out.append("<h2>4. Ontwerprichtingen van de creator</h2><p>De creator kiest per website een richting (of de klant kiest er een). Elke richting bepaalt de opening en het ritme van de hele pagina.</p><div class='dir'>"
               + "".join(f"<div><b>{e(a)}</b>{e(b)}</div>" for a, b in DIRECTIONS) + "</div>")
    out.append("<div class='pb'></div><h2>5. Onderdelen van de UI-kit</h2><p>Alle onderdelen van de standaardset, gegroepeerd. Ze nemen de kleuren, lettertypen en hoeken van het thema over; hier zijn ze getekend met de standaardkleuren. In een ontwerp zijn ze ook los te vullen met eigen teksten, foto's en knoppen.</p>"
               "<div class='toc'>" + "".join(f"<div><span>{e(g)}</span><b>{len(v)}</b></div>" for g, v in groups.items()) + f"<div><span><b>Totaal</b></span><b>{len(comps)}</b></div></div>")
    n = 0
    for g, items in groups.items():
        out.append(f"<h3 class='pb'>{e(g)}</h3>" if False else f"<h3>{e(g)}</h3>")
        for c in items:
            out.append(f"<div class='card'><h4>{e(c['name'])}<span>{e(c['easy2edit_tag'])} · {e(c.get('category', ''))}</span></h4><p>{e(c.get('description', ''))}</p><div class='pvw'><iframe class='pvf' data-t='{n}' scrolling='no'></iframe></div><template id='t{n}'>{c['html']}</template></div>")
            n += 1
    out.append("<div class='pb'></div><h2>6. Widgets uit de bibliotheek</h2><p>Kleine, levende onderdelen die je installeert (Thema → Widgets) en op elke pagina zet.</p><table class='t'>"
               + "".join(f"<tr><td>{e(w.get('name', ''))}</td><td><i>{e(w.get('category', ''))} › {e(w.get('subcategory', ''))}</i><br>{e(w.get('description', ''))}</td></tr>" for w in widgets) + "</table>")
    out.append("<h2>7. Mediaobjecten</h2><p>Een verzameling foto's of video's in een eigen stijl, bij te stellen met de eigen foto's.</p><div class='chips'>" + "".join(f"<span class='chip'>{e(m)}</span>" for m in media) + "</div>")
    out.append("<h2>8. Onderdelen van modules</h2><p>Wie een module aan heeft, kan er onderdelen van op een pagina zetten: agenda en afspraken, producten en winkelwagen, documenten, showcase, forum, community, abonnementen, donaties en spelletjes. De creator zet ze op een pagina als de klant die functies heeft gekozen.</p>")
    out.append("<footer class='f'>Deel 2 volgt: thema's en kleuren, lettertypen en hoeken, sjablonen, installaties, en de pagina's die daarvan te maken zijn.</footer>")
    # every picture is an iframe 1180 px wide: the responsive css of a component then sees a desktop width (Chrome prints with a narrow window, so media queries outside an iframe would show the phone layout)
    script = ("<script>const KIT_CSS=" + json.dumps(kit_css) + ";document.querySelectorAll('iframe.pvf').forEach(function(f){var t=document.getElementById('t'+f.dataset.t);"
              "f.srcdoc='<!doctype html><meta charset=utf-8><style>'+KIT_CSS+'</style><style>*{animation:none!important}body{margin:0}</style><body>'+t.innerHTML;"
              "f.onload=function(){try{var d=f.contentDocument;f.style.height='10px';var h=Math.ceil(Math.max(d.body.getBoundingClientRect().height,d.body.scrollHeight))+2;f.style.height=Math.min(Math.max(h,60),900)+'px';}catch(e){}};});</script>")
    doc = f"<!doctype html><html lang='nl'><head><meta charset='utf-8'><title>Ontwerpmogelijkheden met easy2edit</title><style>{CSS}</style></head><body>{''.join(out)}{script}</body></html>"
    exe = next((p for p in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "chromium", "google-chrome", "chromium-browser") if os.path.isfile(p) or subprocess.run(["which", p], capture_output=True).returncode == 0), None)
    if not exe:
        sys.exit("Geen Chrome of Chromium gevonden voor de PDF.")
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "doc.html"
        f.write_text(doc, encoding="utf-8")
        OUT.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=20000", f"--print-to-pdf={OUT}", f.as_uri()], check=True, capture_output=True, timeout=240)
    print(OUT, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
