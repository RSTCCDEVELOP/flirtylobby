// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { tx } from "../../../../lib/t";

// The questions of the prompt wizard: a good brief about the website, step by step. Every answer goes into the prompt (briefToText).
// Question types: text, area (long text), one (choose one), many (choose several), color, yesno.
const KIND = ["Bedrijf of dienstverlener", "Webshop", "Community of ledensite", "Evenementen of agenda", "Blog of nieuws", "Portfolio", "Vereniging of sportclub", "Stichting of goed doel", "Restaurant of horeca", "Zorg of coaching", "Anders"];
const GOALS = ["Meer klanten of aanvragen", "Producten verkopen", "Informeren", "Afspraken laten maken", "Leden werven", "Werk of projecten laten zien", "Donaties ophalen", "Vacatures invullen", "Nieuws en blog delen", "Merk bekender maken"];
const TONES = ["Professioneel", "Vriendelijk", "Speels", "Zakelijk", "Luxe", "Nuchter", "Warm", "Inspirerend", "Technisch", "Jong en vlot"];
const PAGES = ["Home", "Over ons", "Diensten", "Producten of webshop", "Portfolio of projecten", "Blog of nieuws", "Contact", "FAQ", "Prijzen", "Team", "Agenda of evenementen", "Vacatures", "Reviews", "Over de oprichter", "Locatie en openingstijden", "Downloads"];
const SECTIONS = ["Hero met kop en knop", "Voordelen of kenmerken", "Over ons", "Diensten", "Producten", "Reviews", "Prijzen", "Veelgestelde vragen", "Cijfers", "Logo's van klanten", "Team", "Foto's of galerij", "Stappenplan", "Nieuwsbrief", "Contactformulier of -gegevens", "Oproep tot actie"];
const STYLES = ["Modern", "Minimalistisch", "Speels", "Klassiek", "Luxe", "Stoer en krachtig", "Warm en huiselijk", "Zakelijk", "Technisch", "Natuurlijk", "Artistiek"];
const IMAGERY = ["Echte foto's", "Illustraties", "Iconen", "Abstracte vormen", "Patronen", "Video", "Weinig beeld, vooral tekst"];
const MODULES = ["Webshop", "FAQ", "Agenda en afspraken", "Showcase of portfolio", "Documenten", "Marktplaats", "Community en ledenprofielen", "Donaties", "Abonnementen", "Games", "Zoeken", "Meertalig", "Nieuwsbrief", "Reviews", "Chat en berichten", "Leeftijdscontrole"];

export const BRIEF_STEPS = [
  { key: "business", title: "Het bedrijf", intro: "Vertel kort wie je bent. Hoe meer je invult, hoe beter de AI het ontwerp afstemt.", q: [
    { k: "name", t: "text", l: "Naam van het bedrijf of de organisatie", ph: "bv. Bakkerij De Zon" },
    { k: "kind", t: "one", l: "Soort website", opts: KIND },
    { k: "what", t: "area", l: "Wat doe of verkoop je?", ph: "In een paar zinnen" },
    { k: "usp", t: "area", l: "Wat maakt jou anders of beter?", ph: "Sterke punten, ervaring, garanties" },
    { k: "place", t: "text", l: "Plaats of werkgebied", ph: "bv. Utrecht en omgeving" },
    { k: "slogan", t: "text", l: "Slogan of ondertitel (als je die hebt)" },
  ] },
  { key: "goal", title: "Doel en bezoekers", intro: "Wie komt er op de site en wat moet het opleveren?", q: [
    { k: "goals", t: "many", l: "Wat moet de website doen?", opts: GOALS },
    { k: "audience", t: "area", l: "Wie zijn je bezoekers of klanten?", ph: "Leeftijd, beroep, wat zoeken ze" },
    { k: "cta", t: "text", l: "Wat moet een bezoeker vooral doen?", ph: "bv. een offerte aanvragen, bellen, bestellen" },
    { k: "tone", t: "many", l: "Hoe klinkt de tekst?", opts: TONES },
    { k: "address", t: "one", l: "Hoe spreek je bezoekers aan?", opts: ["Je en jij", "U", "Ik/wij, zonder aanspreekvorm"] },
  ] },
  { key: "pages", title: "Pagina's en inhoud", intro: "Welke pagina's heb je nodig en wat staat erop?", q: [
    { k: "pages", t: "many", l: "Welke pagina's wil je?", opts: PAGES },
    { k: "pages_extra", t: "text", l: "Nog andere pagina's", ph: "Gescheiden door komma's" },
    { k: "sections", t: "many", l: "Wat komt er op de startpagina?", opts: SECTIONS },
    { k: "texts", t: "one", l: "Teksten", opts: ["Ik heb teksten (ik plak ze in de prompt)", "De AI schrijft de teksten", "De AI schrijft een eerste versie van mijn punten"] },
    { k: "textpoints", t: "area", l: "Belangrijke punten of teksten die erin moeten", ph: "Opsomming, diensten met prijzen, openingstijden" },
  ] },
  { key: "contact", title: "Contactgegevens", intro: "Deze komen in de kop, de voet en op de contactpagina.", q: [
    { k: "addr", t: "text", l: "Adres" }, { k: "phone", t: "text", l: "Telefoon" }, { k: "email", t: "text", l: "E-mail" },
    { k: "hours", t: "area", l: "Openingstijden", ph: "ma-vr 9-17" },
    { k: "social", t: "area", l: "Sociale kanalen", ph: "Links of namen van Instagram, Facebook, LinkedIn" },
    { k: "legal", t: "text", l: "KvK-nummer, btw-nummer (optioneel)" },
  ] },
  { key: "style", title: "Stijl en uitstraling", intro: "Hoe moet de site eruitzien en aanvoelen?", q: [
    { k: "styles", t: "many", l: "Stijl", opts: STYLES },
    { k: "corners", t: "one", l: "Hoeken", opts: ["Scherp", "Zacht afgerond", "Heel rond"] },
    { k: "density", t: "one", l: "Ruimte", opts: ["Veel witruimte", "Gemiddeld", "Compact en vol"] },
    { k: "dark", t: "one", l: "Lichte en donkere stand", opts: ["Alleen licht", "Alleen donker", "Beide (licht en donker)"] },
    { k: "motion", t: "one", l: "Beweging", opts: ["Rustig, geen effecten", "Subtiele hover-effecten", "Opvallend"] },
  ] },
  { key: "colors", title: "Thema, kleuren en componenten", special: "kit", intro: "Kies een thema (kleuren, lettertypen, vormen) en een componentenset (de kant-en-klare onderdelen) van deze website, of vul zelf merkkleuren in. De AI gebruikt ze in het ontwerp en de importer tekent alles in dat thema.", q: [
    { k: "theme_info", t: "hidden", l: "Chosen easy2edit theme" },
    { k: "compset_info", t: "hidden", l: "Chosen component set" },
    { k: "primary", t: "color", l: "Hoofdkleur (knoppen, links)" },
    { k: "secondary", t: "color", l: "Tweede kleur (accenten)" },
    { k: "colors_note", t: "text", l: "Andere kleuren, of kleuren die je juist niet wilt", ph: "bv. geen groen, wel warme tinten" },
    { k: "font", t: "one", l: "Lettertypen", opts: ["Systeemlettertypen (snel)", "Strak sans-serif", "Klassiek serif", "Rond en vriendelijk", "Laat de AI kiezen"] },
    { k: "logo", t: "one", l: "Logo", opts: ["Ik heb een logo (ik voeg het bij)", "De AI maakt een eenvoudig tekstlogo", "Nog geen logo"] },
  ] },
  { key: "imagery", title: "Beeld", intro: "Welk beeld hoort bij je verhaal?", q: [
    { k: "imagery", t: "many", l: "Soort beeld", opts: IMAGERY },
    { k: "photos", t: "one", l: "Foto's", opts: ["Ik heb eigen foto's (voeg ik later toe)", "Gebruik illustraties en kleurvlakken", "Gebruik tijdelijke plaatsvervangers"] },
    { k: "imagery_note", t: "area", l: "Wat moet er op de beelden te zien zijn?", ph: "bv. mensen aan het werk, producten, de winkel" },
  ] },
  { key: "features", title: "Functies", intro: "easy2edit heeft kant-en-klare onderdelen. Kies wat je wilt tonen; de AI plaatst daar de levende blokken.", q: [
    { k: "modules", t: "many", l: "Welke onderdelen wil je?", opts: MODULES },
    { k: "features_note", t: "area", l: "Wensen voor die onderdelen", ph: "bv. webshop met 12 producten, agenda met open dagen" },
  ] },
  { key: "tech", title: "Taal en vindbaarheid", intro: "Talen, zoekmachines en toegankelijkheid.", q: [
    { k: "lang", t: "text", l: "Hoofdtaal van de website", ph: "Nederlands" },
    { k: "langs", t: "text", l: "Andere talen", ph: "bv. Engels, Duits" },
    { k: "keywords", t: "area", l: "Zoekwoorden waarop je gevonden wilt worden", ph: "bv. bakker Utrecht, brood bestellen" },
    { k: "a11y", t: "yesno", l: "Goed toegankelijk (kleurcontrast, grote knoppen, duidelijke koppen)" },
    { k: "mobile", t: "one", l: "Vooral gebruikt op", opts: ["Telefoon", "Computer", "Beide even veel"] },
  ] },
  { key: "extra", title: "Inspiratie en wensen", intro: "Voorbeelden en wat je nog kwijt wilt.", q: [
    { k: "examples", t: "area", l: "Websites die je mooi vindt, en wat je ervan mooi vindt", ph: "Adressen en een toelichting" },
    { k: "competitors", t: "area", l: "Concurrenten of vergelijkbare sites" },
    { k: "avoid", t: "area", l: "Wat moet er juist niet in?" },
    { k: "wishes", t: "area", l: "Nog meer wensen of opmerkingen" },
  ] },
];

export const emptyBrief = () => ({});

// the brief as text for the prompt (only what is filled in)
export function briefToText(brief) {
  const b = brief || {};
  const out = [];
  for (const st of BRIEF_STEPS) {
    const lines = [];
    for (const q of st.q) {
      const v = b[q.k];
      const val = Array.isArray(v) ? v.join(", ") : q.t === "yesno" ? (v === true ? "yes" : v === false ? "no" : "") : String(v || "").trim();
      if (val) lines.push(`- ${q.l}: ${val}`);
    }
    if (lines.length) out.push(`### ${st.title}\n${lines.join("\n")}`);
  }
  return out.join("\n\n");
}

export const briefFilled = (brief) => BRIEF_STEPS.reduce((n, st) => n + st.q.filter((q) => { const v = (brief || {})[q.k]; return Array.isArray(v) ? v.length : q.t === "yesno" ? typeof v === "boolean" : String(v || "").trim(); }).length, 0);

const chip = (on) => ({ padding: ".3rem .75rem", borderRadius: 999, border: `1px solid ${on ? "var(--blue)" : "var(--line)"}`, background: on ? "color-mix(in srgb, var(--blue) 16%, var(--card))" : "var(--card)", color: on ? "var(--blue)" : "var(--text)", cursor: "pointer", font: "inherit", fontSize: ".88rem", fontWeight: on ? 700 : 500 });

// the questions of one step
export function BriefStep({ step, brief, setBrief, onSet }) {
  const set = (k, v) => setBrief((cur) => ({ ...cur, [k]: v }));
  return (
    <div className="stack-sm" style={{ gap: ".9rem" }}>
      {step.intro && <p className="muted" style={{ margin: 0 }}>{tx(step.intro)}</p>}
      {step.special === "kit" && <KitStep brief={brief} setBrief={setBrief} onSet={onSet} />}
      {step.q.filter((q) => q.t !== "hidden").map((q) => {
        const v = brief[q.k];
        return (
          <div key={q.k} className="stack-sm" style={{ gap: ".35rem" }}>
            <strong style={{ fontSize: ".9rem" }}>{tx(q.l)}</strong>
            {q.t === "text" && <input value={v || ""} placeholder={q.ph ? tx(q.ph) : ""} onChange={(e) => set(q.k, e.target.value)} />}
            {q.t === "area" && <textarea rows={3} value={v || ""} placeholder={q.ph ? tx(q.ph) : ""} onChange={(e) => set(q.k, e.target.value)} />}
            {q.t === "one" && <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>{q.opts.map((o) => <button type="button" key={o} style={chip(v === o)} aria-pressed={v === o} onClick={() => set(q.k, v === o ? "" : o)}>{tx(o)}</button>)}</div>}
            {q.t === "many" && <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>{q.opts.map((o) => { const on = (v || []).includes(o); return <button type="button" key={o} style={chip(on)} aria-pressed={on} onClick={() => set(q.k, on ? (v || []).filter((x) => x !== o) : [...(v || []), o])}>{tx(o)}</button>; })}</div>}
            {q.t === "yesno" && <div style={{ display: "flex", gap: ".4rem" }}>{[[true, "Ja"], [false, "Nee"]].map(([val, l]) => <button type="button" key={l} style={chip(v === val)} aria-pressed={v === val} onClick={() => set(q.k, v === val ? undefined : val)}>{tx(l)}</button>)}</div>}
            {q.t === "color" && (
              <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", alignItems: "center" }}>
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(v || "") ? v : "#f2823f"} onChange={(e) => set(q.k, e.target.value)} aria-label={tx(q.l)} style={{ width: 44, height: 36, padding: 0 }} />
                <input value={v || ""} placeholder="#f2823f" onChange={(e) => set(q.k, e.target.value)} style={{ width: "8rem" }} />
                {v && <button type="button" className="btn sm" onClick={() => set(q.k, "")}>{tx("Leegmaken")}</button>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const card = (on) => ({ textAlign: "left", padding: ".6rem .7rem", borderRadius: 12, border: `2px solid ${on ? "var(--blue)" : "var(--line)"}`, background: on ? "color-mix(in srgb, var(--blue) 8%, var(--card))" : "var(--card)", color: "var(--text)", cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", gap: ".35rem" });

// the choice of a theme (colours, fonts, shapes) and a set of components of this website; both go into the brief
function KitStep({ brief, setBrief, onSet }) {
  const [packs, setPacks] = useState(null);
  const [sets, setSets] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    // the themes of this website, and the themes of the library that are not installed yet (they can be installed later; the AI only needs their colours and fonts)
    Promise.all([api("/theme/packs/").then((d) => d.packs || d || []).catch(() => []), api("/resource/").then((d) => d?.kinds?.themas || []).catch(() => [])]).then(([own, lib]) => {
      const have = new Set(own.map((p) => p.key));
      const fromLib = lib.filter((r) => !r.bundle && !have.has(r.name) && r.preview).map((r) => ({ key: r.name, name: r.title, description: r.description, mode: r.preview.mode, library: true, fonts: [r.preview.font, r.preview.font],
        colors: { primary: r.preview.primary, secondary: r.preview.secondary, light_bg: r.preview.light?.page, light_card: r.preview.light?.card, light_text: r.preview.light?.text, dark_bg: r.preview.dark?.page } }));
      const seen = new Set();  // every theme once: by key and by name
      setPacks([...own, ...fromLib].filter((p) => { const k = `${p.key}|${String(p.name).trim().toLowerCase()}`; if (seen.has(p.key) || seen.has(`n:${String(p.name).trim().toLowerCase()}`)) return false; seen.add(p.key); seen.add(`n:${String(p.name).trim().toLowerCase()}`); return !!k; }));
    });
    api("/components/sets/").then((d) => setSets([...(d.installed || []), ...(d.library || []).filter((m) => !m.installed)])).catch(() => setSets([])); }, []);
  const pickTheme = (p) => setBrief((cur) => (p ? { ...cur, theme_key: p.key, primary: p.colors?.primary || cur.primary, secondary: p.colors?.secondary || cur.secondary, /* the colours of the theme go into the fields below (and can still be changed) */ theme_info: `${p.name} (key ${p.key}): primary ${p.colors?.primary}, secondary ${p.colors?.secondary}, page ${p.colors?.light_bg}, card ${p.colors?.light_card}, text ${p.colors?.light_text}; heading font ${p.fonts?.[0]}, body font ${p.fonts?.[1]}; ${p.mode === "dark" ? "dark" : p.mode === "light" ? "light" : "light and dark"} mode. Use exactly these colours and fonts as the theme of the design.` } : { ...cur, theme_key: "", theme_info: "" }));
  const pickSet = (m) => { setBrief((cur) => (m ? { ...cur, compset_key: m.key, compset_info: `${m.name} (key ${m.key}): use its components (the list with the easy2edit_tag of every component is attached with this prompt), in the look of this set.` } : { ...cur, compset_key: "", compset_info: "" })); onSet?.(m ? m.key : ""); };
  const list = (packs || []).filter((p) => p.enabled !== false && (!q.trim() || `${p.name} ${p.description} ${p.key}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="stack-sm" style={{ gap: ".9rem" }}>
      <strong style={{ fontSize: ".9rem" }}>{tx("Thema")} <small className="muted">({packs ? (packs || []).length : "…"})</small></strong>
      <input type="search" value={q} placeholder={tx("Zoek een thema…")} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: "18rem" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: ".5rem", maxHeight: 300, overflow: "auto", padding: 2 }}>
        <button type="button" style={card(!brief.theme_key)} aria-pressed={!brief.theme_key} onClick={() => pickTheme(null)}><strong>{tx("Geen voorkeur")}</strong><small className="muted">{tx("De AI kiest kleuren en lettertypen zelf (of gebruik de kleuren uit de vorige stap).")}</small></button>
        {list.map((p) => (
          <button type="button" key={p.key} style={card(brief.theme_key === p.key)} aria-pressed={brief.theme_key === p.key} onClick={() => pickTheme(p)}>
            <span style={{ display: "flex", height: 26, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>{[p.colors?.primary, p.colors?.secondary, p.colors?.light_bg, p.colors?.light_card, p.colors?.dark_bg].map((c, i) => <i key={i} style={{ flex: 1, background: c || "transparent" }} />)}</span>
            <strong>{p.name}</strong><small className="muted" style={{ lineHeight: 1.25 }}>{[p.fonts?.[0], p.mode === "dark" ? tx("donker") : p.mode === "light" ? tx("licht") : "", p.library ? tx("uit de bibliotheek") : ""].filter(Boolean).join(" · ")}</small>
          </button>
        ))}
      </div>
      <strong style={{ fontSize: ".9rem" }}>{tx("Componentenset")} <small className="muted">({sets ? sets.length : "…"})</small></strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: ".5rem" }}>
        <button type="button" style={card(!brief.compset_key)} aria-pressed={!brief.compset_key} onClick={() => pickSet(null)}><strong>{tx("Set in gebruik")}</strong><small className="muted">{tx("De componenten van de set die nu op de website staat.")}</small></button>
        {(sets || []).map((m) => (
          <button type="button" key={m.key} style={card(brief.compset_key === m.key)} aria-pressed={brief.compset_key === m.key} onClick={() => pickSet(m)}>
            <strong>{m.name}</strong><small className="muted" style={{ lineHeight: 1.25 }}>{m.description}</small>{m.count ? <small className="muted">{m.count} {tx("componenten")}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
