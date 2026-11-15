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
    order = ["Start", "Basis", "Navigatie", "Content-blokken", "Database & lijsten", "Webshop", "Data & feedback", "Planning & agenda", "Zakelijk", "Media", "Afsluiting"]  # the footer stays last
    comps.sort(key=lambda c: order.index(c["group"]) if c["group"] in order else 99)
    major, minor, patch = (int(x) for x in str(man["version"]).split("."))
    ver = f"{major}.{minor + (0 if man['version'] == '1.0.0' and False else 1) if not any(c['easy2edit_tag'] in tags for c in man['components']) else minor}.{0 if not any(c['easy2edit_tag'] in tags for c in man['components']) else patch + 1}"
    man["version"], man["components"] = ver, comps
    man["description"] = "The standard set of Easy2edit objects: hero, cards, pricing, FAQ, forms, calendar, kanban, KPI, documents, audio and video players, gallery, carousel, blog, webshop, login and more. They take the colours, fonts and corners of the theme in use."
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
