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
    order = ["Start", "Basis", "Navigatie", "Content-blokken", "Webshop", "Data & feedback", "Planning & agenda", "Zakelijk", "Media", "Afsluiting"]  # the footer stays last
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
