// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// The tab Design of a standard installation: choose the pages of this website that belong to the installation. They are kept with ALL their texts and pictures,
// and come back exactly like this when the installation is set.
export default function PresetDesign({ preset }) {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);   // Set of page keys
  const [base, setBase] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = (d) => { setData(d); const s = new Set(d.pages.filter((p) => p.saved).map((p) => p.key)); setSel(s); setBase([...s].sort().join(",")); };
  useEffect(() => { api(`/system/presets/${preset}/design/`).then(load).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [preset]);
  const rows = useMemo(() => (data?.pages || []).filter((p) => (p.title + " " + p.key).toLowerCase().includes(q.trim().toLowerCase())), [data, q]);
  if (!data || !sel) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Bezig…")}</p>;
  const flip = (k, on) => { const n = new Set(sel); if (on) n.add(k); else n.delete(k); setSel(n); };
  const dirty = [...sel].sort().join(",") !== base;
  const save = async () => {
    setBusy(true); setMsg(null);
    try { load(await api(`/system/presets/${preset}/design/`, { method: "POST", body: { pages: [...sel] } })); setMsg({ ok: true, text: tx("Opgeslagen. Deze pagina's komen met alle afbeeldingen precies zo terug als de installatie wordt ingesteld.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  return (<>
    <p className="muted" style={{ margin: 0 }}>{tx("Kies de pagina's van deze website die bij de installatie horen. Ze worden bewaard met al hun teksten en alle gekoppelde afbeeldingen en video's. Wordt de installatie ingesteld, dan zijn de pagina's precies zo. Een pagina met een eigen inhoud blijft staan tenzij je kiest om hem te vervangen.")}</p>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".5rem" }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek een pagina…")} aria-label={tx("Zoeken")} style={{ flex: 1 }} />
      <button type="button" className="btn sm" onClick={() => setSel(new Set(data.pages.map((p) => p.key)))}>{tx("Alles aan")}</button>
      <button type="button" className="btn sm" onClick={() => setSel(new Set())}>{tx("Alles uit")}</button>
    </div>
    <div className="pdz-list">
      {rows.map((p) => (
        <label key={p.key} className="check sec-toggle pdz-row">
          <span className="switch"><input type="checkbox" checked={sel.has(p.key)} onChange={(e) => flip(p.key, e.target.checked)} /><span /></span>
          <span className="pdz-name">{p.title}<small className="muted" style={{ display: "block" }}>{p.path || `/${p.key}`}</small></span>
          <span className="badge">{p.kind === "content" ? tx("Eigen pagina") : tx("Standaardpagina")}</span>
          {p.in_menu && <span className="badge ok">{tx("In het menu")}</span>}
        </label>
      ))}
      {!rows.length && <p className="muted">{tx("Geen pagina gevonden.")}</p>}
    </div>
    {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
    <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", gap: ".75rem" }}>
      <button type="button" className="btn primary" disabled={busy || !dirty} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan in de installatie")}</button>
      <small className="muted">{tx("{0} pagina's gekozen", sel.size)}{data.saved_at ? ` · ${tx("laatst opgeslagen")} ${new Date(data.saved_at).toLocaleString()}` : ""}</small>
    </div>
  </>);
}
