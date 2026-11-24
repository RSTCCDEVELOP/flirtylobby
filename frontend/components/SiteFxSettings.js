// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import Tabs from "./Tabs";

// The website settings at the top of the Settings of the editor. First the tab "Muis" (more tabs can follow); under it the tabs of the mouse settings: the pointer that follows the mouse,
// buttons, cards and pictures. A change is saved at once (theme settings fx_*) and works on the page (components/MouseEffects.js watches the attributes on <html>);
// while the page is edited the effects stand still, so they show after "Klaar".
const ATTR = { fx_cursor: "fxc", fx_magnetic: "fxm", fx_tilt: "fxt", fx_glow: "fxg", fx_ripple: "fxr", fx_parallax: "fxp" };
const CFG = (v) => JSON.stringify(Object.fromEntries(Object.entries(v).filter(([k, x]) => k.startsWith("fx_") && (typeof x === "number" || k === "fx_cursor_color" || k === "fx_cursor_native"))));
const SUB = [["cursor", "Aanwijzer"], ["buttons", "Knoppen"], ["cards", "Kaarten"], ["images", "Afbeeldingen"]];

export default function SiteFxSettings() {
  const [theme, setTheme] = useState(null);
  const [msg, setMsg] = useState(null);
  const [sub, setSub] = useState("cursor");
  const latest = useRef(null);
  useEffect(() => { api("/theme/").then((t) => { setTheme(t); latest.current = t.values; }).catch((e) => setMsg(errorText(e))); }, []);
  if (!theme) return msg ? <div className="alert">{msg}</div> : null;
  const fields = Object.fromEntries(theme.schema.flatMap((g) => g.fields).map((f) => [f.key, f]));
  const val = (k) => theme.values[k] ?? fields[k]?.default;
  const live = (values, key) => {  // at once on the page
    const d = document.documentElement.dataset;
    if (ATTR[key]) d[ATTR[key]] = values[key]; else d.fxcfg = CFG(values);
  };
  const save = async (values) => { try { await api("/theme/", { method: "PUT", body: { values } }); setMsg(null); } catch (e) { setMsg(errorText(e)); } };
  const set = async (key, v, commit = true) => {
    const values = { ...latest.current, [key]: v };
    latest.current = values; setTheme((t) => ({ ...t, values })); live(values, key);
    if (commit) await save(values);
  };
  const off = (k) => val(k) === "no" || val(k) === "off";
  const sw = (k, label, hint) => (
    <label key={k} className="hed-sw"><span className="switch"><input type="checkbox" checked={val(k) === "yes"} onChange={(e) => set(k, e.target.checked ? "yes" : "no")} /><span /></span><span className="hed-swt"><strong>{tx(label)}</strong>{hint && <small className="muted">{tx(hint)}</small>}</span></label>
  );
  const slider = (k, label, dep) => {  // (a function, not a component: a component made here would start again at every move of the slider)
    const f = fields[k]; if (!f) return null;
    const dis = dep ? off(dep) : false;
    return (
      <div key={k} className={`hed-field${dis ? " fxs-dis" : ""}`}>
        <span className="hed-lbl">{tx(label)}<b className="hed-val">{val(k)}{f.unit ? ` ${f.unit}` : ""}</b></span>
        <input type="range" min={f.min} max={f.max} step={f.step} value={val(k)} disabled={dis} onChange={(e) => set(k, Number(e.target.value), false)} onPointerUp={() => save(latest.current)} onKeyUp={() => save(latest.current)} />
      </div>
    );
  };
  const cursor = fields.fx_cursor, colour = fields.fx_cursor_color;
  const anyOn = !off("fx_cursor") || ["fx_magnetic", "fx_tilt", "fx_glow", "fx_ripple", "fx_parallax"].some((k) => val(k) === "yes");
  const all = async (preset) => {
    const v = { ...latest.current, fx_cursor: preset ? "ring" : "off" };
    for (const k of ["fx_magnetic", "fx_tilt", "fx_glow", "fx_ripple", "fx_parallax"]) v[k] = preset && k !== "fx_glow" && k !== "fx_parallax" ? "yes" : "no";
    latest.current = v; setTheme((t) => ({ ...t, values: v }));
    for (const k of Object.keys(ATTR)) live(v, k);
    await save(v);
  };
  return (
    <section className="fxs">
      <Tabs className="fxs-top" value="mouse" onChange={() => {}} tabs={[["mouse", "Muis"]]} />
      <p className="muted fxs-sub">{tx("Effecten met de muis voor de hele website. Ze werken niet op een telefoon of tablet en niet voor mensen die minder beweging hebben gevraagd. Tijdens het bewerken staan de effecten met de muis stil (je ziet ze na Klaar); het effect bij het scrollen, zoals meebewegende afbeeldingen, werkt wel.")}</p>
      {msg && <div className="alert">{msg}</div>}
      <Tabs className="fxs-subtabs" value={sub} onChange={setSub} tabs={SUB} />
      <div className="fxs-panel">
        {sub === "cursor" && (<>
          {cursor && <label>{tx("Aanwijzer die de muis volgt")}<select value={val("fx_cursor")} onChange={(e) => set("fx_cursor", e.target.value)}>{cursor.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>}
          {slider("fx_cursor_size", "Grootte", "fx_cursor")}
          {slider("fx_cursor_speed", "Hoe vlot hij de muis volgt", "fx_cursor")}
          {slider("fx_cursor_grow", "Groei boven links en knoppen", "fx_cursor")}
          {colour && <label className={off("fx_cursor") ? "fxs-dis" : ""}>{tx("Kleur")}<select value={val("fx_cursor_color")} disabled={off("fx_cursor")} onChange={(e) => set("fx_cursor_color", e.target.value)}>{colour.choices.map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>}
          {sw("fx_cursor_native", "Gewone aanwijzer verbergen", "Alleen de eigen aanwijzer blijft zichtbaar.")}
        </>)}
        {sub === "buttons" && (<>
          {sw("fx_magnetic", "Magnetische knoppen", "De knop trekt een stukje naar de muis toe.")}
          {slider("fx_magnetic_strength", "Kracht", "fx_magnetic")}
          {sw("fx_ripple", "Golfje bij een klik", "Een knop geeft een golfje als je erop klikt.")}
        </>)}
        {sub === "cards" && (<>
          {sw("fx_tilt", "Kaarten kantelen", "Kaarten kantelen in 3D onder de muis.")}
          {slider("fx_tilt_amount", "Hoek", "fx_tilt")}
          {sw("fx_glow", "Lichtvlek op kaarten", "Een zachte lichtvlek volgt de muis over een kaart.")}
          {slider("fx_glow_size", "Grootte van de lichtvlek", "fx_glow")}
          {slider("fx_glow_strength", "Sterkte van de lichtvlek", "fx_glow")}
        </>)}
        {sub === "images" && (<>
          {sw("fx_parallax", "Meebewegende afbeeldingen", "Grote afbeeldingen schuiven een klein beetje mee met de muis.")}
          {slider("fx_parallax_amount", "Afstand", "fx_parallax")}
        </>)}
      </div>
      <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem" }}>
        <button type="button" className="btn sm" disabled={!anyOn} onClick={() => all(false)}>{tx("Alle effecten uit")}</button>
        <button type="button" className="btn sm" onClick={() => all(true)}>{tx("Voorbeeld: modern")}</button>
      </div>
    </section>
  );
}
