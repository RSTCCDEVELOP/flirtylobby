// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { LineChart, Donut } from "./Charts";
import { ADVICE_STATUS, ADVICE_TEXT } from "./EnergyAdvice";
import { fmtBytes, fmtG, Rating } from "./EnergyBlocks";
import { IconBolt, IconBriefcase, IconChart, IconGlobe, IconLeaf, IconUsers } from "./Icons";
import Loading from "./Loading";
import Tabs from "./Tabs";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

const when = (v) => (v ? new Date(v).toLocaleString() : "–");
const num = (v) => Number(v || 0).toLocaleString();
const REASON = {
  pending: "Keur deze website eerst goed.",
  nokey: "Deze website heeft nog geen koppelsleutel: die wordt uitgewisseld bij het eerstvolgende inloggen van een beheerder op die website.",
  unsafe: "Het API-adres van deze website is niet veilig om aan te roepen (https is nodig).",
  unreachable: "De website is niet bereikbaar via zijn API.",
  refused: "De website weigert de aanvraag.",
};
const errText = (e) => (e?.data?.reason && REASON[e.data.reason] ? tx(REASON[e.data.reason]) : errorText(e));

const Stat = ({ label, value, sub }) => (
  <div className="card stat" style={{ padding: ".7rem .9rem", gap: ".2rem" }}>
    <small className="muted">{label}</small>
    <strong style={{ fontSize: "1.35rem", fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    {sub && <small className="muted">{sub}</small>}
  </div>
);
const Tiles = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: ".6rem" }}>{children}</div>;
const Panel = ({ title, children }) => (
  <div className="card" style={{ display: "grid", gap: ".6rem", alignContent: "start", minWidth: 0 }}>
    <strong>{title}</strong>
    {children}
  </div>
);
const Panels = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: ".8rem" }}>{children}</div>;
function BarList({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <small className="muted">–</small>;
  return (
    <ul className="bar-list">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`}>
          <span className="bl-label" title={r.label}>{r.label}{r.ai && <small className="muted"> · AI</small>}</span>
          <span className="bl-bar"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="bl-val">{num(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// The page statistics of the website (the plugin Statistics): visitors, bots, where they come from, the pages.
function PluginSwitch({ on, busy, onChange }) {
  return (
    <div className="card" style={{ padding: ".8rem 1rem" }}>
      <label className="check sec-toggle">
        <span className="switch"><input type="checkbox" checked={on} disabled={busy} onChange={(e) => onChange(e.target.checked)} /><span /></span>
        <span>{tx("Statistieken verzamelen")}<small className="muted" style={{ display: "block" }}>{on ? tx("Bezoeken en bots worden geteld door de statistieken-plugin.") : tx("Zet de plugin aan om bezoekers, bots en pagina's te meten. Er is geen geschiedenis: de cijfers beginnen vanaf het aanzetten.")}</small></span>
      </label>
    </div>
  );
}

function Stats({ d, run, busy }) {
  const toggle = async (on) => {
    if (!on && !(await confirmDialog(tx("De statistieken-plugin uitzetten? Er worden dan geen bezoeken meer geteld; wat al is verzameld blijft bewaard."), { okLabel: tx("Uitzetten"), danger: true }))) return;
    run({ action: "plugin", name: "statistics", enabled: on }, on ? tx("De statistieken-plugin is aangezet. De cijfers beginnen vanaf nu.") : tx("De statistieken-plugin is uitgezet."), "stats");
  };
  if (!d.available) return <PluginSwitch on={false} busy={busy} onChange={toggle} />;
  const t = d.totals, s = d.series;
  const kind = { direct: "Direct", search: "Zoekmachine", ai: "AI-assistent", social: "Social", other: "Overige sites" };
  return (
    <>
      <PluginSwitch on busy={busy} onChange={toggle} />
      <Tiles>
        <Stat label={tx("Bezoekers")} value={num(t.visitors)} sub={tx("laatste {0} dagen", d.days)} />
        <Stat label={tx("Paginaweergaven")} value={num(t.page_views)} />
        <Stat label={tx("Klikken uit zoekmachines")} value={num(t.search_clicks)} />
        <Stat label={tx("Klikken uit AI-assistenten")} value={num(t.ai_clicks)} />
        <Stat label={tx("Bezoeken van zoekbots")} value={num(t.bot_search)} />
        <Stat label={tx("Bezoeken van AI-bots")} value={num(t.bot_ai)} />
      </Tiles>
      <Panels>
        <Panel title={tx("Bezoekers en paginaweergaven per dag")}>
          <LineChart dates={d.dates} series={[{ label: tx("Bezoekers"), values: s.visitors, total: t.visitors }, { label: tx("Paginaweergaven"), values: s.page_views, total: t.page_views, color: "var(--orange)" }]} />
        </Panel>
        <Panel title={tx("Bezoeken van bots per dag")}>
          <LineChart dates={d.dates} area={false} series={[{ label: tx("Zoekbots"), values: s.bot_search, total: t.bot_search }, { label: tx("AI-bots"), values: s.bot_ai, total: t.bot_ai, color: "#8b5cf6" }, { label: tx("Overig"), values: s.bot_other, total: t.bot_other, color: "#16a34a" }]} />
        </Panel>
        <Panel title={tx("Waar bezoekers vandaan komen")}>
          {d.referrers.length ? <Donut parts={d.referrers.map((r) => ({ label: tx(kind[r.label] || r.label), value: r.value }))} /> : <small className="muted">–</small>}
        </Panel>
        <Panel title={tx("Bots per naam")}><BarList rows={d.bots} /></Panel>
        <Panel title={tx("Meest bezochte pagina's")}><BarList rows={d.pages} /></Panel>
        <Panel title={tx("Beste landingspagina's (uit zoek en AI)")}><BarList rows={d.landing} /></Panel>
      </Panels>
    </>
  );
}

// The energy use of the website (the module Energy): the score now and after the advice, the course per day, and the advice with what it is expected to give.
function Energy({ d, run, busy, reload }) {
  const a = d.advice, sm = d.summary, b = d.benchmark;
  const same = a.after_apply.co2_g === a.current.co2_g && a.after_all.co2_g === a.current.co2_g;  // nothing that can be won with what is known
  const dates = d.series.map((x) => x.date);
  const Score = ({ label, s }) => (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: ".8rem", padding: ".8rem 1rem" }}>
      <Rating r={s.rating} size={56} />
      <div style={{ display: "grid", gap: ".1rem" }}><small className="muted">{label}</small><strong>{fmtG(s.co2_g)}</strong><small className="muted">{fmtBytes(s.avg_bytes)}</small></div>
    </div>
  );
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: ".7rem" }}>
        <Score label={tx("Nu")} s={a.current} />
        {same ? (
          <div className="card" style={{ gridColumn: "span 2", display: "grid", gap: ".5rem", alignContent: "center" }}>
            <strong>{tx("Er zijn geen verbeteringen die hier kunnen worden toegepast.")}</strong>
            {!a.has_scan && <small className="muted">{tx("Meet de pagina's van de website voor een nauwkeuriger advies (compressie, productiebuild).")}</small>}
            <span className="row" style={{ justifyContent: "flex-start", gap: ".5rem" }}>
              <button type="button" className="btn sm primary" disabled={busy} onClick={() => run({ action: "energy_scan" }, tx("De meting is gestart. Vernieuw dit tabblad over een minuut."))}><IconLeaf /> {tx("Meting starten")}</button>
              <button type="button" className="btn sm" disabled={busy} onClick={() => reload("energy")}>{tx("Vernieuwen")}</button>
            </span>
          </div>
        ) : (
          <>
            <Score label={tx("Na de adviezen die hier kunnen")} s={a.after_apply} />
            <Score label={tx("Na ook de handmatige stappen")} s={a.after_all} />
          </>
        )}
      </div>
      <Tiles>
        <Stat label={tx("Paginaweergaven")} value={num(sm.views)} sub={tx("laatste {0} dagen", d.period_days)} />
        <Stat label={tx("Gemiddeld paginagewicht")} value={fmtBytes(sm.avg_page_bytes)} sub={b.vs_pct != null ? `${b.vs_pct > 0 ? "+" : ""}${b.vs_pct}% ${tx("t.o.v. een gemiddelde pagina")}` : ""} />
        <Stat label={tx("CO₂ per pagina")} value={fmtG(sm.avg_co2_g)} />
        <Stat label={tx("Energie")} value={`${sm.total_kwh} kWh`} />
        <Stat label={tx("Uitstoot")} value={`${sm.total_co2_kg} kg`} sub="CO₂" />
        <Stat label={tx("Verzoeken per pagina")} value={sm.avg_requests} />
      </Tiles>
      <Panel title={tx("CO₂ per pagina per dag")}>
        {d.series.length
          ? <LineChart dates={dates} totals={false} format={(v) => fmtG(v)} series={[{ label: tx("Deze website"), values: d.series.map((x) => x.avg_co2_g) }, { label: tx("Gemiddelde webpagina"), values: d.series.map(() => b.co2_g), dashed: true, color: "var(--muted)" }]} />
          : <small className="muted">{tx("Nog geen metingen.")}</small>}
      </Panel>
      <Panel title={tx("Adviezen en verbeteringen")}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: ".6rem" }}>
          {a.items.map((i) => {
            const [label, cls] = ADVICE_STATUS[i.status] || ["", "badge"];
            return (
              <li key={i.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".8rem", flexWrap: "wrap" }}>
                <span style={{ minWidth: 0 }}>
                  <strong>{tx((ADVICE_TEXT[i.key] || [i.key])[0])}</strong>
                  {i.saving > 0 && <small className="muted" style={{ display: "block" }}>{tx("Bespaart ongeveer {0} per pagina", fmtBytes(i.saving))}</small>}
                </span>
                <span className={cls}>{tx(label)}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

// Super admin+ -> Site manager -> view: what the website itself says when the easy2edit server asks it through its API (users, statistics, energy, reseller, AI).
export function SiteView({ site, onClose }) {
  const [tab, setTab] = useState("users");
  const [data, setData] = useState({});
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const reload = (part) => { setData((x) => { const n = { ...x }; delete n[part]; return n; }); setErr((x) => { const n = { ...x }; delete n[part]; return n; }); };
  // an action on the website, through its API (switch the plugin Statistics, start a measurement)
  const run = async (body, okText, part) => {
    setBusy(true); setNote(null);
    try { await api(`/system/sites/${site.id}/action/`, { method: "POST", body }); setNote({ ok: true, text: okText }); if (part) reload(part); }
    catch (e) { setNote({ ok: false, text: errText(e) }); }
    setBusy(false);
  };
  useEffect(() => {
    if (data[tab] || err[tab]) return;
    api(`/system/sites/${site.id}/info/?part=${tab}`).then((d) => setData((x) => ({ ...x, [tab]: d }))).catch((e) => setErr((x) => ({ ...x, [tab]: e })));
  }, [tab, site.id, data, err]);
  const d = data[tab];
  const money = (v, cur) => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR" }).format(v || 0); } catch { return `${v}`; } };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal wide" style={{ width: "min(1040px, 96vw)", maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: ".8rem" }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{site.name || site.url}</h2>
          <button type="button" className="btn sm" onClick={onClose}>{tx("Sluiten")}</button>
        </div>
        <small className="muted">{site.url} · {tx("Gevraagd bij de website zelf via zijn API")}</small>
        <Tabs value={tab} onChange={(k) => { setTab(k); setNote(null); }} tabs={[["users", "Gebruikers", <IconUsers key="u" />], ["stats", "Statistieken", <IconChart key="s" />], ["energy", "Energie", <IconLeaf key="e" />], ["reseller", "Reseller", <IconBriefcase key="r" />], ["ai", "AI-gebruik", <IconBolt key="a" />]]} />
        {note && <div className={note.ok ? "alert ok" : "alert"}>{note.text}</div>}
        {err[tab] && <div className="alert">{errText(err[tab])}</div>}
        {!d && !err[tab] && <p className="muted"><Loading /></p>}
        {d && tab === "users" && (
          <>
            <Tiles>
              <Stat label={tx("Gebruikers")} value={d.total} />
              <Stat label={tx("Actief")} value={d.active} />
              <Stat label={tx("Geblokkeerd")} value={d.blocked} />
              <Stat label={tx("Beheerders")} value={d.admins} />
              <Stat label={tx("Nieuw (30 dagen)")} value={d.new_30_days} />
              <Stat label={tx("Ingelogd (30 dagen)")} value={d.logged_in_30_days} />
            </Tiles>
            <Panel title={tx("Beheerders")}>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>{tx("E-mailadres")}</th><th>{tx("Niveau")}</th><th>{tx("Laatste inlog")}</th><th>{tx("Status")}</th></tr></thead>
                  <tbody>
                    {d.admin_accounts.map((a) => <tr key={a.email}><td>{a.email}</td><td>{a.level}</td><td>{when(a.last_login)}</td><td><span className={`badge ${a.active ? "ok" : ""}`}>{a.active ? tx("Actief") : tx("Geblokkeerd")}</span></td></tr>)}
                    {!d.admin_accounts.length && <tr><td colSpan={4} className="muted">–</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
        {d && tab === "stats" && <Stats d={d} run={run} busy={busy} />}
        {d && tab === "energy" && <Energy d={d} run={run} busy={busy} reload={reload} />}
        {d && tab === "reseller" && (
          <Panels>
            <Panel title={tx("Reseller")}>
              <span>{d.reseller.name || "–"}</span>
              <span className="muted">{d.reseller.email || "–"}</span>
              {d.reseller.url && <a href={d.reseller.url} target="_blank" rel="noopener noreferrer">{d.reseller.url}</a>}
            </Panel>
            <Panel title={<>{tx("Licentie")} <span className={`badge ${d.licence.has && !d.licence.expired ? "ok" : "warn"}`}>{!d.licence.has ? tx("Geen licentie") : d.licence.expired ? tx("Verlopen") : tx("Geldig")}</span></>}>
              <span>{tx("Klant")}: {d.licence.client || "–"}</span>
              <span>{tx("Geldig tot")}: {d.licence.valid_until || "–"}</span>
              <span className="muted">{tx("Licentienummer")}: {d.licence.number || "–"}</span>
            </Panel>
          </Panels>
        )}
        {d && tab === "ai" && (
          <>
            <small className="muted">{tx("Wat aan de eindgebruiker wordt doorberekend (met marge). De inkoopprijs staat hier niet.")}</small>
            <Tiles>
              <Stat label={tx("Deze maand")} value={money(d.month.end_user_price, d.currency)} sub={`${num(d.month.calls)} ${tx("Aanroepen")}`} />
              <Stat label={tx("Laatste 30 dagen")} value={money(d.last_30_days.end_user_price, d.currency)} sub={`${num(d.last_30_days.calls)} ${tx("Aanroepen")}`} />
              <Stat label={tx("Totaal")} value={money(d.total.end_user_price, d.currency)} sub={`${num(d.total.calls)} ${tx("Aanroepen")}`} />
            </Tiles>
            <Panel title={tx("Eindgebruikersprijs")}>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th /><th>{tx("Aanroepen")}</th><th>{tx("Tokens")}</th><th>{tx("Eindgebruikersprijs")}</th></tr></thead>
                  <tbody>
                    {[["month", "Deze maand"], ["last_30_days", "Laatste 30 dagen"], ["total", "Totaal"]].map(([k, l]) => (
                      <tr key={k}><td><strong>{tx(l)}</strong></td><td>{num(d[k].calls)}{d[k].errors ? ` (${d[k].errors} ${tx("fouten")})` : ""}</td><td>{num(d[k].tokens)}</td><td><strong>{money(d[k].end_user_price, d.currency)}</strong></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            {d.by_group_month.length > 0 && (
              <Panel title={tx("Deze maand per groep")}>
                <ul className="bar-list">
                  {(() => { const max = Math.max(0.01, ...d.by_group_month.map((g) => g.end_user_price)); return d.by_group_month.map((g) => <li key={g.group}><span className="bl-label">{g.group}</span><span className="bl-bar"><span style={{ width: `${(g.end_user_price / max) * 100}%` }} /></span><span className="bl-val">{money(g.end_user_price, d.currency)}</span></li>); })()}
                </ul>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// The "online" tab of the edit pop-up: a switch. Off = the maintenance page for visitors (administrators can still log in); on = online again. Through the API of the website.
export function SiteOnline({ site, onChanged }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  useEffect(() => {
    api(`/system/sites/${site.id}/info/?part=status`).then((s) => { setSt(s); setMsg(s.maintenance_message || ""); }).catch(setErr);
  }, [site.id]);
  const set = async (online) => {
    if (!online && !(await confirmDialog(tx("{0} offline halen? Bezoekers zien de onderhoudspagina; beheerders kunnen nog inloggen.", site.name || site.url), { okLabel: tx("Offline halen"), danger: true }))) return;
    setBusy(true); setDone(""); setErr(null);
    try { const r = await api(`/system/sites/${site.id}/online/`, { method: "POST", body: { online, message: msg } }); setSt(r); setDone(online ? tx("De website staat online.") : tx("De website staat offline.")); onChanged?.(); }
    catch (e) { setErr(e); }
    setBusy(false);
  };
  return (
    <div style={{ display: "grid", gap: ".9rem" }}>
      {err && <div className="alert">{errText(err)}</div>}
      {!st && !err && <p className="muted"><Loading /></p>}
      {st && (
        <>
          <div className="card" style={{ display: "grid", gap: ".6rem" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".8rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                <span className="st-ico" style={{ width: "2.2rem", height: "2.2rem" }}><IconGlobe /></span>
                <span style={{ display: "grid" }}>
                  <strong>{st.online ? tx("Website online") : tx("Website offline")}</strong>
                  <small className="muted">{st.site_name} · {st.version} · {st.build}</small>
                </span>
              </span>
              <label className="switch" title={st.online ? tx("Offline halen") : tx("Online zetten")}>
                <input type="checkbox" checked={!!st.online} disabled={busy} onChange={() => set(!st.online)} aria-label={tx("Website online")} />
                <span />
              </label>
            </div>
            <small className="muted">{st.online ? tx("Bezoekers kunnen de website gebruiken. Zet de schakelaar uit om de onderhoudspagina te tonen.") : tx("Bezoekers zien de onderhoudspagina. Beheerders kunnen nog inloggen. Zet de schakelaar aan om weer online te gaan.")}</small>
          </div>
          <label>{tx("Bericht voor bezoekers (optioneel)")}
            <textarea rows={2} maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={tx("Wordt getoond op de onderhoudspagina als de website offline gaat.")} />
          </label>
          {done && <div className="alert ok">{done}</div>}
        </>
      )}
    </div>
  );
}
