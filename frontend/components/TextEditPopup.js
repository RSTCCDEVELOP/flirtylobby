// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";

const I = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const TOOLS = [
  ["bold", "Vet", I(<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" />)],
  ["italic", "Cursief", I(<path d="M19 4h-9M14 20H5M15 4L9 20" />)],
  ["underline", "Onderstreept", I(<path d="M6 4v7a6 6 0 0012 0V4M4 21h16" />)],
  ["link", "Link", I(<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />)],
  ["removeFormat", "Opmaak wissen", I(<path d="M5 5h14M12 5l-3 14M4 20l16-16" />)],
];

// The screen to change a text of a page that was taken over 1 to 1 from an html file (edit mode): an editor that shows the text as it is on the page
// (colour, size, font and background of the original) and that you change by typing in it. sel = what was clicked; onChange(sel) after a change.
export default function TextEditPopup({ sel, css, onChange, onSave, onClose, busy, err }) {
  const ref = useRef(null);
  const id = `t${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rich = sel.kind === "el";
  const last = useRef(sel);
  last.current = sel;
  const doc = useMemo(() => {
    const l = sel.look || {};
    const root = `#root{outline:none;min-height:1.5em;margin:0;white-space:pre-wrap;color:${l.color || "#0e0638"};font-family:${l.font || "system-ui,sans-serif"};font-size:${l.size || "18px"};font-weight:${l.weight || 400};line-height:${l.lh || "1.5"};text-align:${l.align || "left"};letter-spacing:${l.ls || "normal"};text-transform:${l.tt || "none"}}`;
    const init = rich ? sel.html : String(sel.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `<!doctype html><meta charset="utf-8"><style>${css || ""}</style><style>html,body{margin:0;min-height:100%;background:${l.bg || "#fff"}}body{padding:40px;box-sizing:border-box}${root}#root a{color:inherit}</style><div id="root" contenteditable="true" spellcheck="false">${init}</div><script>(function(){var id=${JSON.stringify(id)},r=document.getElementById("root");function send(){parent.postMessage({tedit:id,html:r.innerHTML,text:r.innerText.replace(/\\n+$/,"")},"*")}
r.addEventListener("input",send);r.addEventListener("click",function(e){if(e.target.closest("a"))e.preventDefault()});r.focus();var s=window.getSelection(),g=document.createRange();g.selectNodeContents(r);s.removeAllRanges();s.addRange(g);
window.addEventListener("message",function(e){var m=e.data||{};if(m.tedit!==id)return;r.focus();if(m.cmd==="link"){if(m.url)document.execCommand("createLink",false,m.url)}else document.execCommand(m.cmd,false,null);send()});})();<\/script>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const on = (e) => {
      if (e.source !== ref.current?.contentWindow || e.data?.tedit !== id) return;
      onChange({ ...last.current, ...(rich ? { html: String(e.data.html || "") } : { text: String(e.data.text || "") }) });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  });
  const run = (cmd) => {
    let url = "";
    if (cmd === "link") { url = window.prompt(tx("Naar welk adres moet de link gaan?"), "https://") || ""; if (!url) return; }
    ref.current?.contentWindow?.postMessage({ tedit: id, cmd, url }, "*");
  };
  const body = (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal form text-editor" role="dialog" aria-label={tx("Tekst aanpassen")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>{tx("Tekst aanpassen")}</h2>
          <div className="row" style={{ gap: ".5rem" }}>
            <button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button>
            <button type="button" className="btn primary" disabled={busy} onClick={onSave}>{tx("Opslaan")}</button>
          </div>
        </div>
        {rich && <div className="code-tools">{TOOLS.map(([cmd, label, icon]) => <button key={cmd} type="button" className="btn sm" title={tx(label)} aria-label={tx(label)} onMouseDown={(e) => e.preventDefault()} onClick={() => run(cmd)}>{icon}</button>)}</div>}
        <iframe ref={ref} title={tx("Tekst aanpassen")} srcDoc={doc} sandbox="allow-scripts" className="code-frame" />
        {sel.link >= 0 && <label>{tx("Link van de knop of tekst")}<input value={sel.href} onChange={(e) => onChange({ ...sel, href: e.target.value })} /></label>}
        {err && <div className="alert">{err}</div>}
        <small className="muted">{tx("Zo ziet de tekst er op de pagina uit. Klik erin en typ om te wijzigen.")}</small>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
