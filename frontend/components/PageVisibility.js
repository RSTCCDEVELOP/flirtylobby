// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { IconEye, IconEyeOff, IconFriends, IconGlobe2, IconUser, IconUsers } from "./Icons";

// "Who sees my profile page": one row of buttons — public, members, friends, selected members, or off.
const MODES = [
  ["public", "Openbaar", "Iedereen, ook bezoekers die niet ingelogd zijn", <IconGlobe2 key="p" />],
  ["members", "Leden", "Alleen ingelogde leden", <IconUsers key="m" />],
  ["friends", "Vrienden", "Alleen jouw vrienden", <IconFriends key="f" />],
  ["selected", "Geselecteerd", "Alleen leden die jij aanwijst", <IconUser key="s" />],
  ["off", "Uit", "Niemand ziet je pagina, alleen jijzelf", <IconEyeOff key="o" />],
];

export const modeOf = (p) => (!p.enabled ? "off" : p.visibility);

export default function PageVisibility({ p, onChange, onPreview, busy }) {
  const mode = modeOf(p);
  const cur = MODES.find(([v]) => v === mode) || MODES[0];
  return (
    <div className="pvis">
      <div className="pvis-row" role="radiogroup" aria-label={tx("Wie ziet mijn profielpagina?")}>
        {MODES.map(([v, label, hint, icon]) => (
          <button key={v} type="button" role="radio" aria-checked={v === mode} disabled={busy} title={tx(hint)}
            className={`pvis-btn ${v === mode ? "active" : ""} ${v === "off" ? "off" : ""}`} onClick={() => v !== mode && onChange(v)}>
            {icon}<span>{tx(label)}</span>
          </button>
        ))}
      </div>
      <div className="pvis-foot">
        <span className="muted">{tx(cur[2])}</span>
        <button type="button" className="btn" onClick={onPreview}><IconEye /> {tx("Voorbeeld van mijn openbare profiel")}</button>
      </div>
    </div>
  );
}
