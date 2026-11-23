// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, apiBase, errorText, getToken } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import LineChart from "./LineChart";

const GREEN = "#2f7d5b", SUN = "#d98f2b", SEA = "#3b82a0", PLUM = "#8a5a9e";
const METRIC = [  // key, name, unit, decimals
  ["html", "Pagina (zoals een bezoeker)", "ms", 0],
  ["api", "Backend, uit de cache", "ms", 0],
  ["db", "Backend, met de database", "ms", 0],
  ["mbps", "Downloadsnelheid", "Mbit/s", 1],
];
const DURATIONS = [30, 60, 120];

const timed = async (fn) => { const t = performance.now(); try { await fn(); return performance.now() - t; } catch { return null; } };
const avg = (a) => { const v = a.filter((x) => typeof x === "number"); return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null; };
const fmt = (v, d = 0) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : "–");
const pts = (samples, key) => samples.map((s) => (typeof s[key] === "number" ? s[key] : null));

// one measurement: the page as a visitor gets it, a cached answer of the backend, a call that asks the database (and the time the server itself needed), and a download of 256 KB
async function measure() {
  const html = await timed(async () => { await (await fetch(`/?speedtest=${Date.now()}`, { cache: "no-store" })).arrayBuffer(); });
  const apiMs = await timed(() => api("/site/"));
  let server = null;
  const db = await timed(async () => { const r = await api("/system/speedtest/ping/"); server = r.server_ms; });
  let mbps = null;
  try {
    const t = performance.now();
    const res = await fetch(`${apiBase()}/api/system/speedtest/blob/?kb=256&_=${Date.now()}`, { headers: { Authorization: `Token ${getToken()}` }, cache: "no-store" });
    const buf = await res.arrayBuffer();
    mbps = (buf.byteLength * 8) / 1e6 / Math.max(0.001, (performance.now() - t) / 1000);
  } catch { mbps = null; }
  return { html, api: apiMs, db, mbps, server };
}

function Charts({ samples }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: "1rem" }}>
      <LineChart title={tx("Pagina (zoals een bezoeker)")} unit="ms" series={[{ label: tx("Pagina"), color: GREEN, points: pts(samples, "html") }]} />
      <LineChart title={tx("Backend")} unit="ms" series={[{ label: tx("Uit de cache"), color: SEA, points: pts(samples, "api") }, { label: tx("Met database"), color: SUN, points: pts(samples, "db") }, { label: tx("Server zelf"), color: PLUM, points: pts(samples, "server") }]} decimals={0} />
      <LineChart title={tx("Downloadsnelheid")} unit="Mbit/s" series={[{ label: tx("Snelheid"), color: GREEN, points: pts(samples, "mbps") }]} decimals={1} />
      <div className="eco-panel" style={{ alignContent: "start" }}>
        <strong style={{ color: "var(--eco-deep)" }}>{tx("Samenvatting")}</strong>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ textAlign: "right", opacity: .7 }}><th style={{ textAlign: "left", fontWeight: 600 }}>{tx("Meting")}</th><th>{tx("Gem.")}</th><th>{tx("Min.")}</th><th>{tx("Max.")}</th></tr></thead>
          <tbody>
            {METRIC.map(([k, name, unit, d]) => { const v = pts(samples, k).filter((x) => typeof x === "number"); return (
              <tr key={k} style={{ textAlign: "right", borderTop: "1px solid var(--line)" }}><td style={{ textAlign: "left", padding: ".3rem 0" }}>{tx(name)} <small className="muted">{unit}</small></td><td>{fmt(avg(v), d)}</td><td>{fmt(v.length ? Math.min(...v) : null, d)}</td><td>{fmt(v.length ? Math.max(...v) : null, d)}</td></tr>
            ); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const overlay = { zIndex: 3100 };
const modal = { maxWidth: 1000, width: "100%", maxHeight: "92vh", overflowY: "auto", display: "grid", gap: "1rem", padding: "1.3rem 1.5rem" };

// The pop-up with the live speed test (Admin -> Cache en snelheid): press Start, the charts follow every second; with Opnemen on the run is kept for the analysis when it stops.
export function SpeedTestPopup({ onClose, onSaved }) {
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState([]);
  const [limit, setLimit] = useState(30);
  const [record, setRecord] = useState(true);
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState(null);
  const alive = useRef(true);
  const stopRef = useRef(false);
  useEffect(() => () => { alive.current = false; stopRef.current = true; }, []);

  const start = async () => {
    setSamples([]); setMsg(null); setRunning(true); stopRef.current = false;
    const t0 = performance.now(), got = [];
    while (alive.current && !stopRef.current && (performance.now() - t0) / 1000 < limit) {
      const tick = performance.now();
      const m = await measure();
      if (!alive.current) return;
      got.push({ t: Math.round((tick - t0) / 1000), ...m });
      setSamples([...got]);
      const wait = 1000 - (performance.now() - tick);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    if (!alive.current) return;
    setRunning(false);
    if (record && got.length >= 3) {
      try {
        const run = await api("/system/speedtest/runs/", { method: "POST", body: { label: label.trim() || `${tx("Test")} ${new Date().toLocaleString()}`, seconds: Math.round((performance.now() - t0) / 1000), samples: got } });
        setMsg({ ok: true, text: tx("De test is opgenomen. Je vindt hem onder Opnames.") });
        onSaved && onSaved(run);
      } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    }
  };
  const last = samples[samples.length - 1];
  const pct = Math.min(100, Math.round(((samples.length ? samples[samples.length - 1].t + 1 : 0) / limit) * 100));
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" style={overlay} role="dialog" aria-modal="true" aria-label={tx("Snelheidstest")} onClick={() => { if (!running) onClose(); }}>
      <div className="card modal eco" style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{tx("Snelheidstest")}</h2>
          <button type="button" className="btn" onClick={() => { stopRef.current = true; onClose(); }}>{tx("Sluiten")}</button>
        </div>
        <div className="eco-panel" style={{ display: "flex", gap: ".9rem 1.4rem", alignItems: "center", flexWrap: "wrap" }}>
          {running
            ? <button type="button" className="btn primary" onClick={() => { stopRef.current = true; }}>{tx("Stoppen")}</button>
            : <button type="button" className="btn primary" onClick={start}>{samples.length ? tx("Opnieuw starten") : tx("Starten")}</button>}
          <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", fontWeight: 600 }}>{tx("Duur")}
            <select value={limit} disabled={running} onChange={(e) => setLimit(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d} value={d}>{d} {tx("seconden")}</option>)}</select>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: ".6rem", fontWeight: 600, cursor: "pointer" }}>
            <span className="switch"><input type="checkbox" checked={record} disabled={running} onChange={(e) => setRecord(e.target.checked)} /><span /></span>{tx("Opnemen voor analyse")}
          </label>
          {record && <input value={label} disabled={running} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder={tx("Naam van de opname (bijvoorbeeld: met paginacache)")} aria-label={tx("Naam van de opname")} style={{ flex: "1 1 240px", minWidth: 0 }} />}
          <div style={{ flex: "1 1 100%", height: 6, borderRadius: 99, background: "color-mix(in srgb, var(--eco-leaf, #7cc59a) 25%, transparent)", overflow: "hidden" }} aria-hidden="true"><div style={{ width: `${pct}%`, height: "100%", background: "var(--eco-green, #2f7d5b)", transition: "width .3s" }} /></div>
        </div>
        {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
        <div className="eco-tiles">
          {METRIC.map(([k, name, unit, d], i) => (
            <div key={k} className={`eco-tile ${["t-green", "t-sea", "t-sun", "t-sand"][i]}`}>
              <span>{tx(name)}</span>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(last?.[k], d)}<small style={{ fontSize: ".9rem", fontWeight: 500 }}> {unit}</small></strong>
              <small>{tx("gemiddeld")} {fmt(avg(pts(samples, k)), d)} {unit}</small>
            </div>
          ))}
        </div>
        {samples.length ? <Charts samples={samples} /> : <p className="muted" style={{ margin: 0 }}>{tx("Druk op Starten. Elke seconde meten we hoe snel de pagina, de backend, de database en de download zijn; de grafieken lopen live mee.")}</p>}
      </div>
    </div>, document.body);
}

// The recorded runs (the analysis) of the speed test, with the charts of one run in a pop-up and the change against the run before it.
export function SpeedRuns({ refreshKey }) {
  const [runs, setRuns] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("/system/speedtest/runs/").then((r) => setRuns(r.runs)).catch((e) => setErr(errorText(e)));
  useEffect(() => { load(); }, [refreshKey]);  // eslint-disable-line react-hooks/exhaustive-deps
  const view = async (id) => { try { setOpen(await api(`/system/speedtest/runs/${id}/`)); } catch (e) { setErr(errorText(e)); } };
  const remove = async (r) => {
    if (!(await confirmDialog(tx("Deze opname verwijderen?"), { title: tx("Opname verwijderen"), okLabel: tx("Verwijderen"), danger: true }))) return;
    try { await api(`/system/speedtest/runs/${r.id}/`, { method: "DELETE" }); load(); } catch (e) { setErr(errorText(e)); }
  };
  if (err) return <div className="alert">{err}</div>;
  if (!runs) return null;
  return (
    <div className="eco-panel" style={{ marginTop: "1rem" }}>
      <strong style={{ color: "var(--eco-deep)" }}>{tx("Opnames")}</strong>
      {!runs.length ? <small className="muted">{tx("Er zijn nog geen opnames. Start een snelheidstest met Opnemen aan.")}</small> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem", fontVariantNumeric: "tabular-nums" }}>
            <thead><tr style={{ textAlign: "right", opacity: .7 }}><th style={{ textAlign: "left" }}>{tx("Opname")}</th><th>{tx("Pagina")} ms</th><th>{tx("Cache")} ms</th><th>{tx("Database")} ms</th><th>Mbit/s</th><th style={{ textAlign: "left", paddingLeft: ".8rem" }}>{tx("Cache-instelling")}</th><th /></tr></thead>
            <tbody>
              {runs.map((r, i) => {
                const prev = runs[i + 1], a = r.summary?.html?.avg, b = prev?.summary?.html?.avg;
                const d = a && b ? Math.round(((a - b) / b) * 100) : null;
                return (
                  <tr key={r.id} style={{ textAlign: "right", borderTop: "1px solid var(--line)" }}>
                    <td style={{ textAlign: "left", padding: ".4rem 0" }}><strong>{r.label || `#${r.id}`}</strong><br /><small className="muted">{new Date(r.created_at).toLocaleString()} · {r.seconds} s{r.by ? ` · ${r.by}` : ""}</small></td>
                    <td>{fmt(a)}{d !== null && <small style={{ marginLeft: ".3rem", color: d <= 0 ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)" }}>{d > 0 ? "+" : ""}{d}%</small>}</td>
                    <td>{fmt(r.summary?.api?.avg)}</td><td>{fmt(r.summary?.db?.avg)}</td><td>{fmt(r.summary?.mbps?.avg, 1)}</td>
                    <td style={{ textAlign: "left", paddingLeft: ".8rem" }}><small>{r.settings?.page_cache ? `${tx("Paginacache aan")} ${r.settings.page_cache_seconds}s` : tx("Paginacache uit")} · {r.settings?.system_cache ? `${tx("Cache aan")} ${r.settings.system_cache_seconds}s` : tx("Cache uit")}</small></td>
                    <td style={{ whiteSpace: "nowrap" }}><button type="button" className="btn sm" onClick={() => view(r.id)}>{tx("Bekijken")}</button> <button type="button" className="btn sm danger" onClick={() => remove(r)}>{tx("Verwijderen")}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && typeof document !== "undefined" && createPortal(
        <div className="overlay" style={overlay} role="dialog" aria-modal="true" aria-label={open.label} onClick={() => setOpen(null)}>
          <div className="card modal eco" style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div><h2 style={{ margin: 0 }}>{open.label || `#${open.id}`}</h2><small className="muted">{new Date(open.created_at).toLocaleString()} · {open.seconds} s · {open.host}</small></div>
              <button type="button" className="btn" onClick={() => setOpen(null)}>{tx("Sluiten")}</button>
            </div>
            <Charts samples={open.samples || []} />
          </div>
        </div>, document.body)}
    </div>
  );
}
