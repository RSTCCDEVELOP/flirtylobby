// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Tabs from "../../../../components/Tabs";
import EcologiTree, { nextGoal } from "../../../../components/EcologiTree";
import EcologiCosts from "../../../../components/EcologiCosts";
import { IconCheck, IconReceipt, IconSettings, IconTree } from "../../../../components/Icons";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { useEcologiOn } from "../../../../lib/ecologi";
import { tx } from "../../../../lib/t";
import Loading from "../../../../components/Loading";

const nf = (n, d = 0) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }).format(n); } catch { return String(n); } };
const money = (n, cur = "EUR") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR" }).format(n); } catch { return `${cur} ${nf(n, 2)}`; } };
const when = (iso) => { try { return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const TABS = [["overview", "Overzicht", <IconTree key="o" />], ["plant", "Bomen planten", <IconCheck key="p" />], ["sources", "Bijdragen", <IconTree key="b" />], ["costs", "Kosten", <IconReceipt key="k" />], ["history", "Geschiedenis", <IconReceipt key="h" />], ["settings", "Instellingen", <IconSettings key="s" />]];

// Super admin → Ecologi: plant trees with the Impact API of Ecologi and see what it did (Reporting API). Only there while the module and the API (Admin → API keys → Ecologi) are on.
export default function EcologiPage() {
  const on = useEcologiOn();
  const [tab, setTab] = useState("overview");
  useEffect(() => { try { const t = new URLSearchParams(window.location.search).get("tab"); if (t && ["overview", "plant", "sources", "costs", "history", "settings"].includes(t)) setTab(t); } catch {} }, []);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/ecologi/overview/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { if (on) load(); }, [on, load]);
  if (!on) {
    return (
      <>
        <h1>{tx("Ecologi")}</h1>
        <div className="card"><p style={{ margin: 0 }}>{tx("Ecologi staat uit. Zet de koppeling aan bij Admin → API keys → Ecologi (met je API-sleutel van Ecologi); dan staan hier de beheerschermen.")}</p>
          <p style={{ margin: ".8rem 0 0" }}><Link className="btn sm primary" href="/dashboard/admin/integrations">{tx("Naar API keys")}</Link></p></div>
      </>
    );
  }
  return (
    <div className="eco">
      <h1>{tx("easy2edit: bomen planten")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{tx("Plant bomen vanuit het systeem met de Impact API van Ecologi en laat de gevolgen zien met hun Reporting API. Ecologi factureert zelf, per maand.")}</p>
      <Tabs tabs={TABS} value={tab} onChange={(t) => { setTab(t); setMsg(null); }} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
      {!d ? <p className="muted">{<Loading compact />}</p> : (
        <>
          {tab === "overview" && <Overview d={d} go={setTab} />}
          {tab === "plant" && <Plant d={d} onDone={(m) => { setMsg(m); load(); }} />}
          {tab === "sources" && <Sources d={d} onSaved={(s) => setD({ ...d, settings: s })} setMsg={setMsg} />}
          {tab === "costs" && <CostsTab />}
          {tab === "history" && <History />}
          {tab === "settings" && <Settings d={d} onSaved={(s) => setD({ ...d, settings: s })} setMsg={setMsg} />}
        </>
      )}
    </div>
  );
}

const Tile = ({ label, value, sub, tone = "green" }) => (
  <div className={`eco-tile t-${tone}`}><span className="eco-ic" aria-hidden="true"><IconTree /></span><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>
);

function Overview({ d, go }) {
  const t = d.totals, r = d.report;
  return (
    <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      {d.settings.test_mode && <div className="alert" role="status">{tx("Testmodus staat aan: bestellingen worden gesimuleerd, er wordt niets gekocht. Zet dit uit bij Instellingen om echt te planten.")}</div>}
      <div className="eco-treebox"><EcologiTree value={t.trees} size={110} caption={false} /><div className="eco-treebox-text"><span className="eco-treebox-num">{nf(t.trees)}</span><strong>{tx("Alle bomen van deze website")}</strong><small>{tx("volgende mijlpaal")}: {nf(nextGoal(t.trees))}</small></div></div>
      <div className="eco-tiles three">
        <Tile label={tx("Bomen geplant vanuit dit systeem")} value={nf(t.trees)} sub={`${nf(t.orders)} ${tx("bestellingen")}`} tone="green" />
        <Tile label={tx("Bomen op je Ecologi-profiel")} value={r ? nf(r.trees) : "-"} sub={r ? `${nf(r.pending)} ${tx("nog in behandeling")} · ${r.username}` : tx("Vul de Ecologi-gebruikersnaam in bij de koppeling (Admin → API keys) voor de openbare cijfers.")} tone="sun" />
        <Tile label={tx("Testbestellingen")} value={nf(t.tests)} sub={tx("er is niets gekocht")} tone="sea" />
      </div>
      <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem" }}><button type="button" className="btn primary" onClick={() => go("plant")}>{tx("Bomen planten")}</button></div>
      <strong>{tx("Laatste bestellingen")}</strong>
      <OrderList orders={d.recent} empty={tx("Nog geen bestellingen.")} />
    </div>
  );
}

function OrderList({ orders, empty }) {
  if (!orders.length) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  return (
    <div style={{ display: "grid", gap: ".5rem" }}>
      {orders.map((o) => (
        <div key={o.id} className="card" style={{ display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap", padding: ".7rem .9rem", boxShadow: "none" }}>
          <span style={{ flex: "1 1 200px", minWidth: 0 }}><strong>{nf(o.number)} {o.number === 1 ? tx("boom") : tx("bomen")}</strong>{o.local ? ` · ${tx("lokaal")} (${o.country})` : ""}{o.name ? ` · ${o.name}` : ""}<br /><small className="muted">{when(o.at)}{o.by ? ` · ${o.by}` : ""}{o.source === "auto" ? ` · ${tx("automatisch")}` : ""}</small></span>
          {o.test && <span className="badge">{tx("test")}</span>}
          <span className={o.status === "ok" ? "badge ok" : "badge off"}>{o.status === "ok" ? tx("gelukt") : tx("mislukt")}</span>
          {o.amount !== null && <span>{money(o.amount, o.currency)}</span>}
          {o.tree_url && <a href={o.tree_url} target="_blank" rel="noopener noreferrer">{tx("Bekijk")}</a>}
          {o.error && <small className="muted" style={{ flexBasis: "100%" }}>{o.error}</small>}
        </div>
      ))}
    </div>
  );
}

function Plant({ d, onDone }) {
  const s = d.settings;
  const [f, setF] = useState({ number: 10, local: s.local, country: s.country, name: s.name, test: s.test_mode });
  const [busy, setBusy] = useState(false);
  const per = f.local ? d.prices.local[f.country] : d.prices.tree;
  const total = per * (Number(f.number) || 0);
  const go = async () => {
    const n = Number(f.number) || 0;
    if (!f.test && !(await confirmDialog(`${tx("Echt {0} bomen planten? Ecologi factureert dit (ongeveer {1}).", String(n), money(total))}`, { okLabel: tx("Planten"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(true);
    try {
      const r = await api("/ecologi/plant/", { method: "POST", body: { number: n, local: f.local, country: f.country, name: f.name, test: f.test } });
      onDone({ ok: true, text: f.test ? tx("Testbestelling gelukt: er is niets gekocht.") : tx("De bomen zijn besteld bij Ecologi.") + (r.order.tree_url ? ` ${r.order.tree_url}` : "") });
    } catch (e) { onDone({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  return (
    <div className="card eco-form" style={{ marginTop: "1rem" }}>
      <label>{tx("Aantal bomen")}
        <input type="number" min="1" max={s.max_per_order} value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
        <span className="row" style={{ justifyContent: "flex-start", gap: ".4rem", marginTop: ".4rem" }}>{[1, 10, 50, 100].map((n) => <button key={n} type="button" className="btn sm" onClick={() => setF({ ...f, number: n })}>{n}</button>)}</span>
      </label>
      <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.local} onChange={(e) => setF({ ...f, local: e.target.checked })} /><span /></span><span>{tx("Lokaal planten")} <small className="muted">{tx("In een land van je keuze, duurder dan de standaard.")}</small></span></label>
      {f.local && <label>{tx("Land")}<select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{Object.entries(d.countries).map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>}
      <label>{tx("Naam bij de bomen")} <small className="muted">{tx("(zichtbaar bij Ecologi)")}</small><select value={f.name === "easy2edit" ? "easy2edit" : "site"} onChange={(e) => setF({ ...f, name: e.target.value })}><option value="site">{tx("Naam van de website")}</option><option value="easy2edit">easy2edit</option></select></label>
      <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.test} onChange={(e) => setF({ ...f, test: e.target.checked })} /><span /></span><span>{tx("Testbestelling")} <small className="muted">{tx("Ecologi antwoordt als bij een echte bestelling, maar er wordt niets gekocht.")}</small></span></label>
      <div className="alert" role="status" style={{ margin: 0 }}>{tx("Indicatie")}: {nf(Number(f.number) || 0)} × {money(per)} = <strong>{money(total)}</strong>. {tx("Ecologi factureert de echte prijs, per maand.")}</div>
      <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn primary" disabled={busy || !(Number(f.number) > 0)} onClick={go}>{busy ? tx("Bezig…") : f.test ? tx("Testbestelling doen") : tx("Bomen planten")}</button></div>
    </div>
  );
}

function CostsTab() {
  const [d, setD] = useState(null);
  useEffect(() => { api("/ecologi/stats/?months=12").then(setD).catch(() => setD(false)); }, []);
  return <div style={{ marginTop: "1rem" }}>{d ? <EcologiCosts d={d} /> : <p className="muted">{d === false ? tx("De cijfers zijn niet beschikbaar.") : <Loading compact />}</p>}</div>;
}

function History() {
  const [rows, setRows] = useState(null);
  const [st, setSt] = useState("");
  useEffect(() => { api(`/ecologi/orders/${st ? `?status=${st}` : ""}`).then((r) => setRows(r.orders)).catch(() => setRows([])); }, [st]);
  return (
    <div style={{ display: "grid", gap: ".8rem", marginTop: "1rem" }}>
      <span className="pb-seg" style={{ justifySelf: "start" }}>{[["", "Alles"], ["ok", "Gelukt"], ["failed", "Mislukt"]].map(([k, l]) => <button key={k} type="button" className={st === k ? "on" : ""} onClick={() => setSt(k)}>{tx(l)}</button>)}</span>
      {!rows ? <p className="muted">{<Loading compact />}</p> : <OrderList orders={rows} empty={tx("Geen bestellingen.")} />}
    </div>
  );
}

function Settings({ d, onSaved, setMsg }) {
  const [f, setF] = useState(d.settings);
  const save = async (patch) => {
    const next = { ...f, ...patch };
    setF(next);
    try { onSaved(await api("/ecologi/settings/", { method: "PATCH", body: patch })); setMsg({ ok: true, text: tx("Opgeslagen.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  return (
    <div className="card eco-form" style={{ marginTop: "1rem" }}>
      <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.test_mode} onChange={(e) => save({ test_mode: e.target.checked })} /><span /></span><span>{tx("Testmodus")} <small className="muted">{tx("Aan (standaard): nieuwe bestellingen zijn testbestellingen. Uit: er wordt echt geplant en Ecologi factureert.")}</small></span></label>
      <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.local} onChange={(e) => save({ local: e.target.checked })} /><span /></span><span>{tx("Standaard lokaal planten")}</span></label>
      {f.local && <label>{tx("Land")}<select value={f.country} onChange={(e) => save({ country: e.target.value })}>{Object.entries(d.countries).map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>}
      <label>{tx("Naam bij de bomen")}<select value={f.name === "easy2edit" ? "easy2edit" : "site"} onChange={(e) => { setF({ ...f, name: e.target.value }); save({ name: e.target.value }); }}><option value="site">{tx("Naam van de website")}</option><option value="easy2edit">easy2edit</option></select></label>
      <div className="grid2 span">
        <label>{tx("Veiligheidsgrens per bestelling")} <small className="muted">{tx("bomen")}</small><input type="number" min="1" value={f.max_per_order} onChange={(e) => setF({ ...f, max_per_order: e.target.value })} onBlur={() => save({ max_per_order: Number(f.max_per_order) })} /></label>
        <label>{tx("Elke maand automatisch planten")} <small className="muted">{tx("bomen, 0 = uit")}</small><input type="number" min="0" value={f.monthly_trees} onChange={(e) => setF({ ...f, monthly_trees: e.target.value })} onBlur={() => save({ monthly_trees: Number(f.monthly_trees) })} /></label>
      </div>
      {f.last_auto_month && <small className="muted">{tx("Laatst automatisch geplant in")}: {f.last_auto_month}</small>}
      <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.show_on_site} onChange={(e) => save({ show_on_site: e.target.checked })} /><span /></span><span>{tx("Aantal bomen tonen in het energievenster van de website")} <small className="muted">{tx("Gebruikt de openbare cijfers van je Ecologi-profiel (gebruikersnaam bij de koppeling).")}</small></span></label>
    </div>
  );
}

const Num = ({ label, unit, hint, value, onChange, onBlur, min = 0 }) => (
  <label style={{ display: "grid", gap: ".25rem" }}>{label}
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}><input type="number" min={min} value={value} onChange={onChange} onBlur={onBlur} style={{ maxWidth: 160 }} />{unit && <span className="muted">{unit}</span>}</span>
    {hint && <small className="muted">{hint}</small>}
  </label>
);

// The contributions: four sources that are settled once a month (the previous month), under a monthly maximum.
function Sources({ d, onSaved, setMsg }) {
  const [f, setF] = useState(d.settings);
  const [plan, setPlan] = useState(null);
  const loadPlan = useCallback(() => api("/ecologi/stats/?months=3").then((r) => setPlan(r.now)).catch(() => {}), []);
  useEffect(() => { loadPlan(); }, [loadPlan]);
  const save = async (patch) => {
    setF((x) => ({ ...x, ...patch }));
    try { onSaved(await api("/ecologi/settings/", { method: "PATCH", body: patch })); setMsg({ ok: true, text: tx("Opgeslagen.") }); loadPlan(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const blur = (k) => () => save({ [k]: Number(f[k]) || 0 });
  const ch = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const Card = ({ n, title, children }) => <section className="card" style={{ display: "grid", gap: ".7rem", padding: "1rem 1.1rem", boxShadow: "none" }}><strong><span className="badge" style={{ marginRight: ".5rem" }}>{n}</span>{tx(title)}</strong>{children}</section>;
  return (
    <div className="eco-cols" style={{ marginTop: "1rem" }}>
      <div className="card span" style={{ display: "grid", gap: ".8rem", padding: "1rem 1.1rem" }}>
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.auto_on} onChange={(e) => save({ auto_on: e.target.checked })} /><span /></span><span>{tx("Automatische bijdragen")} <small className="muted">{tx("Elke maand rekent het systeem de vorige maand af en plant de bomen van de bronnen hieronder (in de testmodus als test).")}</small></span></label>
        <Num label={tx("Maximum per maand")} unit={tx("bomen, 0 = geen limiet")} hint={tx("De automatische bijdragen planten samen nooit meer dan dit. Handmatige bestellingen en de giften van de beheerder tellen hier niet in mee.")} value={f.cap_trees_month} onChange={ch("cap_trees_month")} onBlur={blur("cap_trees_month")} />
      </div>
      <Card n="1" title="Gebruik van de website door bezoekers">
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.visitors_on} onChange={(e) => save({ visitors_on: e.target.checked })} /><span /></span><span>{tx("Een boom voor elk aantal paginabezoeken")}</span></label>
        {f.visitors_on && <Num label={tx("Eén boom per")} unit={tx("paginabezoeken")} value={f.visitors_per} onChange={ch("visitors_per")} onBlur={blur("visitors_per")} min={1} />}
      </Card>
      <Card n="2" title="Belasting van de machine: gebruik van energie">
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.machine_on} onChange={(e) => save({ machine_on: e.target.checked })} /><span /></span><span>{tx("Bomen om de geschatte CO2 van de paginabezoeken te compenseren")} <small className="muted">{tx("Uit de meting van het gewicht van de pagina's (module Energie).")}</small></span></label>
        {f.machine_on && <Num label={tx("Eén boom per")} unit={tx("kg CO2")} hint={tx("Een aanname: een boom neemt ongeveer 22 kg CO2 per jaar op.")} value={f.machine_kg} onChange={ch("machine_kg")} onBlur={blur("machine_kg")} min={1} />}
      </Card>
      <Card n="3" title="Gebruik van easy2edit, door easy2edit">
        <Num label={tx("Bomen per maand die easy2edit voor deze website plant")} unit={tx("bomen")} hint={tx("Dit plant easy2edit zelf, met een eigen Ecologi-account: het komt niet van jouw koppeling en telt niet mee in het maximum. Het wordt hier en in de cijfers getoond.")} value={f.e2e_trees} onChange={ch("e2e_trees")} onBlur={blur("e2e_trees")} />
      </Card>
      <Card n="4" title="Gebruik van easy2edit, door de gebruiker">
        <Num label={tx("Vast aantal bomen per maand (door jou ingesteld)")} unit={tx("bomen")} value={f.monthly_trees} onChange={ch("monthly_trees")} onBlur={blur("monthly_trees")} />
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={f.admin_enabled} onChange={(e) => save({ admin_enabled: e.target.checked })} /><span /></span><span>{tx("De beheerder mag zelf bijdragen")} <small className="muted">{tx("Hij krijgt een tegel Bomen en giften bij Admin → Systeem: een eigen maandelijkse bijdrage en giften. Het gaat via deze Ecologi-koppeling.")}</small></span></label>
        {f.admin_enabled && <Num label={tx("Het meeste dat de beheerder per gift en per maand mag")} unit={tx("bomen")} value={f.admin_max_trees} onChange={ch("admin_max_trees")} onBlur={blur("admin_max_trees")} />}
        {f.admin_enabled && <small className="muted">{tx("Zijn maandelijkse bijdrage nu")}: <strong>{f.admin_trees}</strong> {tx("bomen")}</small>}
      </Card>
      {plan && (
        <div className="alert" role="status" style={{ margin: 0 }}>
          <strong>{tx("Deze maand (nu)")}</strong>: {plan.rows.map((r) => `${tx(r.key === "visitors" ? "Bezoekers" : r.key === "machine" ? "Machine (energie)" : "Gebruiker (beheerder)")}: ${r.trees}`).join(" · ")} · {tx("totaal")} {plan.own_total}{plan.cap ? ` / ${plan.cap}` : ""} {tx("bomen")}{plan.easy2edit ? ` · ${tx("easy2edit")}: ${plan.easy2edit}` : ""}
        </div>
      )}
    </div>
  );
}
