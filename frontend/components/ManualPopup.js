// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { apiBase } from "../lib/api";
import { manualLang } from "../lib/manualMap";
import { tx } from "../lib/t";

// The HTML manual in a large pop-up (a frame), at a chapter, in the language of the website; the switch EN | NL changes it (the same chapter in the other language).
export default function ManualPopup({ page = "", lang: start, onClose }) {
  const [lang, setLang] = useState(start || manualLang());
  const url = `${apiBase()}/api/manual/html/${lang}/${page}`;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal manual-pop" role="dialog" aria-label={tx("Handleiding")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{lang === "nl" ? "Handleiding" : "Manual"}</h2>
          <div className="row" style={{ gap: ".5rem", alignItems: "center" }}>
            <span className="manual-lang" role="group" aria-label={tx("Taal van de handleiding")}>
              {[["en", "English"], ["nl", "Nederlands"]].map(([k, l]) => <button key={k} type="button" className={lang === k ? "on" : ""} aria-pressed={lang === k} title={l} onClick={() => setLang(k)}>{k.toUpperCase()}</button>)}
            </span>
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer">{lang === "nl" ? "Nieuw tabblad" : "New tab"}</a>
            <button type="button" className="btn primary" onClick={onClose}>{lang === "nl" ? "Sluiten" : "Close"}</button>
          </div>
        </div>
        <iframe key={lang} src={url} title={tx("Handleiding")} className="manual-frame" />
      </div>
    </div>, document.body);
}
