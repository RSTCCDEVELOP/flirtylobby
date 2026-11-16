// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import KitScope from "../../../../lib/ui-kit/KitScope";
import { useUpdates } from "../../../../lib/updates";
import Tabs from "../../../../components/Tabs";
import { BarList, Columns, Donut, GROUPS, Kpi, KpiGrid, Legend, Stacked, money, num, short } from "../../../../components/AiCharts";

const PERIODS = [["day", "Laatste 24 uur"], ["week", "Laatste 7 dagen"], ["month", "Laatste 30 dagen"], ["quarter", "Laatste 90 dagen"], ["year", "Laatste jaar"]];
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

// AI costs for the admin: the live view of every request, the overview (today, month, year, expectation) and the statistics. Only what is charged (margin included), never the purchase price.
export default function AiKosten() {
  const [tab, setTab] = useState("live");
  const [msg, setMsg] = useState(null);
  const fail = (e) => setMsg({ ok: false, text: errorText(e) });
  return (
    <>
      <h1>{tx("AI-kosten")}</h1>
      <p className="muted">{tx("Wat de AI kost, live per verzoek, in overzichten en in statistieken. Alles in de valuta van de website en inclusief marge.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["live", "Live"], ["overview", "Overzicht"], ["stats", "Statistieken"]]} />
      <KitScope bridge className="stack">
        {tab === "live" && <Live fail={fail} />}
        {tab === "overview" && <Overview fail={fail} />}
        {tab === "stats" && <Stats fail={fail} />}
      </KitScope>
    </>
  );
}

function Live({ fail }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ currency: "EUR", super: false });
  const [sums, setSums] = useState(null);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState({});
  const [flash, setFlash] = useState(0);
  const [running, setRunning] = useState([]);
  const last = useRef(0);
  const poll = useCallback(async () => {
    try {
      const d = await api(`/admin/ai/live/${last.current ? `?after=${last.current}` : ""}`);
      setMeta({ currency: d.currency, super: d.super });
      if (d.today) setSums({ today: d.today, month: d.month });
      setRunning(d.running || []);
      if (d.top > last.current) last.current = d.top;
      if (d.rows.length) { setRows((cur) => [...d.rows, ...cur].slice(0, 300)); setFlash(d.rows[0].id); }
    } catch (e) { fail(e); }
  }, [fail]);
  useUpdates("ai-live-page", poll, 1500, null, !paused, { live: true });
  const m = (n) => money(n, meta.currency);
  const busyCost = running.reduce((a, r) => a + (r.charged || 0), 0);
  const total = rows.reduce((a, r) => a + (r.charged || 0), 0) + busyCost;
  const tokens = rows.reduce((a, r) => a + r.tokens_in + r.tokens_out, 0);
  return (
    <div className="ai-wrap">
      <KpiGrid>
        <Kpi accent label={tx("In deze lijst")} value={m(total)} sub={`${rows.length} ${tx("verzoeken")} · ${short(tokens)} ${tx("tokens")}`} />
        <Kpi label={tx("Vandaag")} value={sums ? m(sums.today.charged + busyCost) : "—"} sub={sums ? `${sums.today.calls} ${tx("verzoeken")}` : ""} />
        <Kpi label={tx("Deze maand")} value={sums ? m(sums.month.charged + busyCost) : "—"} sub={sums ? `${sums.month.calls} ${tx("verzoeken")}` : ""} />
      </KpiGrid>
      <div className={`e2e-live${paused ? " is-paused" : ""}`} data-easy2edit-tag="ui-live-feed">
        <header className="e2e-live__head">
          <i className="e2e-live__dot" aria-hidden="true" />
          <b>{paused ? tx("Gepauzeerd") : tx("Live: elk verzoek verschijnt hier direct")}</b>
          <span className="e2e-live__tools">
            <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => setPaused((p) => !p)}>{paused ? tx("Hervatten") : tx("Pauzeren")}</button>
            <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => setRows([])}>{tx("Wissen")}</button>
          </span>
        </header>
        <div className="e2e-table-wrap">
          <table className="e2e-table">
            <thead><tr><th>{tx("Tijd")}</th><th>{tx("Waarvoor")}</th><th>{tx("Wie")}</th><th>{tx("Model")}</th><th>{tx("Tokens")}</th><th>{tx("Duur")}</th><th className="e2e-num">{tx("Kosten")}</th></tr></thead>
            <tbody>
              {running.map((r) => (
                <tr key={r.id} className="is-new">
                  <td><i className="e2e-live__dot is-busy" aria-hidden="true" style={{ display: "inline-block" }} /> {tx("bezig")}</td>
                  <td><strong>{r.source || tx("Onbekend")}</strong></td><td>{r.user || "—"}</td><td><small>{r.model || "—"}</small></td>
                  <td style={{ whiteSpace: "nowrap" }}>{num(r.tokens_in)} → {num(r.tokens_out)}</td><td>{r.seconds.toFixed(0)} s</td>
                  <td className="e2e-num"><strong>{m(r.charged)}</strong></td>
                </tr>
              ))}
              {rows.map((r) => (
                <tr key={r.id} data-open className={r.id === flash ? "is-new" : ""} onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} style={{ opacity: r.ok ? 1 : .75 }}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(r.at).toLocaleTimeString()}</td>
                  <td><strong>{r.source || tx("Onbekend")}</strong>{!r.ok && <span className="e2e-badge e2e-badge--danger" style={{ marginLeft: ".4rem" }}>{tx("mislukt")}</span>}{open[r.id] && <small className="e2e-hint" style={{ display: "block" }}>{[r.purpose, r.group, r.web ? tx("web") : "", r.images ? `${r.images} ${tx("foto's")}` : "", r.error].filter(Boolean).join(" · ")}</small>}</td>
                  <td>{r.user || "—"}</td><td><small>{r.model || "—"}</small></td>
                  <td style={{ whiteSpace: "nowrap" }}>{num(r.tokens_in)} → {num(r.tokens_out)}</td><td>{(r.ms / 1000).toFixed(1)} s</td>
                  <td className="e2e-num"><strong>{m(r.charged)}</strong></td>
                </tr>
              ))}
              {!rows.length && !running.length && <tr><td colSpan={7} className="e2e-live__empty"><strong style={{ display: "block", color: "var(--e2e-text)" }}>{tx("Wachten op het volgende verzoek…")}</strong>{tx("Zodra de AI wordt gebruikt verschijnt het hier, met de kosten.")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Overview({ fail }) {
  const [s, setS] = useState(null);
  const [period, setPeriod] = useState("month");
  const [d, setD] = useState(null);
  useUpdates("ai-summary", () => api("/admin/ai/summary/"), 15000, setS, true, { onError: fail });
  useEffect(() => { setD(null); api(`/ai/admin/overview/?period=${period}`).then(setD).catch(fail); }, [period, fail]);
  if (!s) return <p className="muted">{tx("Laden…")}</p>;
  const m = (n) => money(n, s.currency);
  const delta = s.last_month.charged ? Math.round(((s.month.charged - s.last_month.charged) / s.last_month.charged) * 100) : null;
  const keys = d ? GROUPS.filter((g) => d.by_group.some((r) => r.group === g)) : [];
  return (
    <div className="ai-wrap">
      <KpiGrid>
        <Kpi accent label={tx("Vandaag")} value={m(s.today.charged)} sub={`${s.today.calls} ${tx("verzoeken")}${s.today.errors ? ` · ${s.today.errors} ${tx("mislukt")}` : ""}`} />
        <Kpi label={tx("Gisteren")} value={m(s.yesterday.charged)} sub={`${s.yesterday.calls} ${tx("verzoeken")}`} />
        <Kpi label={tx("Laatste 7 dagen")} value={m(s.week.charged)} sub={`${s.week.calls} ${tx("verzoeken")}`} />
        <Kpi accent label={tx("Deze maand")} value={m(s.month.charged)} sub={`${tx("Verwacht")}: ${m(s.expected_month)}`} />
        <Kpi label={tx("Vorige maand")} value={m(s.last_month.charged)} sub={delta === null ? `${s.last_month.calls} ${tx("verzoeken")}` : `${delta > 0 ? "+" : ""}${delta}% ${tx("deze maand")}`} />
        <Kpi label={tx("Dit jaar")} value={m(s.year.charged)} sub={`${s.year.calls} ${tx("verzoeken")} · ${short(s.year.tokens)} ${tx("tokens")}`} />
        <Kpi label={tx("Totaal")} value={m(s.all.charged)} sub={`${s.all.calls} ${tx("verzoeken")}`} />
      </KpiGrid>
      <div className="e2e-chartcard">
        <header style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
          <h4 style={{ flex: 1, margin: 0 }}>{tx("Kosten in de tijd")}</h4>
          <select className="e2e-select" style={{ width: "auto", minWidth: "12rem" }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={tx("Periode")}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
        </header>
        {!d ? <p className="muted">{tx("Laden…")}</p> : <><Legend keys={keys.length ? keys : ["user", "admin"]} /><Stacked series={d.series} metric="charged" format={(v) => (v >= 1 ? short(v) : v.toFixed(2))} /></>}
      </div>
      {d && <div className="e2e-grid" style={{ "--e2e-min": "340px" }}>
        <div className="e2e-chartcard"><header><h4>{tx("Kosten per groep")}</h4></header><Donut rows={d.by_group.map((r) => ({ key: r.group, label: tx(r.name), value: r.charged }))} /></div>
        <div className="e2e-chartcard"><header><h4>{tx("Laatste verzoeken")}</h4></header>
          <ul className="e2e-rows" data-easy2edit-tag="ui-rows">{d.recent.slice(0, 8).map((r, i) => (
            <li key={i}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source || tx("Onbekend")} <small className="e2e-hint">· {r.user}</small></span><strong>{m(r.charged)}</strong></li>))}
            {!d.recent.length && <li className="e2e-hint">{tx("Nog niets.")}</li>}</ul>
        </div>
      </div>}
    </div>
  );
}

function Stats({ fail }) {
  const [period, setPeriod] = useState("month");
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); api(`/ai/admin/overview/?period=${period}`).then(setD).catch(fail); }, [period, fail]);
  const m = (n) => money(n, d?.currency || "EUR");
  const t = d?.totals;
  return (
    <div className="ai-wrap">
      <div className="ai-filters"><label>{tx("Periode")}<select className="e2e-select" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label></div>
      {!d ? <p className="muted">{tx("Laden…")}</p> : (<>
        <KpiGrid>
          <Kpi label={tx("Verzoeken")} value={num(t.calls)} sub={`${num(t.errors)} ${tx("mislukt")} (${t.calls ? Math.round((t.errors / t.calls) * 100) : 0}%)`} />
          <Kpi label={tx("Kosten")} value={m(t.charged)} sub={t.calls ? `${m(t.charged / t.calls)} ${tx("per verzoek")}` : ""} />
          <Kpi label={tx("Tokens")} value={short(t.tokens_in + t.tokens_out)} sub={`${short(t.tokens_in)} in · ${short(t.tokens_out)} uit`} />
          <Kpi label={tx("Gemiddelde duur")} value={`${(t.avg_ms / 1000).toFixed(1)} s`} />
          <Kpi label={tx("Actieve gebruikers")} value={num(t.users)} />
        </KpiGrid>
        <div className="e2e-grid" style={{ "--e2e-min": "340px" }}>
          <div className="e2e-chartcard"><header><h4>{tx("Waar wordt AI gebruikt")}</h4></header><BarList rows={d.by_source.map((r) => ({ label: tx(r.source), value: r.charged, sub: `${num(r.calls)} ${tx("verzoeken")} · ${short(r.tokens_in + r.tokens_out)} ${tx("tokens")}${r.errors ? ` · ${r.errors} ${tx("mislukt")}` : ""}` }))} format={m} /></div>
          <div className="e2e-chartcard"><header><h4>{tx("Per model")}</h4></header><BarList rows={d.by_model.map((r) => ({ label: r.model, value: r.charged, sub: `${num(r.calls)} ${tx("verzoeken")}` }))} format={m} /></div>
        </div>
        <div className="e2e-grid" style={{ "--e2e-min": "340px" }}>
          <div className="e2e-chartcard"><header><h4>{tx("Per doel")}</h4></header><BarList rows={d.by_purpose.map((r) => ({ label: tx(r.purpose), value: r.calls, sub: m(r.charged) }))} /></div>
          <div className="e2e-chartcard"><header><h4>{tx("Hoogste kosten per gebruiker")}</h4></header><BarList rows={d.by_user.slice(0, 8).map((r) => ({ label: r.user, value: r.charged, sub: `${num(r.calls)} ${tx("verzoeken")}` }))} format={m} /></div>
        </div>
        <div className="e2e-grid" style={{ "--e2e-min": "340px" }}>
          <div className="e2e-chartcard"><header><h4>{tx("Drukte per uur van de dag")}</h4></header><Columns values={d.hours} labels={d.hours.map((_, i) => String(i))} /></div>
          <div className="e2e-chartcard"><header><h4>{tx("Drukte per dag van de week")}</h4></header><Columns values={d.weekdays} labels={DAYS.map((x) => tx(x))} /></div>
        </div>
      </>)}
    </div>
  );
}
