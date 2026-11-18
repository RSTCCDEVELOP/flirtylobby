// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

// The tabs of a part of a page (text, heading, a quote ...):
//  - Position (default export): where the box sits in its cell (size, sideways, up and down)
//  - TextAlignTab: how the text inside the box is aligned
//  - FontTab: the font and the size of the text; empty = the theme
// value = the style of the part; onChange(patch).
const H = [["", "Auto"], ["left", "Links"], ["center", "Midden"], ["right", "Rechts"]];
const V = [["", "Auto"], ["top", "Boven"], ["middle", "Midden"], ["bottom", "Onder"]];
const FONTS = [["", "Zoals het thema"], ["body", "Lettertype van de tekst"], ["heading", "Lettertype van de koppen"], ["serif", "Serif"], ["mono", "Monospace"]];
const FONT_CSS = { "": "var(--font-body)", body: "var(--font-body)", heading: "var(--font-heading)", serif: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, Menlo, Consolas, monospace" };

// single-colour line icons (they take the colour of the theme): the lines of text, flush left / centred / flush right / justified
const lines = (a) => ({ left: [[3, 6, 17], [3, 10, 11], [3, 14, 17], [3, 18, 9]], center: [[3, 6, 18], [6, 10, 12], [3, 14, 18], [7, 18, 10]], right: [[4, 6, 17], [10, 10, 11], [4, 14, 17], [12, 18, 9]], justify: [[3, 6, 18], [3, 10, 18], [3, 14, 18], [3, 18, 18]] }[a] || []);
const AlignIcon = ({ a }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    {a ? lines(a).map(([x, y, w], i) => <path key={i} d={`M${x} ${y}h${w}`} />) : <path d="M4 7h16M4 12h16M4 17h10" opacity=".55" />}
  </svg>
);

function Seg({ rows, value, onChange, label, icons = false }) {
  return (
    <div className="pb-stylerow pb-stack"><span>{tx(label)}</span>
      <span className="pb-seg" role="group" aria-label={tx(label)}>
        {rows.map(([k, l]) => (
          <button type="button" key={k || "auto"} className={(value || "") === k ? "on" : ""} aria-pressed={(value || "") === k} title={k === "" ? tx("Zoals de kolom") : tx(l)} aria-label={tx(l)} onClick={() => onChange(k)}>
            {icons ? <AlignIcon a={k} /> : tx(l)}
          </button>
        ))}
      </span>
    </div>
  );
}

export default function PositionTab({ value, onChange, withSize = false }) {
  const v = value || {};
  const w = String(v.w || "");
  const mode = !w ? "auto" : w.endsWith("px") ? "px" : "%";  // Auto | % (always a slider, 10 to 100) | px (a number)
  const n = parseInt(w, 10) || 0;
  const pickMode = (m) => onChange({ w: m === "auto" ? "" : m === "%" ? `${mode === "%" && n ? n : 50}%` : `${mode === "px" && n ? n : 300}px` });
  return (
    <div className="pb-cols">
      {withSize && (
        <div className="pb-stylerow"><span>{tx("Breedte")}</span>
          <select value={mode} aria-label={tx("Eenheid")} onChange={(e) => pickMode(e.target.value)}>
            <option value="auto">{tx("Auto")}</option><option value="%">%</option><option value="px">px</option>
          </select>
          {mode === "%" && <>
            <input type="range" min={10} max={100} step={1} value={Math.min(100, Math.max(10, n || 50))} aria-label={tx("Breedte")} onChange={(e) => onChange({ w: `${e.target.value}%` })} />
            <small className="muted">{Math.min(100, Math.max(10, n || 50))}%</small>
          </>}
          {mode === "px" && <input type="number" min={20} max={4000} value={n || ""} aria-label={tx("Breedte")} onChange={(e) => e.target.value !== "" && onChange({ w: `${Math.min(4000, Math.max(20, Number(e.target.value) || 20))}px` })} style={{ width: "6rem" }} />}
        </div>
      )}
      <Seg rows={H} value={v.align} onChange={(k) => onChange({ align: k })} label="Horizontaal" />
      <Seg rows={V} value={v.valign} onChange={(k) => onChange({ valign: k })} label="Verticaal" />
      <small className="muted">{tx("Waar dit onderdeel staat in zijn kolom. Omhoog en omlaag werkt als de kolom hoger is dan het onderdeel.")}</small>
    </div>
  );
}

// the alignment of the text inside the box, with icons
export function TextAlignTab({ value, onChange }) {
  const v = value || {};
  return (
    <div className="pb-cols">
      <Seg rows={[["", "Auto"], ["left", "Links"], ["center", "Midden"], ["right", "Rechts"], ["justify", "Uitvullen"]]} value={v.talign} onChange={(k) => onChange({ talign: k })} label="Tekst uitlijnen" icons />
      <small className="muted">{tx("Hoe de tekst in het blok loopt. Auto volgt de uitlijning van het blok of de kolom.")}</small>
    </div>
  );
}

// the font and the size of the text, with a sample; empty = the theme
export function FontTab({ value, onChange, withWeight = false }) {
  const v = value || {};
  return (
    <div className="pb-cols">
      <div className="pb-stylerow"><span>{tx("Lettertype")}</span>
        <select value={v.font || ""} onChange={(e) => onChange({ font: e.target.value })}>
          {FONTS.map(([k, l]) => <option key={k || "theme"} value={k} style={{ fontFamily: FONT_CSS[k] }}>{tx(l)}</option>)}
        </select></div>
      <div className="pb-stylerow"><span>{tx("Lettergrootte")}</span>
        <input type="number" min={0.6} max={6} step={0.1} value={v.size || ""} placeholder={tx("Thema")} aria-label={tx("Lettergrootte")} onChange={(e) => onChange({ size: e.target.value === "" ? "" : Number(e.target.value) })} />
        <small className="muted">rem</small></div>
      {withWeight && (
        <div className="pb-stylerow"><span>{tx("Dikte")}</span>
          <select value={v.weight || ""} onChange={(e) => onChange({ weight: e.target.value })}>
            <option value="">{tx("Zoals het thema")}</option><option value="400">{tx("Normaal")}</option><option value="500">{tx("Medium")}</option><option value="600">{tx("Halfvet")}</option><option value="700">{tx("Vet")}</option><option value="800">{tx("Extra vet")}</option>
          </select></div>
      )}
      <div className="pb-fontsample" aria-hidden="true" style={{ fontFamily: FONT_CSS[v.font || ""], fontSize: v.size ? `${v.size}rem` : undefined, fontWeight: v.weight || undefined }}>Aa — {tx("Voorbeeldtekst")}</div>
      {(v.font || v.size || (withWeight && v.weight)) && <div className="pb-stylerow pb-quick"><span /><button type="button" className="btn sm" onClick={() => onChange({ font: "", size: "", ...(withWeight ? { weight: "" } : {}) })}>{tx("Zoals het thema")}</button></div>}
      <small className="muted">{tx("Leeg is het lettertype en de grootte van het thema.")}</small>
    </div>
  );
}
