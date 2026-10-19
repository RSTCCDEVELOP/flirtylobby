"use client";

import { tx } from "../lib/t";

// How a picture is placed: alignment (left / middle / right) and size (a share of the width). Used for every picture that can be placed:
// popups, pages, e-mail. Stored as "align:size", for instance "center:m".
export const ALIGNS = [["left", "Links", "⇤"], ["center", "Midden", "↔"], ["right", "Rechts", "⇥"]];
export const SIZES = [["s", "Klein", 25], ["m", "Middel", 50], ["l", "Groot", 75], ["full", "Volledige breedte", 100]];
export const DEFAULT_PLACE = "center:full";

// a size is one of the presets, or an own size: "320px" or "40%"
const CUSTOM = /^[1-9][0-9]{0,3}(px|%)$/;
export const parsePlace = (s) => {
  const [a, z] = String(s || DEFAULT_PLACE).split(":");
  return { align: ALIGNS.some(([k]) => k === a) ? a : "center", size: SIZES.some(([k]) => k === z) || CUSTOM.test(z) ? z : "full" };
};
export const joinPlace = ({ align, size }) => `${align}:${size}`;

// the style of the <img>: width as a share of its box, pushed to the left, the middle or the right
export const placeStyle = (s) => {
  const { align, size } = parsePlace(s);
  const w = CUSTOM.test(size) ? size : `${SIZES.find(([k]) => k === size)[2]}%`;
  return { display: "block", width: w, maxWidth: "100%", height: "auto", marginLeft: align === "left" ? 0 : "auto", marginRight: align === "right" ? 0 : "auto" };
};

// the controls: always shown with a picture, so it is always chosen how it sits
export function PlaceControls({ value, onChange, disabled = false, compact = false }) {
  const cur = parsePlace(value);
  const set = (patch) => onChange(joinPlace({ ...cur, ...patch }));
  const custom = CUSTOM.test(cur.size);
  const unit = custom ? (cur.size.endsWith("%") ? "%" : "px") : "px";
  const num = custom ? parseInt(cur.size, 10) : "";
  const small = compact ? { width: "auto", padding: ".15rem .4rem", fontSize: ".8rem" } : undefined;
  const own = (n, u) => { const v = Math.max(1, Math.min(u === "%" ? 100 : 4000, Number(n) || 0)); if (v) set({ size: `${v}${u}` }); };
  return (
    <span className="place-controls" role="group" aria-label={tx("Plaatsing van de afbeelding")}>
      <span className="pb-seg" title={tx("Uitlijnen")}>{ALIGNS.map(([k, l, g]) => <button type="button" key={k} disabled={disabled} className={cur.align === k ? "on" : ""} title={tx(l)} aria-pressed={cur.align === k} onClick={() => set({ align: k })}>{g}</button>)}</span>
      <select value={custom ? "own" : cur.size} disabled={disabled} aria-label={tx("Formaat")} onChange={(e) => (e.target.value === "own" ? set({ size: "300px" }) : set({ size: e.target.value }))} style={small}>
        {SIZES.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}
        <option value="own">{tx("Eigen formaat")}</option>
      </select>
      {custom && (
        <span className="place-own" style={{ display: "inline-flex", gap: ".25rem", alignItems: "center", whiteSpace: "nowrap" }}>
          <input type="number" min={1} max={unit === "%" ? 100 : 4000} value={num} disabled={disabled} aria-label={tx("Breedte")} onChange={(e) => own(e.target.value, unit)} style={{ width: "5rem", ...small }} />
          <select value={unit} disabled={disabled} aria-label={tx("Eenheid")} onChange={(e) => own(num || (e.target.value === "%" ? 50 : 300), e.target.value)} style={{ width: "auto", ...small }}>
            <option value="px">px</option>
            <option value="%">%</option>
          </select>
        </span>
      )}
    </span>
  );
}
