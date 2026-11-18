// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

// The tab "Position" of every part of a page: where the part sits in its cell, sideways (left, middle, right) and up and down (top, middle, bottom).
// value = the style of the part ({align, valign}); an empty choice follows the cell. onChange(patch).
const H = [["", "Zoals de kolom"], ["left", "Links"], ["center", "Midden"], ["right", "Rechts"]];
const V = [["", "Zoals de kolom"], ["top", "Boven"], ["middle", "Midden"], ["bottom", "Onder"]];

export default function PositionTab({ value, onChange }) {
  const v = value || {};
  const seg = (rows, key, label) => (
    <div className="pb-stylerow"><span>{tx(label)}</span>
      <span className="pb-seg" role="group" aria-label={tx(label)}>
        {rows.map(([k, l]) => <button type="button" key={k || "col"} className={(v[key] || "") === k ? "on" : ""} aria-pressed={(v[key] || "") === k} onClick={() => onChange({ [key]: k })}>{tx(l)}</button>)}
      </span>
    </div>
  );
  return (
    <div className="pb-cols">
      {seg(H, "align", "Horizontaal")}
      {seg(V, "valign", "Verticaal")}
      <small className="muted">{tx("Waar dit onderdeel staat in zijn kolom. Omhoog en omlaag werkt als de kolom hoger is dan het onderdeel.")}</small>
    </div>
  );
}
