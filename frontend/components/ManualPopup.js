// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { createPortal } from "react-dom";
import { apiBase } from "../lib/api";
import { tx } from "../lib/t";

// The HTML manual in a large pop-up (a frame), at a chapter. Also used by the manual buttons and the help icon.
export default function ManualPopup({ page = "", onClose }) {
  const url = `${apiBase()}/api/manual/html/${page}`;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal manual-pop" role="dialog" aria-label={tx("Handleiding")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{tx("Handleiding")}</h2>
          <div className="row" style={{ gap: ".5rem" }}>
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer">{tx("Nieuw tabblad")}</a>
            <button type="button" className="btn primary" onClick={onClose}>{tx("Sluiten")}</button>
          </div>
        </div>
        <iframe src={url} title={tx("Handleiding")} className="manual-frame" />
      </div>
    </div>, document.body);
}
