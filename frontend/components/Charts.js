// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";
import { tx } from "../lib/t";

// Small dependency-free SVG charts that follow the theme colors.
export function BarChart({ points, format = (v) => v, height = 150, color = "var(--blue)" }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 100 / points.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" style={{ width: "100%", height }} role="img">
        <line x1="0" x2="100" y1={height / 3 - 0.5} y2={height / 3 - 0.5} stroke="var(--line)" strokeWidth="0.4" />
        {points.map((p, i) => {
          const h = Math.max(p.value > 0 ? 1 : 0, (p.value / max) * (height / 3 - 4));
          return <rect key={i} x={i * w + w * 0.15} y={height / 3 - 0.5 - h} width={w * 0.7} height={h} rx="0.6" fill={color}><title>{`${p.label}: ${format(p.value)}`}</title></rect>;
        })}
      </svg>
      <div className="chart-axis"><span>{points[0]?.label}</span><span>{tx("max {0}", format(max))}</span><span>{points[points.length - 1]?.label}</span></div>
    </div>
  );
}

const COLORS = ["var(--blue)", "var(--orange)", "#16a34a", "#8b5cf6", "#ec4899"];
export function Donut({ parts, size = 140 }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  let acc = 0;
  const r = 15.9155;
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42" width={size} height={size} role="img">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        {parts.map((p, i) => {
          const len = (p.value / total) * 100;
          const el = <circle key={i} cx="21" cy="21" r={r} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={25 - acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <ul>{parts.map((p, i) => <li key={i}><i style={{ background: COLORS[i % COLORS.length] }} />{p.label}: <strong>{p.value}</strong></li>)}</ul>
    </div>
  );
}
