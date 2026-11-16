# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Adds the extra components (gallery, carousel, blog, shop, login, search ...) to the standard component set and writes the next version of resource/components/easy2edit-ui-kit-<version>.zip.

  venv/bin/python tools/make_kit_extra.py            (from backend/; reads the newest easy2edit-ui-kit zip of the library, keeps the old components, adds or replaces the extra ones)

The extra components only use the tokens of the kit (--e2e-*), so they take the colours, fonts and corners of the theme like all others."""
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "resource" / "components"
KEY = "easy2edit-ui-kit"


def C(tag, name, desc, group, cat, body):
    return {"easy2edit_tag": tag, "name": name, "description": desc, "group": group, "category": cat, "html": f'<div data-easy2edit-tag="{tag}">\n{body.strip()}\n</div>'}


G = lambda n: f'<div class="e2e-gallery__img" style="--g:{n}"></div>'  # noqa: E731


# ---- charts: the data of the examples is drawn here (svg and css only, no library) ----
import math as _m


def _pts(vals, w=400, h=150, pad=10, mx=None):
    mx = mx or max(vals) * 1.1
    n = len(vals)
    return [(round(pad + i * (w - 2 * pad) / (n - 1), 1), round(h - pad - (v / mx) * (h - 2 * pad), 1)) for i, v in enumerate(vals)]


def _grid(w=400, h=150, rows=4):
    return "".join('<line x1="0" x2="%d" y1="%d" y2="%d"/>' % (w, round(h * i / rows), round(h * i / rows)) for i in range(1, rows))


def _line(vals, cls="s1", area=False, w=400, h=150, mx=None):
    pts = _pts(vals, w, h, mx=mx)
    poly = " ".join("%s,%s" % p for p in pts)
    a = '<path class="e2e-area %s" d="M%s L%s,%d L%s,%d Z"/>' % (cls, poly.replace(" ", " L"), pts[-1][0], h, pts[0][0], h) if area else ""
    dots = "".join('<circle class="e2e-dot-pt %s" cx="%s" cy="%s" r="3"><title>%s</title></circle>' % (cls, x, y, v) for (x, y), v in zip(pts, vals))
    return a + '<polyline class="e2e-line %s" points="%s"/>' % (cls, poly) + dots


def _svg(inner, w=400, h=150, label="Grafiek"):
    return '<svg class="e2e-chart__svg" viewBox="0 0 %d %d" preserveAspectRatio="none" role="img" aria-label="%s"><g class="e2e-chart__grid">%s</g>%s</svg>' % (w, h, label, _grid(w, h), inner)


_DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"]
_MON = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
_V1 = [42, 58, 51, 74, 69, 92, 85]
_Y1 = [120, 150, 140, 190, 220, 210, 260, 300, 280, 340, 380, 420]
_Y2 = [90, 100, 130, 120, 160, 170, 190, 210, 230, 250, 290, 310]


def _axis():
    return '<div class="e2e-chart__axis">' + "".join("<span>%s</span>" % m for m in _MON) + "</div>"


def _bars(vals, labels, cls="s1", h=160):
    mx = max(vals)
    return '<div class="e2e-bars" style="--h:%dpx">%s</div>' % (h, "".join('<div class="e2e-bar %s" style="--v:%d%%" title="%s"><i></i><small>%s</small></div>' % (cls, round(v / mx * 100), v, l) for v, l in zip(vals, labels)))


def _hbars(items):
    mx = max(v for _l, v in items)
    return '<ul class="e2e-hbars">%s</ul>' % "".join('<li><span>%s</span><div class="e2e-track"><i style="--v:%d%%"></i></div><b>%s</b></li>' % (l, round(v / mx * 100), v) for l, v in items)


def _heat():
    return "".join('<i data-l="%d"></i>' % ((r * 7 + c * 3 + (r * c) % 5) % 5) for r in range(7) for c in range(24))


def _radar(vals, labels, r=62, cx=90, cy=82):
    n = len(vals)
    ang = [-_m.pi / 2 + i * 2 * _m.pi / n for i in range(n)]
    rings = "".join('<polygon points="%s"/>' % " ".join("%s,%s" % (round(cx + r * k / 4 * _m.cos(a), 1), round(cy + r * k / 4 * _m.sin(a), 1)) for a in ang) for k in (1, 2, 3, 4))
    axes = "".join('<line x1="%d" y1="%d" x2="%s" y2="%s"/>' % (cx, cy, round(cx + r * _m.cos(a), 1), round(cy + r * _m.sin(a), 1)) for a in ang)
    poly = " ".join("%s,%s" % (round(cx + r * v / 100 * _m.cos(a), 1), round(cy + r * v / 100 * _m.sin(a), 1)) for v, a in zip(vals, ang))
    labs = "".join('<text x="%s" y="%s" text-anchor="middle">%s</text>' % (round(cx + (r + 14) * _m.cos(a), 1), round(cy + (r + 14) * _m.sin(a) + 3, 1), l) for l, a in zip(labels, ang))
    return '<svg class="e2e-radar" viewBox="0 0 180 170" role="img" aria-label="Radardiagram"><g class="e2e-chart__grid">%s%s</g><polygon class="e2e-area s1" points="%s"/><polygon class="e2e-line s1" points="%s"/>%s</svg>' % (rings, axes, poly, poly, labs)


def _ring(pct, label, cls="s1"):
    c = 2 * _m.pi * 40
    return '<div class="e2e-ring %s"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" class="e2e-ring__bg"/><circle cx="50" cy="50" r="40" class="e2e-ring__fg" stroke-dasharray="%s %s" transform="rotate(-90 50 50)"/></svg><b>%d%%</b><small>%s</small></div>' % (cls, round(c * pct / 100, 1), round(c, 1), pct, label)


def _gauge(pct):
    L = _m.pi * 50
    return '<div class="e2e-gauge"><svg viewBox="0 0 120 70"><path d="M10 60 A50 50 0 0 1 110 60" class="e2e-ring__bg"/><path d="M10 60 A50 50 0 0 1 110 60" class="e2e-ring__fg" stroke-dasharray="%s %s"/></svg><b>%d%%</b><small>van het doel</small></div>' % (round(L * pct / 100, 1), round(L, 1), pct)


def _stack(rows):
    return '<div class="e2e-bars e2e-bars--stack" style="--h:170px">%s</div>' % "".join('<div class="e2e-bar" title="%s"><div class="e2e-stack__col">%s</div><small>%s</small></div>' % (l, "".join('<i class="s%d" style="--v:%d%%"></i>' % (i + 1, v) for i, v in enumerate(vals)), l) for l, vals in rows)


def _card(title, body, hint="", cls="", extra=""):
    head = "<header><h4>%s</h4>%s%s</header>" % (title, ('<small class="e2e-hint">%s</small>' % hint) if hint else "", extra)
    return '<div class="e2e-chartcard%s">%s%s</div>' % ((" " + cls) if cls else "", head, body)


def _legend(items):
    return '<ul class="e2e-legend e2e-legend--row">%s</ul>' % "".join('<li><i class="s%d"></i>%s</li>' % (i + 1, l) for i, l in enumerate(items))


def _trend(label, value, delta, up, vals, cls):
    return '<div class="e2e-trend"><small>%s</small><b>%s</b><span class="e2e-delta %s">%s %s</span><div class="e2e-chart e2e-chart--mini">%s</div></div>' % (label, value, "is-up" if up else "is-down", "▲" if up else "▼", delta, _svg(_line(vals, cls, area=True, w=200, h=50), 200, 50))


def _meter(label, pct, cls="s1"):
    return '<div><div class="e2e-meters__row"><span>%s</span><b>%d%%</b></div><div class="e2e-track %s"><i style="--v:%d%%"></i></div></div>' % (label, pct, cls, pct)


GROUP = "Grafieken & statistieken"
CHARTS = [
    C("ui-bar-chart", "Staafdiagram", "Verticale staven per dag of maand; de waarde staat in de tooltip.", GROUP, "Staafdiagram", _card("Bezoekers per dag", _bars(_V1, _DAYS), "Afgelopen week")),
    C("ui-bar-chart-horizontal", "Staafdiagram liggend", "Liggende staven voor een ranglijst, zoals de meest bekeken pagina's.", GROUP, "Liggend staafdiagram", _card("Meest bekeken pagina's", _hbars([("Home", 1240), ("Diensten", 860), ("Webshop", 640), ("Over ons", 420), ("Contact", 310)]))),
    C("ui-line-chart", "Lijndiagram", "Lijn met punten en een raster; hoe de waarde verandert in de tijd.", GROUP, "Lijndiagram", _card("Omzet dit jaar", '<div class="e2e-chart">' + _svg(_line(_Y1, "s1")) + "</div>" + _axis(), "in euro's")),
    C("ui-area-chart", "Vlakdiagram", "Lijn met een gevuld vlak eronder.", GROUP, "Vlakdiagram", _card("Nieuwe leden", '<div class="e2e-chart">' + _svg(_line(_Y1, "s1", area=True)) + "</div>" + _axis())),
    C("ui-multi-line-chart", "Lijndiagram met meer reeksen", "Twee lijnen met een legenda, bijvoorbeeld dit jaar tegenover vorig jaar.", GROUP, "Lijndiagram, meer reeksen", _card("Bezoek dit jaar en vorig jaar", '<div class="e2e-chart">' + _svg(_line(_Y2, "s2", mx=462) + _line(_Y1, "s1", mx=462)) + "</div>" + _axis(), "", "", _legend(["Dit jaar", "Vorig jaar"]))),
    C("ui-stacked-bar-chart", "Gestapeld staafdiagram", "Staven die uit delen bestaan, met een legenda.", GROUP, "Gestapeld staafdiagram", _card("Bestellingen per kanaal", _stack(list(zip(_DAYS, [[30, 15, 10], [35, 20, 12], [28, 18, 20], [40, 22, 15], [45, 25, 18], [55, 30, 25], [38, 20, 12]]))), "", "", _legend(["Webshop", "Telefoon", "Winkel"]))),
    C("ui-pie-chart", "Taartdiagram", "Een volle cirkel met de verdeling en een legenda.", GROUP, "Taartdiagram", _card("Verkoop per categorie", '<div class="e2e-donut"><div class="e2e-donut__ring e2e-pie" style="background:conic-gradient(var(--e2e-primary) 0 40%,var(--e2e-secondary) 40% 65%,var(--e2e-accent) 65% 85%,var(--e2e-info) 85% 100%)"></div><ul class="e2e-legend"><li><i class="s1"></i>Kleding <b>40%</b></li><li><i class="s2"></i>Schoenen <b>25%</b></li><li><i class="s3"></i>Accessoires <b>20%</b></li><li><i class="s4"></i>Overig <b>15%</b></li></ul></div>')),
    C("ui-gauge", "Meter", "Halve cirkel die laat zien hoever je bent met een doel.", GROUP, "Meter", _card("Maanddoel omzet", _gauge(72), "", "e2e-chartcard--center")),
    C("ui-radial-progress", "Voortgangsringen", "Drie ringen met een percentage, voor doelen of scores.", GROUP, "Voortgangsringen", _card("Voortgang", '<div class="e2e-rings">' + _ring(82, "Profiel", "s1") + _ring(64, "Taken", "s2") + _ring(37, "Doel", "s3") + "</div>")),
    C("ui-trend-stats", "Cijfers met trend", "Kerncijfers met een stijging of daling en een klein lijntje.", GROUP, "Cijfers met trend", '<div class="e2e-grid" style="--e2e-min:200px">' + _trend("Omzet", "€ 12.480", "12,4%", True, [4, 6, 5, 8, 7, 10, 12], "s1") + _trend("Bezoekers", "8.214", "4,1%", True, [5, 5, 6, 6, 7, 7, 8], "s2") + _trend("Retouren", "38", "9,0%", False, [9, 8, 9, 7, 6, 6, 5], "s3") + "</div>"),
    C("ui-heatmap", "Activiteitenkaart", "Rooster van dagen en uren; hoe donkerder, hoe drukker.", GROUP, "Activiteitenkaart", _card("Drukte per uur", '<div class="e2e-heat">' + _heat() + '</div><div class="e2e-heat__scale"><small>Rustig</small><i data-l="0"></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i><small>Druk</small></div>', "ma t/m zo, 0 – 24 uur")),
    C("ui-funnel", "Trechter", "Stappen waarin bezoekers afhaken, met het percentage per stap.", GROUP, "Trechter", _card("Van bezoek naar bestelling", '<div class="e2e-funnel"><div style="--w:100%"><b>Bezoekers</b><span>12.480</span></div><div style="--w:62%"><b>Productpagina</b><span>7.738 · 62%</span></div><div style="--w:28%"><b>Winkelwagen</b><span>3.494 · 28%</span></div><div style="--w:14%"><b>Afrekenen</b><span>1.747 · 14%</span></div><div style="--w:9%"><b>Besteld</b><span>1.123 · 9%</span></div></div>')),
    C("ui-progress-bars", "Voortgangsbalken", "Meerdere balken met een naam en een percentage, voor doelen.", GROUP, "Voortgangsbalken", _card("Doelen dit kwartaal", '<div class="e2e-meters">' + _meter("Nieuwe klanten", 78) + _meter("Omzet", 64, "s2") + _meter("Klanttevredenheid", 92, "s5") + "</div>")),
    C("ui-target-bar", "Doel en werkelijk", "Balk met een streepje voor het doel, om te zien of je ervoor of erachter ligt.", GROUP, "Doel en werkelijk", _card("Omzet tegenover doel", '<div class="e2e-target"><div class="e2e-track"><i style="--v:68%"></i><em style="--t:80%" title="Doel"></em></div><div class="e2e-meters__row" style="margin-top:.5rem"><span>€ 68.000</span><span class="e2e-hint">Doel € 80.000</span></div></div>')),
    C("ui-leaderboard", "Ranglijst", "Genummerde ranglijst met naam, balk en waarde.", GROUP, "Ranglijst", _card("Beste verkopers", '<ol class="e2e-leader">' + "".join('<li><b>%d</b><span class="e2e-avatar%s">%s</span><span>%s</span><div class="e2e-track"><i style="--v:%d%%"></i></div><strong>%d</strong></li>' % (i + 1, " e2e-avatar--alt" if i % 2 else "", a, n, round(v / 48 * 100), v) for i, (a, n, v) in enumerate([("SD", "Sophie de Vries", 48), ("DS", "Daan Smit", 39), ("LB", "Lotte Bos", 29), ("MK", "Milan Kok", 21)])) + "</ol>")),
    C("ui-radar-chart", "Radardiagram", "Scores op meerdere onderdelen in één vorm, om sterke en zwakke punten te zien.", GROUP, "Radardiagram", _card("Score per onderdeel", _radar([80, 65, 90, 55, 72], ["Snelheid", "Service", "Prijs", "Aanbod", "Gemak"]), "", "e2e-chartcard--center")),
    C("ui-compare-stat", "Vergelijking met vorige periode", "Deze periode tegenover de vorige, met twee balken en het verschil.", GROUP, "Vergelijking", _card("Bestellingen deze maand", '<div class="e2e-meters"><div><div class="e2e-meters__row"><span>Deze maand</span><b>236</b></div><div class="e2e-track"><i style="--v:100%"></i></div></div><div><div class="e2e-meters__row"><span>Vorige maand</span><b>200</b></div><div class="e2e-track s2"><i style="--v:85%"></i></div></div></div>', "", "", '<span class="e2e-delta is-up">▲ 18%</span>')),
    C("ui-chart-switch", "Grafiek met periodekeuze", "Een lijndiagram waarbij je met knoppen kiest tussen week en jaar.", GROUP, "Grafiek met keuze", '<div class="e2e-chartcard" data-e2e-chartswitch><header><h4>Bezoekers</h4><div class="e2e-segmented" role="group" aria-label="Periode"><button type="button" aria-pressed="true" data-show="week">Week</button><button type="button" aria-pressed="false" data-show="jaar">Jaar</button></div></header><div class="e2e-chart" data-set="week">' + _svg(_line(_V1, "s1", area=True)) + '</div><div class="e2e-chart" data-set="jaar" hidden>' + _svg(_line(_Y1, "s1", area=True)) + "</div></div>"),
]


EXTRA = [
    C("ui-announcement-bar", "Aankondigingsbalk", "Smalle balk boven aan de site voor een actie of mededeling, met sluitknop.", "Navigatie", "Aankondigingsbalk", '''
<div class="e2e-announce" role="region" aria-label="Aankondiging"><span><b>Nieuw:</b> gratis website-check deze maand</span><a href="#">Meer info →</a><button type="button" class="e2e-announce__x" aria-label="Sluiten" data-e2e-close=".e2e-announce">×</button></div>'''),
    C("ui-search-bar", "Zoekbalk", "Zoekveld met knop en een rij populaire zoekopdrachten.", "Navigatie", "Zoekbalk", '''
<form class="e2e-search" onsubmit="return false"><div class="e2e-input-group"><input class="e2e-input" type="search" placeholder="Zoek op de website…" aria-label="Zoeken"><button class="e2e-btn">Zoeken</button></div>
<div class="e2e-row" style="margin-top:.7rem"><small class="e2e-hint">Populair:</small><a href="#" class="e2e-badge">Prijzen</a><a href="#" class="e2e-badge">Webshop</a><a href="#" class="e2e-badge">Contact</a></div></form>'''),
    C("ui-sidebar-menu", "Zijmenu", "Verticaal menu met groepen, een actief item en tellers.", "Navigatie", "Zijmenu", '''
<nav class="e2e-sidemenu" aria-label="Menu"><small>Beheer</small><a href="#" class="is-active">Overzicht</a><a href="#">Pagina's <span class="e2e-badge e2e-badge--neutral">12</span></a><a href="#">Media</a><small>Account</small><a href="#">Profiel</a><a href="#">Uitloggen</a></nav>'''),
    C("ui-gallery", "Fotogalerij", "Rooster met foto's en bijschriften; vervang de vlakken door je eigen afbeeldingen.", "Media", "Fotogalerij", f'''
<div class="e2e-gallery">{G(1)}{G(2)}{G(3)}{G(4)}{G(5)}{G(6)}</div>'''),
    C("ui-carousel", "Carrousel", "Dia's naast elkaar die je kunt wegschuiven, met pijlen.", "Media", "Carrousel", '''
<div class="e2e-carousel" data-e2e-carousel><div class="e2e-carousel__track">
<article class="e2e-slide"><span class="e2e-badge e2e-badge--solid">Project</span><h3>Bakkerij Van Dam</h3><p>Een warme website met webshop in drie weken.</p></article>
<article class="e2e-slide"><span class="e2e-badge e2e-badge--solid">Project</span><h3>Studio Noord</h3><p>Portfolio met showcase en afspraken.</p></article>
<article class="e2e-slide"><span class="e2e-badge e2e-badge--solid">Project</span><h3>Fietsenmaker Jansen</h3><p>Reparaties plannen via de agenda.</p></article>
<article class="e2e-slide"><span class="e2e-badge e2e-badge--solid">Project</span><h3>Yoga Utrecht</h3><p>Lessen en abonnementen online.</p></article></div>
<div class="e2e-carousel__nav"><button type="button" class="e2e-btn e2e-btn--outline e2e-btn--icon e2e-btn--sm" data-dir="-1" aria-label="Vorige">‹</button><button type="button" class="e2e-btn e2e-btn--outline e2e-btn--icon e2e-btn--sm" data-dir="1" aria-label="Volgende">›</button></div></div>'''),
    C("ui-blog-list", "Blog en nieuws", "Drie artikelkaarten met categorie, datum en doorlees-link.", "Content-blokken", "Blog en nieuws", '''
<div class="e2e-grid" style="--e2e-min:260px">
<article class="e2e-card e2e-card--hover"><div class="e2e-card__media"></div><div class="e2e-card__body"><div class="e2e-row"><span class="e2e-badge">Tips</span><small class="e2e-hint">12 nov 2026</small></div><h3>Zo schrijf je een tekst die gelezen wordt</h3><p>Korte zinnen, duidelijke koppen en één boodschap per alinea.</p><a href="#">Lees verder →</a></div></article>
<article class="e2e-card e2e-card--hover"><div class="e2e-card__media"></div><div class="e2e-card__body"><div class="e2e-row"><span class="e2e-badge">Nieuws</span><small class="e2e-hint">5 nov 2026</small></div><h3>Onze nieuwe webshop is live</h3><p>Verkoop online met varianten, kortingscodes en bezorging.</p><a href="#">Lees verder →</a></div></article>
<article class="e2e-card e2e-card--hover"><div class="e2e-card__media"></div><div class="e2e-card__body"><div class="e2e-row"><span class="e2e-badge">Praktijk</span><small class="e2e-hint">28 okt 2026</small></div><h3>Een afspraak plannen in drie klikken</h3><p>Laat klanten zelf een moment kiezen in je agenda.</p><a href="#">Lees verder →</a></div></article></div>'''),
    C("ui-newsletter", "Nieuwsbrief-inschrijving", "Banner met een e-mailveld om je te abonneren.", "Content-blokken", "Nieuwsbrief", '''
<section class="e2e-newsletter"><div><h3>Blijf op de hoogte</h3><p>Eén keer per maand tips en nieuws. Afmelden kan altijd.</p></div><form class="e2e-input-group" onsubmit="return false"><input class="e2e-input" type="email" placeholder="je@email.nl" aria-label="E-mailadres"><button class="e2e-btn">Inschrijven</button></form></section>'''),
    C("ui-steps-process", "Stappenplan", "Hoe het werkt in drie genummerde stappen.", "Content-blokken", "Stappenplan", '''
<ol class="e2e-process"><li><b>1</b><h4>Kennismaken</h4><p>We bespreken je doelen en wensen.</p></li><li><b>2</b><h4>Ontwerpen</h4><p>Je krijgt een ontwerp in je eigen kleuren.</p></li><li><b>3</b><h4>Live</h4><p>Je site gaat online en je past hem zelf aan.</p></li></ol>'''),
    C("ui-comparison-table", "Vergelijkingstabel", "Pakketten naast elkaar met vinkjes per onderdeel.", "Content-blokken", "Vergelijking", '''
<div class="e2e-table-wrap"><table class="e2e-table e2e-compare"><thead><tr><th></th><th>Start</th><th class="is-featured">Pro</th><th>Business</th></tr></thead><tbody>
<tr><td>Pagina's</td><td>10</td><td class="is-featured">Onbeperkt</td><td>Onbeperkt</td></tr><tr><td>Webshop</td><td>–</td><td class="is-featured">✓</td><td>✓</td></tr><tr><td>Agenda en afspraken</td><td>–</td><td class="is-featured">✓</td><td>✓</td></tr><tr><td>Support</td><td>E-mail</td><td class="is-featured">Telefoon</td><td>Prioriteit</td></tr></tbody></table></div>'''),
    C("ui-profile-card", "Profielkaart", "Persoon met avatar, korte tekst, cijfers en knoppen.", "Content-blokken", "Profielkaart", '''
<article class="e2e-profile"><span class="e2e-avatar e2e-avatar--lg">SD</span><h3>Sophie de Vries</h3><p>Ontwerper uit Utrecht. Houdt van koffie en lange wandelingen.</p><div class="e2e-profile__stats"><span><b>128</b><small>Berichten</small></span><span><b>54</b><small>Vrienden</small></span><span><b>9</b><small>Groepen</small></span></div><div class="e2e-row" style="justify-content:center"><button class="e2e-btn e2e-btn--sm">Volgen</button><button class="e2e-btn e2e-btn--outline e2e-btn--sm">Bericht</button></div></article>'''),
    C("ui-rating", "Beoordeling", "Sterren met gemiddelde en verdeling per aantal sterren.", "Content-blokken", "Beoordeling", '''
<div class="e2e-rating"><div class="e2e-rating__score"><b>4,6</b><span class="e2e-stars" aria-label="4,6 van 5">★★★★★</span><small class="e2e-hint">op basis van 214 reviews</small></div><div class="e2e-rating__bars"><div><small>5</small><i style="--w:72%"></i></div><div><small>4</small><i style="--w:18%"></i></div><div><small>3</small><i style="--w:6%"></i></div><div><small>2</small><i style="--w:3%"></i></div><div><small>1</small><i style="--w:1%"></i></div></div></div>'''),
    C("ui-product-cards", "Productkaarten", "Webshop-producten met foto, prijs, label en winkelwagenknop.", "Webshop", "Productkaarten", '''
<div class="e2e-grid" style="--e2e-min:220px">
<article class="e2e-card e2e-card--hover"><div class="e2e-card__media"><span class="e2e-badge e2e-badge--solid e2e-product__flag">Nieuw</span></div><div class="e2e-card__body"><h3>Linnen overhemd</h3><div class="e2e-product__price">€ 59,00</div></div><div class="e2e-card__footer"><span class="e2e-stars">★★★★☆</span><button class="e2e-btn e2e-btn--sm">In winkelwagen</button></div></article>
<article class="e2e-card e2e-card--hover"><div class="e2e-card__media"></div><div class="e2e-card__body"><h3>Wollen trui</h3><div class="e2e-product__price"><s>€ 89,00</s> € 69,00</div></div><div class="e2e-card__footer"><span class="e2e-badge e2e-badge--danger">Aanbieding</span><button class="e2e-btn e2e-btn--sm">In winkelwagen</button></div></article>
<article class="e2e-card e2e-card--hover"><div class="e2e-card__media"></div><div class="e2e-card__body"><h3>Katoenen sjaal</h3><div class="e2e-product__price">€ 24,50</div></div><div class="e2e-card__footer"><span class="e2e-badge e2e-badge--neutral">Uitverkocht</span><button class="e2e-btn e2e-btn--outline e2e-btn--sm" disabled>Bericht mij</button></div></article></div>'''),
    C("ui-cart-summary", "Winkelwagen-overzicht", "Regels met aantal en prijs, kortingscode, totaal en afrekenknop.", "Webshop", "Winkelwagen", '''
<aside class="e2e-cart"><h3>Je bestelling</h3><div class="e2e-cart__row"><span>2 × Linnen overhemd</span><span>€ 118,00</span></div><div class="e2e-cart__row"><span>1 × Wollen trui</span><span>€ 69,00</span></div><form class="e2e-input-group" onsubmit="return false"><input class="e2e-input" placeholder="Kortingscode" aria-label="Kortingscode"><button class="e2e-btn e2e-btn--outline">Toepassen</button></form><div class="e2e-cart__row"><span>Verzending</span><span>Gratis</span></div><div class="e2e-cart__row e2e-cart__total"><span>Totaal</span><span>€ 187,00</span></div><small class="e2e-hint">Waarvan € 32,45 btw</small><a href="#" class="e2e-btn e2e-btn--block">Afrekenen</a></aside>'''),
    C("ui-login-card", "Inlogkaart", "Inlogformulier met wachtwoord vergeten, sociale knop en registreerlink.", "Basis", "Inloggen", '''
<form class="e2e-login" onsubmit="return false"><h3>Inloggen</h3><div class="e2e-field"><label class="e2e-label" for="lg-mail">E-mailadres</label><input class="e2e-input" id="lg-mail" type="email" placeholder="je@email.nl"></div><div class="e2e-field"><label class="e2e-label" for="lg-pw">Wachtwoord</label><input class="e2e-input" id="lg-pw" type="password"></div><div class="e2e-row" style="justify-content:space-between"><label class="e2e-check"><input type="checkbox"> Onthoud mij</label><a href="#">Wachtwoord vergeten?</a></div><button class="e2e-btn e2e-btn--block">Inloggen</button><div class="e2e-login__or"><span>of</span></div><button type="button" class="e2e-btn e2e-btn--outline e2e-btn--block">Doorgaan met Google</button><p class="e2e-hint" style="text-align:center">Nog geen account? <a href="#">Registreren</a></p></form>'''),
    C("ui-social-links", "Sociale links", "Ronde knoppen naar je sociale kanalen.", "Basis", "Sociale links", '''
<div class="e2e-social"><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Instagram">in</a><a href="#" aria-label="LinkedIn">li</a><a href="#" aria-label="YouTube">▶</a><a href="#" aria-label="WhatsApp">w</a></div>'''),
    C("ui-section-heading", "Sectiekop", "Eyebrow, kop, introtekst en een streep, gecentreerd of links.", "Start", "Sectiekop", '''
<div class="e2e-stack" style="gap:2.5rem"><header class="e2e-sechead"><span class="e2e-eyebrow">Onze diensten</span><h2>Alles voor je website</h2><p class="e2e-lead">Van ontwerp tot onderhoud, in één vast bedrag.</p></header>
<header class="e2e-sechead e2e-sechead--left"><span class="e2e-eyebrow">Over ons</span><h2>Een klein team met grote aandacht</h2><hr class="e2e-rule"></header></div>'''),
    C("ui-countdown", "Aftelklok", "Dagen, uren, minuten en seconden tot een moment (data-date).", "Data & feedback", "Aftelklok", '''
<div class="e2e-countdown" data-e2e-countdown data-date="2027-01-01T00:00:00"><div><b data-u="d">00</b><small>dagen</small></div><div><b data-u="h">00</b><small>uren</small></div><div><b data-u="m">00</b><small>minuten</small></div><div><b data-u="s">00</b><small>seconden</small></div></div>'''),
    C("ui-error-page", "Foutpagina", "Pagina niet gevonden met uitleg en knoppen terug.", "Data & feedback", "Foutpagina", '''
<section class="e2e-error"><b>404</b><h2>Deze pagina bestaat niet</h2><p>De pagina is verplaatst of het adres klopt niet. Ga terug naar de startpagina of zoek verder.</p><div class="e2e-row" style="justify-content:center"><a href="#" class="e2e-btn">Naar de startpagina</a><a href="#" class="e2e-btn e2e-btn--outline">Contact opnemen</a></div></section>'''),
    C("ui-notification-list", "Meldingen-lijst", "Lijst met meldingen, ongelezen met een stip.", "Data & feedback", "Meldingen-lijst", '''
<ul class="e2e-notes"><li class="is-new"><i></i><div><b>Nieuwe bestelling #1042</b><small>2 minuten geleden</small></div></li><li class="is-new"><i></i><div><b>Sophie heeft je bericht beantwoord</b><small>1 uur geleden</small></div></li><li><i></i><div><b>Je back-up is gemaakt</b><small>Gisteren</small></div></li></ul>'''),
    C("ui-segmented", "Segmentknoppen", "Een groep knoppen om één weergave te kiezen (dag, week, maand), in de stijl van het thema.", "Basis", "Segmentknoppen", '''
<div class="e2e-segmented" role="group" aria-label="Weergave"><button type="button" aria-pressed="false">Dag</button><button type="button" aria-pressed="false">Week</button><button type="button" aria-pressed="true">Maand</button><button type="button" aria-pressed="false">Jaar</button></div>'''),
    C("ui-calendar-toolbar", "Kalenderbalk", "Vorige, vandaag en volgende, de maandtitel en de keuze van de weergave.", "Planning & agenda", "Kalenderbalk", '''
<div class="e2e-cal-toolbar"><div class="e2e-row"><button class="e2e-btn e2e-btn--outline e2e-btn--icon e2e-btn--sm" aria-label="Vorige">‹</button><button class="e2e-btn e2e-btn--outline e2e-btn--sm">Vandaag</button><button class="e2e-btn e2e-btn--outline e2e-btn--icon e2e-btn--sm" aria-label="Volgende">›</button><h3>November 2026</h3></div><div class="e2e-segmented" role="group" aria-label="Weergave"><button type="button" aria-pressed="false">Dag</button><button type="button" aria-pressed="false">Week</button><button type="button" aria-pressed="true">Maand</button><button type="button" aria-pressed="false">Jaar</button></div></div>'''),
    C("ui-mini-calendar", "Minikalender", "Kleine maand om een dag te kiezen, met stippen bij dagen met afspraken.", "Planning & agenda", "Minikalender", '''
<div class="e2e-mini"><div class="e2e-mini__head"><strong>november 2026</strong><span><button class="e2e-btn e2e-btn--outline e2e-btn--sm e2e-btn--icon" aria-label="Vorige">‹</button><button class="e2e-btn e2e-btn--outline e2e-btn--sm e2e-btn--icon" aria-label="Volgende">›</button></span></div>
<div class="e2e-mini__grid"><span class="e2e-mini__dow">ma</span><span class="e2e-mini__dow">di</span><span class="e2e-mini__dow">wo</span><span class="e2e-mini__dow">do</span><span class="e2e-mini__dow">vr</span><span class="e2e-mini__dow">za</span><span class="e2e-mini__dow">zo</span>
<button class="is-out">26</button><button class="is-out">27</button><button class="is-out">28</button><button class="is-out">29</button><button class="is-out">30</button><button class="is-out">31</button><button>1</button>
<button>2</button><button>3</button><button class="has-ev">4</button><button>5</button><button>6</button><button>7</button><button>8</button>
<button>9</button><button>10</button><button class="has-ev">11</button><button>12</button><button class="has-ev">13</button><button>14</button><button class="is-today">15</button>
<button>16</button><button>17</button><button>18</button><button class="has-ev is-selected">19</button><button>20</button><button>21</button><button>22</button></div></div>'''),
    C("ui-filter-list", "Filterlijst", "Keuzevakjes met een kleurstip, om soorten items aan of uit te zetten.", "Basis", "Filterlijst", '''
<div class="e2e-filter"><label><input type="checkbox" checked><i class="e2e-dot" data-c="blue"></i> Mijn afspraken</label><label><input type="checkbox" checked><i class="e2e-dot" data-c="purple"></i> Groepen</label><label><input type="checkbox"><i class="e2e-dot" data-c="orange"></i> Evenementen</label></div>'''),
    C("ui-side-panel", "Zijpaneel", "Een blok met titel en inhoud, voor in een zijbalk (filters, uitnodigingen, komende items).", "Content-blokken", "Zijpaneel", '''
<aside class="e2e-panel"><h4>Komende afspraken</h4><ul class="e2e-upnext"><li><i class="e2e-dot" data-c="teal"></i><div><b>Onboarding nieuwe collega\'s</b><small>16 nov · 14:30</small></div></li><li><i class="e2e-dot" data-c="red"></i><div><b>ICT-onderhoud servers</b><small>19 nov · 00:30</small></div></li><li><i class="e2e-dot" data-c="orange"></i><div><b>Vrijdagmiddagborrel</b><small>20 nov · 21:30</small></div></li></ul></aside>'''),
    C("ui-calendar-weeks", "Maandkalender met weeknummers", "Maand met een kolom voor de weeknummers en gekleurde afspraken.", "Planning & agenda", "Maandkalender met weken", '''
<div class="e2e-cal e2e-cal--weeks"><div class="e2e-cal__grid">
<div class="e2e-cal__dow">#</div><div class="e2e-cal__dow">ma</div><div class="e2e-cal__dow">di</div><div class="e2e-cal__dow">wo</div><div class="e2e-cal__dow">do</div><div class="e2e-cal__dow">vr</div><div class="e2e-cal__dow">za</div><div class="e2e-cal__dow">zo</div>
<div class="e2e-cal__week">46</div><div class="e2e-cal__day"><span class="e2e-cal__num">9</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">10</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">11</span><span class="e2e-chip" data-c="green">17:30 Lunch</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">12</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">13</span><span class="e2e-chip" data-c="orange">21:30 Borrel</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">14</span></div><div class="e2e-cal__day is-today"><span class="e2e-cal__num">15</span></div>
<div class="e2e-cal__week">47</div><div class="e2e-cal__day"><span class="e2e-cal__num">16</span><span class="e2e-chip" data-c="teal">14:30 Onboarding</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">17</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">18</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">19</span><span class="e2e-chip" data-c="red">00:30 ICT</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">20</span><span class="e2e-chip" data-c="orange">21:30 Borrel</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">21</span></div><div class="e2e-cal__day"><span class="e2e-cal__num">22</span></div>
</div></div>'''),
    C("ui-data-table", "Datatabel met zoeken en sorteren", "Tabel met zoekveld, filter, sorteren op kolom en bladeren; werkt op de rijen in de pagina.", "Database & lijsten", "Datatabel", '''
<div class="e2e-dt" data-e2e-datatable data-page-size="5"><div class="e2e-toolbar"><input class="e2e-input" type="search" placeholder="Zoek in de tabel…" aria-label="Zoeken" data-dt-search><select class="e2e-select" data-dt-filter aria-label="Filter"><option value="">Alle soorten</option><option value="klant">Klanten</option><option value="lead">Leads</option></select><span class="e2e-hint" data-dt-count></span></div>
<div class="e2e-table-wrap"><table class="e2e-table"><thead><tr><th data-sort="text">Naam</th><th data-sort="text">Status</th><th data-sort="text">Product</th><th data-sort="num">Omzet</th><th></th></tr></thead><tbody>
<tr data-cat="klant"><td><strong>Bakkerij Van Dam</strong><br><small class="e2e-hint">Utrecht</small></td><td><span class="e2e-badge e2e-badge--success">Actief</span></td><td>Webshop</td><td data-v="1250">€ 1250</td><td style="text-align:right"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Bewerk</button></td></tr>
<tr data-cat="lead"><td><strong>Studio Noord</strong><br><small class="e2e-hint">Groningen</small></td><td><span class="e2e-badge e2e-badge--warning">Offerte</span></td><td>Website</td><td data-v="890">€ 890</td><td style="text-align:right"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Bewerk</button></td></tr>
<tr data-cat="klant"><td><strong>Fietsenmaker Jansen</strong><br><small class="e2e-hint">Arnhem</small></td><td><span class="e2e-badge e2e-badge--success">Actief</span></td><td>Agenda</td><td data-v="420">€ 420</td><td style="text-align:right"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Bewerk</button></td></tr>
<tr data-cat="klant"><td><strong>Yoga Utrecht</strong><br><small class="e2e-hint">Utrecht</small></td><td><span class="e2e-badge e2e-badge--neutral">Gepauzeerd</span></td><td>Abonnementen</td><td data-v="310">€ 310</td><td style="text-align:right"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Bewerk</button></td></tr>
<tr data-cat="lead"><td><strong>Restaurant De Haven</strong><br><small class="e2e-hint">Rotterdam</small></td><td><span class="e2e-badge e2e-badge--warning">Offerte</span></td><td>Webshop</td><td data-v="1780">€ 1780</td><td style="text-align:right"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Bewerk</button></td></tr>
<tr data-cat="klant"><td><strong>Tuincentrum Groen</strong><br><small class="e2e-hint">Breda</small></td><td><span class="e2e-badge e2e-badge--success">Actief</span></td><td>Website</td><td data-v="640">€ 640</td><td style="text-align:right"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Bewerk</button></td></tr>
<tr data-cat="lead"><td><strong>Kapsalon Noor</strong><br><small class="e2e-hint">Delft</small></td><td><span class="e2e-badge e2e-badge--danger">Verloren</span></td><td>Website</td><td data-v="0">€ 0</td><td style="text-align:right"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Bewerk</button></td></tr>
</tbody></table></div><div class="e2e-pager"><button class="e2e-btn e2e-btn--outline e2e-btn--sm" data-dt-prev>‹ Vorige</button><span data-dt-page></span><button class="e2e-btn e2e-btn--outline e2e-btn--sm" data-dt-next>Volgende ›</button></div></div>'''),
    C("ui-bulk-table", "Tabel met selectie en bulkacties", "Rijen aanvinken en een actiebalk met het aantal geselecteerde rijen.", "Database & lijsten", "Bulkacties", '''
<div class="e2e-bulk" data-e2e-bulk><div class="e2e-bulk__bar" hidden><strong data-bulk-count>0</strong> geselecteerd<span class="e2e-row"><button class="e2e-btn e2e-btn--outline e2e-btn--sm">Exporteren</button><button class="e2e-btn e2e-btn--sm">Verwijderen</button></span></div>
<div class="e2e-table-wrap"><table class="e2e-table"><thead><tr><th style="width:2.4rem"><input type="checkbox" data-bulk-all aria-label="Alles selecteren"></th><th>Bestelling</th><th>Klant</th><th>Status</th><th>Totaal</th></tr></thead><tbody>
<tr><td><input type="checkbox" data-bulk-row aria-label="Selecteren"></td><td>#1042</td><td>Sophie de Vries</td><td><span class="e2e-badge e2e-badge--success">Betaald</span></td><td>€ 187,00</td></tr>
<tr><td><input type="checkbox" data-bulk-row aria-label="Selecteren"></td><td>#1041</td><td>Daan Smit</td><td><span class="e2e-badge e2e-badge--warning">Wacht op betaling</span></td><td>€ 59,00</td></tr>
<tr><td><input type="checkbox" data-bulk-row aria-label="Selecteren"></td><td>#1040</td><td>Lotte Bos</td><td><span class="e2e-badge e2e-badge--success">Betaald</span></td><td>€ 312,50</td></tr>
<tr><td><input type="checkbox" data-bulk-row aria-label="Selecteren"></td><td>#1039</td><td>Milan Kok</td><td><span class="e2e-badge e2e-badge--danger">Geannuleerd</span></td><td>€ 24,50</td></tr></tbody></table></div></div>'''),
    C("ui-record-list", "Lijst met records", "Lijst met avatar, titel, details, status en acties per regel, met een zoekveld.", "Database & lijsten", "Recordlijst", '''
<div class="e2e-records" data-e2e-recordlist><div class="e2e-toolbar"><input class="e2e-input" type="search" placeholder="Zoek een persoon…" aria-label="Zoeken" data-rl-search><button class="e2e-btn e2e-btn--sm">+ Nieuw</button></div>
<ul class="e2e-reclist"><li><span class="e2e-avatar">SD</span><div><b>Sophie de Vries</b><small>Ontwerper · Utrecht</small></div><span class="e2e-badge e2e-badge--success">Actief</span><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Open</button></li>
<li><span class="e2e-avatar e2e-avatar--alt">DS</span><div><b>Daan Smit</b><small>Ontwikkelaar · Arnhem</small></div><span class="e2e-badge e2e-badge--neutral">Afwezig</span><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Open</button></li>
<li><span class="e2e-avatar">LB</span><div><b>Lotte Bos</b><small>Marketing · Delft</small></div><span class="e2e-badge e2e-badge--success">Actief</span><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Open</button></li>
<li><span class="e2e-avatar e2e-avatar--alt">MK</span><div><b>Milan Kok</b><small>Support · Breda</small></div><span class="e2e-badge e2e-badge--warning">Nieuw</span><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Open</button></li></ul></div>'''),
    C("ui-filter-grid", "Kaartenraster met zoeken en filters", "Rooster van kaarten met zoekveld, filterknoppen en sorteren; werkt op de kaarten in de pagina.", "Database & lijsten", "Zoekraster", '''
<div class="e2e-fgrid" data-e2e-filtergrid><div class="e2e-toolbar"><input class="e2e-input" type="search" placeholder="Zoek een product…" aria-label="Zoeken" data-fg-search><div class="e2e-segmented" role="group" aria-label="Filter"><button type="button" aria-pressed="true" data-fg-cat="">Alles</button><button type="button" aria-pressed="false" data-fg-cat="kleding">Kleding</button><button type="button" aria-pressed="false" data-fg-cat="accessoires">Accessoires</button></div><select class="e2e-select" data-fg-sort aria-label="Sorteren"><option value="">Sorteren</option><option value="name">Naam</option><option value="price">Prijs</option></select></div>
<div class="e2e-grid" style="--e2e-min:200px"><article class="e2e-card" data-cat="kleding" data-name="Linnen overhemd" data-price="59"><div class="e2e-card__media"></div><div class="e2e-card__body"><h3>Linnen overhemd</h3><p>€ 59,00</p></div></article>
<article class="e2e-card" data-cat="kleding" data-name="Wollen trui" data-price="69"><div class="e2e-card__media"></div><div class="e2e-card__body"><h3>Wollen trui</h3><p>€ 69,00</p></div></article>
<article class="e2e-card" data-cat="accessoires" data-name="Katoenen sjaal" data-price="24"><div class="e2e-card__media"></div><div class="e2e-card__body"><h3>Katoenen sjaal</h3><p>€ 24,50</p></div></article>
<article class="e2e-card" data-cat="accessoires" data-name="Leren riem" data-price="39"><div class="e2e-card__media"></div><div class="e2e-card__body"><h3>Leren riem</h3><p>€ 39,00</p></div></article></div><p class="e2e-hint" data-fg-empty hidden>Niets gevonden.</p></div>'''),
    C("ui-search-results", "Zoekpagina met filters", "Groot zoekveld, aantal resultaten, filters links en resultaten rechts.", "Database & lijsten", "Zoekresultaten", '''
<div class="e2e-searchpage"><form class="e2e-input-group" onsubmit="return false"><input class="e2e-input" type="search" value="website" aria-label="Zoeken"><button class="e2e-btn">Zoeken</button></form><p class="e2e-hint">12 resultaten voor <b>website</b></p>
<div class="e2e-searchpage__cols"><aside class="e2e-panel"><h4>Filteren</h4><div class="e2e-filter"><label><input type="checkbox" checked> Pagina\'s</label><label><input type="checkbox" checked> Producten</label><label><input type="checkbox"> Documenten</label><label><input type="checkbox"> Nieuws</label></div></aside>
<ul class="e2e-results"><li><a href="#">Een website laten maken</a><small>/diensten/website</small><p>Wij bouwen je <mark>website</mark> in je eigen kleuren, zodat je hem zelf kunt aanpassen.</p></li><li><a href="#">Pakketten en prijzen</a><small>/pakketten-prijzen</small><p>Kies het pakket dat past bij je <mark>website</mark>: Start, Pro of Business.</p></li><li><a href="#">Zo schrijf je een tekst die gelezen wordt</a><small>/blog/teksten</small><p>Tips voor de teksten op je <mark>website</mark>.</p></li></ul></div></div>'''),
    C("ui-filter-bar", "Filterbalk", "Rij met filtervelden, actieve filters als badges en een knop om te wissen.", "Database & lijsten", "Filterbalk", '''
<div class="e2e-filterbar"><div class="e2e-toolbar"><select class="e2e-select" aria-label="Status"><option>Alle statussen</option><option>Actief</option><option>Gepauzeerd</option></select><select class="e2e-select" aria-label="Plaats"><option>Alle plaatsen</option><option>Utrecht</option><option>Arnhem</option></select><input class="e2e-input" type="date" aria-label="Vanaf"><button class="e2e-btn e2e-btn--outline">Wissen</button></div><div class="e2e-row"><small class="e2e-hint">Actief:</small><span class="e2e-badge">Status: Actief ×</span><span class="e2e-badge">Plaats: Utrecht ×</span></div></div>'''),
    C("ui-record-detail", "Recorddetail", "Gegevenskaart met titel, status, velden en acties.", "Database & lijsten", "Recorddetail", '''
<article class="e2e-detail"><header><div><h3>Bakkerij Van Dam</h3><small class="e2e-hint">Klant sinds 2023 · Utrecht</small></div><span class="e2e-badge e2e-badge--success">Actief</span></header><dl><div><dt>Contactpersoon</dt><dd>Anna van Dam</dd></div><div><dt>E-mail</dt><dd>anna@vandam.nl</dd></div><div><dt>Telefoon</dt><dd>030 123 4567</dd></div><div><dt>Pakket</dt><dd>Pro · € 59 per maand</dd></div><div><dt>Laatste contact</dt><dd>12 november 2026</dd></div><div><dt>Notitie</dt><dd>Wil in december een webshop starten.</dd></div></dl><footer class="e2e-row"><button class="e2e-btn">Bewerken</button><button class="e2e-btn e2e-btn--outline">Bericht sturen</button><button class="e2e-btn e2e-btn--ghost">Verwijderen</button></footer></article>'''),
    C("ui-record-form", "Recordformulier", "Formulier om een record toe te voegen of te wijzigen, met opslaan en annuleren.", "Database & lijsten", "Recordformulier", '''
<form class="e2e-recform" onsubmit="return false"><h3>Nieuwe klant</h3><div class="e2e-grid" style="--e2e-min:220px"><div class="e2e-field"><label class="e2e-label" for="rf-n">Naam</label><input class="e2e-input" id="rf-n" placeholder="Bedrijfsnaam"></div><div class="e2e-field"><label class="e2e-label" for="rf-e">E-mailadres</label><input class="e2e-input" id="rf-e" type="email"></div><div class="e2e-field"><label class="e2e-label" for="rf-p">Pakket</label><select class="e2e-select" id="rf-p"><option>Start</option><option>Pro</option><option>Business</option></select></div><div class="e2e-field"><label class="e2e-label" for="rf-d">Startdatum</label><input class="e2e-input" id="rf-d" type="date"></div><div class="e2e-field" style="grid-column:1/-1"><label class="e2e-label" for="rf-m">Notitie</label><textarea class="e2e-textarea" id="rf-m"></textarea></div></div><div class="e2e-row" style="justify-content:flex-end"><button type="button" class="e2e-btn e2e-btn--outline">Annuleren</button><button class="e2e-btn">Opslaan</button></div></form>'''),
    C("ui-master-detail", "Lijst met detail", "Links een lijst, rechts de gegevens van het gekozen item.", "Database & lijsten", "Lijst met detail", '''
<div class="e2e-masterdetail" data-e2e-masterdetail><ul class="e2e-reclist" role="listbox"><li class="is-active" data-md="a"><span class="e2e-avatar">SD</span><div><b>Sophie de Vries</b><small>Ontwerper</small></div></li><li data-md="b"><span class="e2e-avatar e2e-avatar--alt">DS</span><div><b>Daan Smit</b><small>Ontwikkelaar</small></div></li><li data-md="c"><span class="e2e-avatar">LB</span><div><b>Lotte Bos</b><small>Marketing</small></div></li></ul>
<div class="e2e-detail" data-md-pane="a"><header><h3>Sophie de Vries</h3><span class="e2e-badge e2e-badge--success">Actief</span></header><dl><div><dt>Functie</dt><dd>Ontwerper</dd></div><div><dt>Plaats</dt><dd>Utrecht</dd></div></dl></div>
<div class="e2e-detail" data-md-pane="b" hidden><header><h3>Daan Smit</h3><span class="e2e-badge e2e-badge--neutral">Afwezig</span></header><dl><div><dt>Functie</dt><dd>Ontwikkelaar</dd></div><div><dt>Plaats</dt><dd>Arnhem</dd></div></dl></div>
<div class="e2e-detail" data-md-pane="c" hidden><header><h3>Lotte Bos</h3><span class="e2e-badge e2e-badge--success">Actief</span></header><dl><div><dt>Functie</dt><dd>Marketing</dd></div><div><dt>Plaats</dt><dd>Delft</dd></div></dl></div></div>'''),
    C("ui-schedule", "Weekrooster met uren", "Dag- of weekrooster met een uurkolom en afspraken op hun tijd (de plaats van elke afspraak staat in top en height).", "Planning & agenda", "Weekrooster", '''
<div class="e2e-sched" style="--cols:3"><div class="e2e-sched__head"><div></div><div class="e2e-sched__day"><button class="e2e-sched__dn"><small>ma</small><b>16</b></button></div><div class="e2e-sched__day is-today"><button class="e2e-sched__dn"><small>di</small><b>17</b></button></div><div class="e2e-sched__day"><button class="e2e-sched__dn"><small>wo</small><b>18</b></button></div></div>
<div class="e2e-sched__body"><div class="e2e-sched__gut"><div class="e2e-sched__hour" style="height:46px"><span>8:00</span></div><div class="e2e-sched__hour" style="height:46px"><span>9:00</span></div><div class="e2e-sched__hour" style="height:46px"><span>10:00</span></div><div class="e2e-sched__hour" style="height:46px"><span>11:00</span></div><div class="e2e-sched__hour" style="height:46px"><span>12:00</span></div></div>
<div class="e2e-sched__col"><div class="e2e-sched__line" style="top:0px"></div><div class="e2e-sched__line" style="top:46px"></div><div class="e2e-sched__line" style="top:92px"></div><div class="e2e-sched__line" style="top:138px"></div><div class="e2e-sched__line" style="top:184px"></div><button class="e2e-sched__ev" data-c="teal" style="top:46px;height:60px;left:0;width:96%"><b>Onboarding</b><small>09:00</small></button></div>
<div class="e2e-sched__col is-today"><div class="e2e-sched__line" style="top:0px"></div><div class="e2e-sched__line" style="top:46px"></div><div class="e2e-sched__line" style="top:92px"></div><div class="e2e-sched__line" style="top:138px"></div><div class="e2e-sched__line" style="top:184px"></div><button class="e2e-sched__ev" data-c="blue" style="top:92px;height:92px;left:0;width:96%"><b>Klantgesprek</b><small>10:00 – 12:00</small></button><div class="e2e-sched__now" style="top:130px"></div></div>
<div class="e2e-sched__col"><div class="e2e-sched__line" style="top:0px"></div><div class="e2e-sched__line" style="top:46px"></div><div class="e2e-sched__line" style="top:92px"></div><div class="e2e-sched__line" style="top:138px"></div><div class="e2e-sched__line" style="top:184px"></div><button class="e2e-sched__ev" data-c="orange" style="top:23px;height:46px;left:0;width:96%"><b>Lunch</b><small>08:30</small></button></div></div></div>'''),
    C("ui-year-calendar", "Jaaroverzicht", "Maanden naast elkaar als minikalenders, met stipjes bij dagen met afspraken.", "Planning & agenda", "Jaaroverzicht", '''
<div class="e2e-year"><div class="e2e-mini"><div class="e2e-mini__head"><strong>september</strong></div><div class="e2e-mini__grid"><span class="e2e-mini__dow">ma</span><span class="e2e-mini__dow">di</span><span class="e2e-mini__dow">wo</span><span class="e2e-mini__dow">do</span><span class="e2e-mini__dow">vr</span><span class="e2e-mini__dow">za</span><span class="e2e-mini__dow">zo</span><button>1</button><button>2</button><button class="has-ev">3</button><button>4</button><button>5</button><button class="is-today">6</button><button>7</button><button>8</button><button>9</button><button class="has-ev">10</button><button>11</button></div></div><div class="e2e-mini"><div class="e2e-mini__head"><strong>oktober</strong></div><div class="e2e-mini__grid"><span class="e2e-mini__dow">ma</span><span class="e2e-mini__dow">di</span><span class="e2e-mini__dow">wo</span><span class="e2e-mini__dow">do</span><span class="e2e-mini__dow">vr</span><span class="e2e-mini__dow">za</span><span class="e2e-mini__dow">zo</span><button>1</button><button>2</button><button class="has-ev">3</button><button>4</button><button>5</button><button class="is-today">6</button><button>7</button><button>8</button><button>9</button><button class="has-ev">10</button><button>11</button></div></div><div class="e2e-mini"><div class="e2e-mini__head"><strong>november</strong></div><div class="e2e-mini__grid"><span class="e2e-mini__dow">ma</span><span class="e2e-mini__dow">di</span><span class="e2e-mini__dow">wo</span><span class="e2e-mini__dow">do</span><span class="e2e-mini__dow">vr</span><span class="e2e-mini__dow">za</span><span class="e2e-mini__dow">zo</span><button>1</button><button>2</button><button class="has-ev">3</button><button>4</button><button>5</button><button class="is-today">6</button><button>7</button><button>8</button><button>9</button><button class="has-ev">10</button><button>11</button></div></div></div>'''),
    C("ui-rows", "Waardelijst", "Compacte regels met links een naam en rechts een waarde of tijd, voor in een tegel.", "Database & lijsten", "Waardelijst", '''
<ul class="e2e-rows"><li><span>Sophie de Vries <span class="e2e-badge e2e-badge--solid">2</span></span><small>Zie je morgen?</small></li><li><span>Daan Smit</span><small>Bedankt voor je bericht</small></li><li><span>#1042 Anna van Dam</span><span><b>€ 187,00</b> <span class="e2e-badge e2e-badge--success">Betaald</span></span></li><li><span>Linnen overhemd</span><small class="is-low">3 over</small></li></ul>'''),
    C("ui-stat-row", "Cijfertegels", "Een rij kleine tegels met een waarde en een label, voor in een dashboardtegel.", "Data & feedback", "Cijfertegels", '''
<div class="e2e-statrow"><div class="e2e-statbox"><span>Matches</span><b>12</b></div><div class="e2e-statbox"><span>Nieuwe likes</span><b>4</b></div><div class="e2e-statbox"><span>Favorieten</span><b>9</b></div></div>'''),
    C("ui-donut", "Cirkeldiagram", "Ring met de verdeling in delen en een legenda.", "Data & feedback", "Cirkeldiagram", '''
<div class="e2e-donut"><div class="e2e-donut__ring" style="background:conic-gradient(var(--e2e-primary) 0 45%,var(--e2e-secondary) 45% 75%,var(--e2e-accent) 75% 100%)"></div><ul class="e2e-legend"><li><i style="background:var(--e2e-primary)"></i>Afbeeldingen <b>45%</b></li><li><i style="background:var(--e2e-secondary)"></i>Documenten <b>30%</b></li><li><i style="background:var(--e2e-accent)"></i>Overig <b>25%</b></li></ul></div>'''),
]
EXTRA += CHARTS

# ---- AI costs: the live list, the three amounts, the floating window ----
COSTS = [
    C("ui-live-feed", "Live lijst", "Een lijst die live bijgewerkt wordt (bv. elk AI-verzoek met kosten), met een lampje, pauzeren en wissen.", "Data & feedback", "Live lijst", """
<div class="e2e-live"><header class="e2e-live__head"><i class="e2e-live__dot"></i><b>Live: elk verzoek verschijnt hier direct</b><span class="e2e-live__tools"><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Pauzeren</button><button class="e2e-btn e2e-btn--ghost e2e-btn--sm">Wissen</button></span></header>
<div class="e2e-table-wrap"><table class="e2e-table"><thead><tr><th>Tijd</th><th>Waarvoor</th><th>Wie</th><th>Tokens</th><th style="text-align:right">Kosten</th></tr></thead><tbody>
<tr><td>10:26:03</td><td><strong>Website ontwerpen</strong></td><td>Ronald</td><td>20.076 → 24.000</td><td style="text-align:right"><strong>€ 1,51</strong></td></tr>
<tr><td>10:22:45</td><td><strong>Vertalen</strong> <span class="e2e-badge e2e-badge--danger">mislukt</span></td><td>Systeem</td><td>19.358 → 17.211</td><td style="text-align:right"><strong>€ 1,14</strong></td></tr></tbody></table></div></div>"""),
    C("ui-cost-summary", "Kosten: nu, vandaag, maand", "Drie bedragen naast elkaar: wat het nu kost, wat het vandaag kost en wat het deze maand kost.", "Grafieken & statistieken", "Kosten", """
<div class="e2e-costs"><div class="e2e-costs__main"><small>Nu</small><b>€ 8,05</b></div><div class="e2e-costs__item"><small>Vandaag</small><b>€ 12,40</b><span class="e2e-hint">24 verzoeken</span></div><div class="e2e-costs__item"><small>Deze maand</small><b>€ 186,10</b><span class="e2e-hint">412 verzoeken</span></div></div>"""),
    C("ui-cost-widget", "Zwevend kostenvenster", "Een ronde knop met het valutateken die een klein venster opent met de kosten nu, vandaag en deze maand en de verzoeken per soort, uit te klappen.", "Data & feedback", "Kostenvenster", """
<div class="e2e-floatwin"><div class="e2e-floatwin__panel"><div class="e2e-costs e2e-costs--solid"><div class="e2e-costs__main"><small>Nu</small><b>€ 8,05</b></div><div class="e2e-costs__item"><small>Vandaag</small><b>€ 12,40</b></div><div class="e2e-costs__item"><small>Deze maand</small><b>€ 186,10</b></div></div>
<ul class="e2e-fold"><li><button class="e2e-fold__head" aria-expanded="false"><span>Systeem</span><b>€ 8,05</b></button></li><li><button class="e2e-fold__head" aria-expanded="false"><span>Website ontwerpen</span><b>€ 3,20</b></button></li></ul></div>
<button class="e2e-floatwin__btn" aria-label="Kosten">€</button></div>"""),
]
EXTRA += COSTS

CSS = r'''
/* ===== TABS VOLGEN HET THEMA: data-e2e-tabstyle="pills|underline|segmented|folder" op html, body of het blok (easy2edit zet hem uit Thema > Vormgeving > Uiterlijk van tabbladen) ===== */
[data-e2e-tabstyle="pills"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__list{border:0;background:transparent;padding:0;gap:.4rem;flex-wrap:wrap;overflow:visible;display:flex;border-radius:0}
[data-e2e-tabstyle="pills"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab{margin:0;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius);background:var(--e2e-bg);padding:.55rem 1.1rem}
[data-e2e-tabstyle="pills"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab[aria-selected="true"]{background:var(--e2e-primary);border-color:var(--e2e-primary);color:var(--e2e-on-primary)}
[data-e2e-tabstyle="underline"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__list{border:0;border-bottom:1px solid var(--e2e-border);background:transparent;padding:0;gap:0;border-radius:0;display:flex}
[data-e2e-tabstyle="underline"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab{margin:0 0 -1px;border:0;border-bottom:2px solid transparent;border-radius:0;background:none;padding:.75rem 1.1rem}
[data-e2e-tabstyle="underline"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab[aria-selected="true"]{background:none;color:var(--e2e-primary-ink);border-bottom-color:var(--e2e-primary)}
[data-e2e-tabstyle="segmented"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__list{display:inline-flex;gap:0;padding:3px;border:1px solid var(--e2e-border);border-radius:calc(var(--e2e-radius) + 3px);background:var(--e2e-surface);max-width:100%}
[data-e2e-tabstyle="segmented"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab{margin:0;border:0;border-radius:var(--e2e-radius);background:none;padding:.5rem 1.1rem}
[data-e2e-tabstyle="segmented"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab[aria-selected="true"]{background:var(--e2e-bg);color:var(--e2e-primary-ink);box-shadow:0 1px 3px rgba(0,0,0,.2)}
[data-e2e-tabstyle="folder"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__list{border:0;border-bottom:1px solid var(--e2e-border);background:transparent;padding:0;gap:.25rem;border-radius:0;display:flex}
[data-e2e-tabstyle="folder"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab{margin:0 0 -1px;border:1px solid var(--e2e-border);border-bottom:0;border-radius:var(--e2e-radius) var(--e2e-radius) 0 0;background:var(--e2e-surface);padding:.65rem 1.1rem}
[data-e2e-tabstyle="folder"] .e2e-tabs:not(.e2e-pills) .e2e-tabs__tab[aria-selected="true"]{background:var(--e2e-bg);color:var(--e2e-primary-ink);border-bottom:1px solid var(--e2e-bg)}
/* ===== EXTRA COMPONENTEN (aankondiging, zoeken, zijmenu, galerij, carrousel, blog, nieuwsbrief, stappen, vergelijking, profiel, beoordeling, webshop, inloggen, sociaal, sectiekop, aftelklok, fout, meldingen) ===== */
.e2e-announce{display:flex;gap:1rem;align-items:center;justify-content:center;flex-wrap:wrap;padding:.6rem 2.6rem .6rem 1rem;background:var(--e2e-accent);color:var(--e2e-on-accent);font-size:.92rem;position:relative;text-align:center}
.e2e-announce a{color:inherit;font-weight:700;text-decoration:underline}
.e2e-announce__x{position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;font-size:1.3rem;line-height:1;cursor:pointer;opacity:.8}
.e2e-search{max-width:560px}
.e2e-sidemenu{display:flex;flex-direction:column;gap:.15rem;width:240px;max-width:100%;padding:.6rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg)}
.e2e-sidemenu small{padding:.7rem .8rem .3rem;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--e2e-muted)}
.e2e-sidemenu a{display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;border-radius:var(--e2e-radius);color:var(--e2e-text);text-decoration:none;font-weight:500}
.e2e-sidemenu a:hover{background:var(--e2e-primary-soft)} .e2e-sidemenu a.is-active{background:var(--e2e-primary);color:var(--e2e-on-primary)}
.e2e-gallery{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))}
.e2e-gallery img,.e2e-gallery__img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--e2e-radius);display:block}
.e2e-gallery__img{background:linear-gradient(135deg,color-mix(in srgb,var(--e2e-primary) calc(var(--g)*12%),var(--e2e-surface)),color-mix(in srgb,var(--e2e-accent) calc(var(--g)*9%),var(--e2e-surface)))}
.e2e-gallery>*:nth-child(1),.e2e-gallery>*:nth-child(5){grid-column:span 2;grid-row:span 1}
.e2e-carousel{position:relative}
.e2e-carousel__track{display:flex;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding-bottom:.5rem;scrollbar-width:none}
.e2e-carousel__track::-webkit-scrollbar{display:none}
.e2e-slide{flex:0 0 min(320px,82%);scroll-snap-align:start;padding:1.6rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-surface);display:flex;flex-direction:column;gap:.6rem}
.e2e-slide h3{margin:0}.e2e-slide p{margin:0;color:var(--e2e-muted)}
.e2e-carousel__nav{display:flex;gap:.4rem;justify-content:flex-end;margin-top:.7rem}
.e2e-newsletter{display:flex;flex-wrap:wrap;gap:1.2rem 2rem;align-items:center;justify-content:space-between;padding:clamp(1.4rem,3vw,2.2rem);border-radius:var(--e2e-radius-lg);background:var(--e2e-primary-soft);border:1px solid var(--e2e-primary-line)}
.e2e-newsletter h3{margin:0 0 .2rem}.e2e-newsletter p{margin:0;color:var(--e2e-muted)}.e2e-newsletter .e2e-input-group{flex:1 1 300px;max-width:460px}
.e2e-process{list-style:none;margin:0;padding:0;display:grid;gap:1.4rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));counter-reset:none}
.e2e-process li{position:relative;padding:1.4rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg)}
.e2e-process b{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:50%;background:var(--e2e-primary);color:var(--e2e-on-primary);font-family:var(--e2e-font-heading);margin-bottom:.7rem}
.e2e-process h4{margin:0 0 .3rem}.e2e-process p{margin:0;color:var(--e2e-muted)}
.e2e-compare th,.e2e-compare td{text-align:center}.e2e-compare th:first-child,.e2e-compare td:first-child{text-align:left;font-weight:600}
.e2e-compare .is-featured{background:var(--e2e-primary-soft);font-weight:700}
.e2e-profile{max-width:340px;padding:1.8rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);text-align:center;display:flex;flex-direction:column;align-items:center;gap:.7rem}
.e2e-profile h3{margin:0}.e2e-profile p{margin:0;color:var(--e2e-muted)}
.e2e-profile__stats{display:flex;gap:1.4rem;padding:.7rem 0}.e2e-profile__stats span{display:flex;flex-direction:column;line-height:1.2}.e2e-profile__stats b{font-family:var(--e2e-font-heading);font-size:1.3rem}.e2e-profile__stats small{color:var(--e2e-muted)}
.e2e-stars{color:var(--e2e-warning);letter-spacing:.1em}
.e2e-rating{display:flex;flex-wrap:wrap;gap:1.6rem 3rem;align-items:center}
.e2e-rating__score{display:flex;flex-direction:column;gap:.2rem}.e2e-rating__score b{font-family:var(--e2e-font-heading);font-size:3.2rem;line-height:1}
.e2e-rating__bars{flex:1 1 260px;display:flex;flex-direction:column;gap:.4rem}.e2e-rating__bars div{display:flex;align-items:center;gap:.6rem}.e2e-rating__bars small{width:1rem;color:var(--e2e-muted)}
.e2e-rating__bars i{flex:1;height:.55rem;border-radius:999px;background:var(--e2e-surface);position:relative;overflow:hidden}.e2e-rating__bars i::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);background:var(--e2e-warning);border-radius:inherit}
.e2e-product__price{font-family:var(--e2e-font-heading);font-size:1.35rem}.e2e-product__price s{color:var(--e2e-muted);font-size:1rem;margin-right:.3rem}
.e2e-product__flag{position:absolute;top:.7rem;left:.7rem}
.e2e-cart{max-width:380px;padding:1.5rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);display:flex;flex-direction:column;gap:.8rem}
.e2e-cart h3{margin:0}.e2e-cart__row{display:flex;justify-content:space-between;gap:1rem}.e2e-cart__total{font-weight:700;font-size:1.2rem;border-top:1px solid var(--e2e-border);padding-top:.8rem}
.e2e-login{max-width:400px;padding:1.8rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);display:flex;flex-direction:column;gap:1rem}
.e2e-login h3{margin:0}.e2e-login__or{display:flex;align-items:center;gap:.8rem;color:var(--e2e-muted);font-size:.85rem}.e2e-login__or::before,.e2e-login__or::after{content:"";flex:1;height:1px;background:var(--e2e-border)}
.e2e-social{display:flex;gap:.5rem;flex-wrap:wrap}.e2e-social a{display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:50%;background:var(--e2e-primary-soft);color:var(--e2e-primary-ink);font-weight:700;text-decoration:none;text-transform:lowercase}
.e2e-social a:hover{background:var(--e2e-primary);color:var(--e2e-on-primary)}
.e2e-sechead{max-width:640px;margin-inline:auto;text-align:center}.e2e-sechead h2{margin:.2rem 0 .6rem}.e2e-sechead--left{margin-inline:0;text-align:left}
.e2e-rule{width:64px;height:4px;border:0;border-radius:4px;background:var(--e2e-primary);margin:1rem 0 0}.e2e-sechead:not(.e2e-sechead--left) .e2e-rule{margin-inline:auto}
.e2e-countdown{display:flex;gap:.8rem;flex-wrap:wrap}.e2e-countdown div{min-width:5.2rem;padding:.9rem .6rem;border-radius:var(--e2e-radius);background:var(--e2e-accent);color:var(--e2e-on-accent);text-align:center;line-height:1.1}
.e2e-countdown b{display:block;font-family:var(--e2e-font-heading);font-size:2rem;font-variant-numeric:tabular-nums}.e2e-countdown small{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;opacity:.8}
.e2e-error{text-align:center;max-width:520px;margin-inline:auto;padding:3rem 1rem;display:flex;flex-direction:column;gap:.8rem;align-items:center}
.e2e-error>b{font-family:var(--e2e-font-heading);font-size:clamp(4rem,12vw,7rem);line-height:1;color:var(--e2e-primary)}.e2e-error h2,.e2e-error p{margin:0}.e2e-error p{color:var(--e2e-muted)}
.e2e-notes{list-style:none;margin:0;padding:0;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);overflow:hidden;background:var(--e2e-bg)}
.e2e-notes li{display:flex;gap:.8rem;align-items:flex-start;padding:.9rem 1.1rem;border-bottom:1px solid var(--e2e-border)}.e2e-notes li:last-child{border-bottom:0}
.e2e-notes i{flex:none;width:.6rem;height:.6rem;border-radius:50%;background:transparent;margin-top:.45rem}.e2e-notes .is-new{background:var(--e2e-primary-soft)}.e2e-notes .is-new i{background:var(--e2e-primary)}
.e2e-notes b{display:block}.e2e-notes small{color:var(--e2e-muted)}
/* ===== PLANNING-ONDERDELEN (segmentknoppen, kalenderbalk, minikalender, filterlijst, zijpaneel, maand met weken, gekleurde chips) ===== */
.e2e-dot,.e2e-chip{--_c:var(--e2e-primary)}
[data-c="blue"]{--_c:#3b82f6}[data-c="orange"]{--_c:#f97316}[data-c="green"]{--_c:#16a34a}[data-c="pink"]{--_c:#ec4899}[data-c="purple"]{--_c:#8b5cf6}[data-c="teal"]{--_c:#0d9488}[data-c="red"]{--_c:#dc2626}[data-c="gray"]{--_c:#64748b}
.e2e-dot{display:inline-block;width:.7rem;height:.7rem;border-radius:50%;background:var(--_c);flex:none}
.e2e-segmented{display:inline-flex;padding:3px;gap:2px;border:1px solid var(--e2e-border);border-radius:calc(var(--e2e-radius) + 3px);background:var(--e2e-surface);max-width:100%}
.e2e-segmented button{border:0;background:none;color:var(--e2e-muted);font:600 .9rem var(--e2e-font-body);padding:.45rem 1rem;border-radius:var(--e2e-radius);cursor:pointer;white-space:nowrap}
.e2e-segmented button:hover{color:var(--e2e-text)}.e2e-segmented button[aria-pressed="true"]{background:var(--e2e-primary);color:var(--e2e-on-primary)}
.e2e-cal-toolbar{display:flex;flex-wrap:wrap;gap:.8rem 1.2rem;align-items:center;justify-content:space-between;padding:.7rem .9rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg)}
.e2e-cal-toolbar h3{margin:0 0 0 .4rem;font-family:var(--e2e-font-heading);font-size:1.3rem;text-transform:capitalize}
.e2e-mini{padding:.8rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg)}
.e2e-mini__head{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;text-transform:capitalize}.e2e-mini__head span{display:flex;gap:.25rem}
.e2e-mini__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}
.e2e-mini__dow{font-size:.7rem;color:var(--e2e-muted);padding:.2rem 0}
.e2e-mini__grid button{position:relative;aspect-ratio:1;border:0;border-radius:50%;background:none;color:var(--e2e-text);font:inherit;font-size:.82rem;cursor:pointer;padding:0}
.e2e-mini__grid button:hover{background:var(--e2e-primary-soft)}.e2e-mini__grid .is-out{color:color-mix(in srgb,var(--e2e-text) 38%,var(--e2e-bg))}
.e2e-mini__grid .is-today{background:var(--e2e-primary);color:var(--e2e-on-primary);font-weight:700}.e2e-mini__grid .is-selected{box-shadow:inset 0 0 0 2px var(--e2e-primary)}
.e2e-mini__grid .has-ev::after{content:"";position:absolute;left:50%;bottom:2px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--e2e-primary)}.e2e-mini__grid .is-today.has-ev::after{background:var(--e2e-on-primary)}
.e2e-filter{display:flex;flex-direction:column;gap:.5rem}.e2e-filter label{display:flex;align-items:center;gap:.55rem;font-weight:500;cursor:pointer}
.e2e-panel{padding:1rem 1.1rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);display:flex;flex-direction:column;gap:.6rem}
.e2e-panel>h4{margin:0}.e2e-panel small{color:var(--e2e-muted)}
.e2e-upnext{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.55rem}.e2e-upnext li{display:flex;gap:.6rem;align-items:flex-start;cursor:pointer}.e2e-upnext .e2e-dot{margin-top:.4rem}.e2e-upnext b{display:block;font-weight:600}.e2e-upnext small{display:block}
.e2e-chip{display:block;width:100%;text-align:left;font:600 .72rem var(--e2e-font-body);padding:.15rem .4rem;border:0;border-left:3px solid var(--_c);border-radius:4px;background:color-mix(in srgb,var(--_c) 16%,var(--e2e-bg));color:color-mix(in srgb,var(--_c) 70%,var(--e2e-text));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.e2e-cal--weeks .e2e-cal__grid{grid-template-columns:2.2rem repeat(7,minmax(0,1fr))}
.e2e-cal--weeks .e2e-cal__day:nth-child(8n+2){border-left:1px solid var(--e2e-border)}
.e2e-cal__week{display:grid;place-items:start center;padding-top:.5rem;font-size:.7rem;color:var(--e2e-muted);border-top:1px solid var(--e2e-border);background:var(--e2e-surface)}
.e2e-cal--weeks .e2e-cal__day.is-today .e2e-cal__num{background:var(--e2e-primary);color:var(--e2e-on-primary)}

/* ===== DATABASE & LIJSTEN (datatabel, bulkacties, recordlijst, zoekraster, zoekpagina, filterbalk, recorddetail, recordformulier, lijst met detail) ===== */
.e2e-toolbar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:.8rem}.e2e-toolbar .e2e-input[type="search"]{flex:1 1 220px;max-width:340px}.e2e-toolbar .e2e-select{width:auto;min-width:9rem}
.e2e-pager{display:flex;gap:.8rem;align-items:center;justify-content:flex-end;margin-top:.7rem;color:var(--e2e-muted);font-size:.9rem}
.e2e-dt th[data-sort]{cursor:pointer;user-select:none}.e2e-dt th[data-sort]::after{content:" ↕";opacity:.4}.e2e-dt th[aria-sort="ascending"]::after{content:" ↑";opacity:1}.e2e-dt th[aria-sort="descending"]::after{content:" ↓";opacity:1}
.e2e-bulk__bar{display:flex;gap:1rem;align-items:center;justify-content:space-between;padding:.6rem .9rem;margin-bottom:.6rem;border-radius:var(--e2e-radius);background:var(--e2e-accent);color:var(--e2e-on-accent)}.e2e-bulk__bar[hidden]{display:none}
.e2e-reclist{list-style:none;margin:0;padding:0;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);overflow:hidden;background:var(--e2e-bg)}
.e2e-reclist li{display:flex;gap:.9rem;align-items:center;padding:.75rem 1rem;border-bottom:1px solid var(--e2e-border)}.e2e-reclist li:last-child{border-bottom:0}.e2e-reclist li>div{flex:1;min-width:0}.e2e-reclist b{display:block}.e2e-reclist small{color:var(--e2e-muted)}
.e2e-reclist li:hover{background:var(--e2e-primary-soft)}.e2e-reclist li.is-active{background:var(--e2e-primary-soft);box-shadow:inset 3px 0 0 var(--e2e-primary)}.e2e-masterdetail .e2e-reclist li{cursor:pointer}
.e2e-fgrid .e2e-card[hidden]{display:none}
.e2e-searchpage__cols{display:grid;gap:1.4rem;grid-template-columns:minmax(0,220px) minmax(0,1fr);margin-top:1rem;align-items:start}@media(max-width:720px){.e2e-searchpage__cols{grid-template-columns:1fr}}
.e2e-results{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1.2rem}.e2e-results a{font-size:1.1rem;font-weight:600}.e2e-results small{display:block;color:var(--e2e-success)}.e2e-results p{margin:.2rem 0 0;color:var(--e2e-muted)}.e2e-results mark{background:color-mix(in srgb,var(--e2e-warning) 35%,var(--e2e-bg));color:inherit;border-radius:3px;padding:0 .15em}
.e2e-filterbar{padding:.9rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-surface);display:flex;flex-direction:column;gap:.6rem}.e2e-filterbar .e2e-toolbar{margin:0}
.e2e-detail{padding:1.4rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);display:flex;flex-direction:column;gap:1rem}.e2e-detail[hidden]{display:none}
.e2e-detail header{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.e2e-detail h3{margin:0}
.e2e-detail dl{display:grid;gap:.8rem 1.6rem;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:0}.e2e-detail dt{font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--e2e-muted)}.e2e-detail dd{margin:.15rem 0 0}
.e2e-recform{padding:1.4rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);display:flex;flex-direction:column;gap:1rem}.e2e-recform h3{margin:0}
.e2e-masterdetail{display:grid;gap:1rem;grid-template-columns:minmax(0,280px) minmax(0,1fr);align-items:start}@media(max-width:720px){.e2e-masterdetail{grid-template-columns:1fr}}

/* ===== ROOSTER, JAAR, WAARDELIJST, CIJFERTEGELS, CIRKELDIAGRAM ===== */
.e2e-sched{border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);overflow:hidden;background:var(--e2e-bg)}
.e2e-sched__head,.e2e-sched__body{display:grid;grid-template-columns:52px repeat(var(--cols,7),minmax(0,1fr))}
.e2e-sched__head{border-bottom:1px solid var(--e2e-border);background:var(--e2e-surface)}
.e2e-sched__day{padding:.35rem .3rem;border-left:1px solid var(--e2e-border);display:flex;flex-direction:column;gap:2px;min-width:0}
.e2e-sched__dn{border:0;background:none;display:flex;flex-direction:column;align-items:center;padding:.1rem;color:inherit;font:inherit;cursor:pointer}
.e2e-sched__dn small{text-transform:uppercase;color:var(--e2e-muted);font-size:.7rem}
.e2e-sched__dn b{font-family:var(--e2e-font-heading);font-size:1.25rem;width:2.1rem;height:2.1rem;display:grid;place-items:center;border-radius:50%}
.e2e-sched__day.is-today .e2e-sched__dn b{background:var(--e2e-primary);color:var(--e2e-on-primary)}.e2e-sched__day.is-today .e2e-sched__dn small{color:var(--e2e-primary-ink)}
.e2e-sched__hour{position:relative}.e2e-sched__hour span{position:absolute;top:-.55rem;right:.4rem;font-size:.7rem;color:var(--e2e-muted)}
.e2e-sched__col{position:relative;border-left:1px solid var(--e2e-border);cursor:pointer}.e2e-sched__col.is-today{background:color-mix(in srgb,var(--e2e-primary) 5%,transparent)}
.e2e-sched__line{position:absolute;left:0;right:0;height:0;border-top:1px solid var(--e2e-border)}
.e2e-sched__ev{--_c:var(--e2e-primary);position:absolute;border:0;border-left:3px solid var(--_c);border-radius:6px;padding:2px 6px;text-align:left;overflow:hidden;display:flex;flex-direction:column;background:color-mix(in srgb,var(--_c) 18%,var(--e2e-bg));color:color-mix(in srgb,var(--_c) 70%,var(--e2e-text));font:inherit;font-weight:600;cursor:pointer}
.e2e-sched__ev b,.e2e-sched__ev strong{font-size:.78rem;line-height:1.15}.e2e-sched__ev small{font-size:.7rem;font-weight:500;opacity:.9}
.e2e-sched__now{position:absolute;left:0;right:0;height:2px;background:var(--e2e-danger);z-index:2}.e2e-sched__now::before{content:"";position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--e2e-danger)}
.e2e-year{display:grid;gap:.8rem;grid-template-columns:repeat(auto-fill,minmax(215px,1fr))}
.e2e-rows{list-style:none;margin:0;padding:0}.e2e-rows li{display:flex;justify-content:space-between;gap:.8rem;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--e2e-border)}.e2e-rows li:last-child{border-bottom:0}.e2e-rows small{color:var(--e2e-muted);text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.e2e-rows .is-low{color:var(--e2e-warning)}
.e2e-statrow{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}.e2e-statbox{padding:.8rem 1rem;border-radius:var(--e2e-radius);background:var(--e2e-surface);display:flex;flex-direction:column;gap:.1rem}.e2e-statbox span{color:var(--e2e-muted);font-size:.82rem}.e2e-statbox b{font-family:var(--e2e-font-heading);font-size:1.7rem;line-height:1.1;color:var(--e2e-primary)}
.e2e-donut{display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap}.e2e-donut__ring{--d:8.5rem;width:var(--d);height:var(--d);border-radius:50%;position:relative;flex:none}.e2e-donut__ring::after{content:"";position:absolute;inset:24%;border-radius:50%;background:var(--e2e-bg)}
.e2e-legend{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem;font-size:.9rem}.e2e-legend li{display:flex;align-items:center;gap:.5rem}.e2e-legend i{width:.7rem;height:.7rem;border-radius:3px;flex:none}.e2e-legend b{margin-left:auto;padding-left:.8rem}

/* ===== GRAFIEKEN & STATISTIEKEN (alleen css en svg, in de kleuren van het thema) ===== */
.e2e-chartcard{padding:1.2rem 1.3rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);display:flex;flex-direction:column;gap:.9rem}.e2e-chartcard--center{align-items:center;text-align:center}
.e2e-chartcard>header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem 1rem;width:100%}.e2e-chartcard h4{margin:0}
.s1{--_s:var(--e2e-primary)}.s2{--_s:var(--e2e-secondary)}.s3{--_s:var(--e2e-accent)}.s4{--_s:var(--e2e-info)}.s5{--_s:var(--e2e-success)}
.e2e-legend i.s1,.e2e-legend i.s2,.e2e-legend i.s3,.e2e-legend i.s4,.e2e-legend i.s5{background:var(--_s)}.e2e-legend--row{flex-direction:row;flex-wrap:wrap;gap:.4rem 1rem}
.e2e-chart{width:100%;height:150px}.e2e-chart--mini{height:50px}.e2e-chart__svg{width:100%;height:100%;display:block;overflow:visible}
.e2e-chart__grid line{stroke:var(--e2e-border);stroke-width:1;vector-effect:non-scaling-stroke}.e2e-chart__grid polygon{fill:none;stroke:var(--e2e-border);stroke-width:1}
.e2e-line{fill:none;stroke:var(--_s,var(--e2e-primary));stroke-width:2.5;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.e2e-area{fill:color-mix(in srgb,var(--_s,var(--e2e-primary)) 18%,transparent);stroke:none}
.e2e-dot-pt{fill:var(--e2e-bg);stroke:var(--_s,var(--e2e-primary));stroke-width:2;vector-effect:non-scaling-stroke}.e2e-chart--mini .e2e-dot-pt{display:none}
.e2e-chart__axis{display:flex;justify-content:space-between;font-size:.72rem;color:var(--e2e-muted)}
.e2e-bars{display:flex;align-items:flex-end;gap:.5rem;height:var(--h,160px);padding-top:.4rem;border-bottom:1px solid var(--e2e-border);margin-bottom:1.4rem}
.e2e-bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:.3rem;min-width:0}.e2e-bar>i{width:100%;max-width:2.4rem;height:var(--v);border-radius:6px 6px 0 0;background:var(--_s,var(--e2e-primary));min-height:2px}.e2e-bar:hover>i{filter:brightness(1.1)}.e2e-bar>small{font-size:.72rem;color:var(--e2e-muted);margin-bottom:-1.3rem;white-space:nowrap}
.e2e-bars--stack .e2e-stack__col{width:100%;max-width:2.4rem;height:100%;display:flex;flex-direction:column-reverse;border-radius:6px 6px 0 0;overflow:hidden}.e2e-bars--stack .e2e-stack__col i{display:block;height:var(--v);background:var(--_s)}
.e2e-hbars{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.7rem}.e2e-hbars li{display:grid;grid-template-columns:minmax(4.5rem,8rem) 1fr auto;gap:.8rem;align-items:center}.e2e-hbars span{font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.e2e-track{position:relative;height:.7rem;border-radius:999px;background:var(--e2e-surface)}.e2e-track>i{display:block;height:100%;width:var(--v);border-radius:inherit;background:var(--_s,var(--e2e-primary))}.e2e-track>em{position:absolute;top:-.3rem;bottom:-.3rem;left:var(--t);width:3px;border-radius:2px;background:var(--e2e-text)}
.e2e-pie::after{display:none}
.e2e-gauge{position:relative;width:min(240px,100%)}.e2e-gauge svg{width:100%;display:block}.e2e-gauge b{position:absolute;left:0;right:0;bottom:.4rem;text-align:center;font-family:var(--e2e-font-heading);font-size:2rem;line-height:1}.e2e-gauge small{position:absolute;left:0;right:0;bottom:-1.1rem;text-align:center;color:var(--e2e-muted)}
.e2e-ring__bg{fill:none;stroke:var(--e2e-surface);stroke-width:12;stroke-linecap:round}.e2e-ring__fg{fill:none;stroke:var(--_s,var(--e2e-primary));stroke-width:12;stroke-linecap:round}
.e2e-rings{display:flex;flex-wrap:wrap;gap:1.4rem;justify-content:space-around;width:100%}.e2e-ring{position:relative;width:7.5rem;text-align:center}.e2e-ring svg{width:100%;display:block}.e2e-ring b{position:absolute;left:0;right:0;top:2.2rem;font-family:var(--e2e-font-heading);font-size:1.5rem}.e2e-ring small{display:block;color:var(--e2e-muted);margin-top:.2rem}
.e2e-trend{padding:1rem 1.1rem;border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);display:flex;flex-direction:column;gap:.2rem}.e2e-trend small{color:var(--e2e-muted)}.e2e-trend b{font-family:var(--e2e-font-heading);font-size:1.9rem;line-height:1.1}
.e2e-delta{font-size:.82rem;font-weight:700}.e2e-delta.is-up{color:var(--e2e-success)}.e2e-delta.is-down{color:var(--e2e-danger)}
.e2e-heat{display:grid;grid-template-columns:repeat(24,1fr);gap:3px}.e2e-heat i,.e2e-heat__scale i{aspect-ratio:1;border-radius:3px;background:color-mix(in srgb,var(--e2e-primary) calc(var(--l,0)*22%),var(--e2e-surface))}
.e2e-heat [data-l="1"],.e2e-heat__scale [data-l="1"]{--l:1}.e2e-heat [data-l="2"],.e2e-heat__scale [data-l="2"]{--l:2}.e2e-heat [data-l="3"],.e2e-heat__scale [data-l="3"]{--l:3}.e2e-heat [data-l="4"],.e2e-heat__scale [data-l="4"]{--l:4.5}
.e2e-heat__scale{display:flex;gap:3px;align-items:center;font-size:.72rem;color:var(--e2e-muted);justify-content:flex-end}.e2e-heat__scale i{width:.9rem}
.e2e-funnel{display:flex;flex-direction:column;gap:.4rem;align-items:center}.e2e-funnel>div{width:var(--w);min-width:11rem;max-width:100%;padding:.6rem .9rem;border-radius:var(--e2e-radius);background:color-mix(in srgb,var(--e2e-primary) 85%,var(--e2e-surface));color:var(--e2e-on-primary);display:flex;justify-content:space-between;gap:1rem;font-size:.9rem}
.e2e-meters{display:flex;flex-direction:column;gap:.9rem;width:100%}.e2e-meters__row{display:flex;justify-content:space-between;gap:1rem;margin-bottom:.3rem}.e2e-target{width:100%}
.e2e-leader{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.7rem;width:100%}.e2e-leader li{display:grid;grid-template-columns:1.4rem auto minmax(5rem,10rem) 1fr auto;gap:.7rem;align-items:center}.e2e-leader li>b{color:var(--e2e-muted);text-align:center}
.e2e-radar{width:min(320px,100%)}.e2e-radar text{font-size:9px;fill:var(--e2e-muted)}.e2e-radar .e2e-line{stroke-width:2}
.e2e-chartcard [data-set][hidden]{display:none}

/* ===== LIVE LIJST, KOSTEN, ZWEVEND VENSTER ===== */
.e2e-live{border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);overflow:hidden}
.e2e-live__head{display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;border-bottom:1px solid var(--e2e-border)}.e2e-live__head b{flex:1}.e2e-live__tools{display:flex;gap:.3rem}
.e2e-live__dot{width:.6rem;height:.6rem;border-radius:50%;background:var(--e2e-success);box-shadow:0 0 0 4px color-mix(in srgb,var(--e2e-success) 25%,transparent)}.e2e-live.is-paused .e2e-live__dot{background:var(--e2e-muted);box-shadow:none}
.e2e-live tbody tr.is-new{background:var(--e2e-primary-soft)}.e2e-live tbody tr[data-open]{cursor:pointer}
.e2e-costs{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:.5rem;align-items:end;padding:1rem 1.15rem;border-radius:var(--e2e-radius-lg);background:var(--e2e-surface)}
.e2e-costs small{display:block;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--e2e-muted)}.e2e-costs b{display:block;font-family:var(--e2e-font-heading);font-size:1.2rem;line-height:1.4;font-variant-numeric:tabular-nums}
.e2e-costs__main b{font-size:1.9rem;line-height:1.15}.e2e-costs__item{border-left:1px solid var(--e2e-border);padding-left:.7rem}
.e2e-costs--solid{background:var(--e2e-primary);color:var(--e2e-on-primary,#fff);border-radius:0}.e2e-costs--solid small,.e2e-costs--solid .e2e-hint{color:inherit;opacity:.85}.e2e-costs--solid .e2e-costs__item{border-color:rgba(255,255,255,.3)}
.e2e-floatwin{position:relative;display:flex;flex-direction:column;align-items:flex-end;gap:.6rem}
.e2e-floatwin__panel{width:min(400px,100%);max-height:60vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--e2e-border);border-radius:calc(var(--e2e-radius-lg) + 4px);background:var(--e2e-bg);box-shadow:0 24px 60px rgba(0,0,0,.28)}
.e2e-floatwin__btn{width:3.25rem;height:3.25rem;border-radius:50%;border:0;background:var(--e2e-primary);color:var(--e2e-on-primary,#fff);font:700 1.5rem/1 var(--e2e-font-heading);cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.e2e-fold{list-style:none;margin:0;padding:.35rem .5rem;overflow-y:auto}.e2e-fold li{border-radius:var(--e2e-radius)}.e2e-fold li.is-open{background:var(--e2e-surface)}
.e2e-fold__head{width:100%;display:flex;justify-content:space-between;gap:.6rem;align-items:center;padding:.6rem;background:none;border:0;color:inherit;font:inherit;cursor:pointer;text-align:left}
.e2e-fold__head::before{content:"›";display:inline-block;width:1rem;transition:transform .15s;opacity:.6}.e2e-fold__head[aria-expanded="true"]::before{transform:rotate(90deg)}.e2e-fold__head span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.e2e-fold__body{padding:0 .6rem .6rem 1.6rem;font-size:.85rem;color:var(--e2e-muted)}.e2e-fold__body div{display:flex;justify-content:space-between;gap:.6rem;padding:.25rem 0;border-top:1px dashed var(--e2e-border)}

/* ===== SERIEKLEUREN (s1..s5) BINNEN DE COMPONENTEN: zo blijven ze ook werken in een blok van een pagina of scherm (alleen e2e-regels) ===== */
.e2e-bar.s1,.e2e-stack__col i.s1,.e2e-legend i.s1,.e2e-track.s1,.e2e-chartcard .s1{--_s:var(--e2e-primary)}
.e2e-bar.s2,.e2e-stack__col i.s2,.e2e-legend i.s2,.e2e-track.s2,.e2e-chartcard .s2{--_s:var(--e2e-secondary)}
.e2e-bar.s3,.e2e-stack__col i.s3,.e2e-legend i.s3,.e2e-track.s3,.e2e-chartcard .s3{--_s:var(--e2e-accent)}
.e2e-bar.s4,.e2e-stack__col i.s4,.e2e-legend i.s4,.e2e-track.s4,.e2e-chartcard .s4{--_s:var(--e2e-info)}
.e2e-bar.s5,.e2e-stack__col i.s5,.e2e-legend i.s5,.e2e-track.s5,.e2e-chartcard .s5{--_s:var(--e2e-success)}
.e2e-live__empty{padding:2.2rem 1rem;text-align:center;color:var(--e2e-muted)}

/* ===== TABEL: volgt het thema (kleur van de kop, hoeken, schaduw, lettertype); verandert overal waar een tabel van de set staat ===== */
.e2e-table-wrap{border:1px solid var(--e2e-border);border-radius:var(--e2e-radius-lg);background:var(--e2e-bg);box-shadow:var(--e2e-shadow);overflow:auto;max-height:var(--e2e-table-max,none)}
.e2e-table{border-collapse:separate;border-spacing:0;font-size:.93rem;color:var(--e2e-text)}
.e2e-table th,.e2e-table td{padding:.8rem 1.15rem;border-bottom:1px solid color-mix(in srgb,var(--e2e-border) 70%,transparent);vertical-align:middle;font-variant-numeric:tabular-nums}
.e2e-table thead th{position:sticky;top:0;z-index:1;white-space:nowrap;background:color-mix(in srgb,var(--e2e-primary) 8%,var(--e2e-surface));color:var(--e2e-primary-ink,var(--e2e-text));font-family:var(--e2e-font-heading);font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid var(--e2e-primary-line)}
.e2e-table tbody tr{transition:background .12s}
.e2e-table tbody tr:nth-child(even){background:color-mix(in srgb,var(--e2e-surface) 55%,transparent)}
.e2e-table tbody tr:hover{background:var(--e2e-primary-soft)}
.e2e-table tbody td:first-child{font-weight:600}
.e2e-table tbody tr:last-child td{border-bottom:0}
.e2e-table .e2e-num{text-align:right}
.e2e-table small,.e2e-table .e2e-hint{color:var(--e2e-muted)}
.e2e-table .e2e-badge{white-space:nowrap}
.e2e-table tfoot td{font-weight:700;background:var(--e2e-surface);border-top:2px solid var(--e2e-border-strong,var(--e2e-border))}
@media(max-width:640px){.e2e-table th,.e2e-table td{padding:.65rem .8rem}}

/* ===== KOSTEN: de drie bedragen staan bovenaan op één lijn; een verzoek dat bezig is ===== */
.e2e-costs{align-items:start}
.e2e-costs__main,.e2e-costs__item{display:flex;flex-direction:column;gap:.1rem;min-width:0}
.e2e-costs__main b,.e2e-costs__item b{line-height:1.25}
.e2e-costs__main .e2e-hint,.e2e-costs__item .e2e-hint{display:block}
.e2e-fold__run{display:flex;gap:.65rem;align-items:center;padding:.6rem .7rem;margin:.1rem 0 .35rem;border-radius:var(--e2e-radius);background:color-mix(in srgb,var(--e2e-primary) 10%,var(--e2e-bg))}
.e2e-fold__run span{flex:1;min-width:0}.e2e-fold__run small{display:block;color:var(--e2e-muted)}.e2e-fold__run b{font-variant-numeric:tabular-nums}
.e2e-live__dot.is-busy{animation:e2e-pulse 1.1s ease-in-out infinite}
@keyframes e2e-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--e2e-success) 45%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--e2e-success) 0%,transparent)}}
'''

JS = r'''
/* ===== EXTRA COMPONENTEN: script ===== */
(function(){
  document.querySelectorAll('[data-e2e-close]').forEach(function(b){b.addEventListener('click',function(){var t=b.closest(b.getAttribute('data-e2e-close'));if(t)t.remove();});});
  document.querySelectorAll('[data-e2e-carousel]').forEach(function(c){var tr=c.querySelector('.e2e-carousel__track');c.querySelectorAll('[data-dir]').forEach(function(b){b.addEventListener('click',function(){tr.scrollBy({left:Number(b.getAttribute('data-dir'))*(tr.clientWidth*0.8),behavior:'smooth'});});});});
  document.querySelectorAll('[data-e2e-countdown]').forEach(function(c){
    var to=new Date(c.getAttribute('data-date')).getTime();
    function z(n){return String(n).padStart(2,'0');}
    function tick(){var d=Math.max(0,to-Date.now()),s=Math.floor(d/1000);var v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};Object.keys(v).forEach(function(k){var e=c.querySelector('[data-u="'+k+'"]');if(e)e.textContent=z(v[k]);});}
    tick();setInterval(tick,1000);
  });
  /* --- database & lijsten --- */
  document.querySelectorAll('[data-e2e-datatable]').forEach(function(root){
    var tb=root.querySelector('tbody'),rows=[].slice.call(tb.rows),size=Number(root.getAttribute('data-page-size'))||10,page=1,q='',cat='',sortCol=-1,dir=1;
    var inp=root.querySelector('[data-dt-search]'),sel=root.querySelector('[data-dt-filter]'),cnt=root.querySelector('[data-dt-count]'),lab=root.querySelector('[data-dt-page]');
    function val(r,i,t){var c=r.cells[i];var v=c.getAttribute('data-v')||c.textContent;return t==='num'?parseFloat(String(v).replace(/[^0-9,.-]/g,'').replace(',','.'))||0:String(v).toLowerCase();}
    function draw(){
      var list=rows.filter(function(r){return (!q||r.textContent.toLowerCase().indexOf(q)>-1)&&(!cat||r.getAttribute('data-cat')===cat);});
      if(sortCol>-1){var t=root.querySelectorAll('th')[sortCol].getAttribute('data-sort');list.sort(function(a,b){var x=val(a,sortCol,t),y=val(b,sortCol,t);return (x<y?-1:x>y?1:0)*dir;});}
      var pages=Math.max(1,Math.ceil(list.length/size));if(page>pages)page=pages;
      rows.forEach(function(r){r.hidden=true;});list.forEach(function(r,i){tb.appendChild(r);r.hidden=!(i>=(page-1)*size&&i<page*size);});
      if(cnt)cnt.textContent=list.length+' resultaten';if(lab)lab.textContent='Pagina '+page+' van '+pages;
      var pv=root.querySelector('[data-dt-prev]'),nx=root.querySelector('[data-dt-next]');if(pv)pv.disabled=page<=1;if(nx)nx.disabled=page>=pages;
    }
    if(inp)inp.addEventListener('input',function(){q=inp.value.toLowerCase();page=1;draw();});
    if(sel)sel.addEventListener('change',function(){cat=sel.value;page=1;draw();});
    root.querySelectorAll('th[data-sort]').forEach(function(th,i){th.addEventListener('click',function(){var idx=[].indexOf.call(th.parentNode.children,th);dir=sortCol===idx?-dir:1;sortCol=idx;root.querySelectorAll('th').forEach(function(x){x.removeAttribute('aria-sort');});th.setAttribute('aria-sort',dir>0?'ascending':'descending');draw();});});
    var pv=root.querySelector('[data-dt-prev]'),nx=root.querySelector('[data-dt-next]');
    if(pv)pv.addEventListener('click',function(){page--;draw();});if(nx)nx.addEventListener('click',function(){page++;draw();});
    draw();
  });
  document.querySelectorAll('[data-e2e-bulk]').forEach(function(root){
    var all=root.querySelector('[data-bulk-all]'),rs=[].slice.call(root.querySelectorAll('[data-bulk-row]')),bar=root.querySelector('.e2e-bulk__bar'),cnt=root.querySelector('[data-bulk-count]');
    function upd(){var n=rs.filter(function(r){return r.checked;}).length;if(cnt)cnt.textContent=n;if(bar)bar.hidden=n===0;if(all){all.checked=n===rs.length&&n>0;all.indeterminate=n>0&&n<rs.length;}rs.forEach(function(r){r.closest('tr').style.background=r.checked?'var(--e2e-primary-soft)':'';});}
    if(all)all.addEventListener('change',function(){rs.forEach(function(r){r.checked=all.checked;});upd();});rs.forEach(function(r){r.addEventListener('change',upd);});upd();
  });
  document.querySelectorAll('[data-e2e-recordlist]').forEach(function(root){
    var inp=root.querySelector('[data-rl-search]');if(!inp)return;
    inp.addEventListener('input',function(){var q=inp.value.toLowerCase();root.querySelectorAll('.e2e-reclist li').forEach(function(li){li.hidden=q&&li.textContent.toLowerCase().indexOf(q)<0;});});
  });
  document.querySelectorAll('[data-e2e-filtergrid]').forEach(function(root){
    var cards=[].slice.call(root.querySelectorAll('.e2e-card')),grid=cards.length?cards[0].parentNode:null,inp=root.querySelector('[data-fg-search]'),srt=root.querySelector('[data-fg-sort]'),empty=root.querySelector('[data-fg-empty]'),cat='',q='';
    function draw(){var n=0;cards.forEach(function(c){var ok=(!cat||c.getAttribute('data-cat')===cat)&&(!q||c.textContent.toLowerCase().indexOf(q)>-1);c.hidden=!ok;if(ok)n++;});if(empty)empty.hidden=n>0;}
    if(inp)inp.addEventListener('input',function(){q=inp.value.toLowerCase();draw();});
    root.querySelectorAll('[data-fg-cat]').forEach(function(b){b.addEventListener('click',function(){root.querySelectorAll('[data-fg-cat]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});cat=b.getAttribute('data-fg-cat');draw();});});
    if(srt)srt.addEventListener('change',function(){var k=srt.value;if(!k||!grid)return;cards.sort(function(a,b){var x=a.getAttribute('data-'+k),y=b.getAttribute('data-'+k);return k==='price'?parseFloat(x)-parseFloat(y):String(x).localeCompare(String(y));}).forEach(function(c){grid.appendChild(c);});});
  });
  document.querySelectorAll('[data-e2e-masterdetail]').forEach(function(root){
    var items=[].slice.call(root.querySelectorAll('[data-md]'));
    items.forEach(function(li){li.addEventListener('click',function(){var k=li.getAttribute('data-md');items.forEach(function(x){x.classList.toggle('is-active',x===li);});root.querySelectorAll('[data-md-pane]').forEach(function(p){p.hidden=p.getAttribute('data-md-pane')!==k;});});});
  });

  document.querySelectorAll('[data-e2e-chartswitch]').forEach(function(root){
    var bs=[].slice.call(root.querySelectorAll('[data-show]'));
    bs.forEach(function(b){b.addEventListener('click',function(){bs.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});root.querySelectorAll('[data-set]').forEach(function(p){p.hidden=p.getAttribute('data-set')!==b.getAttribute('data-show');});});});
  });

})();
'''


def main():
    zips = sorted(LIB.glob(f"{KEY}-*.zip"))
    if not zips:
        sys.exit("Geen easy2edit-ui-kit zip in resource/components.")
    src = zips[-1]
    z = zipfile.ZipFile(src)
    man = json.loads(z.read("components.json"))
    css, js = z.read("components.css").decode(), z.read("components.js").decode()
    css = css.split("/* ===== TABS VOLGEN HET THEMA")[0].split("/* ===== EXTRA COMPONENTEN")[0].rstrip() + "\n" + CSS
    js = js.split("/* ===== EXTRA COMPONENTEN: script")[0].rstrip() + "\n" + JS
    tags = {c["easy2edit_tag"] for c in EXTRA}
    keep = [c for c in man["components"] if c["easy2edit_tag"] not in tags]
    comps = keep + EXTRA
    order = ["Start", "Basis", "Navigatie", "Content-blokken", "Database & lijsten", "Webshop", "Data & feedback", "Grafieken & statistieken", "Planning & agenda", "Zakelijk", "Media", "Afsluiting"]  # the footer stays last
    comps.sort(key=lambda c: order.index(c["group"]) if c["group"] in order else 99)
    major, minor, patch = (int(x) for x in str(man["version"]).split("."))
    ver = f"{major}.{minor + (0 if man['version'] == '1.0.0' and False else 1) if not any(c['easy2edit_tag'] in tags for c in man['components']) else minor}.{0 if not any(c['easy2edit_tag'] in tags for c in man['components']) else patch + 1}"
    man["name"] = "easy2edit UI-kit"
    man["version"], man["components"] = ver, comps
    man["description"] = "The standard set of easy2edit objects: hero, cards, pricing, FAQ, forms, calendar, kanban, KPI, documents, audio and video players, gallery, carousel, blog, webshop, login and more. They take the colours, fonts and corners of the theme in use."
    out = LIB / f"{KEY}-{ver}.zip"
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
