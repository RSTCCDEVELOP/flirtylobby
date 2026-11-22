// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

// Small SVG charts for the Ecologi screens: a stacked bar chart per month (trees per source) and a legend. No library: it follows the colours of the theme.
export const SOURCE = {
  visitors: ["Bezoekers", "#2f7d5b"],
  machine: ["Machine (energie)", "#7cc59a"],
  user: ["Gebruiker (beheerder)", "#e9b949"],
  admin_gift: ["Gift van de beheerder", "#c98a1b"],
  hand: ["Handmatig", "#8aa79a"],
  auto: ["Automatisch", "#b7cfc3"],
};

export function Legend({ keys }) {
  return (
    <div style={{ display: "flex", gap: ".4rem 1rem", flexWrap: "wrap", fontSize: ".8rem" }}>
      {keys.map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}><i aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: SOURCE[k][1], display: "inline-block" }} />{tx(SOURCE[k][0])}</span>)}
    </div>
  );
}

// months: [{label, parts: {key: number}}]
export function StackedBars({ months, keys, height = 170, label = "" }) {
  const W = 560, H = height, L = 34, R = 8, T = 10, B = 24;
  const totals = months.map((m) => keys.reduce((a, k) => a + (m.parts[k] || 0), 0));
  const max = Math.max(1, ...totals) * 1.1;
  const bw = (W - L - R) / months.length;
  const Y = (v) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => Math.round(f * max));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="currentColor" strokeOpacity=".12" /><text x={L - 5} y={Y(t) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity=".6">{t}</text></g>)}
      {months.map((m, i) => {
        let acc = 0;
        return (
          <g key={m.label}>
            {keys.map((k) => {
              const v = m.parts[k] || 0;
              if (!v) return null;
              const y1 = Y(acc + v), y0 = Y(acc);
              acc += v;
              return <rect key={k} x={L + i * bw + bw * 0.18} y={y1} width={bw * 0.64} height={Math.max(1, y0 - y1)} fill={SOURCE[k][1]} rx="2"><title>{`${m.label}: ${tx(SOURCE[k][0])} ${v}`}</title></rect>;
            })}
            <text x={L + i * bw + bw / 2} y={H - 7} textAnchor="middle" fontSize="9.5" fill="currentColor" opacity=".6">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// A thin bar that shows how much of the maximum is used.
export function Meter({ value, max, color = "#2f7d5b" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} style={{ height: 8, borderRadius: 999, background: "color-mix(in srgb, var(--text) 10%, transparent)", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${pct}%`, background: color }} /></div>;
}
