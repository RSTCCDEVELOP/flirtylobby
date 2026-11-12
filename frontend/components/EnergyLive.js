// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { LineChart } from "./EnergyBlocks";
import { IconCheck } from "./Icons";
import { useSession } from "./Session";

const nf = (n, d = 1) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n); } catch { return String(n); } };
const hm = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

// The Green tab of Info: a small live graph of the estimated electricity use of the page views (it updates by itself), and the address of the API for the main portal.
export default function EnergyLive() {
  const { user } = useSession();
  const [hours, setHours] = useState(3);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => api(`/energy/live/?hours=${hours}`).then((r) => { setD(r); setErr(false); }).catch(() => setErr(true)), [hours]);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 10000); // live: every 10 seconds, not while the tab is hidden
    return () => clearInterval(t);
  }, [load]);
  if (err && !d) return <p className="muted">{tx("De energiegegevens zijn niet beschikbaar.")}</p>;
  if (!d) return <p className="muted">{tx("Laden…")}</p>;
  const pts = d.points.map((p) => ({ x: hm(p.t), y: p.w }));
  const copy = async () => { try { await navigator.clipboard.writeText(d.api.url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* no clipboard */ } };
  return (
    <div style={{ display: "grid", gap: ".9rem" }}>
      <style>{"@keyframes eglive{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}100%{box-shadow:0 0 0 8px rgba(34,197,94,0)}}"}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}>
          <i aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", animation: "eglive 1.6s ease-out infinite", display: "inline-block" }} />
          <strong>{tx("Geschat stroomgebruik")}</strong><small className="muted">{tx("live")}</small>
        </span>
        <span className="pb-seg">{[[3, "3 uur"], [24, "24 uur"]].map(([h, l]) => <button type="button" key={h} className={hours === h ? "on" : ""} onClick={() => setHours(h)}>{tx(l)}</button>)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: ".6rem", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{nf(d.now.w, d.now.w < 10 ? 2 : 1)} W</strong>
        <small className="muted">{tx("gemiddeld, laatste 30 minuten")}</small>
      </div>
      <div className="card" style={{ padding: ".6rem .8rem .4rem", boxShadow: "none" }}>
        <LineChart points={pts} height={120} color="#16a34a" format={(v) => `${nf(v, v < 10 ? 1 : 0)} W`} label={tx("Geschat stroomgebruik")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: ".5rem", textAlign: "center" }}>
        {[[tx("Energie"), `${nf(d.now.wh, 2)} Wh`], [tx("Paginabezoeken"), nf(d.now.views, 0)], ["CO2", `${nf(d.now.co2_g, 2)} g`]].map(([l, v]) => <div key={l} className="card" style={{ padding: ".5rem", boxShadow: "none" }}><small className="muted" style={{ display: "block" }}>{l} ({hours} {tx("uur")})</small><strong>{v}</strong></div>)}
      </div>
      <small className="muted">{tx("Geschat uit de data die bezoekers laden (")}{nf(d.model.kwh_per_gb, 2)} kWh {tx("per GB")}). {tx("Het is een schatting voor het hele pad: servers, netwerk en apparaat.")}</small>
      <div className="card" style={{ display: "grid", gap: ".5rem", boxShadow: "none" }}>
        <span style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}><strong>{tx("API voor de hoofdportal")}</strong>
          <span className={d.api.enabled ? "badge ok" : "badge off"}>{d.api.enabled ? tx("Aan") : tx("Uit")}</span>{d.api.key_required && <span className="badge">{tx("sleutel nodig")}</span>}</span>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <code style={{ flex: 1, minWidth: 220, padding: ".5rem .7rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, overflowWrap: "anywhere", fontSize: ".8rem" }}>{d.api.url}</code>
          <button type="button" className="btn sm" onClick={copy}>{copied ? <><IconCheck /> {tx("Gekopieerd")}</> : tx("Kopiëren")}</button>
        </div>
        <small className="muted">{tx("Geef dit adres door aan de hoofdportal: bij Super admin → Energie: totaalbeeld → Websites koppel je deze website.")}{d.api.key_required ? ` ${tx("De portal heeft ook de sleutel nodig.")}` : ""}{!d.api.enabled ? ` ${tx("De API staat uit.")}` : ""}</small>
        {user?.is_staff && <Link href="/dashboard/superadmin/energy-instellingen" className="btn sm" style={{ justifySelf: "start" }}>{tx("Instellingen en sleutel")}</Link>}
      </div>
    </div>
  );
}
