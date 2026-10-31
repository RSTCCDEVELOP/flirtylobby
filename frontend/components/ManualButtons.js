// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { apiBase } from "../lib/api";
import { tx } from "../lib/t";
import ManualPopup from "./ManualPopup";

// Two big buttons for the manual (English): the HTML manual (in a pop-up or in another tab: you choose) and the PDF to download.
export default function ManualButtons() {
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState(false);
  const base = apiBase();
  const htmlUrl = `${base}/api/manual/html/`, pdfUrl = `${base}/api/manual/pdf/`;
  return (
    <div className="manual-buttons">
      <div className="manual-btn-wrap">
        <button type="button" className="manual-btn" onClick={() => setMenu(!menu)} aria-expanded={menu}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2zM4 19a2 2 0 002 2h12M9 7h5M9 11h5" /></svg>
          <strong>{tx("HTML-handleiding")}</strong>
          <small>{tx("Lees de handleiding online (Engels)")}</small>
        </button>
        {menu && (
          <div className="card manual-menu" role="menu">
            <button type="button" className="btn" role="menuitem" onClick={() => { setMenu(false); setPop(true); }}>{tx("Openen in een popup")}</button>
            <a className="btn" role="menuitem" href={htmlUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)}>{tx("Openen in een nieuw tabblad")}</a>
          </div>
        )}
      </div>
      <a className="manual-btn" href={pdfUrl} download>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></svg>
        <strong>{tx("Download PDF")}</strong>
        <small>{tx("De handleiding als PDF (Engels)")}</small>
      </a>
      {pop && <ManualPopup onClose={() => setPop(false)} />}
    </div>
  );
}
