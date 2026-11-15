// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Tabs from "../../../../components/Tabs";
import { tx } from "../../../../lib/t";
import { STEPS } from "./designKit";

// A short step plan that helps to choose how to fill the website: a template, the AI-creator, an AI prompt for an external AI, or reading in a website, folder, ZIP or html files.
// onPick(action): {tab: "ai"|"url"|"folder"|"zip"|"html", auto?: "new"|"prompt"} or {href: "/dashboard/admin/templates"}
export const WAYS = {
  template: { title: "Een template", text: "Een complete website om mee te beginnen, met voorbeeldplaatjes. Je kiest er één en past hem daarna zelf aan. Snel klaar en zonder AI-tegoed.", button: "Templates bekijken", action: { href: "/dashboard/admin/templates" } },
  creator: { title: "De AI-creator (nieuw ontwerp)", text: "easy2edit ontwerpt de pagina's voor je in 7 stappen: naam en soort, stijl, kleuren, pagina's, modules, foto's en een voorbeeld. Kost AI-tegoed.", button: "Nieuw ontwerp maken", action: { tab: "ai", auto: "new" } },
  prompt: { title: "Een AI-prompt voor een externe AI", text: "Een wizard stelt vragen over je website en maakt een prompt voor Claude, ChatGPT of Gemini. De AI levert een ZIP die je hier importeert. De prompt maken kost niets.", button: "AI-prompt maken", action: { tab: "ai", auto: "prompt" } },
  url: { title: "Een website inlezen (adres)", text: "Je geeft het adres van een bestaande website. easy2edit leest de pagina's, de afbeeldingen en de opmaak in. Alleen openbare websites.", button: "Website-adres invullen", action: { tab: "url" } },
  folder: { title: "Een map op de server inlezen", text: "Een map met de bestanden van een website op de server. Handig voor een grote site of een eigen ontwerp.", button: "Map kiezen", action: { tab: "folder" } },
  zip: { title: "Een ZIP-bestand importeren", text: "Een ZIP met HTML, CSS en afbeeldingen, bijvoorbeeld van een ontwerper of van een externe AI. easy2edit bouwt er bewerkbare pagina's van.", button: "ZIP kiezen", action: { tab: "zip" } },
  html: { title: "HTML-bestanden importeren", text: "Eén of meer losse html-bestanden (met eventueel css en afbeeldingen). Elk bestand wordt een pagina.", button: "HTML kiezen", action: { tab: "html" } },
};

// the questions: every answer leads to the next question or to a way
const Q = {
  start: { q: "Waar begin je mee?", opts: [
    ["Ik heb al een website die ik wil overnemen", "existing"],
    ["Ik heb een ontwerp (HTML of ZIP) van een ontwerper of een andere tool", "design"],
    ["Ik heb nog niets en wil een goede start", "scratch"],
    ["Ik wil dat een externe AI (Claude, ChatGPT, Gemini) mijn website ontwerpt", "external"],
  ] },
  existing: { q: "Waar staat die website?", opts: [["Op internet, ik heb het adres", "=url"], ["In een map op de server", "=folder"], ["Als ZIP-bestand", "=zip"], ["Als losse HTML-bestanden", "=html"]] },
  design: { q: "In welke vorm heb je het ontwerp?", opts: [["Een ZIP met HTML, CSS en afbeeldingen", "=zip"], ["Alleen HTML-bestanden", "=html"], ["Het staat in een map op de server", "=folder"]] },
  scratch: { q: "Hoeveel wil je zelf bepalen?", opts: [["Zo snel mogelijk klaar, ik pas later zelf aan", "=template"], ["Ik kies stijl en pagina's, de AI doet het werk", "=creator"], ["Ik wil alles precies beschrijven (kleuren, teksten, pagina's)", "=prompt"]] },
  external: { q: "Heb je al een ontwerp of wil je een compleet nieuw ontwerp?", opts: [["Ik heb al een HTML-ontwerp dat omgezet moet worden", "=prompt"], ["Een compleet nieuw ontwerp op basis van mijn antwoorden", "=prompt"]] },
};

function ChooseWizard({ onPick }) {
  const [path, setPath] = useState([]);  // the answers so far: [label, next]
  const cur = path.length ? path[path.length - 1][1] : "start";
  const way = cur.startsWith("=") ? WAYS[cur.slice(1)] : null;
  const node = !way ? Q[cur] : null;
  const reset = () => setPath([]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
      {true && (
        <div className="stack-sm" style={{ gap: ".7rem" }}>
          <div role="list" style={{ display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" }}>
            {path.map(([label], i) => <button type="button" key={i} role="listitem" className="badge" style={{ cursor: "pointer", border: 0 }} title={tx("Terug naar deze vraag")} onClick={() => setPath(path.slice(0, i))}>{i + 1}. {tx(label)}</button>)}
            <span className="badge ok">{path.length + 1}. {way ? tx("Advies") : tx("Vraag")}</span>
          </div>
          {node && (
            <>
              <strong style={{ fontSize: "1.05rem" }}>{tx(node.q)}</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: ".5rem" }}>
                {node.opts.map(([label, next]) => <button type="button" key={label} className="card" style={{ textAlign: "left", padding: ".7rem .9rem", cursor: "pointer", font: "inherit", color: "var(--text)" }} onClick={() => setPath([...path, [label, next]])}>{tx(label)}</button>)}
              </div>
              {path.length > 0 && <div><button type="button" className="btn sm" onClick={() => setPath(path.slice(0, -1))}>{tx("Vorige vraag")}</button></div>}
            </>
          )}
          {way && (
            <div className="stack-sm" style={{ gap: ".6rem" }}>
              <div className="alert ok" style={{ margin: 0 }}>
                <strong>{tx("Mijn advies")}: {tx(way.title)}</strong>
                <p style={{ margin: ".3rem 0 0" }}>{tx(way.text)}</p>
              </div>
              <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap" }}>
                <button type="button" className="btn primary" onClick={() => { onPick(way.action); reset(); }}>{tx(way.button)}</button>
                <button type="button" className="btn" onClick={() => setPath(path.slice(0, -1))}>{tx("Vorige vraag")}</button>
                <button type="button" className="btn" onClick={reset}>{tx("Opnieuw beginnen")}</button>
              </div>
              <details>
                <summary className="muted" style={{ cursor: "pointer" }}>{tx("Alle mogelijkheden op een rij")}</summary>
                <div style={{ display: "grid", gap: ".5rem", marginTop: ".5rem" }}>
                  {Object.values(WAYS).map((w) => <div key={w.title} className="row" style={{ justifyContent: "space-between", gap: ".6rem", alignItems: "flex-start", flexWrap: "nowrap" }}><span style={{ minWidth: 0 }}><strong>{tx(w.title)}</strong><small className="muted" style={{ display: "block" }}>{tx(w.text)}</small></span><button type="button" className="btn sm" onClick={() => { onPick(w.action); reset(); }}>{tx(w.button)}</button></div>)}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// the step plan of a new design (the AI-creator): the 7 steps
function DesignSteps() {
  return (
    <div className="stack-sm" style={{ gap: ".7rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("Een nieuw ontwerp maak je in 7 stappen. Alles wat je invult wordt bewaard, ook als je halverwege stopt.")}</p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: ".5rem" }}>
        {STEPS.map(([key, title, hint], i) => (
          <li key={key} style={{ display: "flex", gap: ".7rem", alignItems: "center", padding: ".55rem .8rem", border: "1px solid var(--line)", borderRadius: 10, background: "var(--card)" }}>
            <b style={{ display: "grid", placeItems: "center", flex: "none", width: "1.7rem", height: "1.7rem", borderRadius: "50%", background: "var(--blue)", color: "#fff", fontSize: ".8rem" }}>{i + 1}</b>
            <span><strong>{tx(title)}</strong><small className="muted" style={{ display: "block" }}>{tx(hint)}</small></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// The popup behind the button "Stappenplan" (before "Nieuw ontwerp"): help to choose how to fill the website, and the steps of a new design.
export default function StartPlanPopup({ onClose, onPick }) {
  const [tab, setTab] = useState("choose");
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pb-objpop" role="dialog" aria-label={tx("Stappenplan")} style={{ width: "min(820px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Stappenplan: hoe vul ik mijn website?")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.2rem 1.2rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: ".8rem" }}>
          <Tabs value={tab} onChange={setTab} tabs={[["choose", "Hulp bij kiezen"], ["design", "Stappen van een nieuw ontwerp"]]} />
          {tab === "choose" && <ChooseWizard onPick={onPick} />}
          {tab === "design" && <DesignSteps />}
        </div>
      </div>
    </div>, document.body);
}
