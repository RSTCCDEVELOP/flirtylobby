// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

// A status pop-up with a progress bar and the steps of a job (setting an installation, making demo data).
// run: {title, steps: [{key, label, status}], error, done}. The pop-up cannot be closed while the job runs.
export default function RunPopup({ run, onClose, onFix }) {
  if (!run) return null;
  const total = run.steps.length || 1, ok = run.steps.filter((s) => s.status === "ok").length;
  const busy = !run.done && !run.error;
  const pct = run.done ? 100 : Math.round((100 * (ok + (run.steps.some((s) => s.status === "busy") ? 0.5 : 0))) / total);
  const icon = { wait: "○", busy: "◔", ok: "✓", error: "✕" };
  return (
    <div className="overlay">
      <div className="card modal" role="dialog" aria-live="polite" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>{run.title}</h2>
        <div className="run-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} className={run.error ? "err" : ""} /></div>
        <p className="muted" style={{ margin: ".3rem 0 .6rem" }}>{run.error ? tx("Er ging iets mis.") : run.done ? tx("Klaar.") : `${pct}%`}</p>
        <ul className="run-steps">
          {run.steps.map((s) => <li key={s.key} className={`run-${s.status}`}><span className="run-ico" aria-hidden="true">{icon[s.status]}</span><span>{s.label}</span></li>)}
        </ul>
        {run.error && <div className="alert">{run.error}</div>}
        {run.note && !run.error && <div className="alert ok">{run.note}</div>}
        <div className="row" style={{ marginTop: "1rem" }}>
          {run.fix && onFix && <button type="button" className="btn primary" disabled={run.fixing} onClick={onFix}>{run.fixing ? tx("Bezig…") : tx("Aanzetten en verder gaan")}</button>}
          <button type="button" className={`btn ${run.fix && onFix ? "" : "primary"}`} disabled={busy || run.fixing} onClick={onClose}>{busy ? tx("Bezig…") : tx("Sluiten")}</button>
        </div>
      </div>
    </div>
  );
}
