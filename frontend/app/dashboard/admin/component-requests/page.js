// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { Busy } from "../../../../components/PageLoader";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";

// The component requests (superadmin+): components that a design needs and the component set does not have. A request is judged here (nieuw > beoordeling > goedgekeurd / afgewezen > gebouwd);
// it is never put in a site directly: it is built in the code with the building instruction. When it is built, the designs that wait for it are checked again.
export default function ComponentRequestsPage() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(null); // the request that is open: {..., spec, instructie}
  const [tab, setTab] = useState("request");
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api(`/component-requests/${filter ? `?status=${filter}` : ""}`).then(setData).catch((e) => setMsg({ ok: false, text: errorText(e) })), [filter]);
  useEffect(() => { load(); }, [load]);
  const show = async (r) => { setMsg(null); setTab("request"); try { const d = await api(`/component-requests/${r.id}/`); setOpen(d); setNote(d.note || ""); setTag(d.built_tag || ""); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const judge = async (status) => {
    setMsg(null);
    try { const d = await api(`/component-requests/${open.id}/`, { method: "PATCH", body: { status, note, tag } }); setOpen(d); setMsg({ ok: true, text: tx("Opgeslagen.") }); load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  if (!data) return msg ? <div className="alert">{msg.text}</div> : <Busy page />;
  const label = Object.fromEntries(data.statussen);
  return (
    <>
      <div className="page-head"><div><h1>{tx("Componentverzoeken")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("Componenten die een ontwerp nodig heeft en de component set niet heeft. Hetzelfde verzoek van meer ontwerpen en websites is één regel. Een verzoek gaat nooit direct in een site: eerst beoordelen, dan bouwen met de bouwinstructie.")}</p></div></div>
      <div className="card" style={{ padding: "1rem", display: "grid", gap: ".8rem" }}>
        <div className="row" style={{ gap: ".4rem", flexWrap: "wrap" }}>
          {[["", "Alles"], ...data.statussen].map(([k, l]) => <button type="button" key={k} className={`btn sm${filter === k ? " primary" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{tx(l)}</button>)}
        </div>
        {data.verzoeken.length === 0 ? <p className="muted">{tx("Geen verzoeken.")}</p> : (
          <div className="e2e-table-wrap"><table className="e2e-table"><thead><tr><th>{tx("Component")}</th><th>{tx("Status")}</th><th>{tx("Keer gevraagd")}</th><th>{tx("Websites")}</th><th /></tr></thead><tbody>
            {data.verzoeken.map((r) => <tr key={r.id}><td><b>{r.naam}</b> <small className="muted">{r.type}</small>{r.extends && <small className="muted" style={{ display: "block" }}>{tx("Liever uitbreiden")}: {r.extends}</small>}</td><td>{tx(label[r.status] || r.status)}</td><td>{r.votes}</td><td>{(r.sites || []).join(", ")}</td><td><button type="button" className="btn sm" onClick={() => show(r)}>{tx("Openen")}</button></td></tr>)}
          </tbody></table></div>
        )}
      </div>
      {open && (
        <div className="card" style={{ padding: "1rem", marginTop: "1rem", display: "grid", gap: ".8rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>{open.naam} <small className="muted">{open.type}</small></h2><button type="button" className="btn sm" onClick={() => setOpen(null)}>{tx("Sluiten")}</button></div>
          <Tabs value={tab} onChange={setTab} tabs={[["request", "Verzoek"], ["judge", "Beoordeling"], ["build", "Bouwinstructie"]]} />
          {tab === "request" && (
            <div style={{ display: "grid", gap: ".5rem" }}>
              <p style={{ margin: 0 }}>{open.doel}</p>
              <small className="muted">{tx("Status")}: {tx(label[open.status] || open.status)} · {open.votes}× {tx("gevraagd")} · {open.designs} {tx("ontwerpen")}</small>
              {(open.spec?.dichtstbijzijnde_bestaande || []).length > 0 && <small className="muted">{tx("Dichtstbijzijnde bestaande componenten")}: {open.spec.dichtstbijzijnde_bestaande.join(", ")}</small>}
              {open.extends && <div className="alert">{tx("Liever uitbreiden: het bestaande component {0} kan een variant krijgen.", open.extends)}</div>}
              {(open.spec?.voorgestelde_props || []).length > 0 && <div><strong>{tx("Voorgestelde props")}</strong><ul style={{ margin: ".3rem 0 0", paddingLeft: "1.1rem" }}>{open.spec.voorgestelde_props.map((p, i) => <li key={i}>{p.naam} <small className="muted">({p.type}{p.verplicht ? `, ${tx("verplicht")}` : ""})</small></li>)}</ul></div>}
              <details><summary>{tx("Voorbeeldinhoud uit het ontwerp")}</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: ".8rem" }}>{JSON.stringify(open.spec?.voorbeeldinhoud || {}, null, 2)}</pre></details>
            </div>
          )}
          {tab === "judge" && (
            <div className="form" style={{ display: "grid", gap: ".7rem" }}>
              <label>{tx("Notitie bij de beoordeling")}<textarea rows={3} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></label>
              {open.volgende.includes("gebouwd") && <label>{tx("Type van het gebouwde component")}<input value={tag} placeholder="ui-..." onChange={(e) => setTag(e.target.value)} /></label>}
              <div className="row" style={{ gap: ".4rem", flexWrap: "wrap" }}>
                {open.volgende.length === 0 && <span className="muted">{tx("Dit verzoek is klaar.")}</span>}
                {open.volgende.map((st) => <button type="button" key={st} className={`btn sm${st === "afgewezen" ? " danger" : " primary"}`} onClick={() => judge(st)}>{tx(label[st] || st)}</button>)}
              </div>
            </div>
          )}
          {tab === "build" && (
            <div style={{ display: "grid", gap: ".5rem" }}>
              <small className="muted">{tx("De vaste instructie om dit component in de code te bouwen, met tests. Kopieer hem naar Claude Code.")}</small>
              <textarea readOnly rows={18} value={open.instructie || ""} onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, monospace", fontSize: ".8rem" }} />
            </div>
          )}
          {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
        </div>
      )}
    </>
  );
}
