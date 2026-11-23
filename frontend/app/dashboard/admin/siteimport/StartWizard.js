// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../../../../lib/t";
import { manualPage } from "../../../../lib/manualMap";
import ManualPopup from "../../../../components/ManualPopup";
import { IconHelp } from "../../../../components/Icons";
import TemplateGallery from "./TemplateGallery";

// A short step plan that helps to choose how to fill the website: a ready-to-use template, the AI-creator, or reading in a website, folder, ZIP or html files.
// The wizard: questions that give the AI chat build a good start. At the end the chat starts with the choices. Someone who already has a website, a design or a ZIP is sent to the right place.
// onStart(brief, firstMessage): the chat build opens with these settings; onPick(action): {tab: "url"|"folder"|"zip"|"html", auto?: "prompt"} for an existing website or design.
const WAYS = {
  templates: { title: "Kant-en-klare templates", text: "Kies een complete website met voorbeeldplaatjes (pagina's, menu en soms een eigen thema) en pas hem daarna zelf aan in de editor.", button: "Templates bekijken", action: { href: "/dashboard/admin/templates" } },
  url: { title: "Een website inlezen (adres)", text: "Je geeft het adres van een bestaande website. easy2edit leest de pagina's, de afbeeldingen en de opmaak in. Alleen openbare websites.", button: "Website-adres invullen", action: { tab: "url" } },
  folder: { title: "Een map op de server inlezen", text: "Een map met de bestanden van een website op de server. Handig voor een grote site of een eigen ontwerp.", button: "Map kiezen", action: { tab: "folder" } },
  zip: { title: "Een ZIP-bestand importeren", text: "Een ZIP met HTML, CSS en afbeeldingen, bijvoorbeeld van een ontwerper of van een externe AI. easy2edit bouwt er bewerkbare pagina's van.", button: "ZIP kiezen", action: { tab: "zip" } },
  html: { title: "HTML-bestanden importeren", text: "Eén of meer losse html-bestanden (met eventueel css en afbeeldingen). Elk bestand wordt een pagina.", button: "HTML kiezen", action: { tab: "html" } },
};

const Q = {
  start: { q: "Waar begin je mee?", opts: [["Ik wil een nieuwe website maken met de AI", "=new"], ["Ik heb al een website of een ontwerp dat ik wil overnemen", "existing"], ["Ik wil een kant-en-klare template gebruiken", "=templates"]] },
  existing: { q: "Waar staat die website of dat ontwerp?", opts: [["Op internet, ik heb het adres", "=url"], ["In een map op de server", "=folder"], ["Als ZIP-bestand", "=zip"], ["Als losse HTML-bestanden", "=html"]] },
};

// A new website with the AI: the chat opens at once and the AI asks the questions there (a questionnaire with ready-made answers).
const NEW_TEXT = "Ik wil een nieuwe website maken met de AI. Stel me de vragen die je nodig hebt voor een goede start.";

function ChooseWizard({ onPick, onStart, onInstalled, onCompact }) {
  const [path, setPath] = useState([]);  // the answers so far: [label, next]
  const cur = path.length ? path[path.length - 1][1] : "start";
  const way = cur.startsWith("=") ? WAYS[cur.slice(1)] : null;
  const node = !way ? Q[cur] : null;
  const reset = () => setPath([]);
  const [compact, setCompactState] = useState(false);  // a template is open in the detail view: the advice makes room for the template
  const setCompact = (v) => { setCompactState(v); onCompact?.(v); };
  useEffect(() => { setCompact(cur === "=templates"); }, [cur]);  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
      {!compact && <div role="list" style={{ display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" }}>
        {path.map(([label], i) => <button type="button" key={i} role="listitem" className="badge" style={{ cursor: "pointer", border: 0 }} title={tx("Terug naar deze vraag")} onClick={() => setPath(path.slice(0, i))}>{i + 1}. {tx(label)}</button>)}
        <span className="badge ok">{path.length + 1}. {way ? tx("Advies") : tx("Vraag")}</span>
      </div>}
            {node && (
        <>
          <strong style={{ fontSize: "1.05rem" }}>{tx(node.q)}</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: ".5rem" }}>
            {node.opts.map(([label, next]) => <button type="button" key={label} className="card" style={{ textAlign: "left", padding: ".7rem .9rem", cursor: "pointer", font: "inherit", color: "var(--text)" }} onClick={() => (next === "=new" ? onStart({}, tx(NEW_TEXT)) : setPath([...path, [label, next]]))}>{tx(label)}</button>)}
          </div>
          {path.length > 0 && <div><button type="button" className="btn sm" onClick={() => setPath(path.slice(0, -1))}>{tx("Vorige vraag")}</button></div>}
        </>
      )}
      {way && cur === "=templates" && (
        <div className="stack-sm" style={{ gap: ".8rem" }}>

          <TemplateGallery onInstalled={onInstalled} onDetail={() => {}} subtitle={way.text} />
          <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap", paddingTop: ".4rem", borderTop: "1px solid var(--line, rgba(0,0,0,.1))" }}>
            <button type="button" className="btn" onClick={() => setPath(path.slice(0, -1))}>{tx("Vorige vraag")}</button>
            <button type="button" className="btn" onClick={reset}>{tx("Opnieuw beginnen")}</button>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn" onClick={() => { onPick(way.action); reset(); }}>{tx("Alle templates beheren")}</button>
          </div>
        </div>
      )}
      {way && cur !== "=templates" && (
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
        </div>
      )}
    </div>
  );
}

// The popup behind the button "Wizard": the questions for a good start of the AI chat build.
export default function StartPlanPopup({ onClose, onPick, onStart, onInstalled }) {
  const [help, setHelp] = useState(false);
  const [compact, setCompact] = useState(false);
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pb-objpop" role="dialog" aria-label={tx("Wizard")} style={{ width: "min(1040px, 94vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("Wizard: een goede start voor je website")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.2rem 1.2rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: ".8rem" }}>
          {!compact && <div className="alert ok" role="group" aria-label={tx("Help")} style={{ margin: 0, display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ flex: "1 1 220px" }}>{tx("Wil je de help zien? De handleiding met uitleg en video's.")}</strong>
            <button type="button" className="btn primary" onClick={() => setHelp(true)}><IconHelp /> {tx("Help openen")}</button>
          </div>}
          <ChooseWizard onPick={onPick} onStart={onStart} onInstalled={onInstalled} onCompact={setCompact} />
        </div>
      </div>
      {help && <ManualPopup page={manualPage("/dashboard/admin/siteimport")} zIndex={1400} onClose={() => setHelp(false)} />}
    </div>, document.body);
}
