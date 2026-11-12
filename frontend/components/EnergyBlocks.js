// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { useSession } from "./Session";

const nf = (n, d = 0) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n); } catch { return String(n); } };
export const fmtBytes = (b) => (b >= 1e6 ? `${nf(b / 1e6, 2)} MB` : b >= 1e3 ? `${nf(b / 1e3, 0)} KB` : `${nf(b)} B`);
export const fmtG = (g) => (g >= 100 ? `${nf(g, 0)} g` : g >= 1 ? `${nf(g, 2)} g` : `${nf(g, 3)} g`);
export const fmtKg = (kg) => (kg >= 1 ? `${nf(kg, 2)} kg` : `${nf(kg * 1000, 1)} g`);
export const fmtN = (n) => nf(n, 0);
const dayLabel = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }); } catch { return iso; } };
const pathName = (p) => (p === "/" ? tx("Startpagina") : p);

export const RATING_COLOR = { "A+": "#15803d", A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", E: "#ef4444", F: "#b91c1c" };
const RATING_INK = { B: "#14210a", C: "#2a2103" };
export const RATING_MAX = [["A+", "≤ 0,095 g"], ["A", "≤ 0,186 g"], ["B", "≤ 0,341 g"], ["C", "≤ 0,493 g"], ["D", "≤ 0,656 g"], ["E", "≤ 0,846 g"], ["F", "> 0,846 g"]];

// The data of the blocks: this website's own figures (every block on the page shares one request per period)
const cache = {};
export function useEnergy(days = 30, url = "/energy/view/") {
  const key = `${url}?${days}`;
  const [d, setD] = useState(cache[key]?.data || null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (cache[key] && Date.now() - cache[key].at < 60000) { setD(cache[key].data); return; }
    let live = true;
    api(`${url}?days=${days}`).then((r) => { cache[key] = { at: Date.now(), data: r }; if (live) setD(r); }).catch(() => live && setErr(true));
    return () => { live = false; };
  }, [key, days, url]);
  return { d, err };
}
export const resetEnergy = () => { Object.keys(cache).forEach((k) => delete cache[k]); };

export function Rating({ r, size = 44 }) {
  if (!r) return null;
  return <span aria-label={`${tx("Label")} ${r}`} style={{ display: "inline-grid", placeItems: "center", width: size, height: size, borderRadius: size / 4.5, background: RATING_COLOR[r], color: RATING_INK[r] || "#fff", fontWeight: 800, fontSize: size * 0.42, flex: "none", boxShadow: "inset 0 -3px 0 rgba(0,0,0,.18)" }}>{r}</span>;
}

// A line with a soft area under it. points: [{x, y}], x are labels.
export function LineChart({ points, format = fmtN, height = 150, color = "var(--blue)", label }) {
  if (!points?.length) return <div className="muted" style={{ padding: "1.4rem 0", textAlign: "center" }}>{tx("Nog geen gegevens")}</div>;
  const W = 520, H = height, L = 44, R = 10, T = 12, B = 22;
  const max = Math.max(...points.map((p) => p.y), 1e-9) * 1.1, min = 0;
  const X = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const Y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${X(points.length - 1).toFixed(1)},${H - B} L${X(0).toFixed(1)},${H - B} Z`;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const idx = points.length <= 2 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="currentColor" strokeOpacity=".12" /><text x={L - 6} y={Y(t) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity=".6">{format(t)}</text></g>)}
      <path d={area} fill={color} opacity=".14" /><path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {points.length <= 40 && points.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.y)} r="2.6" fill={color}><title>{`${p.x}: ${format(p.y)}`}</title></circle>)}
      {idx.map((i) => <text key={i} x={X(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10" fill="currentColor" opacity=".6">{points[i].x}</text>)}
    </svg>
  );
}

const Tile = ({ label, value, sub, extra }) => (
  <div className="card stat" style={{ display: "flex", flexDirection: "column", gap: ".25rem", padding: "1rem 1.1rem" }}>
    <span className="muted" style={{ fontSize: ".8rem" }}>{label}</span>
    <span style={{ display: "flex", alignItems: "center", gap: ".6rem" }}><strong style={{ fontSize: "1.65rem", lineHeight: 1.1 }}>{value}</strong>{extra}</span>
    {sub && <small className="muted">{sub}</small>}
  </div>
);

const sourceNote = (d) => (d.source === "visitors" ? tx("Gemeten in de browsers van bezoekers") : d.source === "scan" ? tx("Gemeten met een scan van de pagina's door de server") : tx("Nog niet gemeten"));
const Empty = () => <div className="card muted" style={{ textAlign: "center", padding: "1.6rem" }}>{tx("Er zijn nog geen metingen. De eerste paginabezoeken worden vanzelf gemeten.")}</div>;

function Kpis({ d }) {
  const s = d.summary;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: ".8rem" }}>
      <Tile label={tx("Paginagewicht")} value={fmtBytes(s.avg_page_bytes)} sub={tx("gemiddeld per pagina")} />
      <Tile label={tx("Verzoeken per pagina")} value={nf(s.avg_requests, 1)} sub={tx("bestanden die de pagina laadt")} />
      <Tile label={tx("Uitstoot per paginabezoek")} value={fmtG(s.avg_co2_g)} extra={<Rating r={s.rating} size={34} />} sub={tx("geschat, CO2")} />
      <Tile label={`${tx("Totaal")} (${d.period_days} ${tx("dagen")})`} value={fmtKg(s.total_co2_kg)} sub={`${fmtN(s.views)} ${tx("paginabezoeken")} · ${nf(s.total_kwh, 3)} kWh`} />
    </div>
  );
}

function Trend({ d }) {
  const pts = d.series || [];
  return (
    <div className="card" style={{ display: "grid", gap: ".9rem", padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.2rem" }}>
        <div><strong style={{ fontSize: ".9rem" }}>{tx("Paginagewicht per bezoek")}</strong><LineChart points={pts.map((p) => ({ x: dayLabel(p.date), y: p.avg_bytes }))} format={fmtBytes} label={tx("Paginagewicht per bezoek")} /></div>
        <div><strong style={{ fontSize: ".9rem" }}>{tx("Uitstoot per paginabezoek")}</strong><LineChart points={pts.map((p) => ({ x: dayLabel(p.date), y: p.avg_co2_g }))} format={fmtG} color="#16a34a" label={tx("Uitstoot per paginabezoek")} /></div>
      </div>
    </div>
  );
}

function PageBars({ rows, bench, total }) {
  const max = Math.max(...rows.map((r) => r.bytes), bench, 1);
  return (
    <div style={{ display: "grid", gap: ".65rem" }}>
      {rows.map((r) => (
        <div key={r.path} style={{ display: "grid", gridTemplateColumns: "minmax(80px, 170px) 1fr auto", gap: ".7rem", alignItems: "center" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.path}>{pathName(r.path)}{total && <small className="muted"> · {fmtN(r.views)}×</small>}</span>
          <span style={{ position: "relative", height: 14, background: "var(--line)", borderRadius: 99 }}>
            <i style={{ position: "absolute", inset: 0, width: `${Math.max(2, (r.bytes / max) * 100)}%`, background: "var(--blue)", borderRadius: 99 }} />
            <i title={tx("Gemiddelde webpagina")} style={{ position: "absolute", top: -3, bottom: -3, left: `${(bench / max) * 100}%`, width: 2, background: "currentColor", opacity: .55 }} />
          </span>
          <small style={{ whiteSpace: "nowrap" }}><b>{fmtBytes(r.bytes)}</b> · {fmtN(r.requests)} {tx("verz.")} · {fmtG(r.co2)}</small>
        </div>
      ))}
    </div>
  );
}

function Pages({ d }) {
  const vis = (d.pages || []).map((p) => ({ path: p.path, bytes: p.avg_bytes, requests: p.avg_requests, co2: p.avg_co2_g, views: p.views }));
  const scan = (d.scans || []).map((s) => ({ path: s.path, bytes: s.bytes, requests: s.requests, co2: s.co2_g }));
  if (!vis.length && !scan.length) return <Empty />;
  return (
    <div className="card" style={{ display: "grid", gap: "1.1rem", padding: "1.1rem 1.2rem" }}>
      {vis.length > 0 && <div style={{ display: "grid", gap: ".6rem" }}><strong style={{ fontSize: ".9rem" }}>{tx("Gewicht per pagina (bezoekers)")}</strong><PageBars rows={vis} bench={d.benchmark.page_bytes} total /></div>}
      {scan.length > 0 && <div style={{ display: "grid", gap: ".6rem" }}><strong style={{ fontSize: ".9rem" }}>{vis.length ? tx("Gewicht per pagina (scan door de server)") : tx("Gewicht per pagina")}</strong><PageBars rows={scan} bench={d.benchmark.page_bytes} /></div>}
      <small className="muted">{tx("De streep is een gemiddelde webpagina.")}</small>
    </div>
  );
}

function Compare({ d }) {
  const s = d.summary, b = d.benchmark, max = Math.max(s.avg_page_bytes, b.page_bytes, 1);
  const pct = b.vs_pct;
  return (
    <div className="card" style={{ display: "grid", gap: "1rem", padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".9rem", flexWrap: "wrap" }}>
        <Rating r={s.rating} size={56} />
        <div style={{ flex: 1, minWidth: 200 }}><strong style={{ fontSize: "1.1rem" }}>{pct <= 0 ? `${Math.abs(pct)}% ${tx("lichter dan een gemiddelde webpagina")}` : `${pct}% ${tx("zwaarder dan een gemiddelde webpagina")}`}</strong>
          <small className="muted" style={{ display: "block" }}>{tx("Gemiddelde webpagina")}: {fmtBytes(b.page_bytes)} · {fmtG(b.co2_g)} {tx("per bezoek")}</small></div>
      </div>
      {[[tx("Deze website"), s.avg_page_bytes, "var(--blue)", fmtG(s.avg_co2_g)], [tx("Gemiddelde webpagina"), b.page_bytes, "#94a3b8", fmtG(b.co2_g)]].map(([l, v, c, g]) => (
        <div key={l} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 160px) 1fr auto", gap: ".7rem", alignItems: "center" }}>
          <span>{l}</span><span style={{ height: 16, background: "var(--line)", borderRadius: 99 }}><i style={{ display: "block", height: "100%", width: `${Math.max(2, (v / max) * 100)}%`, background: c, borderRadius: 99 }} /></span>
          <small style={{ whiteSpace: "nowrap" }}><b>{fmtBytes(v)}</b> · {g}</small>
        </div>
      ))}
      <div style={{ display: "flex", gap: 3 }} aria-hidden>{RATING_MAX.map(([r]) => <span key={r} style={{ flex: 1, height: 8, borderRadius: 4, background: RATING_COLOR[r], opacity: r === s.rating ? 1 : .35, outline: r === s.rating ? "2px solid currentColor" : "none", outlineOffset: 1 }} />)}</div>
    </div>
  );
}

function Badge({ d }) {
  const s = d.summary;
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: ".9rem", padding: ".8rem 1rem", width: "fit-content", maxWidth: "100%" }}>
      <Rating r={s.rating} size={52} />
      <div><strong style={{ display: "block", fontSize: "1.05rem" }}>{fmtG(s.avg_co2_g)} {tx("CO2 per paginabezoek")}</strong><small className="muted">{fmtBytes(s.avg_page_bytes)} · {nf(s.avg_requests, 0)} {tx("verzoeken")}</small></div>
    </div>
  );
}

function Method({ d }) {
  const m = d.model;
  return (
    <div className="card muted" style={{ fontSize: ".85rem", display: "grid", gap: ".35rem", padding: "1rem 1.2rem" }}>
      <strong style={{ color: "var(--text)" }}>{tx("Zo rekenen we")}</strong>
      <span>{tx("Elke pagina meten we aan de hand van alle data die over het netwerk komt (het paginagewicht) en het aantal bestanden dat wordt opgehaald (verzoeken). Uit het gewicht schatten we de energie van de hele keten: servers, netwerk en apparaat.")}</span>
      <span>{tx("Model")}: {m.method} · {nf(m.kwh_per_gb, 2)} kWh {tx("per GB")} · {nf(m.g_per_kwh, 0)} g CO2 {tx("per kWh")}. {sourceNote(d)}. {tx("Het zijn schattingen, bedoeld om te vergelijken en te verbeteren.")}</span>
    </div>
  );
}

function Network({ n }) {
  const t = n.totals;
  return (
    <div style={{ display: "grid", gap: ".9rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".7rem", flexWrap: "wrap" }}><strong style={{ fontSize: "1.15rem" }}>{n.title}</strong><span className="badge">{t.sites_ok} / {t.sites} {tx("websites")}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: ".8rem" }}>
        <Tile label={tx("Paginagewicht")} value={fmtBytes(t.avg_page_bytes)} sub={tx("gemiddeld, alle websites")} />
        <Tile label={tx("Verzoeken per pagina")} value={nf(t.avg_requests, 1)} sub={tx("gemiddeld")} />
        <Tile label={tx("Uitstoot per paginabezoek")} value={fmtG(t.avg_co2_g)} extra={<Rating r={t.rating} size={34} />} sub={tx("gemiddeld, geschat")} />
        <Tile label={tx("Totaal")} value={fmtKg(t.total_co2_kg)} sub={`${fmtN(t.views)} ${tx("paginabezoeken")} · ${nf(t.total_kwh, 3)} kWh`} />
      </div>
      <Trend d={{ series: n.series }} />
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap"><table>
          <thead><tr><th>{tx("Website")}</th><th>{tx("Paginagewicht")}</th><th>{tx("Verzoeken")}</th><th>{tx("Uitstoot per bezoek")}</th><th>{tx("Bezoeken")}</th><th>{tx("Label")}</th></tr></thead>
          <tbody>{n.sites.map((s) => <tr key={s.name + (s.url || "")}><td><strong>{s.name}</strong>{s.own && <small className="muted"> · {tx("deze website")}</small>}{s.error && <small style={{ display: "block", color: "var(--danger)" }}>{s.error}</small>}</td>
            <td>{s.ok ? fmtBytes(s.summary.avg_page_bytes || 0) : "—"}</td><td>{s.ok ? nf(s.summary.avg_requests || 0, 1) : "—"}</td><td>{s.ok ? fmtG(s.summary.avg_co2_g || 0) : "—"}</td><td>{s.ok ? fmtN(s.summary.views || 0) : "—"}</td><td>{s.ok && s.summary.rating ? <Rating r={s.summary.rating} size={26} /> : ""}</td></tr>)}</tbody>
        </table></div>
      </div>
    </div>
  );
}

export const NetworkView = Network;

// The system object Energie: one block with a layout (kpis, trend, pages, compare, badge, overview or network).
export default function EnergyBlock({ layout = "overview", days = 30 }) {
  const { editing } = useSession();
  const net = layout === "network";
  const { d, err } = useEnergy(days, net ? "/energy/network/" : "/energy/view/");
  if (err) return net && editing ? <div className="card muted">{tx("Het totaalbeeld is nog niet gepubliceerd (Super admin → Energie).")}</div> : null;
  if (!d) return <div className="card muted">{tx("Laden…")}</div>;
  if (net) return <Network n={d} />;
  const none = d.source === "none";
  if (layout === "badge") return none ? <Empty /> : <Badge d={d} />;
  if (none) return <Empty />;
  const parts = {
    kpis: <Kpis d={d} />, trend: <Trend d={d} />, pages: <Pages d={d} />, compare: <Compare d={d} />,
    overview: <div style={{ display: "grid", gap: ".9rem" }}><Kpis d={d} /><Trend d={d} /><Compare d={d} /><Pages d={d} /><Method d={d} /></div>,
  };
  return parts[layout] || parts.overview;
}
