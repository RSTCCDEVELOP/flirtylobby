// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

export const GROUP_COLOR = { user: "var(--blue)", admin: "var(--orange)", super: "#8b5cf6", system: "#64748b", site: "#16a34a" };
export const GROUPS = ["user", "admin", "super", "system", "site"];
const GROUP_LABEL = { user: "Gebruikers", admin: "Admins", super: "Superadmins", system: "Systeem", site: "Website" };
const nf = (n, d = 0) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(n || 0);
export const num = nf;
export const money = (n, cur = "USD") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: Math.abs(n) < 1 ? 4 : 2 }).format(n || 0); } catch { return `${cur} ${nf(n, 2)}`; } };
// a price of one single token: very small, so with many decimals
export const moneyTok = (n, cur = "USD") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", minimumFractionDigits: 6, maximumFractionDigits: 10 }).format(n || 0); } catch { return `${cur} ${(n || 0).toFixed(8)}`; } };
export const short = (n) => (n >= 1e6 ? `${nf(n / 1e6, 1)}M` : n >= 1e3 ? `${nf(n / 1e3, 1)}k` : nf(n));

export function Legend({ keys = GROUPS }) {
  return <div className="ai-legend">{keys.map((g) => <span key={g}><i style={{ background: GROUP_COLOR[g] }} />{tx(GROUP_LABEL[g])}</span>)}</div>;
}

// Columns per day (or hour), stacked per group. series = { "2026-10-31": { user: {charged, calls}, ... } }; metric = which number to stack.
export function Stacked({ series, metric = "charged", format = short }) {
  const keys = Object.keys(series).sort();
  if (!keys.length) return <p className="muted">{tx("Nog geen AI-gebruik in deze periode.")}</p>;
  const W = 820, H = 240, L = 46, B = 28, T = 10, bw = (W - L) / keys.length;
  const tot = (k) => GROUPS.reduce((a, g) => a + (series[k][g]?.[metric] || 0), 0);
  const max = Math.max(...keys.map(tot), 0.0001);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ai-chart" role="img" aria-label={tx("Verloop in de tijd")}>
      {[0, .5, 1].map((f) => <g key={f}><line x1={L} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" /><text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{format(max * f)}</text></g>)}
      {keys.map((k, i) => {
        let acc = 0;
        return (
          <g key={k}>
            <title>{`${k}: ${format(tot(k))}`}</title>
            {GROUPS.map((g) => { const v = series[k][g]?.[metric] || 0; if (!v) return null; const y0 = y(acc + v), h = y(acc) - y0; acc += v; return <rect key={g} x={L + i * bw + bw * .15} y={y0} width={bw * .7} height={Math.max(1, h)} fill={GROUP_COLOR[g]} rx="2" />; })}
            {(keys.length <= 12 || i % Math.ceil(keys.length / 10) === 0) && <text x={L + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--muted)">{k.slice(keys.length > 40 || k.length > 10 ? 5 : 5, 16)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Plain columns (hours of the day, days of the week).
export function Columns({ values, labels }) {
  const max = Math.max(...values, 1);
  return (
    <div className="ai-cols" role="img" aria-label={tx("Verdeling")}>
      {values.map((v, i) => <div key={i} title={`${labels[i]}: ${nf(v)}`}><i style={{ height: `${Math.max(2, (v / max) * 100)}%` }} /><small>{labels[i]}</small></div>)}
    </div>
  );
}

// Horizontal bars: rows = [{ label, value, sub }].
export function BarList({ rows, color = "var(--blue)", format = nf }) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  if (!rows.length) return <p className="muted">{tx("Nog niets.")}</p>;
  return (
    <div className="ai-bars">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="ai-bar-top"><span title={r.label}>{r.label}</span><strong>{format(r.value)}</strong></div>
          <div className="ai-bar"><i style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: r.color || color }} /></div>
          {r.sub && <small className="muted">{r.sub}</small>}
        </div>
      ))}
    </div>
  );
}

// A ring with the share of every group: rows = [{ key, label, value }].
export function Donut({ rows, size = 160 }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <p className="muted">{tx("Nog niets.")}</p>;
  const R = 54, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="ai-donut">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={tx("Verdeling per groep")}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="18" />
        {rows.map((r) => { const len = (r.value / total) * C, el = <circle key={r.key} cx="70" cy="70" r={R} fill="none" stroke={GROUP_COLOR[r.key] || "var(--blue)"} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)"><title>{`${r.label}: ${nf(r.value)}`}</title></circle>; off += len; return el; })}
        <text x="70" y="75" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">{short(total)}</text>
      </svg>
      <ul>{rows.map((r) => <li key={r.key}><i style={{ background: GROUP_COLOR[r.key] }} />{r.label} <strong>{Math.round((r.value / total) * 100)}%</strong></li>)}</ul>
    </div>
  );
}
