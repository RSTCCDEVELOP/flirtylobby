// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { downloadFile } from "../lib/api";
import { tx } from "../lib/t";

// The button PDF: a summary, or with "Gedetailleerd" a complete list of every call with tokens in and out and the costs.
export default function PdfButton({ query, name, onError, compact = false, who = "", base = "/admin/ai/report/" }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await downloadFile(`${base}?${query}${detail ? "&detail=1" : ""}`, `${name}${detail ? "-gedetailleerd" : ""}.pdf`); setOpen(false); }
    catch (e) { onError(e); }
    setBusy(false);
  };
  const body = (<>
    {who && <strong>{who}</strong>}
    <label className="check"><span className="switch"><input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /><span /></span><span>{tx("Gedetailleerd")}</span></label>
    <small className="muted">{detail ? tx("Een complete lijst van alle aanroepen: tokens in en uit, duur en kosten.") : tx("Een overzicht met totalen per onderdeel en model.")}</small>
    <button type="button" className="btn primary" disabled={busy} onClick={go}>{busy ? tx("PDF maken…") : tx("Download PDF")}</button>
  </>);
  return (
    <div className="ai-pdf">
      <button type="button" className={compact ? "btn sm" : "btn"} onClick={() => setOpen(!open)} aria-expanded={open} title={who ? `${tx("PDF")}: ${who}` : undefined}>{tx("PDF")}</button>
      {open && !compact && <div className="card ai-pdf-pop">{body}</div>}
      {open && compact && typeof document !== "undefined" && createPortal(
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="card modal form" role="dialog" aria-label={tx("PDF")} style={{ maxWidth: 380 }} onMouseDown={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>{tx("Rapport als PDF")}</h2>
            {body}
            <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setOpen(false)}>{tx("Annuleren")}</button></div>
          </div>
        </div>, document.body)}
    </div>
  );
}
