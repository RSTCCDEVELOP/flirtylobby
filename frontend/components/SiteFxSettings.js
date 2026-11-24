// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// The website settings at the top of the Settings of the editor: the mouse effects of the whole website (theme settings fx_*). A change is saved at once and works on the page
// (components/MouseEffects.js watches the attributes on <html>); while the page is edited the effects stand still, so they show after "Klaar".
const ATTR = { fx_cursor: "fxc", fx_magnetic: "fxm", fx_tilt: "fxt", fx_glow: "fxg", fx_ripple: "fxr", fx_parallax: "fxp" };
const SWITCHES = [
  ["fx_magnetic", "Magnetische knoppen", "De knop trekt een stukje naar de muis toe."],
  ["fx_tilt", "Kaarten kantelen", "Kaarten kantelen in 3D onder de muis."],
  ["fx_glow", "Lichtvlek op kaarten", "Een zachte lichtvlek volgt de muis over een kaart."],
  ["fx_ripple", "Golfje bij een klik", "Een knop geeft een golfje als je erop klikt."],
  ["fx_parallax", "Meebewegende afbeeldingen", "Grote afbeeldingen schuiven een klein beetje mee met de muis."],
];

export default function SiteFxSettings() {
  const [theme, setTheme] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/theme/").then(setTheme).catch((e) => setMsg(errorText(e))); }, []);
  if (!theme) return msg ? <div className="alert">{msg}</div> : null;
  const fields = theme.schema.flatMap((g) => g.fields);
  const cursor = fields.find((f) => f.key === "fx_cursor");
  const set = async (key, v) => {
    const values = { ...theme.values, [key]: v };
    setTheme({ ...theme, values });
    document.documentElement.dataset[ATTR[key] === "fxc" ? "fxc" : ATTR[key]] = v;  // at once on the page
    try { await api("/theme/", { method: "PUT", body: { values } }); setMsg(null); } catch (e) { setMsg(errorText(e)); }
  };
  const anyOn = (theme.values.fx_cursor || "off") !== "off" || SWITCHES.some(([k]) => theme.values[k] === "yes");
  return (
    <section className="fxs">
      <h4>{tx("Website-instellingen")}</h4>
      <p className="muted fxs-sub">{tx("Muiseffecten voor de hele website. Ze werken niet op een telefoon of tablet en niet voor mensen die minder beweging hebben gevraagd. Tijdens het bewerken staan ze stil: je ziet ze na Klaar.")}</p>
      {msg && <div className="alert">{msg}</div>}
      {cursor && (
        <label>{tx("Muisaanwijzer")}
          <select value={theme.values.fx_cursor || "off"} onChange={(e) => set("fx_cursor", e.target.value)}>{cursor.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select>
        </label>
      )}
      {SWITCHES.map(([k, label, hint]) => (
        <label key={k} className="hed-sw">
          <span className="switch"><input type="checkbox" checked={theme.values[k] === "yes"} onChange={(e) => set(k, e.target.checked ? "yes" : "no")} /><span /></span>
          <span className="hed-swt"><strong>{tx(label)}</strong><small className="muted">{tx(hint)}</small></span>
        </label>
      ))}
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="btn sm" disabled={!anyOn} onClick={async () => { for (const k of ["fx_cursor", ...SWITCHES.map(([x]) => x)]) await set(k, k === "fx_cursor" ? "off" : "no"); }}>{tx("Alle effecten uit")}</button>
        <button type="button" className="btn sm" onClick={async () => { await set("fx_cursor", "ring"); for (const k of ["fx_magnetic", "fx_tilt", "fx_ripple"]) await set(k, "yes"); }}>{tx("Voorbeeld: modern")}</button>
      </div>
    </section>
  );
}
