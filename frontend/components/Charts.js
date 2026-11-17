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

export const COLORS = ["var(--blue)", "var(--orange)", "#16a34a", "#8b5cf6", "#ec4899"];
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

// A line chart with one or more series over the same days: gridlines, a soft area under the first series, a tooltip per day, and a legend with the total of every series.
// series: [{label, values, color?, dashed?, total?}] (values: one number per date)
export function LineChart({ dates = [], series = [], height = 170, format = (v) => Number(v).toLocaleString(), totals = true, area = true }) {
  const W = 100, H = 40;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = Math.max(dates.length, ...series.map((s) => s.values.length), 1);
  const x = (i) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const y = (v) => H - 2 - (v / max) * (H - 6);
  const pts = (vals) => vals.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height }} role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {[0, 0.5, 1].map((g) => <line key={g} x1="0" x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={g ? "3 3" : undefined} />)}
        {area && series[0] && series[0].values.length > 1 && <polygon points={`0,${H - 2} ${pts(series[0].values)} ${W},${H - 2}`} fill={series[0].color || COLORS[0]} fillOpacity="0.1" />}
        {series.map((s, k) => <polyline key={k} points={pts(s.values)} fill="none" stroke={s.color || COLORS[k % COLORS.length]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray={s.dashed ? "5 4" : undefined} />)}
        {Array.from({ length: n }, (_, i) => (
          <rect key={i} x={x(i) - W / n / 2} y="0" width={W / n} height={H} fill="transparent"><title>{`${dates[i] || ""}: ${series.map((s) => `${s.label} ${format(s.values[i] ?? 0)}`).join(" · ")}`}</title></rect>
        ))}
      </svg>
      <div className="chart-axis"><span>{dates[0]}</span><span>{tx("max {0}", format(max))}</span><span>{dates[dates.length - 1]}</span></div>
      <ul className="chart-legend">
        {series.map((s, k) => (
          <li key={k}><i style={{ background: s.color || COLORS[k % COLORS.length], ...(s.dashed ? { opacity: 0.55 } : {}) }} />{s.label}{totals && !s.dashed && <strong> {format(s.total ?? s.values.reduce((a, b) => a + b, 0))}</strong>}</li>
        ))}
      </ul>
    </div>
  );
}
