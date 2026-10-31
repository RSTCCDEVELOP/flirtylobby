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
import Tabs from "../../../../components/Tabs";
import PdfButton from "../../../../components/AiPdfButton";
import { BarList, Columns, Donut, GROUP_COLOR, GROUPS, Legend, Stacked, money, moneyTok, num, short } from "../../../../components/AiCharts";

const PROVIDERS = [["anthropic", "Claude"], ["openai", "OpenAI"], ["gemini", "Gemini"]];
const PERIODS = [["day", "Laatste 24 uur"], ["week", "Laatste 7 dagen"], ["month", "Laatste 30 dagen"], ["quarter", "Laatste 90 dagen"], ["year", "Laatste jaar"]];
const GROUP_NAME = { user: "Gebruiker", admin: "Admin", super: "Superadmin", system: "Systeem", site: "Website" };
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const Badge = ({ g, site }) => <span className="badge" style={{ background: "transparent", border: `1px solid ${GROUP_COLOR[g]}`, color: GROUP_COLOR[g] }}>{g === "site" && site ? site : tx(GROUP_NAME[g] || g)}</span>;
const ago = (iso) => (iso ? new Date(iso).toLocaleString() : "");
function Kpi({ label, value, sub }) { return <div className="card stat"><span>{label}</span><strong style={{ fontSize: "1.5rem" }}>{value}</strong>{sub && <small>{sub}</small>}</div>; }

// The AI dashboard of the superadmin: every call to Claude, per user, per group and per part of the system, with what it costs and what is charged (margin on top).
export default function AiDashboard() {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("month");
  const [group, setGroup] = useState("");
  const [month, setMonth] = useState(""); // "2026-10": a whole calendar month instead of the period
  const months = (() => { const out = [], n = new Date(); for (let i = 0; i <= 12; i++) { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); out.push([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, d.toLocaleString(undefined, { month: "long", year: "numeric" })]); } return out; })(); // this month and the 12 before it
  const [d, setD] = useState(null);
  const [by, setBy] = useState("month");
  const [costs, setCosts] = useState(null);
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState(null);
  const fail = (e) => setMsg({ ok: false, text: errorText(e) });
  const load = useCallback(() => api(`/admin/ai/overview/?period=${period}${month ? `&month=${month}` : ""}${group ? `&group=${group}` : ""}`).then(setD).catch(fail), [period, month, group]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "costs") api(`/admin/ai/costs/?by=${by}`).then(setCosts).catch(fail); }, [tab, by]);
  useEffect(() => { if (tab === "settings" && !st) api("/admin/ai/settings/").then(setSt).catch(fail); }, [tab, st]);
  const cur = d?.currency || "USD";
  const m = (n) => money(n, cur); // what is charged (selling currency)
  const cc = d?.cost_currency || costs?.cost_currency || st?.cost_currency || "USD";
  const mc = (n) => money(n, cc); // what the supplier charges us (purchase currency)
  const [cr, setCr] = useState(null); // the credit of every user and its settings
  const [stripe, setStripe] = useState(null); // the system Stripe account (Super admin → Licentie): AI credit is always paid through it when it is on
  useEffect(() => { if (tab === "credit") api("/admin/ai/pay-status/").then(setStripe).catch(() => setStripe({ via: "sandbox" })); }, [tab]);
  const [adj, setAdj] = useState(null); // the user whose credit is being changed: { user, amount, note }
  useEffect(() => { if (tab === "credit" && !cr) api("/admin/ai/credit/").then(setCr).catch(fail); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const crSave = async (body) => { try { setCr(await api("/admin/ai/credit/", { method: "POST", body })); setMsg(null); } catch (e) { fail(e); } };
  const [blocks, setBlocks] = useState(null);
  useEffect(() => { if (tab === "blocks" && !blocks) api("/admin/ai/blocks/").then(setBlocks).catch(fail); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = async (b, on) => { try { setBlocks(await api("/admin/ai/blocks/", { method: "POST", body: { key: b.key, on } })); } catch (e) { fail(e); } };
  const [rateBusy, setRateBusy] = useState(false);
  const [ptab, setPtab] = useState("general"); // Algemeen, Claude, OpenAI, Gemini
  const [provs, setProvs] = useState(null);
  const loadProvs = (refresh) => api(`/admin/ai/models/${refresh ? "?refresh=1" : ""}`).then(setProvs).catch(fail);
  const [refBusy, setRefBusy] = useState(false);
  const refresh = async () => { // the models the API offers, and their prices (looked up by Claude on the price page of the supplier) filled in
    setRefBusy(true); setMsg(null);
    try {
      const fresh = await api("/admin/ai/models/?refresh=1");
      setProvs(fresh);
      const pv = fresh.providers.find((x) => x.provider === ptab);
      const r = await api("/admin/ai/prices/", { method: "POST", body: { provider: ptab, models: pv.models.map((x) => x.model) } });
      setSt((o) => ({ ...o, prices: r.prices }));
      setProvs(await api("/admin/ai/models/"));
      setMsg({ ok: true, text: `${r.filled.length} ${tx("prijzen ingevuld")} (${r.source}).${r.missing.length ? ` ${tx("Geen prijs gevonden voor")}: ${r.missing.join(", ")}.` : ""} ${tx("Controleer de prijzen: ze zijn door AI opgezocht.")}` });
    } catch (e) { fail(e); }
    setRefBusy(false);
  };
  useEffect(() => { if (tab === "settings" && !provs) loadProvs(false); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const updateRate = async () => {
    setRateBusy(true); setMsg(null);
    try { await api("/admin/ai/settings/", { method: "POST", body: { currency: st.currency, cost_currency: st.cost_currency } }); const r = await api("/admin/ai/rate/", { method: "POST" }); setSt((o) => ({ ...o, ...r, margin_in: o.margin_in, margin_out: o.margin_out, prices: o.prices })); setMsg({ ok: true, text: `${tx("Koers bijgewerkt")}: 1 ${r.cost_currency} = ${r.rate} ${r.currency} (${r.rate_note})` }); load(); }
    catch (e) { fail(e); }
    setRateBusy(false);
  };
  const save = async () => {
    try { setSt(await api("/admin/ai/settings/", { method: "POST", body: { currency: st.currency, cost_currency: st.cost_currency, rate: st.rate, bill_internal: st.bill_internal, margins: st.margins, prices: st.prices } })); setMsg({ ok: true, text: tx("Opgeslagen. Het geldt voor nieuwe AI-aanroepen; wat al is vastgelegd blijft zoals het was.") }); load(); loadProvs(false); }
    catch (e) { fail(e); }
  };
  const filters = (
    <div className="ai-filters">
      <label>{tx("Periode")}<select value={month ? "" : period} onChange={(e) => { setMonth(""); setPeriod(e.target.value); }}>{month && <option value="">{tx("Zie de gekozen maand")}</option>}{PERIODS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
      <label>{tx("Maand")}<select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">{tx("Alle maanden (volgens de periode)")}</option>{months.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>{tx("Groep")}<select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">{tx("Alle groepen")}</option>{GROUPS.filter((g) => g !== "site" || d?.group_names?.site).map((g) => <option key={g} value={g}>{g === "site" ? d?.group_names?.site : tx(GROUP_NAME[g])}</option>)}</select></label>
      <PdfButton query={`kind=usage&period=${period}${month ? `&month=${month}` : ""}${group ? `&group=${group}` : ""}`} name="easy2edit-ai-gebruik" onError={fail} />
    </div>
  );
  const t = d?.totals;
  return (
    <>
      <h1>{tx("AI")}</h1>
      <p className="muted">{tx("Alle AI-aanroepen van het systeem: wie, waar, hoeveel en wat het kost. De module staat altijd aan zodra er een AI-koppeling is.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["overview", "Overzicht"], ["where", "Waar"], ["users", "Gebruikers"], ["costs", "Kosten"], ["credit", "Tegoed"], ["blocks", "Blokken"], ["settings", "Instellingen"]]} />
      {!d && !msg && <p className="muted">{tx("Laden…")}</p>}
      {d && tab === "overview" && (<div className="ai-wrap">
        {filters}
        <div className="cards" style={{ marginTop: 0 }}>
          <Kpi label={tx("Aanroepen")} value={num(t.calls)} sub={`${num(t.errors)} ${tx("mislukt")}`} />
          <Kpi label={tx("Tokens in")} value={short(t.tokens_in)} />
          <Kpi label={tx("Tokens uit")} value={short(t.tokens_out)} />
          <Kpi label={tx("Kosten (inkoop)")} value={mc(t.cost)} sub={cc} />
          <Kpi label={tx("In rekening gebracht")} value={m(t.charged)} sub={cur} />
          <Kpi label={tx("Marge")} value={m(t.margin)} />
          {d.own > 0 && <Kpi label={tx("Eigen kosten reseller")} value={m(d.own)} sub={tx("niet in rekening gebracht")} />}
          <Kpi label={tx("Gemiddelde duur")} value={`${(t.avg_ms / 1000).toFixed(1)} s`} />
          <Kpi label={tx("Actieve gebruikers")} value={num(t.users)} />
        </div>
        <div className="card"><strong>{tx("In rekening gebracht in de tijd")}</strong><Legend /><Stacked series={d.series} metric="charged" format={(v) => (v >= 1 ? short(v) : v.toFixed(2))} /></div>
        <div className="card"><strong>{tx("Aanroepen in de tijd")}</strong><Legend /><Stacked series={d.series} metric="calls" /></div>
        <div className="grid2">
          <div className="card"><strong>{tx("Aanroepen per groep")}</strong><Donut rows={d.by_group.map((r) => ({ key: r.group, label: tx(r.name), value: r.calls }))} /></div>
          <div className="card"><strong>{tx("Kosten per groep")}</strong><BarList rows={d.by_group.map((r) => ({ label: tx(r.name), value: r.charged, color: GROUP_COLOR[r.group], sub: `${num(r.calls)} ${tx("aanroepen")} · ${r.users} ${tx("gebruikers")}` }))} format={m} /></div>
        </div>
        <div className="card"><strong>{tx("Laatste aanroepen")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Wanneer")}</th><th>{tx("Wie")}</th><th>{tx("Waar")}</th><th>{tx("Model")}</th><th>{tx("In")}</th><th>{tx("Uit")}</th><th>{tx("Duur")}</th><th>{tx("Kosten")}</th></tr></thead>
            <tbody>{d.recent.map((r, i) => <tr key={i}><td>{ago(r.at)}</td><td>{r.user} <Badge g={r.group} site={d?.group_names?.site} /></td><td>{r.source}</td><td>{r.model}</td><td>{num(r.tokens_in)}</td><td>{num(r.tokens_out)}</td><td>{(r.ms / 1000).toFixed(1)} s</td><td>{r.ok ? m(r.charged) : <span style={{ color: "var(--danger)" }}>{r.error || tx("mislukt")}</span>}</td></tr>)}
              {!d.recent.length && <tr><td colSpan={8} className="muted">{tx("Nog geen AI-gebruik in deze periode.")}</td></tr>}</tbody></table></div>
        </div>
      </div>)}
      {d && tab === "where" && (<div className="ai-wrap">
        {filters}
        <div className="grid2">
          <div className="card"><strong>{tx("Waar wordt AI het meest gebruikt")}</strong><BarList rows={d.by_source.map((r) => ({ label: tx(r.source), value: r.calls, sub: `${short(r.tokens_in + r.tokens_out)} tokens · ${m(r.charged)}${r.errors ? ` · ${r.errors} ${tx("mislukt")}` : ""}` }))} /></div>
          <div className="card"><strong>{tx("Wat kost het meest")}</strong><BarList rows={[...d.by_source].sort((a, b) => b.charged - a.charged).map((r) => ({ label: tx(r.source), value: r.charged }))} format={m} color="var(--orange)" /></div>
        </div>
        <div className="grid2">
          <div className="card"><strong>{tx("Opdrachten (waarvoor)")}</strong><BarList rows={d.by_purpose.map((r) => ({ label: r.purpose, value: r.calls, sub: m(r.charged) }))} /></div>
          <div className="card"><strong>{tx("Modellen")}</strong><BarList rows={d.by_model.map((r) => ({ label: r.model, value: r.calls, sub: `${short(r.tokens_in)} in · ${short(r.tokens_out)} uit · ${m(r.charged)}` }))} /></div>
        </div>
        <div className="grid2">
          <div className="card"><strong>{tx("Drukte per uur van de dag")}</strong><Columns values={d.hours} labels={d.hours.map((_, i) => String(i))} /></div>
          <div className="card"><strong>{tx("Drukte per dag van de week")}</strong><Columns values={d.weekdays} labels={DAYS.map((x) => tx(x))} /></div>
        </div>
      </div>)}
      {d && tab === "users" && (<div className="ai-wrap">
        {filters}
        <div className="grid2">
          <div className="card"><strong>{tx("Veel vragers (aantal aanroepen)")}</strong><BarList rows={[...d.by_user].sort((a, b) => b.calls - a.calls).slice(0, 10).map((r) => ({ label: r.user, value: r.calls, color: GROUP_COLOR[r.group], sub: `${tx(GROUP_NAME[r.group])} · ${m(r.charged)}` }))} /></div>
          <div className="card"><strong>{tx("Hoogste kosten")}</strong><BarList rows={d.by_user.slice(0, 10).map((r) => ({ label: r.user, value: r.charged, color: GROUP_COLOR[r.group], sub: `${num(r.calls)} ${tx("aanroepen")}` }))} format={m} /></div>
        </div>
        <div className="card"><strong>{tx("Per gebruiker")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Gebruiker")}</th><th>{tx("Groep")}</th><th>{tx("Aanroepen")}</th><th>{tx("Tokens in")}</th><th>{tx("Tokens uit")}</th><th>{tx("Duur (gem.)")}</th><th>{tx("Inkoop")}</th><th>{tx("In rekening")}</th><th>{tx("Laatst")}</th><th>{tx("Rapport")}</th></tr></thead>
            <tbody>{d.by_user.map((r, i) => <tr key={i}><td>{r.user}</td><td><Badge g={r.group} site={d?.group_names?.site} /></td><td>{num(r.calls)}</td><td>{num(r.tokens_in)}</td><td>{num(r.tokens_out)}</td><td>{(r.avg_ms / 1000).toFixed(1)} s</td><td>{mc(r.cost)}</td><td><strong>{m(r.charged)}</strong></td><td>{ago(r.last)}</td><td><PdfButton compact who={r.user} name={`easy2edit-ai-${(r.user || "systeem").replace(/[^a-z0-9]+/gi, "-")}`} query={`kind=usage&user=${r.user_id || 0}&period=${period}${month ? `&month=${month}` : ""}`} onError={fail} /></td></tr>)}
              {!d.by_user.length && <tr><td colSpan={10} className="muted">{tx("Nog geen AI-gebruik in deze periode.")}</td></tr>}</tbody></table></div>
        </div>
      </div>)}
      {tab === "costs" && costs && (<div className="ai-wrap">
        <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", marginBottom: ".8rem" }}>
          <select value={by} onChange={(e) => setBy(e.target.value)} aria-label={tx("Per")}><option value="month">{tx("Per maand")}</option><option value="week">{tx("Per week")}</option></select>
          <PdfButton query={`kind=costs&by=${by}`} name="easy2edit-ai-kosten" onError={fail} />
        </div>
        <div className="card"><strong>{tx("In rekening gebracht per periode, per groep")}</strong><Legend />
          <Stacked series={Object.fromEntries(costs.periods.map((p) => [p, Object.fromEntries(GROUPS.map((g) => [g, costs.groups[g]?.[p]]).filter(([, v]) => v))]))} metric="charged" format={(v) => (v >= 1 ? short(v) : v.toFixed(2))} /></div>
        <div className="card"><strong>{tx("Kosten per groep")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Groep")}</th>{costs.periods.map((p) => <th key={p}>{p}</th>)}</tr></thead>
            <tbody>{GROUPS.filter((g) => costs.groups[g]).map((g) => <tr key={g}><td><Badge g={g} site={costs?.group_names?.site} /></td>{costs.periods.map((p) => <td key={p}>{costs.groups[g][p] ? <>{m(costs.groups[g][p].charged)}<br /><small className="muted">{money(costs.groups[g][p].cost, costs.cost_currency)} {tx("inkoop")}</small></> : "–"}</td>)}</tr>)}
              {!Object.keys(costs.groups).length && <tr><td className="muted">{tx("Nog geen AI-gebruik.")}</td></tr>}</tbody></table></div>
        </div>
        <div className="card"><strong>{tx("Kosten per gebruiker")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Gebruiker")}</th><th>{tx("Groep")}</th>{costs.periods.map((p) => <th key={p}>{p}</th>)}<th>{tx("Totaal")}</th><th>{tx("Rapport")}</th></tr></thead>
            <tbody>{costs.users.map((u, i) => <tr key={i}><td>{u.user}</td><td><Badge g={u.group} site={costs?.group_names?.site} /></td>{costs.periods.map((p) => <td key={p}>{u.periods[p] ? m(u.periods[p].charged) : "–"}</td>)}<td><strong>{m(u.total)}</strong></td><td><PdfButton compact who={u.user} name={`easy2edit-ai-${(u.user || "systeem").replace(/[^a-z0-9]+/gi, "-")}`} query={`kind=usage&user=${u.user_id || 0}&period=year`} onError={fail} /></td></tr>)}</tbody></table></div>
        </div>
      </div>)}
      {tab === "credit" && cr && (<div className="ai-wrap">
        <div className="card form ai-settings">
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={cr.credit_required} onChange={(e) => crSave({ credit_required: e.target.checked })} /><span /></span>
            <span>{tx("Gebruikers en admins moeten AI-tegoed kopen om AI te kunnen gebruiken")}<small className="muted" style={{ display: "block" }}>{tx("Aan: zonder tegoed wordt er niets naar de AI gestuurd en krijgt de gebruiker een voorstel om tegoed te kopen. Superadmins en het systeem hebben geen tegoed nodig. Alleen jij beheert dit.")}</small></span></label>
          <div className="grid2">
            {[["topup_min", "Kleinste bedrag"], ["topup_max", "Grootste bedrag"], ["topup_step", "Stap van de schuifbalk"]].map(([k, l]) => (
              <label key={k}>{tx(l)} ({cr.currency})<input type="number" min="0" step="0.5" defaultValue={cr[k]} onBlur={(e) => { if (Number(e.target.value) !== cr[k]) crSave({ [k]: e.target.value }); }} /></label>))}
          </div>
          <div className={stripe && stripe.via !== "sandbox" ? "alert ok" : "alert"} style={{ margin: 0 }}>
            {tx("Betalen via")} <strong>Stripe</strong>: {stripe?.via === "link" ? `${tx("de Easy2edit-koppeling")} "${stripe.name}" (${stripe.mode}).` : stripe?.via === "license" ? tx("het Stripe-account van de licentie (er is geen Stripe-koppeling van de superadmin).") : tx("nog niet gekoppeld. Zet bij API keys een Stripe-koppeling aan en vink Superadmin-koppeling aan; zolang dat niet kan, kan er alleen via de sandbox worden betaald.")}
            <small className="muted" style={{ display: "block" }}>{tx("AI-tegoed wordt altijd betaald via een Easy2edit-koppeling van de superadmin, nooit via de eigen Stripe van de webshop.")}</small>
          </div>
          <small className="muted">{tx("De schuifbalk loopt van het kleinste bedrag tot 25, 50 of 100 (maximaal het grootste bedrag), afhankelijk van wat iemand de afgelopen 30 dagen gebruikte. Betalen gaat via de betaalkoppeling.")}</small>
        </div>
        <div className="card"><strong>{tx("Tegoed per gebruiker")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Gebruiker")}</th><th>{tx("Groep")}</th><th>{tx("Tegoed")}</th><th>{tx("Aanroepen (30 d)")}</th><th>{tx("Kosten (30 d)")}</th><th /></tr></thead>
            <tbody>{cr.users.map((u) => (
              <tr key={u.id}><td>{u.user}</td><td><Badge g={u.group} site={d?.group_names?.site} /></td><td><strong>{u.subject ? money(u.balance, cr.currency) : "–"}</strong>{!u.subject && <small className="muted"> {tx("geen tegoed nodig")}</small>}</td><td>{num(u.month_calls)}</td><td>{money(u.month_charged, cr.currency)}</td>
                <td><button type="button" className="btn sm" onClick={() => setAdj({ user: u, amount: "10", note: "" })}>{tx("Opwaarderen")}</button></td></tr>))}</tbody></table></div>
        </div>
        <div className="card"><strong>{tx("Gekocht en aangepast")}</strong>
          <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Wanneer")}</th><th>{tx("Gebruiker")}</th><th>{tx("Wat")}</th><th>{tx("Bedrag")}</th><th>{tx("Door")}</th></tr></thead>
            <tbody>{cr.ledger.map((r, i) => <tr key={i}><td>{ago(r.at)}</td><td>{r.user}</td><td>{r.kind === "topup" ? tx("Gekocht") : tx("Aangepast")}{r.note ? ` · ${r.note}` : ""}</td><td>{money(r.amount, cr.currency)}</td><td>{r.by || "–"}</td></tr>)}
              {!cr.ledger.length && <tr><td colSpan={5} className="muted">{tx("Nog niets.")}</td></tr>}</tbody></table></div>
        </div>
        {adj && (
          <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdj(null); }}>
            <div className="card modal form" role="dialog" aria-label={tx("Opwaarderen")} style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
              <h2 style={{ margin: 0 }}>{tx("Tegoed aanpassen")}: {adj.user.user}</h2>
              <p className="muted" style={{ margin: 0 }}>{tx("Nu")}: {money(adj.user.balance, cr.currency)}. {tx("Een negatief bedrag boekt tegoed af.")}</p>
              <label>{tx("Bedrag")} ({cr.currency})<input type="number" step="0.5" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} autoFocus /></label>
              <label>{tx("Omschrijving")}<input value={adj.note} maxLength={200} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder={tx("Bijvoorbeeld: cadeau of correctie")} /></label>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => setAdj(null)}>{tx("Annuleren")}</button>
                <button type="button" className="btn primary" disabled={!Number(adj.amount)} onClick={async () => { await crSave({ user_id: adj.user.id, amount: adj.amount, note: adj.note }); setAdj(null); }}>{tx("Opslaan")}</button>
              </div>
            </div>
          </div>
        )}
      </div>)}
      {tab === "blocks" && blocks && (<div className="card form ai-settings">
        <p className="muted" style={{ margin: 0 }}>{tx("Onderdelen van dit dashboard als blok voor op een pagina. Zet een blok aan: dan vind je het in bewerkmodus bij + Toevoegen → Systeemobjecten, onder AI. De cijfers zijn alleen te zien voor superadmins.")}</p>
        <div className="ai-blocklist">{blocks.map((b) => (
          <label key={b.key} className="check sec-toggle ai-blockrow">
            <span className="switch"><input type="checkbox" checked={b.on} onChange={(e) => flip(b, e.target.checked)} /><span /></span>
            <span><strong>{tx(b.label)}</strong><small className="muted" style={{ display: "block" }}>{tx(b.desc)}</small></span>
          </label>))}</div>
      </div>)}
      {tab === "settings" && st && (<div className="card form ai-settings">
        <Tabs value={ptab} onChange={setPtab} tabs={[["general", "Algemeen"], ...PROVIDERS.map(([k, l]) => [k, l, null, provs?.providers?.find((x) => x.provider === k)?.enabled ? "✓" : null])]} />
        {ptab === "general" && (<>
          <p className="muted" style={{ margin: 0 }}>{tx("Wat een miljoen tokens kost en welke marge je er bovenop zet. De marge geldt apart voor tokens die naar de AI gaan (in) en tokens die terugkomen (uit). Het wordt per aanroep vastgelegd, dus een wijziging telt alleen voor nieuwe aanroepen.")}</p>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!st.bill_internal} onChange={(e) => setSt({ ...st, bill_internal: e.target.checked })} /><span /></span>
            <span>{tx("Kosten van superadmins en het systeem ook ten laste van de klant")}<small className="muted" style={{ display: "block" }}>{st.bill_internal ? `${tx("Aan: deze kosten worden geboekt op de groep")} "${st.site_name}" ${tx("(met de marge van de reseller) en zijn als PDF uit te draaien.")}` : tx("Uit: deze kosten zijn voor de reseller of superadmin zelf, zonder marge, en worden niet in rekening gebracht.")}</small></span></label>
          <strong>{tx("Marge per groep (in procenten)")}</strong>
          <div className="ai-margins">
            {[["user", "Gebruikers"], ["admin", "Admins"], ["super", "Reseller / superadmin"]].map(([g, l]) => (
              <div key={g} className="ai-margin"><strong>{tx(l)}</strong>
                <label>{tx("Tokens in")} (%)<input type="number" step="0.5" min="-100" value={st.margins?.[g]?.in ?? 0} onChange={(e) => setSt({ ...st, margins: { ...st.margins, [g]: { ...st.margins?.[g], in: e.target.value } } })} /></label>
                <label>{tx("Tokens uit")} (%)<input type="number" step="0.5" min="-100" value={st.margins?.[g]?.out ?? 0} onChange={(e) => setSt({ ...st, margins: { ...st.margins, [g]: { ...st.margins?.[g], out: e.target.value } } })} /></label>
                {g === "super" && <small className="muted">{tx("Geldt ook voor het gebruik van superadmins en het systeem, als dat ten laste van de klant komt.")}</small>}
              </div>))}
          </div>
          <div className="grid2">
            <label>{tx("Munt van de inkoop (wat de AI-leverancier rekent)")}<input maxLength={5} value={st.cost_currency} onChange={(e) => setSt({ ...st, cost_currency: e.target.value.toUpperCase() })} /></label>
            <label>{tx("Munt van de verkoop (wat je in rekening brengt)")}<input maxLength={5} value={st.currency} onChange={(e) => setSt({ ...st, currency: e.target.value.toUpperCase() })} /></label>
            <label>{tx("Koers")}: 1 {st.cost_currency} = … {st.currency}<input type="number" step="0.0001" min="0" value={st.rate} onChange={(e) => setSt({ ...st, rate: e.target.value })} disabled={st.cost_currency === st.currency} /></label>
            <div style={{ alignSelf: "end" }}>
              <button type="button" className="btn" disabled={rateBusy || st.cost_currency === st.currency} onClick={updateRate}>{rateBusy ? tx("Koers opzoeken…") : tx("Koers bijwerken via AI")}</button>
              <small className="muted" style={{ display: "block" }}>{st.rate_at ? `${new Date(st.rate_at).toLocaleString()} · ${st.rate_note}` : tx("De koers is nog niet bijgewerkt.")}</small>
            </div>
          </div>
          <small className="muted">{tx("Per tabblad (Claude, OpenAI, Gemini) staan de modellen met hun inkoopprijs. De standaardprijzen zijn een schatting: controleer ze met de prijslijst van de AI-leverancier.")}</small>
        </>)}
        {ptab !== "general" && (() => {
          const pv = provs?.providers?.find((x) => x.provider === ptab);
          if (!pv) return <p className="muted">{tx("Laden…")}</p>;
          const own = st.prices?.[ptab] || {};
          const rate = st.cost_currency === st.currency ? 1 : Number(st.rate);
          const names = [...pv.models.map((r) => r.model), ...Object.keys(own).filter((k) => !pv.models.some((r) => r.model === k))];
          const row = (k) => pv.models.find((r) => r.model === k) || { model: k, api: false, in_use: false, calls: 0, in: 0, out: 0, source: "eigen" };
          const val = (k, f) => (own[k] ? own[k][f] : row(k)[f]);
          const edit = (k, f, v) => setSt({ ...st, prices: { ...st.prices, [ptab]: { ...own, [k]: { in: val(k, "in"), out: val(k, "out"), [f]: v } } } });
          return (<>
            <div className="row" style={{ justifyContent: "space-between", gap: ".6rem" }}>
              <div>
                <span className={`badge ${pv.enabled ? "ok" : "off"}`}>{pv.enabled ? tx("Gekoppeld en aan") : pv.linked ? tx("Gekoppeld, maar uit") : tx("Niet gekoppeld")}</span>{" "}
                {pv.active_model && <span className="muted">{tx("Model in gebruik")}: <code>{pv.active_model}</code></span>}
                {pv.enabled && <span className="muted"> · {pv.count_api} {tx("modellen actief in de API")}</span>}
              </div>
              <button type="button" className="btn sm" disabled={!pv.enabled || refBusy} onClick={refresh}>{refBusy ? tx("Modellen en prijzen ophalen…") : tx("Modellen verversen")}</button>
            </div>
            {pv.error && <div className="alert">{pv.error}</div>}
            {!pv.enabled && <small className="muted">{tx("Koppel en zet deze AI aan bij Admin → API keys om te zien welke modellen actief zijn in de API. De prijzen hieronder kun je alvast invullen.")}</small>}
            <div className="ai-prices">
              <div className="ai-prow head"><span>{tx("Model")}</span><span>{tx("Aanroepen (30 d)")}</span><span>{tx("Inkoop per miljoen tokens")} ({st.cost_currency})</span><span>{tx("Verkoop per miljoen tokens")} ({st.currency})</span><span /></div>
              {names.map((k) => {
                const r = row(k), pin = Number(val(k, "in")), pout = Number(val(k, "out"));
                const sin = pin * (1 + Number(st.margin_in) / 100) * rate, sout = pout * (1 + Number(st.margin_out) / 100) * rate;
                return (
                  <div className="ai-prow" key={k}>
                    <span className="ai-model"><code>{k}</code><span className="ai-status">{r.api && <span className="badge ok">{tx("Actief in de API")}</span>}{r.in_use && <span className="badge">{tx("In gebruik")}</span>}{!r.api && pv.enabled && <span className="badge off">{tx("Niet in de API")}</span>}{!own[k] && r.source === "geen" && <span className="badge off">{tx("Prijs ontbreekt")}</span>}</span></span>
                    <span className="ai-num" data-l={tx("Aanroepen (30 d)")}>{num(r.calls)}</span>
                    <span className="ai-pair" data-l={tx("Inkoop")}>
                      <label><em>{tx("In")}</em><input type="number" step="0.01" min="0" value={val(k, "in")} onChange={(e) => edit(k, "in", e.target.value)} /><small className="muted">{moneyTok(pin / 1e6, st.cost_currency)} / {tx("token")}</small></label>
                      <label><em>{tx("Uit")}</em><input type="number" step="0.01" min="0" value={val(k, "out")} onChange={(e) => edit(k, "out", e.target.value)} /><small className="muted">{moneyTok(pout / 1e6, st.cost_currency)} / {tx("token")}</small></label>
                    </span>
                    <span className="ai-pair" data-l={tx("Verkoop")}>
                      <label><em>{tx("In")}</em><strong>{money(sin, st.currency)}</strong><small className="muted">{moneyTok(sin / 1e6, st.currency)} / {tx("token")}</small></label>
                      <label><em>{tx("Uit")}</em><strong>{money(sout, st.currency)}</strong><small className="muted">{moneyTok(sout / 1e6, st.currency)} / {tx("token")}</small></label>
                    </span>
                    <span>{own[k] && <button type="button" className="btn sm" title={tx("Terug naar de standaardprijs")} onClick={() => { const { [k]: _gone, ...rest } = own; setSt({ ...st, prices: { ...st.prices, [ptab]: rest } }); }}>↺</button>}</span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn sm" style={{ justifySelf: "start" }} onClick={() => { const k = window.prompt(tx("Een model, of een deel van de modelnaam (de langste passende naam geldt)"), ""); if (k && k.trim()) setSt({ ...st, prices: { ...st.prices, [ptab]: { ...own, [k.trim().toLowerCase()]: { in: 0, out: 0 } } } }); }}>+ {tx("Model toevoegen")}</button>
          </>);
        })()}
        <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" onClick={save}>{tx("Opslaan")}</button></div>
      </div>)}
    </>
  );
}
