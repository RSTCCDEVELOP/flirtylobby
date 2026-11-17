// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { IconEdit, IconRefresh, IconTrash } from "../../../../components/Icons";
import Loading from "../../../../components/Loading";
import PlusLock from "../../../../components/PlusLock";
import { useAuth } from "../../../../components/AuthContext";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";

const when = (v) => (v ? new Date(v).toLocaleString() : "–");

// Super admin+ -> Site manager: the easy2edit websites. Every website reports itself to the easy2edit server the first time and at every login of an administrator;
// the installation that is the server shows the list here.
export default function SiteManager() {
  const { user } = useAuth();
  const plus = !!user?.is_superadmin_plus;
  const [data, setData] = useState(null);  // {me, sites}
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api("/system/sites/").then(setData).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { if (plus) load(); }, [plus, load]);
  if (!plus) return <p className="muted">{tx("Dit onderdeel is alleen voor een superadmin+.")} <PlusLock /></p>;
  if (!data) return msg ? <div className="alert">{msg.text}</div> : <p className="muted"><Loading /></p>;
  const { me, sites } = data;
  const act = async (body, ok) => {
    setBusy(body.action); setMsg(null);
    try { setData(await api("/system/sites/", { method: "POST", body })); setMsg({ ok: true, text: ok }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); await load(); }
    setBusy("");
  };
  const save = async () => {
    setBusy("edit");
    try { await api(`/system/sites/${edit.id}/`, { method: "PATCH", body: { name: edit.name, url: edit.url, notes: edit.notes, status: edit.status } }); setEdit(null); await load(); }
    catch (e) { setEdit((x) => ({ ...x, error: errorText(e) })); }
    setBusy("");
  };
  const remove = async (s) => {
    if (!(await confirmDialog(tx("{0} uit de lijst verwijderen? De website zelf blijft bestaan en meldt zich bij het volgende inloggen opnieuw.", s.name || s.url), { danger: true, okLabel: tx("Verwijderen") }))) return;
    try { await api(`/system/sites/${s.id}/`, { method: "DELETE" }); await load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const list = sites.filter((s) => !q.trim() || `${s.name} ${s.url} ${s.ip || ""} ${s.seen_ip || ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <h1>{tx("Site manager")}<PlusLock /></h1>
      <p className="muted">{tx("Elke easy2edit-website meldt zich de eerste keer bij de easy2edit-server en daarna bij elke keer dat een beheerder, superadmin of superadmin+ inlogt. De server houdt de lijst bij.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

      <div className="card" style={{ display: "grid", gap: ".7rem", marginBottom: "1rem" }}>
        <strong>{tx("Deze website")}</strong>
        <small className="muted">{tx("Meldt zich bij")} <code>{me.api_url}</code> · {me.last_ok_at ? `${tx("laatste melding")} ${when(me.last_ok_at)}` : tx("nog niet gemeld")}</small>
        {me.last_error && <div className="alert">{tx("Laatste fout")}: {me.last_error}</div>}
        <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn" disabled={!!busy} onClick={() => act({ action: "sync" }, tx("Gemeld bij de easy2edit-server."))}><IconRefresh /> {busy === "sync" ? tx("Bezig…") : tx("Nu melden")}</button>
          <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={!!me.server} disabled={!!busy} onChange={(e) => act({ action: "server", on: e.target.checked }, e.target.checked ? tx("Deze installatie is nu de site manager-server.") : tx("Deze installatie is geen site manager-server meer."))} /><span /></span>
            <span>{tx("Deze installatie is de easy2edit-server (site manager)")}<small className="muted" style={{ display: "block" }}>{tx("Alleen op de installatie die api.easy2edit.com draait: die neemt dan de meldingen van alle websites aan en toont de lijst hieronder.")}</small></span>
          </label>
        </div>
      </div>

      {me.server ? (
        <>
          <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", alignItems: "center", marginBottom: ".6rem" }}>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} style={{ maxWidth: "20rem" }} />
            <span className="muted">{list.length}/{sites.length}</span>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>{tx("Naam")}</th><th>{tx("Adres")}</th><th>{tx("IP-adres")}</th><th>{tx("versie")}</th><th>{tx("Laatste inlog")}</th><th>{tx("Status")}</th><th /></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name || "–"}</strong><br /><small className="muted">{tx("Eerste melding")} {when(s.first_seen)}</small></td>
                    <td>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url.replace(/^https?:\/\//, "")}</a> : "–"}{s.url_generated && <small className="muted" style={{ display: "block" }}>{tx("Aangemaakt door de server")}</small>}</td>
                    <td>{s.ip || "–"}{s.seen_ip && s.seen_ip !== s.ip && <small className="muted" style={{ display: "block" }}>{tx("gezien")}: {s.seen_ip}</small>}</td>
                    <td>{s.version || "–"}{s.build ? ` · ${s.build}` : ""}</td>
                    <td>{when(s.last_login_at)}{s.last_login_role && <small className="muted" style={{ display: "block" }}>{s.last_login_role} · {s.login_count}×</small>}</td>
                    <td><span className={`badge ${s.status === "active" ? "ok" : ""}`}>{s.status === "active" ? tx("Actief") : tx("Geblokkeerd")}</span><small className="muted" style={{ display: "block" }}>{when(s.last_seen)}</small></td>
                    <td className="actions">
                      <button type="button" className="btn sm" onClick={() => setEdit({ ...s })} aria-label={tx("Wijzigen")}><IconEdit /></button>{" "}
                      <button type="button" className="btn sm danger" onClick={() => remove(s)} aria-label={tx("Verwijderen")}><IconTrash /></button>
                    </td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={7} className="muted">{sites.length ? tx("Niets gevonden.") : tx("Nog geen websites gemeld.")}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="muted">{tx("De lijst met websites staat op de easy2edit-server. Zet hierboven de schakelaar aan op die installatie.")}</p>}

      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}>
          <form className="card modal form" style={{ width: "min(560px, 94vw)" }} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <h2 style={{ margin: 0 }}>{tx("Website wijzigen")}</h2>
            <label>{tx("Naam")}<input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label>{tx("Adres")}<input value={edit.url || ""} placeholder="https://naam.easy2edit.com" onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></label>
            <label>{tx("Status")}<select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">{tx("Actief")}</option><option value="blocked">{tx("Geblokkeerd")}</option></select></label>
            <label>{tx("Notities")}<textarea rows={3} value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
            {edit.error && <div className="alert">{edit.error}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setEdit(null)}>{tx("Annuleren")}</button>
              <button className="btn primary" disabled={busy === "edit"}>{tx("Opslaan")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
