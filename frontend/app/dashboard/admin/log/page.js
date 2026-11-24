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

const RANK_CLASS = { 0: "", 1: "ok", 2: "", 3: "" };

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
  const clear = async () => {
    if (!(await confirmDialog(tx("Het hele logboek leegmaken? Alle regels worden verwijderd. Dit kan niet ongedaan worden gemaakt."), { okLabel: tx("Ja, leegmaken"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(true); setMsg(null);
    try { const r = await api("/log/", { method: "DELETE" }); setMsg({ ok: true, text: tx("{0} regels verwijderd.", r.removed) }); setF({ ...f, page: 1 }); load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const days = (d) => (d === 0 ? tx("Onbeperkt") : d === 30 ? tx("1 maand") : d === 90 ? tx("3 maanden") : d === 180 ? tx("6 maanden") : d === 365 ? tx("1 jaar") : d === 730 ? tx("2 jaar") : tx("{0} dagen", d));
  return (
    <>
      <h1>{tx("Logboek")}</h1>
      <p className="muted">{tx("Wie logde in of uit en de belangrijke dingen die gebeuren. Je leest de regels van je eigen rang en lager: een admin leest geen regels van een superadmin.")}</p>
      <Tabs value={tab} onChange={setTab} tabs={[["lines", "Regels"], ["settings", "Instellingen"]]} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      {tab === "lines" && (<>
        <div className="grid2" style={{ alignItems: "end" }}>
          <label>{tx("Zoeken")}<input value={f.q} onChange={set("q")} placeholder={tx("Naam, e-mailadres, adres of omschrijving")} /></label>
          <label>{tx("Soort")}
            <select value={f.category} onChange={set("category")}><option value="">{tx("Alles")}</option>{(data?.categories || []).map((c) => <option key={c} value={c}>{tx(c)}</option>)}</select>
          </label>
          <label>{tx("Gebeurtenis")}
            <select value={f.event} onChange={set("event")}><option value="">{tx("Alles")}</option>{(data?.events || []).filter((x) => !f.category || x.category === f.category).map((x) => <option key={x.key} value={x.key}>{tx(x.label)}</option>)}</select>
          </label>
          <label>{tx("Vanaf")}<input type="date" value={f.from} onChange={set("from")} /></label>
          <label>{tx("Tot en met")}<input type="date" value={f.to} onChange={set("to")} /></label>
        </div>
        <div className="log-wrap">
          <table className="log-table">
            <thead><tr><th>{tx("Tijd")}</th><th>{tx("Gebeurtenis")}</th><th>{tx("Wie")}</th><th>{tx("Over")}</th><th>{tx("Adres (IP)")}</th></tr></thead>
            <tbody>
              {(data?.results || []).map((r) => (
                <tr key={r.id}>
                  <td className="log-time">{new Date(r.at).toLocaleString()}</td>
                  <td><strong>{tx(r.label)}</strong>{r.detail && <small className="muted" style={{ display: "block" }}>{r.detail}</small>}</td>
                  <td>{r.actor || "—"}{r.email && r.actor && r.email !== r.actor && <small className="muted" style={{ display: "block" }}>{r.email}</small>}<span className={`badge ${RANK_CLASS[r.level] || ""}`}>{tx(r.rank)}</span></td>
                  <td>{r.target || "—"}</td>
                  <td className="muted">{r.ip || "—"}</td>
                </tr>
              ))}
              {data && !data.results.length && <tr><td colSpan={5} className="muted">{tx("Geen regels gevonden.")}</td></tr>}
              {!data && <tr><td colSpan={5} className="muted">{tx("Bezig…")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <small className="muted">{data ? tx("{0} regels", data.total) : ""}</small>
          <div className="row" style={{ gap: ".4rem" }}>
            <button type="button" className="btn sm" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>{tx("Vorige")}</button>
            <span className="muted">{f.page} / {pages}</span>
            <button type="button" className="btn sm" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })}>{tx("Volgende")}</button>
          </div>
        </div>
      </>)}
      {tab === "settings" && cfg && (<>
        <h3 style={{ marginBottom: 0 }}>{tx("Bewaartermijn")}</h3>
        <p className="muted" style={{ marginTop: 0 }}>{tx("Regels die ouder zijn dan deze termijn worden vanzelf verwijderd. Onbeperkt bewaart alles.")}</p>
        <div className="log-seg" role="group" aria-label={tx("Bewaartermijn")}>
          {cfg.choices.map((d) => <button type="button" key={d} className={cfg.retention_days === d ? "on" : ""} aria-pressed={cfg.retention_days === d} disabled={!cfg.can_edit || busy} onClick={() => keep(d)}>{days(d)}</button>)}
        </div>
        {!cfg.can_edit && <small className="muted">{tx("Alleen een superadmin kan de bewaartermijn wijzigen.")}</small>}
        {cfg.can_edit && (<>
          <h3 style={{ marginBottom: 0 }}>{tx("Logboek legen")}</h3>
          <p className="muted" style={{ marginTop: 0 }}>{tx("Alleen een superadmin mag het logboek leegmaken. Er blijft één regel over die zegt dat het is gedaan.")}</p>
          <div><button type="button" className="btn danger" disabled={busy} onClick={clear}>{tx("Logboek leegmaken")}</button></div>
        </>)}
      </>)}
    </>
  );
}
