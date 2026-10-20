"use client";

import { tx } from "../lib/t";
import { visibilityOptions } from "../lib/photo-visibility";

const P = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

// Line icons that take the text colour (white/black by mode, house colour when active)
export const VISIBILITY_ICON = {
  public: <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 4 5.7 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.7-4-9s1.4-6.3 4-9z" /></svg>,
  members: <svg {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14.3c2.2.6 3.5 2.5 3.5 5.2" /></svg>,
  private: <svg {...P}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>,
  hidden: <svg {...P}><path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0112 6c5 0 8.5 4 9.5 6-.4.8-1.3 2.1-2.7 3.3M6.4 7.6C4.4 9 3 11 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9M9.9 9.9a3 3 0 004.2 4.2" /></svg>,
};

// Pick who may see a photo: four icon buttons, the chosen one in the primary colour, its name next to it
export default function VisibilityPicker({ value, onChange, allowPrivate = true, showLabel = true }) {
  const opts = visibilityOptions(allowPrivate || value === "private");
  const cur = opts.find(([v]) => v === value) || opts[0];
  return (
    <div className="vis-picker">
      <div className="vis-buttons" role="radiogroup" aria-label={tx("Zichtbaar voor")}>
        {opts.map(([v, label, hint]) => (
          <button key={v} type="button" role="radio" aria-checked={v === value} title={`${label}: ${hint}`}
            className={`vis-btn ${v === value ? "active" : ""}`} onClick={() => v !== value && onChange(v)}>
            {VISIBILITY_ICON[v]}
          </button>
        ))}
      </div>
      {showLabel && <span className="vis-label">{cur[1]}</span>}
    </div>
  );
}
