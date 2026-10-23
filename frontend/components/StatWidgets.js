// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { tx } from "../lib/t";

const COLORS = ["var(--blue)", "var(--orange)", "#16a34a", "#8b5cf6", "#ec4899", "#0ea5a4"];
const short = (iso) => { const [, m, d] = String(iso).split("-"); return d && m ? `${+d}-${+m}` : String(iso); };

// Line/area chart of one or more series over the days, with a hover read-out. Dependency-free SVG.
function Series({ w }) {
  const list = w.series || [{ name: "", points: w.points || [] }];
  const n = Math.max(1, ...list.map((s) => s.points.length));
  const max = Math.max(1, ...list.flatMap((s) => s.points.map((p) => p.y)));
  const [hover, setHover] = useState(null);
  const H = 120, W = 400, X = (i) => (n < 2 ? W / 2 : (i / (n - 1)) * W), Y = (v) => H - 4 - (v / max) * (H - 12);
  const pts = (s) => s.points.map((p, i) => `${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const first = list[0].points;
  const total = list.map((s) => s.points.reduce((a, p) => a + p.y, 0));
  return (
    <div className="stw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))))); }}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />)}
        {list.map((s, k) => (
          <g key={k}>
            {list.length === 1 && <polygon points={`0,${H} ${pts(s)} ${W},${H}`} fill={COLORS[0]} opacity="0.12" />}
            <polyline points={pts(s)} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        ))}
        {hover != null && <line x1={X(hover)} x2={X(hover)} y1="0" y2={H} stroke="var(--muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
      </svg>
      <div className="stw-axis"><span>{first[0] ? short(first[0].x) : ""}</span><span>{hover != null && first[hover] ? <b>{short(first[hover].x)}: {list.map((s) => s.points[hover]?.y ?? 0).join(" · ")}</b> : tx("max {0}", max)}</span><span>{first.length ? short(first[first.length - 1].x) : ""}</span></div>
      {(list.length > 1 || w.sub) && <div className="stw-legend">{list.map((s, k) => <span key={k}><i style={{ background: COLORS[k % COLORS.length] }} />{tx(s.name)} <strong>{total[k]}</strong></span>)}</div>}
    </div>
  );
}

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="muted stw-none">{tx("Nog geen gegevens.")}</p>;
  return (
    <ul className="stw-rows">
      {rows.map((r, i) => (
        <li key={i} title={`${r.label}: ${r.value}`}>
          <span className="stw-bl">{r.label}</span>
          <span className="stw-track"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: COLORS[i % COLORS.length] }} /></span>
          <strong>{r.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function Table({ w }) {
  if (!w.rows.length) return <p className="muted stw-none">{tx("Nog geen gegevens.")}</p>;
  return (
    <div className="stw-scroll"><table className="stw-table"><thead><tr>{w.columns.map((c, i) => <th key={i}>{tx(c)}</th>)}</tr></thead><tbody>{w.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
  );
}

// One widget as the backend sends it: number | series | bars | table
export function Widget({ w }) {
  if (w.type === "number") return <div className="stw-card stw-k-number"><span className="stw-t">{tx(w.title)}</span><strong>{w.value}</strong>{w.sub ? <small className="muted">{w.sub}</small> : null}</div>;
  return (
    <div className={`stw-card stw-k-${w.type}`}>
      <h3>{tx(w.title)}</h3>
      {w.type === "series" && <Series w={w} />}
      {w.type === "bars" && <Bars rows={w.rows} />}
      {w.type === "table" && <Table w={w} />}
    </div>
  );
}

export function Widgets({ widgets }) {
  const nums = widgets.filter((w) => w.type === "number");
  const series = widgets.filter((w) => w.type === "series");
  const rest = widgets.filter((w) => w.type === "bars" || w.type === "table");
  return (
    <div className="stw">
      {nums.length > 0 && <section className="stw-sec"><h2>{tx("Kerncijfers")}</h2><div className="stw-nums">{nums.map((w, i) => <Widget key={i} w={w} />)}</div></section>}
      {series.length > 0 && <section className="stw-sec"><h2>{tx("Verloop")}</h2><div className="stw-grid stw-wide">{series.map((w, i) => <Widget key={i} w={w} />)}</div></section>}
      {rest.length > 0 && <section className="stw-sec"><h2>{tx("Overzichten")}</h2><div className="stw-grid">{rest.map((w, i) => <Widget key={i} w={w} />)}</div></section>}
    </div>
  );
}
