// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";

// Pagina-instellingen → Import (only for a page that came from Site importeren): an instruction for Claude, and a button that builds this one page again
// from the original html file, with that instruction. info = what the server told about the import of this page.
export default function PageImportTab({ pageKey, path, info, onInfo }) {
  const [prompt, setPrompt] = useState(info.prompt || "");
  const [render, setRender] = useState(info.render === "design" ? "design" : "blocks");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const running = info.state === "running" && !info.stale;
  const timer = useRef(null);
  const poll = () => api(`/siteimport/page/${pageKey}/`).then((i) => { onInfo(i); if (i.state === "running" && !i.stale) timer.current = setTimeout(poll, 3000); }).catch(() => {});
  useEffect(() => { if (running) timer.current = setTimeout(poll, 3000); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => {
    setBusy(true); setErr("");
    try { const i = await api(`/siteimport/page/${pageKey}/`, { method: "POST", body: { prompt, render } }); onInfo(i); clearTimeout(timer.current); timer.current = setTimeout(poll, 3000); }
    catch (e) { setErr(e?.message || tx("Aanpassen is niet gelukt.")); }
    setBusy(false);
  };
  const pct = Math.max(2, Math.min(100, info.percent || 0));
  return (
    <div className="form" style={{ gap: ".8rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("Deze pagina komt uit")} <strong>{info.file}</strong> ({info.name}). {tx("Claude bouwt de pagina opnieuw op uit het originele bestand, met jouw opdracht. De huidige inhoud van deze pagina wordt vervangen.")}</p>
      <label>{tx("Weergave")}
        <select value={render} onChange={(e) => setRender(e.target.value)} disabled={running}>
          <option value="blocks">{tx("Bewerkbaar: opbouwen met blokken")}</option>
          <option value="design">{tx("Exact: 1 op 1 zoals het bestand")}</option>
        </select>
      </label>
      <label>{tx("Opdracht voor Claude (om de pagina te verbeteren)")}
        <textarea rows={6} value={prompt} maxLength={1500} disabled={running || render === "design"} onChange={(e) => setPrompt(e.target.value)} placeholder={tx("Bijvoorbeeld: de hero is te hoog, zet de knoppen naast elkaar, maak de koppen groter.")} />
      </label>
      {render === "design" && <small className="muted">{tx("Bij Exact wordt het bestand 1 op 1 overgenomen: een opdracht is daar niet nodig.")}</small>}
      {(running || info.state === "done" || info.state === "error" || info.error) && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>{info.error ? tx("Mislukt") : info.step}</span><strong>{Math.round(info.percent || 0)} %</strong></div>
          <div style={{ height: 8, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: info.error ? "var(--danger)" : "var(--blue)", transition: "width .4s" }} /></div>
        </div>
      )}
      {(err || info.error) && <div className="alert">{err || info.error}</div>}
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="btn primary" disabled={busy || running} onClick={run}>{running ? tx("Bezig…") : tx("Pas de import aan")}</button>
        {info.state === "done" && !running && <a className="btn" href={path}>{tx("Ga naar pagina")}</a>}
      </div>
    </div>
  );
}
