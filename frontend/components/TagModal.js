// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useState } from "react";

// Add or remove tags on the selected files. `known` = tags that already exist (suggestions), `present` = tags on the selection.
export default function TagModal({ count, known, present, onApply, onClose }) {
  const [add, setAdd] = useState("");
  const [rem, setRem] = useState([]);
  const toggle = (t) => setRem((r) => (r.includes(t) ? r.filter((x) => x !== t) : [...r, t]));
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onApply({ add, remove: rem }); }}>
        <h2 style={{ margin: 0 }}>{tx("Tags voor {0} bestand(en)", count)}</h2>
        <label>{tx("Tags toevoegen")} <small className="muted">{tx("gescheiden door komma's")}</small>
          <input value={add} onChange={(e) => setAdd(e.target.value)} list="media-tags" autoFocus placeholder={tx("bv. zomer, strand, logo")} />
          <datalist id="media-tags">{known.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        {known.length > 0 && (
          <div>
            <small className="muted">{tx("Bestaande tags (klik om toe te voegen)")}</small>
            <div className="chips" style={{ marginTop: ".3rem" }}>
              {known.slice(0, 20).map((t) => <button key={t} type="button" className="chip" onClick={() => setAdd((a) => (a.split(",").map((x) => x.trim()).includes(t) ? a : (a.trim() ? `${a.trim().replace(/,$/, "")}, ${t}` : t)))}>+ {t}</button>)}
            </div>
          </div>
        )}
        {present.length > 0 && (
          <div>
            <small className="muted">{tx("Tags op deze selectie (klik om te verwijderen)")}</small>
            <div className="chips" style={{ marginTop: ".3rem" }}>
              {present.map((t) => <button key={t} type="button" className={`chip ${rem.includes(t) ? "tag-del" : ""}`} onClick={() => toggle(t)}>{rem.includes(t) ? "✕ " : ""}{t}</button>)}
            </div>
          </div>
        )}
        <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button className="btn primary" disabled={!add.trim() && !rem.length}>{tx("Toepassen")}</button></div>
      </form>
    </div>
  );
}
