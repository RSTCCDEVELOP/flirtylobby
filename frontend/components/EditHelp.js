"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import I18N from "../lib/help-i18n.json";
import { getLanguage, tx } from "../lib/t";
import { useSession } from "./Session";

// Help mode in edit mode: a "?" at the top right. When it is on, the page is dimmed and every control that is pointed at tells what it does.
const HELP = [
  ["help", ".edit-help-btn", "Help: zet de uitleg aan of uit. Wijs daarna een icoon aan voor uitleg over wat het doet."],
  ["row-move", ".pb-rowbar [title='Omhoog'], .pb-rowbar [title='Omlaag']", "Verplaats dit blok of deze hero een plek omhoog of omlaag. Slepen met het icoon linksboven kan ook."],
  ["row-delete", ".pb-rowbar .danger", "Verwijdert dit blok of deze hero met alles wat erin staat. Je krijgt eerst een vraag om te bevestigen."],
  ["bg", ".sec-bg-controls", "Achtergrond van dit blok: kies een afbeelding of video uit de mediabibliotheek en bepaal hoe donker die wordt, zodat de tekst leesbaar blijft."],
  ["colorpick", ".pb-colorpick", "Kies een kleur uit het palet van het thema, of een eigen kleur met de kleurkiezer. Het kruisje betekent: zoals het thema."],
  ["stylebox", ".pb-stylebox", "Opmaak: kleuren, doorzichtigheid, lettertype en ronde hoeken. Met Terug naar thema zet je alles weer op de standaard van het thema."],
  ["alpha", ".pb-alpha, .pb-stylebox input[type='range']", "Doorzichtigheid: schuif naar links voor meer doorzichtig, naar rechts voor meer zichtbaar."],
  ["col-layout", ".pb-colchooser", "Kolomindeling: kies hoeveel kolommen dit blok of deze hero heeft en hoe breed ze zijn, bijvoorbeeld 50/50, 66/33 of drie gelijke kolommen. De onderdelen blijven staan; je sleept ze naar een andere kolom."],
  ["row-field", ".pb-rowbar label", "Een instelling van dit blok: kolommen, breedte, ruimte, hoogte of uitlijning. Elke wijziging wordt direct opgeslagen."],
  ["empty-image", ".pb-ph", "Een lege afbeelding: klik om een afbeelding of video uit de mediabibliotheek te kiezen of te uploaden."],
  ["device", ".device-bar", "Weergave testen: bekijk de pagina zoals hij eruitziet op een telefoon, tablet of computer."],
  ["preview-bar", ".pp-bar", "Bekijken of Bewerken, de breedte van het apparaat (computer, tablet, telefoon), de pagina openen in een eigen venster, of sluiten."],
  ["banner", ".edit-banner", "Bewerkmodus staat aan. Opslaan gebeurt automatisch bij elke wijziging."],
  ["image", ".img-edit", "Een afbeelding die je kunt wijzigen: gebruik Wijzig om te vervangen, het tandwiel voor grootte, uitlijning en doorzichtigheid, en Verwijder om hem weg te halen."],
  ["undo", ".edit-undo-btn", "Ongedaan maken: zet de laatste wijziging terug, tot 10 stappen (teksten, afbeeldingen en blokken). Sneltoets: Ctrl of Cmd + Z."],
  ["row-grip", ".pb-rowgrip", "Sleep dit blok of deze hero naar een andere plek op de pagina, ook naar boven. Een blauwe lijn laat zien waar het landt."],
  ["block-gear", ".pb-corner .pb-gear", "Instellingen van dit blok: kolommen, breedte, hoogte (bij een hero), ruimte, achtergrondkleur met doorzichtigheid, tekstkleur, lettertype, ronde hoeken en een achtergrond van een afbeelding of video."],
  ["page-gear", ".pb-pagegear", "Instellingen van de hele pagina: ruimte (padding), items per pagina, breedte, raster of rijen, hero tonen en de opmaak van de blokken."],
  ["block-nav", ".block-nav-btn", "De lijst met blokken: opent een zwevende lijst met de namen van alle blokken van deze pagina. Een klik op een naam brengt je naar dat blok. De lijst blijft open tot je op het kruisje klikt."],
  ["block-nav-list", ".block-nav-pop", "De blokken van deze pagina. Klik op een naam om naar dat blok te gaan; het blok dat je nu ziet is gemarkeerd. De namen stel je in bij de instellingen van een blok (Titel en adres)."],
  ["row-mobile-radius", ".pb-mobradius", "Ronde hoeken op mobiel: Aan houdt de ronde hoeken van dit blok ook op een telefoon. Uit maakt de hoeken van het blok en zijn achtergrond recht op schermen smaller dan 760 pixels; op een computer of tablet verandert er niets."],
  ["row-anchor", ".pb-anchorbox", "Titel en anker van dit blok: de titel staat in de lijst met blokken en het anker (bijvoorbeeld over-ons) maakt een link naar dit blok: het adres van de pagina met #over-ons erachter. Een hero heet standaard Hero."],
  ["text-gear", ".pb-gear.sm", "Tekstinstellingen: kies een tekststijl van het thema (Kop 1 tot 4, Alinea), een eigen grootte, kleur of lettertype."],
  ["image-gear", ".img-set-btn", "Afbeeldingsinstellingen: uitlijnen links, midden of rechts, grootte in pixels of procenten, doorzichtigheid en ronde hoeken."],
  ["image-delete", ".img-del-btn", "Verwijdert deze afbeelding of video van de pagina. Het onderdeel blijft staan, zodat je een andere kunt kiezen."],
  ["image-change", ".img-edit-btn", "Wijzig: kies een andere afbeelding of video uit de mediabibliotheek, of upload een nieuwe."],
  ["image-place", ".img-place-bar", "Uitlijning en grootte van deze afbeelding: klein, middel, groot, volledige breedte of een eigen formaat."],
  ["item-grip", ".pb-grip", "Sleep dit onderdeel (tekst, afbeelding of object) naar een andere plek, ook naar een andere kolom."],
  ["item-delete", ".pb-x", "Haalt dit onderdeel van de pagina."],
  ["cell-add", ".pb-add", "Voeg in deze kolom een tekst, een afbeelding of een systeemobject toe. Onder Raster in dit blok kies je 1 tot 4 kolommen voor het hele blok, ook in een hero."],
  ["grid-add", ".plain-btn", "Raster: een blok met kolommen (standaard drie) en een eigen hoogte, uitlijning en achtergrond, maar zonder de banner-uitstraling van een hero. Zet er tekst, afbeeldingen of objecten in."],
  ["row-add", ".pb-addrow", "Voeg een nieuw blok met 1 tot 4 kolommen toe, of een hero: een banner met een eigen hoogte en achtergrond."],
  ["cell-align", ".pb-cellbar .pb-seg", "Uitlijnen van de onderdelen in deze kolom: links, midden of rechts, boven, midden of onder."],
  ["rowbar", ".pb-rowbar", "De instellingen van dit blok. Sluit ze met het tandwiel linksboven in het blok."],
  ["text", ".text-edit, .editable-rich, .editable", "Klik op de tekst om hem te wijzigen. Met Uitgebreid open je de volledige tekst-editor met koppen, lijsten en links. Alles wordt direct opgeslagen."],
  ["page-settings", ".page-settings-btn", "Pagina-instellingen: de naam per taal, het adres per taal, SEO en de achtergrond van deze pagina."],
  ["edit-switch", ".edit-switch", "Zet de bewerkmodus aan of uit. Als hij uit staat zien bezoekers de pagina zoals hij is."],
  ["layout", ".pb-layout", "Kies de opmaak van de pagina: de blokken blijven staan, alleen het raster verandert. Herstel zet de standaard van het thema terug."],
  ["menu-site", ".hmenu a, .hmenu .hm-label, .hmenu-wrap", "Het menu van de website. Je bewerkt het in Admin → Pagina's → Menu: items maken, slepen naar een submenu, de vorm per apparaat en de header instellen."],
  ["menu-toggle", ".nav-toggle2", "Het hamburger-icoon: opent het menu op een telefoon of tablet. Vorm en positie stel je in bij Admin → Pagina's → Menu → Instellingen."],
  ["menu-bottom", ".f-bottom", "De menubalk onderaan het scherm, zoals een app. Aan te zetten per apparaat bij de menu-instellingen."],
  ["header", ".site-header", "De header van de website: logo, menu en knoppen. Hoogte, achtergrond, doorzichtigheid en gedrag bij scrollen stel je in bij Admin → Pagina's → Menu → Instellingen."],
];
// the changed texts (Admin → Help-teksten) come from the server; a text per language
const SELECTOR = HELP.map(([, s]) => s).join(",");
export const HELP_ENTRIES = HELP.map(([key, sel, text]) => ({ key, sel, text }));

export default function EditHelp() {
  const { editing } = useSession();
  const [on, setOn] = useState(false);
  const [tip, setTip] = useState(null); // the text of the control that is pointed at
  const tipEl = useRef(null);
  const custom = useRef({}); // texts that an administrator changed: {key: {lang: text}}
  const pos = useRef({ x: 0, y: 0 });
  const place = () => { const el = tipEl.current; if (!el) return; const x = Math.min(pos.current.x + 16, window.innerWidth - el.offsetWidth - 12), y = Math.min(pos.current.y + 18, window.innerHeight - el.offsetHeight - 12); el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`; };
  useEffect(() => { if (!editing) setOn(false); }, [editing]);
  useEffect(() => { if (on) api("/help/tips/").then((d) => { custom.current = d || {}; }).catch(() => {}); }, [on]);
  useEffect(() => {
    if (!on) { setTip(null); document.querySelectorAll(".help-target").forEach((e) => e.classList.remove("help-target")); return undefined; }
    let last = null, raf = 0;
    const over = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); });
      const t = e.target.closest?.(SELECTOR);
      if (t === last) return;
      last?.classList.remove("help-target");
      last = t || null;
      if (!t) { setTip(null); return; }
      t.classList.add("help-target");
      const hit = HELP.find(([, s]) => t.matches(s)) || HELP.find(([, s]) => t.closest(s));
      setTip(hit ? (custom.current[hit[0]]?.[getLanguage()] || custom.current[hit[0]]?.nl || I18N[hit[0]]?.[getLanguage()] || tx(hit[2])) : null);
    };
    const key = (e) => { if (e.key === "Escape") setOn(false); };
    document.addEventListener("mousemove", over);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousemove", over); document.removeEventListener("keydown", key); last?.classList.remove("help-target"); };
  }, [on]);
  if (!editing) return null;
  return (
    <>
      <button type="button" className={`edit-help-btn${on ? " on" : ""}`} onClick={() => setOn(!on)} aria-pressed={on} title={on ? (I18N._on?.[getLanguage()] || tx("Help uit")) : (I18N._off?.[getLanguage()] || tx("Help aan: wijs een icoon aan voor uitleg"))} aria-label={tx("Help")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></svg>
      </button>
      {on && <div className="edit-help-dim" aria-hidden="true"><span>{I18N._dim?.[getLanguage()] || tx("Help: wijs een icoon of onderdeel aan voor uitleg. Druk op Esc of op ? om te sluiten.")}</span></div>}
      {on && tip && <div className="edit-help-tip" role="tooltip" ref={(el) => { tipEl.current = el; if (el) requestAnimationFrame(place); }}>{tip}</div>}
    </>
  );
}
