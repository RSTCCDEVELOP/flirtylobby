# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Makes the standard component set (resource/components/easy2edit-ui-kit-1.0.0.zip) from the easy2edit UI-kit html file: python3 backend/tools/make_easy2edit_component_set.py [ui-kit.html]. Every component gets its easy2edit_tag here (the TAGS table)."""

import re, json, html as H
from pathlib import Path
import sys, zipfile
src = open(sys.argv[1] if len(sys.argv) > 1 else '/Users/ronald/Desktop/easy2edit-ui-kit.html', encoding='utf-8').read()
# css: sections 1-4 of the kit (not the documentation page)
css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
cut = css.index('/* =====================================================================\n   DOCUMENTATIE-PAGINA')
kit_css = css[:cut].strip()
# component script
scripts = re.findall(r'<script>(.*?)</script>', src, re.S)
comp_js = next(s for s in scripts if 'COMPONENT-SCRIPT' in s)
# sidebar groups: h6 + links
nav = re.search(r'<nav class="doc-side".*?</nav>', src, re.S).group(0)
group_of = {}
cur = ''
for m in re.finditer(r'<h6>(.*?)</h6>|<a href="#([\w-]+)">(.*?)</a>', nav):
    if m.group(1): cur = H.unescape(m.group(1))
    else: group_of[m.group(2)] = cur
comps = []
parts = re.split(r'<section class="doc-section" id="([\w-]+)">', src)
for sid, body in zip(parts[1::2], parts[2::2]):
    body = body.split('</section>')[0] if False else body
    h2 = re.search(r'<h2>(.*?)</h2>', body, re.S); p = re.search(r'<header><div><h2>.*?</h2>(?:<p>(.*?)</p>)?', body, re.S)
    cat = re.sub(r'<[^>]+>', '', H.unescape(h2.group(1))) if h2 else sid
    desc = re.sub(r'<[^>]+>', '', H.unescape(p.group(1) or '')) if p else ''
    for dm in re.finditer(r'<div class="doc-demo"><div class="doc-demo__bar">(.*?)<button class="doc-copy">.*?</button></div>\s*<div class="doc-demo__canvas[^"]*">(.*?)\s*</div></div>', body, re.S):
        name = re.sub(r'<[^>]+>', '', H.unescape(dm.group(1))).strip()
        htmlc = dm.group(2).strip('\n')
        htmlc = re.sub(r'\sdata-demo-tone="\d"', '', htmlc)
        comps.append({'section': sid, 'group': group_of.get(sid, ''), 'category': cat, 'category_desc': desc, 'name': name, 'html': htmlc})

TAGS = {
 "Typografie": ("ui-typography", "Typografie", "Koppen, lead-tekst en alinea in de kop- en tekstfont van het thema."),
 "Varianten": ("ui-button-variants", "Knoppen", "Primair, secundair, accent, outline, ghost en uitgeschakeld."),
 "Maten & iconen": ("ui-button-sizes", "Knoppen: maten en iconen", "Klein, normaal, groot, met pijl en als icoonknop."),
 "Badges": ("ui-badges", "Badges en avatars", "Labels, statusbadges en een stapel avatars."),
 "Alerts": ("ui-alerts", "Meldingen", "Info, succes, waarschuwing, fout en merkmelding."),
 "Velden": ("ui-form-fields", "Formuliervelden", "Invoer, selectie, tekstvak, checkbox, schakelaar, slider en invoergroep."),
 "Navbar": ("ui-navbar", "Navigatiebalk", "Responsive menubalk met logo, links en knop."),
 "Breadcrumb + pagination": ("ui-breadcrumb-pagination", "Kruimelpad en paginering", "Kruimelpad en paginering."),
 "Tabs": ("ui-tabs", "Tabs", "Tabbladen met pijltjestoetsen."),
 "Pills": ("ui-tabs-pills", "Tabs als pillen", "Tabbladen in pil-stijl, bijvoorbeeld maand/jaar."),
 "Hero — gesplitst": ("ui-hero-split", "Hero gesplitst", "Tekst en knoppen links, beeld rechts."),
 "Hero — gecentreerd": ("ui-hero-center", "Hero gecentreerd", "Gecentreerde kop met twee knoppen."),
 "Hero — donker": ("ui-hero-dark", "Hero donker", "Hero op de accentkleur, gecentreerd."),
 "Content-kaarten": ("ui-cards", "Content-kaarten", "Kaarten voor blog, project, product of dienst."),
 "Feature-grid": ("ui-features", "Features / diensten", "Vier voordelen met icoon, kop en tekst."),
 "Split-sectie": ("ui-split", "Tekst en beeld", "Beeld naast tekst met lijst en knop."),
 "Statistieken + logo's": ("ui-stats", "Cijfers en logo's", "Vier cijfers en een logo-balk."),
 "Pricing": ("ui-pricing", "Prijzen", "Drie prijskaarten met een uitgelichte."),
 "Testimonials": ("ui-testimonials", "Reviews", "Klantcitaten met naam en functie."),
 "Teamleden": ("ui-team", "Team", "Teamleden met avatar, naam en functie."),
 "Accordion": ("ui-faq", "FAQ", "Veelgestelde vragen als uitklapbare lijst."),
 "CTA-banners": ("ui-cta", "Call-to-action", "Banner met kop en knop in merk- of accentkleur."),
 "Contactblok": ("ui-contact", "Contact", "Contactgegevens met formulier."),
 "Datatabel": ("ui-table", "Tabel", "Datatabel met statusbadges."),
 "Progress + steps": ("ui-progress", "Voortgang en stappen", "Voortgangsbalk, stappenbalk en skeletons."),
 "Timeline": ("ui-timeline", "Tijdlijn", "Verticale tijdlijn."),
 "Overlays": ("ui-overlays", "Modal, toast en tooltip", "Modal, toastmelding en tooltip."),
 "Maandkalender": ("ui-calendar", "Maandkalender", "Maandkalender met afspraken (JSON in data-events)."),
 "Agenda-lijst": ("ui-agenda", "Agenda-lijst", "Lijst met evenementen en aanmeldknop."),
 "Afspraak plannen": ("ui-booking", "Afspraak plannen", "Dag- en tijdkeuze met bevestiging."),
 "Kanban": ("ui-kanban", "Kanban-bord", "Versleepbaar taakbord."),
 "Gantt-planning": ("ui-gantt", "Projectplanning", "Gantt-balken met voortgang."),
 "KPI-kaarten": ("ui-kpi", "KPI-dashboard", "Kerncijfers met trend, sparkline en staafdiagram."),
 "Offerte": ("ui-quote-document", "Offerte / factuur", "Offerte- of factuurdocument met totalen."),
 "Openingstijden + kaart": ("ui-hours-map", "Openingstijden en locatie", "Openingstijden naast een kaart."),
 "Bestandenlijst + activiteitenfeed": ("ui-files-feed", "Downloads en activiteit", "Bestandenlijst en activiteitenfeed."),
 "Vacaturekaart + besteloverzicht": ("ui-job-order", "Vacature en bestelling", "Vacaturekaart en besteloverzicht."),
 "Empty state + cookies": ("ui-empty-cookie", "Lege staat en cookiebalk", "Lege staat en cookiemelding."),
 "Speler met afspeellijst": ("ui-audio-playlist", "Audiospeler met afspeellijst", "Audiospeler met afspeellijst."),
 "Compacte speler (bijv. in een blogpost)": ("ui-audio-compact", "Compacte audiospeler", "Kleine audiospeler voor in een tekst."),
 "Videospeler": ("ui-video", "Videospeler", "Videospeler met eigen bediening."),
 "Video met tekst (split)": ("ui-video-split", "Video met tekst", "Video naast tekst."),
 "Footer": ("ui-footer", "Footer", "Footer met kolommen en nieuwsbrief."),
}

# tags
seen = {}
def slug(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')
for c in comps:
    tag, nm, ds = TAGS[c['name']]
    c['name_src'] = c['name']; c['name'] = nm; c['description'] = ds
    c['easy2edit_tag'] = tag
    c['html'] = f'<div data-easy2edit-tag="{tag}">\n{c["html"]}\n</div>'
    c['classes'] = sorted(set(re.findall(r'\be2e-[a-z0-9_-]+', c['html'])))[:12]
assert len({c['easy2edit_tag'] for c in comps}) == len(comps)

slim = [{k: c[k] for k in ('easy2edit_tag', 'name', 'description', 'group', 'category', 'html')} for c in comps]
manifest = {"key": "easy2edit-ui-kit", "name": "easy2edit UI-kit", "version": "1.0.0", "author": "RSTCC", "system_version": "1.0.0",
            "description": "The standard set of easy2edit objects: hero, cards, pricing, FAQ, forms, calendar, kanban, KPI, documents, audio and video players and more. They take the colours, fonts and corners of the theme in use.",
            "components": slim}
out = Path(__file__).resolve().parents[2] / 'resource' / 'components' / 'easy2edit-ui-kit-1.0.0.zip'
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('components.json', json.dumps(manifest, ensure_ascii=False, indent=1))
    z.writestr('components.css', kit_css)
    z.writestr('components.js', comp_js.strip())
print(len(comps), 'components ->', out)
