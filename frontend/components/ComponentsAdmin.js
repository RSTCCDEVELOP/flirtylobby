// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ComponentLibrary } from "./ComponentPicker";
import Tabs from "./Tabs";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import { componentListText } from "../lib/ui-kit/componentList";
import { resetKit, useKit } from "../lib/ui-kit/kitDoc";

import Loading from "./Loading";
const MODES = [["list", "Alleen de lijst (tags)", "Elke easy2edit_tag met wat het is. Klein, voor in een prompt."], ["html", "Lijst met HTML", "Ook de HTML van elk component, zodat een AI ze precies kan overnemen."], ["css", "Lijst, HTML en CSS", "Ook de CSS van de kit, zodat een AI de componenten in zijn voorbeeld kan tonen."]];


// The component sets of this website: the one in use, the ones that are installed and the library (like the theme packages). The first set is installed with every installation.
function Sets({ onUse }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const file = useRef(null);
  const load = useCallback(() => api("/components/sets/").then(setD).catch((e) => setErr(errorText(e))), []);
  useEffect(() => { load(); }, [load]);
  const act = async (action, key) => {
    if (action === "remove" && !(await confirmDialog(tx("Deze componentenset van de website verwijderen?"), { danger: true, okLabel: tx("Verwijderen") }))) return;
    setBusy(key); setErr("");
    try { setD(await api("/components/sets/", { method: "POST", body: { action, key } })); resetKit(); onUse?.(); } catch (e) { setErr(errorText(e)); } finally { setBusy(""); }
  };
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy("upload"); setErr("");
    try { const fd = new FormData(); fd.append("file", f); setD(await api("/components/sets/", { method: "POST", body: fd })); resetKit(); } catch (x) { setErr(errorText(x)); } finally { setBusy(""); }
  };
  if (!d) return err ? <div className="alert">{err}</div> : <p className="muted"><Loading /></p>;
  const card = (m, right) => (
    <div key={m.key} className="card" style={{ display: "flex", gap: ".8rem", alignItems: "center", padding: ".7rem .9rem", flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 200 }}>
        <strong>{m.name}</strong> <small className="muted">v{m.version}</small> {m.active && <span className="badge ok">{tx("In gebruik")}</span>} {m.default && <span className="badge">{tx("Standaard")}</span>}
        <small className="muted" style={{ display: "block" }}>{m.description} · {m.count} {tx("componenten")}</small>
      </span>
      {right}
    </div>
  );
  return (
    <div className="stack">
      {err && <div className="alert">{err}</div>}
      <p className="muted" style={{ margin: 0 }}>{tx("Een componentenset is een zip met componenten (hero, prijzen, agenda ...), zoals een themapakket. De eerste set, de easy2edit UI-kit, staat standaard op elke website totdat je een andere kiest. Ontwerpen en prompts gebruiken de set die je kiest.")}</p>
      <strong>{tx("Op deze website")}</strong>
      {d.installed.map((m) => card(m, (
        <span className="row" style={{ gap: ".4rem" }}>
          {!m.active && <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => act("activate", m.key)}>{tx("Gebruiken")}</button>}
          {!m.default && !m.active && <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => act("remove", m.key)}>{tx("Verwijderen")}</button>}
        </span>
      )))}
      <strong>{tx("Bibliotheek")}</strong>
      {d.library.filter((m) => !m.installed || m.update).map((m) => card({ ...m, active: false, default: false }, <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => act("install", m.key)}>{m.update ? tx("Bijwerken") : tx("Installeren")}</button>))}
      {!d.library.some((m) => !m.installed || m.update) && <small className="muted">{tx("Alle sets uit de bibliotheek staan al op deze website.")}</small>}
      <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", alignItems: "center" }}>
        <input ref={file} type="file" accept=".zip" onChange={upload} style={{ display: "none" }} />
        <button type="button" className="btn" disabled={busy === "upload"} onClick={() => file.current?.click()}>{tx("Een set uploaden (zip)")}</button>
        <small className="muted">{tx("Een zip met components.json, components.css en eventueel components.js. De bibliotheek staat in resource/components.")}</small>
      </div>
    </div>
  );
}

// Admin > Website > Componenten: the ready-made components of the UI-kit (hero, pricing, calendar, kanban ...). They are drawn in the colours of the theme in use, can be
// added in the page editor (+ Toevoegen > Component uit de UI-kit) and have an easy2edit_tag that exports, imports, designs and AI prompts use.
export default function ComponentsAdmin({ embedded = false }) {
  const [tab, setTab] = useState("lib");
  const [libKey, setLibKey] = useState(0);  // changes when another set is put in use: the components are read again
  const [mode, setMode] = useState("list");
  const [msg, setMsg] = useState("");
  const { kit } = useKit(true);
  const text = kit ? componentListText(kit, mode) : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { document.getElementById("cl-text")?.select(); document.execCommand("copy"); }
    setMsg(tx("Gekopieerd")); setTimeout(() => setMsg(""), 1800);
  };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); a.download = "easy2edit-componenten.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  return (
    <div className="stack">
      {!embedded && (
        <div className="page-head"><div><h1>{tx("Componenten")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("Kant-en-klare onderdelen in de kleuren van je thema. Voeg ze toe in de bewerkmodus (+ Toevoegen, Component uit de UI-kit). Elk component heeft een easy2edit_tag: daarmee herkennen exports, imports, ontwerpen en AI-prompts het.")}</p></div></div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[["lib", "Componenten"], ["sets", "Sets"], ["list", "Lijst voor een AI-prompt"]]} />
      {tab === "lib" && <div className="card"><ComponentLibrary key={libKey} /></div>}
      {tab === "sets" && <Sets onUse={() => setLibKey((n) => n + 1)} />}
      {tab === "list" && (
        <div className="card form">
          <p className="muted" style={{ margin: 0 }}>{tx("De lijst van alle componenten met hun easy2edit_tag. Plak hem bij je prompt of bij je HTML, dan gebruikt de AI de juiste componenten en herkent de import ze.")}</p>
          <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap" }}>
            {MODES.map(([k, l]) => <button type="button" key={k} className={`btn ${mode === k ? "primary" : ""}`} onClick={() => setMode(k)}>{tx(l)}</button>)}
          </div>
          <small className="muted">{tx(MODES.find(([k]) => k === mode)[2])}</small>
          <textarea id="cl-text" readOnly rows={16} value={text} onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: ".82rem" }} />
          <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", gap: ".5rem" }}>
            <button type="button" className="btn primary" onClick={copy} disabled={!kit}>{tx("Lijst kopiëren")}</button>
            <button type="button" className="btn" onClick={download} disabled={!kit}>{tx("Downloaden als tekstbestand")}</button>
            <small className="muted">{text.length.toLocaleString()} {tx("tekens")}</small>{msg && <small className="muted">{msg}</small>}
          </div>
        </div>
      )}
    </div>
  );
}
