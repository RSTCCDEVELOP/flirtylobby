// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import EcologiTree, { nextGoal } from "../../../../components/EcologiTree";
import Tabs from "../../../../components/Tabs";
import { IconReceipt, IconTree } from "../../../../components/Icons";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";
import Loading from "../../../../components/Loading";

const nf = (n, d = 0) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }).format(n); } catch { return String(n); } };
const money = (n, cur = "EUR") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR" }).format(n); } catch { return `${cur} ${nf(n, 2)}`; } };
const when = (iso) => { try { return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

// Admin → Systeem → Bomen en giften: the administrator sets his own monthly contribution and gives trees himself (through the Ecologi link of the superadmin). Only when the superadmin allowed it.


function MyCosts({ s }) {
  const cur = s.currency;
  const MON = (ym) => { try { return new Date(`${ym}-01T00:00:00`).toLocaleDateString([], { month: "short" }); } catch { return ym; } };
  const max = Math.max(1, ...s.months.map((m) => m.cost), s.month_estimate);
  return (
    <div className="eco-costs" style={{ marginTop: "1rem" }}>
      <div className="eco-panel eco-forecast">
        <div className="eco-forecast-head"><div><strong>{tx("Verwachte kosten deze maand, per onderdeel")}</strong><br /><small className="muted">{money(s.per_tree, cur)} {tx("per boom")}{s.max_eur ? ` · ${tx("maximum")} ${money(s.max_eur, cur)}` : ""}</small></div><div className="eco-forecast-total"><small>{tx("Totaal verwacht")}</small><strong>{money(s.month_estimate, cur)}</strong></div></div>
        <div className="eco-rows">
          {s.parts.map((x) => (
            <div key={x.key} className={`eco-part${x.on ? "" : " off"}`}>
              <span className="eco-part-name">{tx(x.name)}</span>
              <span className="eco-part-bar"><i style={{ width: `${s.month_estimate ? Math.max(x.amount ? 3 : 0, (x.amount / s.month_estimate) * 100) : 0}%` }} /></span>
              <span className="eco-part-trees">{nf(x.trees)} {tx("bomen")}</span>
              <b>{x.on ? money(x.amount, cur) : tx("uit")}</b>
            </div>
          ))}
        </div>
        {s.cut_trees > 0 && <small className="muted">{nf(s.cut_trees)} {tx("bomen")} {tx("bespaard door het maximum")}.</small>}
      </div>
      <div className="eco-tiles">
        <div className="eco-tile t-green"><span>{tx("Geschatte kosten deze maand")}</span><strong>{money(s.month_estimate, cur)}</strong><small>{tx("al betaald")}: {money(s.this_month_paid, cur)}</small></div>
        <div className="eco-tile t-sun"><span>{tx("Geschat per jaar")}</span><strong>{money(s.year_estimate, cur)}</strong></div>
        <div className="eco-tile t-sand"><span>{tx("Betaald, laatste 12 maanden")}</span><strong>{money(s.total_12, cur)}</strong></div>
        <div className="eco-tile t-sea"><span>{tx("Bomen geplant, laatste 12 maanden")}</span><strong>{nf(s.trees_12)}</strong></div>
      </div>
      <div className="eco-panel">
        <strong>{tx("Kosten en resultaat per maand")}</strong>
        <div className="eco-bars" role="img" aria-label={tx("Kosten per maand")}>
          {s.months.map((m, i) => (
            <div key={m.month} className="eco-bar" title={`${MON(m.month)}: ${money(m.cost, cur)} · ${m.trees} ${tx("bomen")}`}>
              <em style={{ height: `${Math.max(3, ((i === s.months.length - 1 ? Math.max(m.cost, s.month_estimate) : m.cost) / max) * 100)}%` }} className={i === s.months.length - 1 ? "est" : ""} /><span>{MON(m.month)}</span>
            </div>
          ))}
        </div>
        <div className="eco-rows">
          {[...s.months].reverse().map((m, i) => (
            <div key={m.month} className="eco-row eco-month"><span>{new Date(`${m.month}-01T00:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })}</span><span className="muted">{nf(m.trees)} {tx("bomen")}</span><b>{i === 0 ? `${money(Math.max(m.cost, s.month_estimate), cur)} (${tx("geschat")})` : money(m.cost, cur)}</b></div>
          ))}
        </div>
        <small className="muted">{tx("Gestreept: geschat voor de lopende maand.")} {tx("Ecologi factureert maandelijks de eigenaar van de koppeling; de bedragen zijn een indicatie.")}</small>
      </div>
    </div>
  );
}

export default function TreesAdminPage() {
  const [tab, setTab] = useState("mine");
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [funcs, setFuncs] = useState({});
  const [maxEur, setMaxEur] = useState(0);
  const [form, setForm] = useState({ admin_trees: 0, admin_name: "" });
  const [give, setGive] = useState(5);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/ecologi/me/").then((r) => { setD(r); setForm({ admin_trees: r.settings.admin_trees, admin_name: r.settings.admin_name }); setMaxEur(r.settings.admin_max_eur || 0); setFuncs({}); }).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  const save = async (patch) => {
    try { const r = await api("/ecologi/me/", { method: "PATCH", body: patch }); setD(r); setForm({ admin_trees: r.settings.admin_trees, admin_name: r.settings.admin_name }); setMaxEur(r.settings.admin_max_eur || 0); setFuncs({}); setMsg({ ok: true, text: tx("Opgeslagen.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const doGive = async () => {
    const n = Number(give) || 0;
    if (!d.settings.test_mode && !(await confirmDialog(tx("Echt {0} bomen geven? Ecologi factureert dit (ongeveer {1}).", String(n), money(n * d.price, d.currency)), { okLabel: tx("Geven"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(true); setMsg(null);
    try { await api("/ecologi/give/", { method: "POST", body: { number: n } }); setMsg({ ok: true, text: d.settings.test_mode ? tx("Testgift gelukt: er is niets gekocht.") : tx("Bedankt! De bomen zijn besteld.") }); await load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  if (!d) return <><h1>{tx("Bomen en giften")}</h1>{msg ? <div className="alert">{msg.text}</div> : <p className="muted">{<Loading compact />}</p>}</>;
  const max = d.settings.admin_max_trees;
  const setFunc = (k, patch, send = true) => { const next = { ...funcs, [k]: { ...(funcs[k] || {}), ...patch } }; setFuncs(next); if (send) save({ admin_funcs: { [k]: patch } }); };
  return (
    <div className="eco">
      <h1>{tx("Bomen en giften")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{tx("Plant bomen voor je website met easy2edit: stel je eigen maandelijkse bijdrage in en geef zelf bomen. Het telt mee als bijdrage van de gebruiker.")}</p>
      <Tabs tabs={[["mine", "Mijn bijdrage", <IconTree key="m" />], ["costs", "Kosten en resultaat", <IconReceipt key="k" />], ["history", "Geschiedenis", <IconReceipt key="h" />]]} value={tab} onChange={(t) => { setTab(t); setMsg(null); }} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
      {d.settings.test_mode && <div className="alert" role="status">{tx("Testmodus: bijdragen en giften zijn nu proefbestellingen; er wordt niets gekocht.")}</div>}
      {tab === "mine" && (
        <div className="eco-cols two" style={{ marginTop: "1rem" }}>
          <div className="span"><div className="eco-treebox"><EcologiTree value={d.total_trees} size={110} caption={false} /><div className="eco-treebox-text"><span className="eco-treebox-num">{nf(d.total_trees)}</span><strong>{tx("Mijn bomen")}</strong><small>{tx("volgende mijlpaal")}: {nf(nextGoal(d.total_trees))}</small></div></div></div>
          <div className="eco-tiles three span">
            <div className="eco-tile t-green"><span className="eco-ic" aria-hidden="true"><IconTree /></span><span>{tx("Door jou gegeven")}</span><strong>{nf(d.total_trees)} {tx("bomen")}</strong></div>
            <div className="eco-tile t-sun"><span className="eco-ic" aria-hidden="true"><IconTree /></span><span>{tx("Bomen op het Ecologi-profiel")}</span><strong>{d.report ? nf(d.report.trees) : "-"}</strong></div>
            <div className="eco-tile t-sea"><span className="eco-ic" aria-hidden="true"><IconTree /></span><span>{tx("Geschatte kosten per maand")}</span><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency || "EUR" }).format((Number(d.settings.admin_trees) || 0) * (d.price || 0))}</strong><small>{nf(d.settings.admin_trees || 0)} {tx("bomen")} × {new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency || "EUR" }).format(d.price || 0)}</small></div>
          </div>
          <div className="eco-stack">
          <section className="card" style={{ display: "grid", gap: ".8rem" }}>
            <strong>{tx("Mijn maandelijkse bijdrage")}</strong>
            <label style={{ display: "grid", gap: ".25rem" }}>{tx("Bomen per maand")}
              <span style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", whiteSpace: "nowrap" }}><input type="number" min="0" max={max} value={form.admin_trees} onChange={(e) => setForm({ ...form, admin_trees: e.target.value })} onBlur={() => save({ admin_trees: Number(form.admin_trees) || 0 })} style={{ maxWidth: 140 }} /><span className="muted">{tx("(hoogstens {0})", String(max))}</span></span>
              <small className="muted">{tx("Elke maand wordt de vorige maand afgerekend; de volgende afrekening is op {0}.", new Date(d.next_settlement).toLocaleDateString())}</small>
            </label>
            <label style={{ display: "grid", gap: ".25rem" }}>{tx("Naam bij de bomen")} <small className="muted">{tx("(zichtbaar bij Ecologi)")}</small><select value={form.admin_name === "easy2edit" ? "easy2edit" : "site"} onChange={(e) => { setForm({ ...form, admin_name: e.target.value }); save({ admin_name: e.target.value }); }}><option value="site">{tx("Naam van de website")}</option><option value="easy2edit">easy2edit</option></select></label>
          </section>
          <section className="card" style={{ display: "grid", gap: ".8rem" }}>
            <strong>{tx("Nu bomen geven")}</strong>
            <span className="row" style={{ justifyContent: "flex-start", gap: ".4rem", flexWrap: "wrap" }}>{[1, 5, 10, 25].filter((n) => n <= max).map((n) => <button key={n} type="button" className={`btn sm${Number(give) === n ? " primary" : ""}`} onClick={() => setGive(n)}>{n}</button>)}</span>
            <label style={{ display: "grid", gap: ".25rem" }}>{tx("Aantal bomen")}<input type="number" min="1" max={max} value={give} onChange={(e) => setGive(e.target.value)} style={{ maxWidth: 140 }} /></label>
            <small className="muted">{tx("Indicatie")}: {nf(Number(give) || 0)} × {money(d.price, d.currency)} = <strong>{money((Number(give) || 0) * d.price, d.currency)}</strong>. {tx("Ecologi factureert de echte prijs, per maand.")}</small>
            <div><button type="button" className="btn primary" disabled={busy || !(Number(give) > 0) || Number(give) > max} onClick={doGive}>{busy ? tx("Bezig…") : tx("Bomen geven")}</button></div>
          </section>
          </div>
          <section className="card" style={{ display: "grid", gap: ".8rem" }}>
            <strong>{tx("Voor welke functie plant ik bomen")}</strong>
            <small className="muted">{tx("Zet een functie van easy2edit aan: voor elk aantal gebruik wordt er een boom geplant, bij de maandelijkse afrekening.")}</small>
            <div className="eco-rows">
              {(d.plan?.rows || []).map((r) => (
                <div key={r.key} className="eco-func">
                  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!(funcs[r.key] ? funcs[r.key].on : r.on)} onChange={(e) => setFunc(r.key, { on: e.target.checked })} /><span /></span><span><strong>{tx(r.name)}</strong><br /><small className="muted">{tx("Deze maand")}: {nf(r.count, 1)} {tx(r.unit)} → {nf(r.trees)} {tx("bomen")}</small></span></label>
                  <span className="eco-func-per">{tx("Een boom per")} <input type="number" min="1" value={funcs[r.key]?.per ?? r.per} onChange={(e) => setFunc(r.key, { per: e.target.value }, false)} onBlur={(e) => setFunc(r.key, { per: Number(e.target.value) || 1 })} style={{ width: 90 }} /> {tx(r.unit)}</span>
                </div>
              ))}
            </div>
            <label style={{ display: "grid", gap: ".25rem" }}>{tx("Maximaal bedrag per maand")} <small className="muted">{tx("(0 = geen limiet; bepaalt het maximum aantal bomen)")}</small>
              <span style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}>€ <input type="number" min="0" step="0.5" value={maxEur} onChange={(e) => setMaxEur(e.target.value)} onBlur={() => save({ admin_max_eur: Number(maxEur) || 0 })} style={{ maxWidth: 140 }} /></span>
            </label>
            <div className="alert ok" role="status" style={{ margin: 0 }}>{tx("Deze maand")}: <strong>{nf(d.plan?.trees || 0)} {tx("bomen")}</strong> ≈ <strong>{money(d.plan?.amount || 0, d.currency)}</strong>{d.plan?.cut ? ` · ${nf(d.plan.cut)} ${tx("afgekapt door het maximum")}` : ""}</div>
          </section>
        </div>
      )}
      {tab === "costs" && <MyCosts s={d.stats} />}
      {tab === "history" && (
        <div style={{ display: "grid", gap: ".5rem", marginTop: "1rem" }}>
          {!d.orders.length ? <p className="muted">{tx("Nog geen bijdragen of giften.")}</p> : d.orders.map((o) => (
            <div key={o.id} className="card" style={{ display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap", padding: ".7rem .9rem", boxShadow: "none" }}>
              <span style={{ flex: "1 1 200px" }}><strong>{nf(o.number)} {o.number === 1 ? tx("boom") : tx("bomen")}</strong>{o.source === "user" ? ` · ${tx("maandelijkse bijdrage")}` : ` · ${tx("gift")}`}<br /><small className="muted">{when(o.at)}{o.by ? ` · ${o.by}` : ""}</small></span>
              {o.test && <span className="badge">{tx("test")}</span>}
              <span className={o.status === "ok" ? "badge ok" : "badge off"}>{o.status === "ok" ? tx("gelukt") : tx("mislukt")}</span>
              {o.tree_url && <a href={o.tree_url} target="_blank" rel="noopener noreferrer">{tx("Bekijk")}</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
