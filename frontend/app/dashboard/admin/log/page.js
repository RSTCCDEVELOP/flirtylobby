// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";
import Tabs from "../../../../components/Tabs";
import { IconSearch } from "../../../../components/Icons";

// the colour of an event: green = in or out, red = failed or a malfunction, blue = something was changed
const toneOf = (e) => (e === "auth.login" || e === "auth.logout" ? "ok" : e === "auth.login_failed" || e === "system.error" ? "bad" : e === "system.reset" || e === "user.deleted" || e === "system.log_cleared" ? "warn" : "info");
const iso = (d) => d.toISOString().slice(0, 10);

// The log (Logboek): who logged in or out and the important things that happened. Every person reads the lines of their own rank and lower (an admin never reads the lines of a superadmin);
// only a superadmin changes how long the lines are kept and empties the log.
export default function LogPage() {
  const [tab, setTab] = useState("lines");
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [f, setF] = useState({ q: "", category: "", event: "", from: "", to: "", page: 1 });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(f.page), size: "50", ...(f.q ? { q: f.q } : {}), ...(f.category ? { category: f.category } : {}), ...(f.event ? { event: f.event } : {}), ...(f.from ? { from: f.from } : {}), ...(f.to ? { to: f.to } : {}) });
    api(`/log/?${qs}`).then(setData).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [f]);
  useEffect(() => { const t = setTimeout(load, f.q ? 300 : 0); return () => clearTimeout(t); }, [load, f.q]);
  useEffect(() => { api("/log/settings/").then(setCfg).catch(() => {}); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });
  const keep = async (days) => {
    setBusy(true); setMsg(null);
    try { setCfg(await api("/log/settings/", { method: "PUT", body: { retention_days: days } })); setMsg({ ok: true, text: tx("Opgeslagen. Oudere regels worden verwijderd.") }); load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const flip = async (key, on) => {  // an optional event is logged or not
    const off = new Set(cfg.disabled_events || []);
    if (on) off.delete(key); else off.add(key);
    setBusy(true); setMsg(null);
    try { setCfg(await api("/log/settings/", { method: "PUT", body: { disabled_events: [...off] } })); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const clear = async () => {
    if (!(await confirmDialog(tx("Het hele logboek leegmaken? Alle regels worden verwijderd. Dit kan niet ongedaan worden gemaakt."), { okLabel: tx("Ja, leegmaken"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(true); setMsg(null);
    try { const r = await api("/log/", { method: "DELETE" }); setMsg({ ok: true, text: tx("{0} regels verwijderd.", r.removed) }); setF({ ...f, page: 1 }); load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const period = f.from ? ([0, 1, 7, 30].find((d) => d && f.from === iso(new Date(Date.now() - (d - 1) * 864e5)) && !f.to) ?? -1) : 0;  // which quick period is on (-1 = own dates)
  const quick = (d) => setF({ ...f, from: d ? iso(new Date(Date.now() - (d - 1) * 864e5)) : "", to: "", page: 1 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const days = (d) => (d === 0 ? tx("Onbeperkt") : d === 30 ? tx("1 maand") : d === 90 ? tx("3 maanden") : d === 180 ? tx("6 maanden") : d === 365 ? tx("1 jaar") : d === 730 ? tx("2 jaar") : tx("{0} dagen", d));
  return (
    <>
      <h1>{tx("Logboek")}</h1>
      <p className="muted">{tx("Wie logde in of uit en de belangrijke dingen die gebeuren. Je leest de regels van je eigen rang en lager: een admin leest geen regels van een superadmin.")}</p>
      <Tabs value={tab} onChange={setTab} tabs={[["lines", "Regels"], ["settings", "Instellingen"]]} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      {tab === "lines" && (<>
        <div className="lg-stats">
          {[["day", tx("Regels (24 uur)"), "info"], ["logins", tx("Inlogs (24 uur)"), "ok"], ["failed", tx("Mislukt inloggen (24 uur)"), "warn"], ...(data?.can_clear ? [["errors", tx("Storingen (24 uur)"), "bad"]] : [])].map(([k, label, tone]) => (
            <div key={k} className={`lg-stat ${tone}${data?.stats?.[k] > 0 && (tone === "bad" || tone === "warn") ? " hot" : ""}`}><strong>{data?.stats ? data.stats[k] : "…"}</strong><span>{label}</span></div>
          ))}
        </div>
        <div className="lg-bar">
          <div className="lg-search"><IconSearch width={16} height={16} /><input value={f.q} onChange={set("q")} placeholder={tx("Zoek op naam, e-mailadres, adres of omschrijving")} aria-label={tx("Zoeken")} /></div>
          <select value={f.category} onChange={set("category")} aria-label={tx("Soort")}><option value="">{tx("Alle soorten")}</option>{(data?.categories || []).map((c) => <option key={c} value={c}>{tx(c)}</option>)}</select>
          <select value={f.event} onChange={set("event")} aria-label={tx("Gebeurtenis")}><option value="">{tx("Alle gebeurtenissen")}</option>{(data?.events || []).filter((x) => !f.category || x.category === f.category).map((x) => <option key={x.key} value={x.key}>{tx(x.label)}</option>)}</select>
          <div className="lg-seg" role="group" aria-label={tx("Periode")}>
            {[[0, tx("Alles")], [1, tx("24 uur")], [7, tx("7 dagen")], [30, tx("30 dagen")]].map(([d, l]) => <button type="button" key={d} className={period === d ? "on" : ""} aria-pressed={period === d} onClick={() => quick(d)}>{l}</button>)}
          </div>
          {(f.q || f.category || f.event || f.from || f.to) && <button type="button" className="btn sm" onClick={() => { setF({ q: "", category: "", event: "", from: "", to: "", page: 1 }); }}>{tx("Wis filters")}</button>}
        </div>
        <div className="lg-wrap">
          <table className="lg-table">
            <thead><tr><th>{tx("Tijd")}</th><th>{tx("Gebeurtenis")}</th><th>{tx("Wie")}</th><th>{tx("Over")}</th><th>{tx("IP-adres")}</th></tr></thead>
            <tbody>
              {(data?.results || []).map((r) => {
                const d = new Date(r.at);
                return (
                  <tr key={r.id}>
                    <td className="lg-time"><strong>{d.toLocaleDateString()}</strong><span>{d.toLocaleTimeString()}</span></td>
                    <td><span className={`lg-ev ${toneOf(r.event)}`}>{tx(r.label)}</span>{r.detail && <small className="lg-detail">{r.detail}</small>}</td>
                    <td>{r.actor || r.email ? (
                      <span className="lg-who"><span className="lg-av" aria-hidden="true">{(r.actor || r.email || "?").trim().charAt(0).toUpperCase()}</span>
                        <span><span className="lg-name">{r.actor || r.email}</span>{r.email && r.actor && r.email !== r.actor && <small>{r.email}</small>}</span>
                        <span className={`lg-rank r${r.level}`}>{tx(r.rank)}</span></span>
                    ) : <span className="muted">{tx("Systeem")}</span>}</td>
                    <td className="lg-over">{r.target || "—"}</td>
                    <td className="lg-ip">{r.ip || "—"}</td>
                  </tr>
                );
              })}
              {data && !data.results.length && <tr><td colSpan={5} className="lg-empty">{tx("Geen regels gevonden.")}</td></tr>}
              {!data && <tr><td colSpan={5} className="lg-empty">{tx("Bezig…")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="lg-foot">
          <small className="muted">{data ? tx("{0} regels", data.total) : ""}</small>
          <div className="lg-pager">
            <button type="button" className="btn sm" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>‹ {tx("Vorige")}</button>
            <span>{f.page} / {pages}</span>
            <button type="button" className="btn sm" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })}>{tx("Volgende")} ›</button>
          </div>
        </div>
      </>)}
      {tab === "settings" && cfg && (<>
        <h3 style={{ margin: ".25rem 0 0" }}>{tx("Bewaartermijn")}</h3>
        <p className="muted" style={{ margin: ".15rem 0 .5rem", fontSize: ".85rem" }}>{tx("Regels die ouder zijn dan deze termijn worden vanzelf verwijderd. Onbeperkt bewaart alles.")}</p>
        <div className="log-seg" role="group" aria-label={tx("Bewaartermijn")}>
          {cfg.choices.map((d) => <button type="button" key={d} className={cfg.retention_days === d ? "on" : ""} aria-pressed={cfg.retention_days === d} disabled={!cfg.can_edit || busy} onClick={() => keep(d)}>{days(d)}</button>)}
        </div>
        {!cfg.can_edit && <small className="muted">{tx("Alleen een superadmin kan de bewaartermijn wijzigen.")}</small>}
        <p className="muted" style={{ margin: ".6rem 0 0", fontSize: ".85rem" }}>{tx("Het logboek staat altijd aan. Fouten van de server staan er als \"Storing\" in (alleen voor superadmins) en worden ook bewaard in het bestand logs/easy2edit.log in de mappen van de website.")}</p>
        <h3 style={{ margin: "1rem 0 0" }}>{tx("Wat wordt gelogd")}</h3>
        <p className="muted" style={{ margin: ".15rem 0 0", fontSize: ".85rem" }}>{tx("Wat verplicht is, staat altijd aan: daarmee volg je een storing of een aanval en zie je wie wat deed. De rest kan een superadmin uitzetten.")}</p>
        <div className="lg-opts">
          {[...new Set((cfg.events || []).map((e) => e.category))].map((cat) => (
            <section key={cat} className="lg-opt-card">
              <h4>{tx(cat)}</h4>
              {(cfg.events || []).filter((e) => e.category === cat).map((e) => (
                <label key={e.key} className={`lg-opt${e.required ? " locked" : ""}`}>
                  <span className="switch"><input type="checkbox" checked={e.on} disabled={e.required || !cfg.can_edit || busy} onChange={(ev) => flip(e.key, ev.target.checked)} /><span /></span>
                  <span className="lg-opt-name">{tx(e.label)}</span>
                  <span className={`badge ${e.required ? "ok" : ""}`}>{e.required ? tx("Verplicht") : tx("Mag")}</span>
                </label>
              ))}
            </section>
          ))}
        </div>
        {cfg.can_edit && (<>
          <h3 style={{ margin: ".25rem 0 0" }}>{tx("Logboek legen")}</h3>
          <p className="muted" style={{ margin: ".15rem 0 .5rem", fontSize: ".85rem" }}>{tx("Alleen een superadmin mag het logboek leegmaken. Er blijft één regel over die zegt dat het is gedaan.")}</p>
          <div><button type="button" className="btn danger" disabled={busy} onClick={clear}>{tx("Logboek leegmaken")}</button></div>
        </>)}
      </>)}
    </>
  );
}
