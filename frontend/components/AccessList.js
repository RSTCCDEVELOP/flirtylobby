// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { tx } from "../lib/t";

const LEVELS = [[1, "Gebruik"], [2, "Bewerken"], [3, "Beheer"]];

// Module access as a list: pick a module and add it with "+", then it is a row with its level (Gebruik / Bewerken / Beheer) and a remove button.
// modules: [{key, label, group}]; value: { moduleKey: level } (0 or missing = no access); onChange(moduleKey, level).
export default function AccessList({ modules, value, onChange }) {
  const [pick, setPick] = useState("");
  const [find, setFind] = useState("");
  const given = modules.filter((m) => (value[m.key] || 0) > 0);
  const free = modules.filter((m) => !(value[m.key] > 0));
  const groups = free.reduce((a, m) => { (a[m.group || ""] = a[m.group || ""] || []).push(m); return a; }, {});
  const add = () => { if (!pick) return; onChange(pick, 1); setPick(""); };
  const shown = given.filter((m) => `${tx(m.label)} ${tx(m.group || "")}`.toLowerCase().includes(find.toLowerCase()));
  return (
    <div className="acl">
      <div className="acl-add">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={tx("Module")}>
          <option value="">{free.length ? tx("Kies een module…") : tx("Alle modules zijn toegevoegd")}</option>
          {Object.entries(groups).map(([g, list]) => (
            <optgroup key={g} label={tx(g || "Overig")}>{list.map((m) => <option key={m.key} value={m.key}>{tx(m.label)}</option>)}</optgroup>
          ))}
        </select>
        <button type="button" className="btn primary" disabled={!pick} onClick={add}>+ {tx("Toevoegen")}</button>
      </div>
      {given.length > 6 && <input type="search" placeholder={tx("Zoek in de lijst…")} value={find} onChange={(e) => setFind(e.target.value)} />}
      {given.length === 0 ? (
        <p className="acl-empty muted">{tx("Nog geen modules toegevoegd. Kies hierboven een module en klik op +.")}</p>
      ) : (
        <ul className="acl-list">
          {shown.map((m) => (
            <li key={m.key}>
              <span className="acl-name"><strong>{tx(m.label)}</strong>{m.group && <small className="muted">{tx(m.group)}</small>}</span>
              <div className="inv-seg" role="radiogroup" aria-label={tx(m.label)}>
                {LEVELS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value[m.key] === v} className={value[m.key] === v ? "on" : ""} onClick={() => onChange(m.key, v)}>{tx(l)}</button>)}
              </div>
              <button type="button" className="acl-x" title={tx("Verwijderen")} aria-label={tx("Verwijderen")} onClick={() => onChange(m.key, 0)}>×</button>
            </li>
          ))}
          {!shown.length && <li className="muted">{tx("Niets gevonden.")}</li>}
        </ul>
      )}
    </div>
  );
}
