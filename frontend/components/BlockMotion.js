// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

// The tab "Animatie" of a block: how it appears, how long it takes, what it does under the mouse and a movement that goes on by itself.
export const FX_IN = [["", "Zoals het thema"], ["none", "Geen effect"], ["fade", "Vervagen"], ["up", "Omhoog schuiven"], ["down", "Omlaag schuiven"], ["left", "Van links"], ["right", "Van rechts"], ["zoom", "Inzoomen"], ["pop", "Opspringen"], ["flip", "Omdraaien"], ["rotate", "Draaiend"], ["blur", "Scherp worden"]];
export const FX_EASE = [["ease", "Zacht"], ["linear", "Gelijkmatig"], ["ease-in", "Langzaam beginnen"], ["ease-out", "Langzaam eindigen"], ["ease-in-out", "Langzaam beginnen en eindigen"], ["bounce", "Veerkrachtig"]];
export const FX_HOVER = [["none", "Geen"], ["lift", "Omhoog tillen"], ["grow", "Groter worden"], ["shrink", "Kleiner worden"], ["glow", "Gloeien (schaduw)"], ["tilt", "Een beetje kantelen"], ["dim", "Dimmen"]];
export const FX_LOOP = [["none", "Geen"], ["float", "Zweven"], ["pulse", "Kloppen"], ["sway", "Zwaaien"]];

// the css variables of a block: duration, wait and speed curve of its animation
export const fxVars = (r) => ({
  ...(r.fx_ms ? { "--srd": `${r.fx_ms}ms` } : {}),
  ...(r.fx_delay ? { "--srdelay": `${r.fx_delay}ms` } : {}),
  ...(r.fx_ease ? { "--sre": r.fx_ease === "bounce" ? "cubic-bezier(.34,1.56,.64,1)" : r.fx_ease } : {}),
});

export default function BlockMotion({ r, setRow }) {
  const sel = (k, list, empty) => <select value={r[k] || empty} onChange={(e) => setRow(r.id, { [k]: e.target.value })}>{list.map(([v, l]) => <option key={v} value={v}>{tx(l)}</option>)}</select>;
  const noFx = r.fx === "none";
  return (
    <div className="pb-panelbody">
      <div className="pb-cols">
        <label>{tx("Effect bij het verschijnen")}{sel("fx", FX_IN, "")}</label>
        {!noFx && <>
          <label>{tx("Duur")}: {r.fx_ms || 600} ms<input type="range" min={100} max={3000} step={100} value={r.fx_ms || 600} onChange={(e) => setRow(r.id, { fx_ms: Number(e.target.value) })} /></label>
          <label>{tx("Wachten voor het begint")}: {r.fx_delay || 0} ms<input type="range" min={0} max={2000} step={100} value={r.fx_delay || 0} onChange={(e) => setRow(r.id, { fx_delay: Number(e.target.value) })} /></label>
          <label>{tx("Snelheid van de beweging")}{sel("fx_ease", FX_EASE, "ease")}</label>
        </>}
        <label>{tx("Effect bij mouse-over")}{sel("hover", FX_HOVER, "none")}</label>
        <label>{tx("Beweging die doorgaat")}{sel("loop", FX_LOOP, "none")}</label>
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!r.bgpar} onChange={(e) => setRow(r.id, { bgpar: e.target.checked })} /><span /></span><span>{tx("Achtergrond beweegt trager dan de pagina (parallax)")}</span></label>
        <small className="muted">{tx("Bezoekers die bewegingen uit hebben staan in hun systeem zien geen animaties.")}</small>
      </div>
    </div>
  );
}
