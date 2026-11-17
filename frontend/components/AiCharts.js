// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import KitScope from "../lib/ui-kit/KitScope";

export const GROUP_COLOR = { user: "var(--blue)", admin: "var(--orange)", super: "#8b5cf6", system: "#64748b", site: "#16a34a" };
export const GROUPS = ["user", "admin", "super", "system", "site"];
const GROUP_LABEL = { user: "Gebruikers", admin: "Admins", super: "Superadmins", system: "Systeem", site: "Website" };
const nf = (n, d = 0) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n || 0);
export const num = nf;
export const money = (n, cur = "USD") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: Math.abs(n) < 1 ? 4 : 2 }).format(n || 0); } catch { return `${cur} ${nf(n, 2)}`; } };
// a price of one single token: very small, so with many decimals
export const moneyTok = (n, cur = "USD") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", minimumFractionDigits: 6, maximumFractionDigits: 10 }).format(n || 0); } catch { return `${cur} ${(n || 0).toFixed(8)}`; } };
export const short = (n) => (n >= 1e6 ? `${nf(n / 1e6, 1)}M` : n >= 1e3 ? `${nf(n / 1e3, 1)}k` : nf(n));

const SERIES = (g) => `s${Math.max(0, GROUPS.indexOf(g)) + 1}`; // the colour of a group: s1..s5 of the easy2edit set (they follow the theme)
const SERIES_VAR = ["--e2e-primary", "--e2e-secondary", "--e2e-accent", "--e2e-info", "--e2e-success"];

// Everything below is made of easy2edit objects (the component set in use): ui-kpi, ui-legend, ui-stacked-bar-chart, ui-bar-chart, ui-bar-chart-horizontal, ui-donut, ui-cost-summary. They take the colours and corners of the theme.
export function KpiGrid({ children, min = 190 }) {
  return <KitScope><div className="e2e-grid" style={{ "--e2e-min": `${min}px` }} data-easy2edit-tag="ui-kpi">{children}</div></KitScope>;
}
export function Kpi({ label, value, sub, accent }) {
  return <div className="e2e-kpi" style={accent ? { borderTop: "3px solid var(--e2e-primary)" } : undefined}><span className="e2e-kpi__label">{label}</span><span className="e2e-kpi__value">{value}</span>{sub && <span className="e2e-hint">{sub}</span>}</div>;
}

// Three amounts next to each other: now, today, this month.
export function CostSummary({ now, today, month, solid, labels = ["Nu", "Vandaag", "Deze maand"], subs = [] }) {
  return (
    <KitScope><div className={`e2e-costs${solid ? " e2e-costs--solid" : ""}`} data-easy2edit-tag="ui-cost-summary">
      {[now, today, month].map((v, i) => (
        <div key={i} className={i ? "e2e-costs__item" : "e2e-costs__main"}><small>{tx(labels[i])}</small><b>{v}</b>{subs[i] && <span className="e2e-hint">{subs[i]}</span>}</div>
      ))}
    </div></KitScope>
  );
}

export function Legend({ keys = GROUPS }) {
  return <KitScope><ul className="e2e-legend e2e-legend--row" data-easy2edit-tag="ui-stacked-bar-chart">{keys.map((g) => <li key={g}><i className={SERIES(g)} />{tx(GROUP_LABEL[g])}</li>)}</ul></KitScope>;
}

// Columns per day (or hour), stacked per group. series = { "2026-10-31": { user: {charged, calls}, ... } }; metric = which number to stack.
export function Stacked({ series, metric = "charged", format = short }) {
  const keys = Object.keys(series).sort();
  if (!keys.length) return <p className="muted">{tx("Nog geen AI-gebruik in deze periode.")}</p>;
  const tot = (k) => GROUPS.reduce((a, g) => a + (series[k][g]?.[metric] || 0), 0);
  const max = Math.max(...keys.map(tot), 0.0001);
  const step = Math.ceil(keys.length / 10);
  return (
    <KitScope><div className="e2e-bars e2e-bars--stack" style={{ "--h": "220px" }} role="img" aria-label={tx("Verloop in de tijd")} data-easy2edit-tag="ui-stacked-bar-chart">
      {keys.map((k, i) => (
        <div key={k} className="e2e-bar" title={`${k}: ${format(tot(k))}`}>
          <div className="e2e-stack__col" style={{ height: `${Math.max(2, (tot(k) / max) * 100)}%` }}>
            {GROUPS.map((g) => { const v = series[k][g]?.[metric] || 0; return v ? <i key={g} className={SERIES(g)} style={{ "--v": `${(v / tot(k)) * 100}%` }} /> : null; })}
          </div>
          <small>{keys.length <= 12 || i % step === 0 ? k.slice(5, 16) : "\u00a0"}</small>
        </div>
      ))}
    </div></KitScope>
  );
}

// Plain columns (hours of the day, days of the week).
export function Columns({ values, labels }) {
  const max = Math.max(...values, 1);
  return (
    <KitScope><div className="e2e-bars" style={{ "--h": "150px" }} role="img" aria-label={tx("Verdeling")} data-easy2edit-tag="ui-bar-chart">
      {values.map((v, i) => <div key={i} className="e2e-bar s1" style={{ "--v": `${Math.max(2, (v / max) * 100)}%` }} title={`${labels[i]}: ${nf(v)}`}><i /><small>{labels[i]}</small></div>)}
    </div></KitScope>
  );
}

// Horizontal bars: rows = [{ label, value, sub }].
export function BarList({ rows, color, format = nf }) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  if (!rows.length) return <p className="muted">{tx("Nog niets.")}</p>;
  return (
    <KitScope><ul className="e2e-hbars" data-easy2edit-tag="ui-bar-chart-horizontal">
      {rows.map((r) => (
        <li key={r.label}>
          <span title={r.label}>{r.label}{r.sub && <small className="e2e-hint" style={{ display: "block" }}>{r.sub}</small>}</span>
          <div className="e2e-track"><i style={{ "--v": `${Math.max(1.5, (r.value / max) * 100)}%`, ...((r.color || color) ? { "--_s": r.color || color } : {}) }} /></div>
          <b>{format(r.value)}</b>
        </li>
      ))}
    </ul></KitScope>
  );
}

// A ring with the share of every group: rows = [{ key, label, value }].
export function Donut({ rows }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <p className="muted">{tx("Nog niets.")}</p>;
  let at = 0;
  const stops = rows.map((r) => { const from = at; at += (r.value / total) * 100; return `var(${SERIES_VAR[Math.max(0, GROUPS.indexOf(r.key)) % 5]}) ${from}% ${at}%`; }).join(",");
  return (
    <KitScope><div className="e2e-donut" data-easy2edit-tag="ui-donut">
      <div className="e2e-donut__ring" role="img" aria-label={tx("Verdeling per groep")} style={{ background: `conic-gradient(${stops})` }} />
      <ul className="e2e-legend">{rows.map((r) => <li key={r.key}><i className={SERIES(r.key)} />{r.label} <b>{Math.round((r.value / total) * 100)}%</b></li>)}</ul>
    </div></KitScope>
  );
}
