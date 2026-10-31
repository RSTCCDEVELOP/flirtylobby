// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "../lib/api";
import { tx } from "../lib/t";
import Tabs from "./Tabs";

// One-colour icons for the toolbar (they follow the colour of the text)
const I = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const TOOLS = [
  ["bold", "Vet", I(<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" />)],
  ["italic", "Cursief", I(<path d="M19 4h-9M14 20H5M15 4L9 20" />)],
  ["underline", "Onderstreept", I(<path d="M6 4v7a6 6 0 0012 0V4M4 21h16" />)],
  ["insertUnorderedList", "Lijst", I(<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />)],
  ["link", "Link", I(<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />)],
  ["removeFormat", "Opmaak wissen", I(<path d="M5 5h14M12 5l-3 14M4 20l16-16" />)],
];

// The editor of a piece of own html and css (the block "HTML / CSS-code"): Visueel = what you see, and what you can change by clicking in it and typing
// (what you see is what you get); HTML and CSS = the code itself. The code runs in a frame without any rights.
export default function CodeEditor({ data = {}, onChange, onClose }) {
  const [tab, setTab] = useState(data.html || data.css ? "visual" : "html");
  const [bg, setBg] = useState("light");
  const [gen, setGen] = useState(0); // the frame is made again when you come back to it: not while you type in it (the cursor would jump)
  const ref = useRef(null);
  const id = `e${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const media = mediaUrl("/media/");
  const set = (patch) => onChange({ ...data, ...patch });
  const doc = useMemo(() => {
    const body = String(data.html || "").replace(/<script[\s\S]*?(<\/script>|$)/gi, "").replaceAll("__MEDIA__/", media);
    const css = String(data.css || "").replaceAll("__MEDIA__/", media);
    return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}body{padding:24px;min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;line-height:1.5;background:${bg === "dark" ? "#0e0638" : "#ffffff"};color:${bg === "dark" ? "#fff" : "#0e0638"}}#root{outline:none;min-height:80px}#root *{outline:none}#root:empty:before{content:"${tx("Typ hier, of schrijf de code bij HTML")}";opacity:.5}${css}</style><div id="root" contenteditable="true" spellcheck="false">${body}</div><script>(function(){var id=${JSON.stringify(id)},r=document.getElementById("root");function send(){parent.postMessage({code:id,html:r.innerHTML},"*")}
r.addEventListener("input",send);r.addEventListener("blur",send);r.addEventListener("click",function(e){if(e.target.closest("a"))e.preventDefault()});
window.addEventListener("message",function(e){var m=e.data||{};if(m.code!==id)return;r.focus();if(m.cmd==="link"){var u=m.url;if(u)document.execCommand("createLink",false,u)}else document.execCommand(m.cmd,false,null);send()});})();<\/script>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, bg]);
  useEffect(() => {
    const on = (e) => {
      if (e.source !== ref.current?.contentWindow || e.data?.code !== id) return;
      set({ html: String(e.data.html || "").replaceAll(media, "__MEDIA__/") });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  });
  const run = (cmd) => {
    let url = "";
    if (cmd === "link") { url = window.prompt(tx("Naar welk adres moet de link gaan?"), "https://") || ""; if (!url) return; }
    ref.current?.contentWindow?.postMessage({ code: id, cmd, url }, "*");
  };
  const change = (k) => { setTab(k); setGen((n) => n + 1); };
  const body = (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal form code-editor" role="dialog" aria-label={tx("HTML / CSS-code")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>{tx("HTML / CSS-code")}</h2>
          <button type="button" className="btn primary" onClick={onClose}>{tx("Klaar")}</button>
        </div>
        <Tabs value={tab} onChange={change} tabs={[["visual", "Visueel"], ["html", "HTML"], ["css", "CSS"]]} />
        {tab === "visual" && (<>
          <div className="code-tools">
            {TOOLS.map(([cmd, label, icon]) => <button key={cmd} type="button" className="btn sm" title={tx(label)} aria-label={tx(label)} onMouseDown={(e) => e.preventDefault()} onClick={() => run(cmd)}>{icon}</button>)}
            <span style={{ flex: 1 }} />
            <label className="muted" style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>{tx("Achtergrond")}
              <select value={bg} onChange={(e) => setBg(e.target.value)}><option value="light">{tx("Licht")}</option><option value="dark">{tx("Donker")}</option></select>
            </label>
          </div>
          <iframe ref={ref} key={gen} title={tx("Visueel")} srcDoc={doc} sandbox="allow-scripts" className="code-frame" />
          <small className="muted">{tx("Klik in de tekst en typ om te wijzigen. De code draait in een afgeschermd kader: geen toegang tot de inlog of de rest van de website.")}</small>
        </>)}
        {tab === "html" && <textarea className="code-area" spellCheck={false} maxLength={60000} value={data.html || ""} onChange={(e) => set({ html: e.target.value })} aria-label="HTML" />}
        {tab === "css" && <textarea className="code-area" spellCheck={false} maxLength={30000} value={data.css || ""} onChange={(e) => set({ css: e.target.value })} aria-label="CSS" />}
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
