// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import Link from "next/link";
import Tabs from "../../../../components/Tabs";
import PdfButton from "../../../../components/AiPdfButton";
import { BarList, Columns, Donut, GROUP_COLOR, Legend, Stacked, money, num, short } from "../../../../components/AiCharts";

const PERIODS = [["day", "Laatste 24 uur"], ["week", "Laatste 7 dagen"], ["month", "Laatste 30 dagen"], ["quarter", "Laatste 90 dagen"], ["year", "Laatste jaar"]];
const GROUP_NAME = { user: "Gebruiker", admin: "Admin" };
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const ago = (iso) => (iso ? new Date(iso).toLocaleString() : "");
const Kpi = ({ label, value, sub }) => <div className="card stat"><span>{label}</span><strong style={{ fontSize: "1.5rem" }}>{value}</strong>{sub && <small>{sub}</small>}</div>;

// The AI overview for an admin: what the users and the admins use and what that costs them (no purchase prices, no margin), with a report per user.
export default function AiAdmin() {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("month");
  const [month, setMonth] = useState("");
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const fail = (e) => setMsg({ ok: false, text: errorText(e) });
  const [tn, setTn] = useState(null); // the own credit system of this admin for his users
  const [adj, setAdj] = useState(null);
  useEffect(() => { if (tab === "credit" && !tn) api("/ai/tenant/").then(setTn).catch(fail); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const tnSave = async (body) => { try { setTn(await api("/ai/tenant/", { method: "POST", body })); setMsg(null); } catch (e) { fail(e); } };
  const months = (() => { const out = [], n = new Date(); for (let i = 0; i <= 12; i++) { const x = new Date(n.getFullYear(), n.getMonth() - i, 1); out.push([`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, x.toLocaleString(undefined, { month: "long", year: "numeric" })]); } return out; })();
  const load = useCallback(() => api(`/ai/admin/overview/?period=${period}${month ? `&month=${month}` : ""}`).then(setD).catch(fail), [period, month]);
  useEffect(() => { load(); }, [load]);
  const m = (n) => money(n, d?.currency || "EUR");
  const t = d?.totals;
  const filters = (
    <div className="ai-filters">
      <label>{tx("Periode")}<select value={month ? "" : period} onChange={(e) => { setMonth(""); setPeriod(e.target.value); }}>{month && <option value="">{tx("Zie de gekozen maand")}</option>}{PERIODS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
      <label>{tx("Maand")}<select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">{tx("Alle maanden (volgens de periode)")}</option>{months.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    </div>
  );
  return (
    <>
      <h1>{tx("AI")}</h1>
      <p className="muted">{tx("Het AI-gebruik van je gebruikers en van jezelf, en wat het kost. Per gebruiker kun je een rapport als PDF maken.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["overview", "Overzicht"], ["users", "Gebruikers"], ["credit", "Tegoed voor gebruikers"]]} />
      {!d && !msg && <p className="muted">{tx("Laden…")}</p>}
      {d && tab === "overview" && (<div className="ai-wrap">
        {filters}
        <div className="cards" style={{ marginTop: 0 }}>
          <Kpi label={tx("Aanroepen")} value={num(t.calls)} sub={`${num(t.errors)} ${tx("mislukt")}`} />
          <Kpi label={tx("Tokens in")} value={short(t.tokens_in)} />
          <Kpi label={tx("Tokens uit")} value={short(t.tokens_out)} />
          <Kpi label={tx("Kosten")} value={m(t.charged)} />
          <Kpi label={tx("Gemiddelde duur")} value={`${(t.avg_ms / 1000).toFixed(1)} s`} />
          <Kpi label={tx("Actieve gebruikers")} value={num(t.users)} />
        </div>
        <div className="card"><strong>{tx("Kosten in de tijd")}</strong><Legend keys={["user", "admin"]} /><Stacked series={d.series} metric="charged" format={(v) => (v >= 1 ? short(v) : v.toFixed(2))} /></div>
        <div className="grid2">
          <div className="card"><strong>{tx("Aanroepen per groep")}</strong><Donut rows={d.by_group.map((r) => ({ key: r.group, label: tx(r.name), value: r.calls }))} /></div>
          <div className="card"><strong>{tx("Waar wordt AI gebruikt")}</strong><BarList rows={d.by_source.map((r) => ({ label: tx(r.source), value: r.calls, sub: `${short(r.tokens_in + r.tokens_out)} tokens · ${m(r.charged)}` }))} /></div>
        </div>
        <div className="grid2">
          <div className="card"><strong>{tx("Drukte per uur van de dag")}</strong><Columns values={d.hours} labels={d.hours.map((_, i) => String(i))} /></div>
          <div className="card"><strong>{tx("Drukte per dag van de week")}</strong><Columns values={d.weekdays} labels={DAYS.map((x) => tx(x))} /></div>
        </div>
      </div>)}
      {tab === "credit" && tn && (<div className="ai-wrap">
        <div className="card form ai-settings">
          <p className="muted" style={{ margin: 0 }}>{tx("Wil je je gebruikers zelf AI-tegoed laten kopen? Dan heb je een eigen AI-koppeling (Anthropic) en een eigen Stripe-koppeling nodig, ingesteld bij API keys en niet als Superadmin-koppeling. Je gebruikers gebruiken dan jouw AI, betalen via jouw Stripe en de marge is van jou. De AI-instellingen van het systeem zelf wijzigt alleen de superadmin.")}</p>
          <div className="ai-req">
            <div className={tn.ai_link ? "alert ok" : "alert"} style={{ margin: 0 }}>{tx("Eigen AI-koppeling")}: {tn.ai_link ? <strong>{tn.ai_link}</strong> : tx("nog niet ingesteld")}</div>
            <div className={tn.stripe_link ? "alert ok" : "alert"} style={{ margin: 0 }}>{tx("Eigen Stripe-koppeling")}: {tn.stripe_link ? <strong>{tn.stripe_link}</strong> : tx("nog niet ingesteld")}</div>
          </div>
          {!tn.ready && <div><Link className="btn" href="/dashboard/admin/integrations">{tx("Naar API keys")}</Link></div>}
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={tn.enabled} disabled={!tn.ready && !tn.enabled} onChange={(e) => tnSave({ enabled: e.target.checked })} /><span /></span>
            <span>{tx("Een eigen tegoed-systeem voor mijn gebruikers")}<small className="muted" style={{ display: "block" }}>{tn.active ? tx("Aan: je gebruikers gebruiken jouw AI en betalen via jouw Stripe.") : tx("Uit: je gebruikers gebruiken de AI en het tegoed van het systeem.")}</small></span></label>
          {tn.ready && (<>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={tn.credit_required} onChange={(e) => tnSave({ credit_required: e.target.checked })} /><span /></span><span>{tx("Gebruikers moeten AI-tegoed kopen om AI te kunnen gebruiken")}</span></label>
            <div className="grid2">
              {[["topup_min", "Kleinste bedrag"], ["topup_max", "Grootste bedrag"], ["topup_step", "Stap van de schuifbalk"]].map(([k, l]) => (
                <label key={k}>{tx(l)} ({tn.currency})<input type="number" min="0" step="0.5" defaultValue={tn[k]} onBlur={(e) => { if (Number(e.target.value) !== tn[k]) tnSave({ [k]: e.target.value }); }} /></label>))}
              {[["margin_in", "Marge op tokens in"], ["margin_out", "Marge op tokens uit"]].map(([k, l]) => (
                <label key={k}>{tx(l)} (%)<input type="number" step="0.5" min="-100" defaultValue={tn[k]} onBlur={(e) => { if (Number(e.target.value) !== tn[k]) tnSave({ [k]: e.target.value }); }} /></label>))}
            </div>
          </>)}
        </div>
        {tn.active && (
          <div className="card"><strong>{tx("Tegoed van je gebruikers")}</strong>
            <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Gebruiker")}</th><th>{tx("Tegoed")}</th><th>{tx("Aanroepen (30 d)")}</th><th>{tx("Kosten (30 d)")}</th><th /></tr></thead>
              <tbody>{tn.users.map((u) => (
                <tr key={u.id}><td>{u.user}</td><td><strong>{money(u.balance, tn.currency)}</strong></td><td>{num(u.month_calls)}</td><td>{money(u.month_charged, tn.currency)}</td>
                  <td><button type="button" className="btn sm" onClick={() => setAdj({ user: u, amount: "10", note: "" })}>{tx("Opwaarderen")}</button></td></tr>))}
                {!tn.users.length && <tr><td colSpan={5} className="muted">{tx("Nog geen gebruikers.")}</td></tr>}</tbody></table></div>
          </div>
        )}
        {adj && (
          <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdj(null); }}>
            <div className="card modal form" role="dialog" aria-label={tx("Opwaarderen")} style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
              <h2 style={{ margin: 0 }}>{tx("Tegoed aanpassen")}: {adj.user.user}</h2>
              <label>{tx("Bedrag")} ({tn.currency})<input type="number" step="0.5" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} autoFocus /></label>
              <label>{tx("Omschrijving")}<input value={adj.note} maxLength={200} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></label>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => setAdj(null)}>{tx("Annuleren")}</button>
                <button type="button" className="btn primary" disabled={!Number(adj.amount)} onClick={async () => { await tnSave({ user_id: adj.user.id, amount: adj.amount, note: adj.note }); setAdj(null); }}>{tx("Opslaan")}</button>
              </div>
            </div>
          </div>
        )}
      </div>)}
      {d && tab === "users" && (<div className="ai-wrap">
        {filters}
        <div className="grid2">
          <div className="card"><strong>{tx("Veel vragers (aantal aanroepen)")}</strong><BarList rows={[...d.by_user].sort((a, b) => b.calls - a.calls).slice(0, 10).map((r) => ({ label: r.user, value: r.calls, color: GROUP_COLOR[r.group], sub: `${tx(GROUP_NAME[r.group] || r.group)} · ${m(r.charged)}` }))} /></div>
          <div className="card"><strong>{tx("Hoogste kosten")}</strong><BarList rows={d.by_user.slice(0, 10).map((r) => ({ label: r.user, value: r.charged, color: GROUP_COLOR[r.group], sub: `${num(r.calls)} ${tx("aanroepen")}` }))} format={m} /></div>
        </div>
        <div className="card"><strong>{tx("Per gebruiker")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Gebruiker")}</th><th>{tx("Groep")}</th><th>{tx("Aanroepen")}</th><th>{tx("Tokens in")}</th><th>{tx("Tokens uit")}</th><th>{tx("Duur (gem.)")}</th><th>{tx("Kosten")}</th>{d.credit_required && <th>{tx("Tegoed")}</th>}<th>{tx("Laatst")}</th><th>{tx("Rapport")}</th></tr></thead>
            <tbody>{d.by_user.map((r, i) => (
              <tr key={i}><td>{r.user}</td><td>{tx(GROUP_NAME[r.group] || r.group)}</td><td>{num(r.calls)}</td><td>{num(r.tokens_in)}</td><td>{num(r.tokens_out)}</td><td>{(r.avg_ms / 1000).toFixed(1)} s</td><td><strong>{m(r.charged)}</strong></td>
                {d.credit_required && <td>{r.balance == null ? "–" : m(r.balance)}</td>}<td>{ago(r.last)}</td>
                <td>{r.user_id ? <PdfButton compact who={r.user} base="/ai/admin/report/" name={`easy2edit-ai-${r.user.replace(/[^a-z0-9]+/gi, "-")}`} query={`kind=usage&user=${r.user_id}&period=${period}${month ? `&month=${month}` : ""}`} onError={fail} /> : null}</td></tr>))}
              {!d.by_user.length && <tr><td colSpan={10} className="muted">{tx("Nog geen AI-gebruik in deze periode.")}</td></tr>}</tbody></table></div>
        </div>
      </div>)}
    </>
  );
}
