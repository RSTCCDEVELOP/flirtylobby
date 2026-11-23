// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { SPEED_DURATIONS, speed, useSpeed } from "../lib/speedStore";
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

const durLabel = (d) => (d === 0 ? tx("Tot ik uitlog") : d < 120 ? `${d} ${tx("seconden")}` : d < 3600 ? `${d / 60} ${tx("minuten")}` : `${d / 3600} ${tx("uur")}`);
const avg = (a) => { const v = a.filter((x) => typeof x === "number"); return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null; };
const fmt = (v, d = 0) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : "–");
const pts = (samples, key) => samples.map((s) => (typeof s[key] === "number" ? s[key] : null));

function Charts({ samples }) {
  const span = samples.length ? samples[samples.length - 1].t : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: "1rem" }}>
      <LineChart span={span} title={tx("Pagina (zoals een bezoeker)")} unit="ms" series={[{ label: tx("Pagina"), color: GREEN, points: pts(samples, "html") }]} />
      <LineChart span={span} title={tx("Backend")} unit="ms" series={[{ label: tx("Uit de cache"), color: SEA, points: pts(samples, "api") }, { label: tx("Met database"), color: SUN, points: pts(samples, "db") }, { label: tx("Server zelf"), color: PLUM, points: pts(samples, "server") }]} decimals={0} />
      <LineChart span={span} title={tx("Downloadsnelheid")} unit="Mbit/s" series={[{ label: tx("Snelheid"), color: GREEN, points: pts(samples, "mbps") }]} decimals={1} />
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

// The floating window of the speed test (Admin -> Cache en snelheid -> Snelheidstest starten): no dark layer, the page behind it stays usable; the test keeps measuring while you go to other pages.
// With the arrow (›) the window slides away to a small tab on the right edge (with the live number); the tab brings it back.
export function SpeedTestDock() {
  const S = useSpeed();
  if (!S.open || typeof document === "undefined") return null;
  const last = S.samples[S.samples.length - 1];
  const pct = S.limit === 0 ? (S.running ? 100 : 0) : Math.min(100, Math.round(((S.samples.length ? S.samples[S.samples.length - 1].t + 1 : 0) / S.limit) * 100));
  if (S.collapsed) {
    return createPortal(
      <button type="button" onClick={() => speed.set({ collapsed: false })} aria-label={tx("Snelheidstest openen")} title={tx("Snelheidstest openen")}
        style={{ position: "fixed", right: 0, bottom: "7rem", zIndex: 3090, display: "flex", alignItems: "center", gap: ".5rem", padding: ".6rem .8rem .6rem .6rem", border: "1px solid var(--eco-green, #2f7d5b)", borderRight: 0, borderRadius: "14px 0 0 14px", background: "var(--eco-green, #2f7d5b)", color: "#fff", cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,.25)", font: "inherit" }}>
        <span aria-hidden="true" style={{ fontSize: "1.2rem", lineHeight: 1 }}>‹</span>
        <span style={{ display: "grid", textAlign: "left", lineHeight: 1.15 }}>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{S.running ? `${fmt(last?.html)} ms` : tx("Snelheid")}</strong>
          <small style={{ opacity: .85 }}>{S.running ? `${pct}%` : S.samples.length ? tx("klaar") : tx("gestopt")}</small>
        </span>
        {S.running && <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.2s infinite" }} />}
      </button>, document.body);
  }
  return createPortal(
    <div className="card eco" role="dialog" aria-label={tx("Snelheidstest")} style={{ position: "fixed", right: "1rem", bottom: "1rem", zIndex: 3090, width: "min(620px, calc(100vw - 2rem))", maxHeight: "86vh", overflowY: "auto", display: "grid", gap: ".8rem", padding: "1rem 1.1rem", boxShadow: "0 14px 44px rgba(0,0,0,.32)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".6rem" }}>
        <strong style={{ fontSize: "1.05rem" }}>{tx("Snelheidstest")}{S.running ? <small className="muted" style={{ marginLeft: ".5rem" }}>{tx("meet…")}</small> : null}</strong>
        <span style={{ display: "inline-flex", gap: ".4rem" }}>
          <button type="button" className="btn sm" onClick={() => speed.set({ collapsed: true })} aria-label={tx("Naar de rand schuiven")} title={tx("Naar de rand schuiven: de test blijft meten")}>›</button>
          <button type="button" className="btn sm" onClick={() => speed.closePanel()} aria-label={tx("Sluiten")} title={S.running ? tx("Sluiten stopt de test") : tx("Sluiten")}>×</button>
        </span>
      </div>
      <div className="eco-panel" style={{ display: "flex", gap: ".7rem 1.2rem", alignItems: "center", flexWrap: "wrap", padding: ".8rem .9rem" }}>
        {S.running
          ? <button type="button" className="btn primary" onClick={() => speed.stop()}>{tx("Stoppen")}</button>
          : <button type="button" className="btn primary" onClick={() => speed.start()}>{S.samples.length ? tx("Opnieuw starten") : tx("Starten")}</button>}
        <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", fontWeight: 600 }}>{tx("Duur")}
          <select value={S.limit} disabled={S.running} onChange={(e) => speed.set({ limit: Number(e.target.value) })}>{SPEED_DURATIONS.map(([d, every]) => <option key={d} value={d}>{durLabel(d)}</option>)}</select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: ".6rem", fontWeight: 600, cursor: "pointer" }}>
          <span className="switch"><input type="checkbox" checked={S.record} disabled={S.running} onChange={(e) => speed.set({ record: e.target.checked })} /><span /></span>{tx("Opnemen voor analyse")}
        </label>
        {S.record && <input value={S.label} disabled={S.running} onChange={(e) => speed.set({ label: e.target.value })} maxLength={120} placeholder={tx("Naam van de opname (bijvoorbeeld: met paginacache)")} aria-label={tx("Naam van de opname")} style={{ flex: "1 1 220px", minWidth: 0 }} />}
        <div style={{ flex: "1 1 100%", height: 6, borderRadius: 99, background: "color-mix(in srgb, var(--eco-leaf, #7cc59a) 25%, transparent)", overflow: "hidden" }} aria-hidden="true"><div style={{ width: `${pct}%`, height: "100%", background: "var(--eco-green, #2f7d5b)", transition: "width .3s" }} /></div>
      </div>
      {(S.limit === 0 || S.limit > 120) && <small className="muted">{tx("Een lange test meet minder vaak ({0} s) en wordt tussendoor bewaard. Hij stopt als je op Stoppen drukt of uitlogt.", (SPEED_DURATIONS.find((d) => d[0] === S.limit) || [0, 10])[1])}</small>}
      {S.msg && <div className={S.msg.ok ? "alert ok" : "alert"} role="status">{S.msg.text}</div>}
      <div className="eco-tiles" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {METRIC.map(([k, name, unit, d], i) => (
          <div key={k} className={`eco-tile ${["t-green", "t-sea", "t-sun", "t-sand"][i]}`} style={{ padding: ".7rem .8rem" }}>
            <span style={{ paddingRight: 0 }}>{tx(name)}</span>
            <strong style={{ fontSize: "1.5rem", fontVariantNumeric: "tabular-nums" }}>{fmt(last?.[k], d)}<small style={{ fontSize: ".8rem", fontWeight: 500 }}> {unit}</small></strong>
            <small>{tx("gem.")} {fmt(avg(pts(S.samples, k)), d)} {unit}</small>
          </div>
        ))}
      </div>
      {S.samples.length ? <Charts samples={S.samples} /> : <p className="muted" style={{ margin: 0 }}>{tx("Druk op Starten. Elke seconde meten we hoe snel de pagina, de backend, de database en de download zijn. Met › schuif je het venster naar de rand: de test blijft meten terwijl je verder surft.")}</p>}
    </div>, document.body);
}

// The recorded runs (the analysis) of the speed test, with the charts of one run in a pop-up and the change against the run before it.
export function SpeedRuns({ refreshKey }) {
  const [runs, setRuns] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("/system/speedtest/runs/").then((r) => setRuns(r.runs)).catch((e) => setErr(errorText(e)));
  useEffect(() => { load(); }, [refreshKey]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => load(); window.addEventListener("speedrun-saved", f); return () => window.removeEventListener("speedrun-saved", f); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
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
