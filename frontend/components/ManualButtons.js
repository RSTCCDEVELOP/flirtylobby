// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { apiBase } from "../lib/api";
import { manualLang } from "../lib/manualMap";
import { tx } from "../lib/t";
import ManualPopup from "./ManualPopup";

const LANGS = [["en", "English"], ["nl", "Nederlands"]];

// Two big buttons for the manual: the manual (always in a pop-up, with its own language switch) and the PDF to download (you choose English or Dutch).
// The manual of the language of the website comes first; the pop-up has a switch to change language.
export default function ManualButtons() {
  const [menu, setMenu] = useState("");   // "" | "html" | "pdf"
  const [pop, setPop] = useState(false);
  const base = apiBase(), mine = manualLang();
  const order = [...LANGS].sort(([a], [b]) => (a === mine ? -1 : b === mine ? 1 : 0));
  return (
    <div className="manual-buttons">
      <div className="manual-btn-wrap">
        <button type="button" className="manual-btn" onClick={() => { setMenu(""); setPop(true); }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2zM4 19a2 2 0 002 2h12M9 7h5M9 11h5" /></svg>
          <strong>{tx("Handleiding")}</strong>
          <small>{tx("Lees de handleiding online")}</small>
        </button>
      </div>
      <div className="manual-btn-wrap">
        <button type="button" className="manual-btn" onClick={() => setMenu(menu === "pdf" ? "" : "pdf")} aria-expanded={menu === "pdf"}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></svg>
          <strong>{tx("Download PDF")}</strong>
          <small>{tx("Kies de taal van de handleiding")}</small>
        </button>
        {menu === "pdf" && (
          <div className="card manual-menu" role="menu">
            {order.map(([k, l]) => <a key={k} className="btn" role="menuitem" href={`${base}/api/manual/pdf/${k}/`} download onClick={() => setMenu("")}>{tx("Download")} PDF: {l}</a>)}
          </div>
        )}
      </div>
      {pop && <ManualPopup onClose={() => setPop(false)} />}
    </div>
  );
}
